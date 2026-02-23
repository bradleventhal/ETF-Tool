import OpenAI from "openai"
// @ts-expect-error pdf-parse has no types
import pdfParse from "pdf-parse"
import type { FundData } from "@/lib/fund-types"

export const maxDuration = 60

function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) || v === 0 ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Try to fetch a PDF from a URL and extract its text */
async function fetchPdfText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/pdf,*/*" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    })
    if (!res.ok) return null
    const contentType = res.headers.get("content-type") || ""
    // Must be a PDF
    if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const data = await pdfParse(buffer)
    const text = data.text?.trim()
    return text && text.length > 100 ? text : null
  } catch {
    return null
  }
}

/** Find and extract text from the fund's quarterly commentary PDF */
async function fetchCommentary(ticker: string, fundName: string): Promise<string | null> {
  const nameLower = fundName.toLowerCase()

  // Build list of known PDF URLs based on fund family
  const pdfUrls: string[] = []

  if (nameLower.includes("angel oak")) {
    // Angel Oak hosts PDFs at wp-content/uploads with fund name patterns
    const fundSlug = nameLower.includes("ultrashort") && nameLower.includes("etf") ? "UltraShort-Income-ETF"
      : nameLower.includes("ultrashort") ? "UltraShort-Income-Fund"
      : nameLower.includes("multi-strategy") || nameLower.includes("multistrategy") ? "Multi-Strategy-Income-Fund"
      : nameLower.includes("strategic credit") ? "Strategic-Credit-Fund"
      : nameLower.includes("income etf") ? "Income-ETF"
      : nameLower.includes("high yield") ? "High-Yield-Opportunities-ETF"
      : nameLower.includes("mortgage") ? "Mortgage-Backed-Securities-ETF"
      : nameLower.includes("total return") ? "Total-Return-ETF"
      : null

    if (fundSlug) {
      // Try recent quarterly commentary patterns
      const quarters = ["Q4-2025", "Q3-2025", "Q2-2025", "Q1-2025", "Q4-2024", "Q3-2024"]
      for (const q of quarters) {
        pdfUrls.push(`https://angeloakcapital.com/wp-content/uploads/Angel-Oak-${fundSlug}-Commentary-${q}.pdf`)
        pdfUrls.push(`https://angeloakcapital.com/wp-content/uploads/AOCA-${fundSlug}-Commentary-${q}.pdf`)
        pdfUrls.push(`https://angeloakcapital.com/wp-content/uploads/${fundSlug}-Commentary-${q}.pdf`)
      }
    }
    // Also try market outlook
    pdfUrls.push("https://angeloakcapital.com/wp-content/uploads/AOCA-2025-Mid-Year-Outlook.pdf")
  } else if (nameLower.includes("pimco")) {
    pdfUrls.push(`https://www.pimco.com/handlers/PIMCOFundFactSheetHandler.ashx?ticker=${ticker}`)
  }

  // Try each PDF URL
  for (const url of pdfUrls) {
    const text = await fetchPdfText(url)
    if (text) {
      console.log("[v0] Found PDF commentary at:", url, "- length:", text.length)
      return text.slice(0, 6000) // First 6000 chars should capture the meat
    }
  }

  // Fallback: try to find the fund's fact sheet / profile page on the company website
  const fallbackUrls: string[] = []
  if (nameLower.includes("angel oak")) {
    fallbackUrls.push("https://angeloakcapital.com/quarterly-fund-commentaries")
  }
  fallbackUrls.push(`https://www.etf.com/${ticker.toUpperCase()}`)

  for (const url of fallbackUrls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const html = await res.text()

      // Look for PDF links in the page
      const pdfLinks = [...html.matchAll(/href=["'](https?:\/\/[^"']+\.pdf)["']/gi)]
      for (const match of pdfLinks.slice(0, 3)) {
        const pdfText = await fetchPdfText(match[1])
        if (pdfText) {
          console.log("[v0] Found PDF via link scrape:", match[1])
          return pdfText.slice(0, 6000)
        }
      }

      // Also check for relative PDF links
      const relPdfLinks = [...html.matchAll(/href=["'](\/[^"']+\.pdf)["']/gi)]
      const baseUrl = new URL(url).origin
      for (const match of relPdfLinks.slice(0, 3)) {
        const pdfText = await fetchPdfText(baseUrl + match[1])
        if (pdfText) {
          console.log("[v0] Found PDF via relative link:", baseUrl + match[1])
          return pdfText.slice(0, 6000)
        }
      }
    } catch { continue }
  }

  console.log("[v0] No commentary PDF found for", ticker)
  return null
}

const SYSTEM_PROMPT = `You are an expert fixed income analyst at Angel Oak Capital Advisors. You will receive a fund's data and possibly commentary scraped from the fund company's website.

Return ONLY valid JSON with this exact structure:
{
  "performanceDrivers": ["string", ...],
  "tailwinds": ["string", ...],
  "headwinds": ["string", ...],
  "positioning": "string"
}

Rules:
- If real commentary is provided, use it heavily -- summarize the fund manager's actual views, positioning changes, and market outlook
- performanceDrivers: 2-4 bullets explaining what's driving this fund's returns (sector bets, duration positioning, credit selection, yield advantage)
- tailwinds: 2-3 bullets on macro/market factors currently working in the fund's favor
- headwinds: 2-3 bullets on risks, market conditions, or structural factors that could drag performance
- positioning: 1-2 sentence summary of where this fund fits in the market and who it's for
- Be specific with numbers from the data. Reference actual allocations, yields, duration.
- Write like a senior PM briefing the sales desk -- direct, no fluff, no hedging language.
- Every bullet should be 1-2 sentences max.`

function buildDataPayload(fund: FundData): string {
  const lines: string[] = []
  lines.push(`Fund: ${fund.ticker} - ${fund.name}`)
  lines.push(`As of: ${fund.asOfDate}`)
  lines.push("")
  lines.push("KEY STATS:")
  lines.push(`  30-Day SEC Yield: ${fPct(fund.secYield)}`)
  lines.push(`  Distribution Yield: ${fPct(fund.distributionYield)}`)
  lines.push(`  YTW/YTM: ${fPct(fund.ytwYtm)}`)
  lines.push(`  Duration: ${fNum(fund.duration)} yrs`)
  lines.push(`  Std Deviation: ${fNum(fund.stdDev)}`)
  lines.push(`  Sharpe Ratio: ${fNum(fund.sharpe)}`)
  lines.push(`  Expense Ratio: ${fPct(fund.expense)}`)
  lines.push("")
  lines.push("PERFORMANCE:")
  lines.push(`  YTD: ${fPct(fund.ytd)}`)
  lines.push(`  1 Year: ${fPct(fund.oneYear)}`)
  lines.push(`  3 Year (ann.): ${fPct(fund.threeYear)}`)
  lines.push(`  Since Inception: ${fPct(fund.commonInception)}`)
  lines.push("")
  lines.push("SECTOR ALLOCATION:")
  const sectors = [
    ["Non-Agency RMBS", fund.nonAgencyRmbs], ["Agency RMBS", fund.agencyRmbs],
    ["ABS", fund.abs], ["CLO", fund.clo], ["CMBS", fund.cmbs],
    ["Corporate Credit", fund.corporateCredit], ["Government/Cash", fund.governmentCash], ["Other", fund.other],
  ] as [string, number | null][]
  sectors.forEach(([label, val]) => { if (nz(val) > 0.005) lines.push(`  ${label}: ${fPct(val, 1)}`) })
  lines.push("")
  lines.push("CREDIT QUALITY:")
  const credits = [
    ["AAA", fund.aaa], ["AA", fund.aa], ["A", fund.a], ["BBB", fund.bbb],
    ["BB", fund.bb], ["B", fund.b], ["CCC", fund.ccc], ["Below CCC", fund.belowCcc],
  ] as [string, number | null][]
  credits.forEach(([label, val]) => { if (nz(val) > 0.005) lines.push(`  ${label}: ${fPct(val, 1)}`) })
  return lines.join("\n")
}

export async function POST(req: Request) {
  try {
    const { fund } = (await req.json()) as { fund: FundData }
    if (!fund || !fund.ticker) {
      return Response.json({ error: "Missing fund data" }, { status: 400 })
    }

    // Fetch commentary in parallel with building data payload
    const [commentary, dataPayload] = await Promise.all([
      fetchCommentary(fund.ticker, fund.name),
      Promise.resolve(buildDataPayload(fund)),
    ])

    let userContent = `Generate the fund analysis for ${fund.ticker}.\n\nDATA:\n${dataPayload}`
    if (commentary) {
      userContent += `\n\nFUND COMPANY COMMENTARY (scraped from their website -- use this heavily):\n${commentary}`
    }

    const openai = new OpenAI()

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    })

    const text = completion.choices[0]?.message?.content || ""

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned)

    return Response.json({ ...parsed, hasCommentary: !!commentary })
  } catch (err) {
    console.error("[v0] Fund lookup generate error:", err)
    return Response.json({ error: "Failed to generate fund analysis" }, { status: 500 })
  }
}
