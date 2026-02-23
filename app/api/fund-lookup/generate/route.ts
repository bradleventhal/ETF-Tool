import OpenAI from "openai"
import type { FundData } from "@/lib/fund-types"

export const maxDuration = 60

function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) || v === 0 ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }

/** Attempt to scrape commentary/insights from the fund company's website */
async function fetchCommentary(ticker: string, fundName: string): Promise<string | null> {
  // Known fund family commentary URLs
  const commentaryUrls: string[] = []

  const nameLower = fundName.toLowerCase()
  if (nameLower.includes("angel oak")) {
    commentaryUrls.push(
      `https://www.angeloakcapital.com/strategies`,
      `https://www.angeloakcapital.com/insights`,
    )
  } else if (nameLower.includes("pimco")) {
    commentaryUrls.push(`https://www.pimco.com/us/en/investments/mutual-funds/${ticker.toLowerCase()}`)
  } else if (nameLower.includes("blackrock") || nameLower.includes("ishares")) {
    commentaryUrls.push(`https://www.blackrock.com/us/individual/products/fund-details/${ticker.toLowerCase()}`)
  } else if (nameLower.includes("vanguard")) {
    commentaryUrls.push(`https://investor.vanguard.com/investment-products/mutual-funds/profile/${ticker.toLowerCase()}`)
  } else if (nameLower.includes("fidelity")) {
    commentaryUrls.push(`https://fundresearch.fidelity.com/mutual-funds/summary/${ticker}`)
  } else if (nameLower.includes("jpmorgan") || nameLower.includes("jp morgan")) {
    commentaryUrls.push(`https://am.jpmorgan.com/us/en/asset-management/adv/products/fund-details/${ticker.toLowerCase()}`)
  } else if (nameLower.includes("lord abbett")) {
    commentaryUrls.push(`https://www.lordabbett.com/en-us/financial-advisor/investments/mutual-funds/${ticker.toLowerCase()}.html`)
  } else if (nameLower.includes("doubleline")) {
    commentaryUrls.push(`https://doubleline.com/funds/`)
  }

  // Also try Morningstar analysis page as a universal fallback
  commentaryUrls.push(`https://www.morningstar.com/funds/xnas/${ticker.toLowerCase()}/quote`)

  for (const url of commentaryUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const html = await res.text()

      // Strip HTML tags and extract readable text
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()

      // Take first 4000 chars of meaningful content
      if (text.length > 200) {
        return text.slice(0, 4000)
      }
    } catch {
      continue
    }
  }
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
