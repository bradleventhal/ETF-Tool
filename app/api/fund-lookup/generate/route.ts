import OpenAI from "openai"
import type { FundData } from "@/lib/fund-types"

export const maxDuration = 60

function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) || v === 0 ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Dynamically import pdf-parse only when needed (avoids startup crash) */
async function parsePdf(buffer: Buffer): Promise<string | null> {
  try {
    const mod = await import("pdf-parse")
    const pdfParse = mod.default || mod
    const data = await pdfParse(buffer)
    return data.text?.trim() || null
  } catch (err) {
    console.error("[v0] pdf-parse error:", err)
    return null
  }
}

/** Fetch a PDF from a URL and extract its text */
async function fetchPdfText(url: string): Promise<string | null> {
  try {
    console.log("[v0] Trying PDF:", url)
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/pdf,*/*" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    })
    if (!res.ok) { console.log("[v0] PDF fetch failed:", res.status); return null }
    const contentType = res.headers.get("content-type") || ""
    if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      console.log("[v0] Not a PDF, content-type:", contentType)
      return null
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    console.log("[v0] PDF downloaded, size:", buffer.length)
    const text = await parsePdf(buffer)
    if (text && text.length > 100) {
      console.log("[v0] PDF parsed, text length:", text.length)
      return text
    }
    return null
  } catch (err) {
    console.error("[v0] fetchPdfText error:", err)
    return null
  }
}

/** Search for a fund's quarterly commentary PDF via DuckDuckGo, download and parse it. */
async function fetchCommentary(ticker: string, fundName: string): Promise<string | null> {
  console.log("[v0] Searching commentary for:", ticker, fundName)

  const queries = [
    `${ticker} ${fundName} quarterly commentary filetype:pdf`,
    `"${ticker}" fund commentary pdf`,
    `${fundName} quarterly report pdf`,
  ]

  const pdfUrlsFound: string[] = []
  const webPages: string[] = []

  for (const query of queries) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      console.log("[v0] DuckDuckGo search:", query)
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html" },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) { console.log("[v0] DDG returned:", res.status); continue }
      const html = await res.text()
      console.log("[v0] DDG response length:", html.length)

      // Extract uddg redirect URLs (DuckDuckGo wraps all result links)
      const uddgMatches = [...html.matchAll(/uddg=([^&"']+)/gi)]
      console.log("[v0] Found", uddgMatches.length, "uddg links")

      for (const match of uddgMatches) {
        try {
          const url = decodeURIComponent(match[1])
          if (url.toLowerCase().endsWith(".pdf")) {
            if (!pdfUrlsFound.includes(url)) pdfUrlsFound.push(url)
          } else if (url.includes("commentary") || url.includes("quarterly") || url.includes("report") || url.includes("insights")) {
            if (!webPages.includes(url)) webPages.push(url)
          }
        } catch { /* bad URL encoding */ }
      }

      if (pdfUrlsFound.length >= 2) break
    } catch (err) { console.error("[v0] DDG search error:", err); continue }
  }

  console.log("[v0] PDF URLs found:", pdfUrlsFound.length, "Web pages:", webPages.length)

  // Try direct PDFs first
  for (const url of pdfUrlsFound.slice(0, 5)) {
    const text = await fetchPdfText(url)
    if (text) {
      console.log("[v0] Got commentary from PDF:", url)
      return text.slice(0, 6000)
    }
  }

  // Scrape web pages for PDF links
  for (const url of webPages.slice(0, 3)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const html = await res.text()

      const pdfLinks = [...html.matchAll(/href=["'](https?:\/\/[^"']+\.pdf)["']/gi)]
      for (const m of pdfLinks.slice(0, 3)) {
        const pdfText = await fetchPdfText(m[1])
        if (pdfText) return pdfText.slice(0, 6000)
      }

      const relLinks = [...html.matchAll(/href=["'](\/[^"']+\.pdf)["']/gi)]
      const baseUrl = new URL(url).origin
      for (const m of relLinks.slice(0, 3)) {
        const pdfText = await fetchPdfText(baseUrl + m[1])
        if (pdfText) return pdfText.slice(0, 6000)
      }
    } catch { continue }
  }

  console.log("[v0] No commentary found for", ticker)
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ""
    console.error("[v0] Fund lookup generate error:", msg, stack)
    return Response.json({ error: msg, stack: stack?.slice(0, 500) }, { status: 500 })
  }
}
