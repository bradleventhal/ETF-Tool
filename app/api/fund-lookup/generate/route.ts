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

type CommentaryResult = { text: string; sourceUrl: string; preview: string } | null

/** Check if PDF text looks like actual commentary vs just a fact sheet / data table */
function isRealCommentary(text: string): boolean {
  const lower = text.toLowerCase()
  // Real commentary has narrative sentences -- look for commentary-specific language
  const commentarySignals = [
    "during the quarter", "quarter ended", "market environment", "we believe",
    "our view", "portfolio positioning", "looking ahead", "outlook",
    "the fund returned", "contributed to", "detracted from", "we increased",
    "we reduced", "spread tightening", "spread widening", "credit markets",
    "rate environment", "monetary policy", "the fed", "federal reserve",
    "economic growth", "inflation", "positioning the portfolio",
    "investment strategy", "manager commentary", "portfolio manager",
    "market review", "performance discussion", "quarter in review",
  ]
  let hits = 0
  for (const signal of commentarySignals) {
    if (lower.includes(signal)) hits++
  }
  // Need at least 3 commentary signals to qualify
  return hits >= 3
}

/** Search for a fund's quarterly commentary PDF via DuckDuckGo, download and parse it. */
async function fetchCommentary(ticker: string, fundName: string): Promise<CommentaryResult> {
  console.log("[v0] Searching commentary for:", ticker, fundName)

  // More targeted search queries -- specifically look for commentary, not fact sheets
  const queries = [
    `"${ticker}" quarterly commentary filetype:pdf`,
    `"${fundName}" quarterly commentary filetype:pdf`,
    `"${ticker}" "market commentary" OR "portfolio manager commentary" filetype:pdf`,
  ]

  const pdfUrlsFound: string[] = []
  const webPages: string[] = []

  for (const query of queries) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      console.log("[v0] DDG search:", query)
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html" },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const html = await res.text()

      const uddgMatches = [...html.matchAll(/uddg=([^&"']+)/gi)]
      for (const match of uddgMatches) {
        try {
          const url = decodeURIComponent(match[1])
          const urlLower = url.toLowerCase()
          // Only grab PDFs with "commentary" in the URL, skip fact sheets
          if (urlLower.endsWith(".pdf") && (urlLower.includes("comment") || urlLower.includes("quarter") || urlLower.includes("outlook") || urlLower.includes("review"))) {
            if (!pdfUrlsFound.includes(url)) pdfUrlsFound.push(url)
          } else if (urlLower.endsWith(".pdf")) {
            // Lower priority -- could be anything
            if (!pdfUrlsFound.includes(url)) pdfUrlsFound.push(url)
          } else if (urlLower.includes("commentary") || urlLower.includes("quarterly")) {
            if (!webPages.includes(url)) webPages.push(url)
          }
        } catch { /* bad URL encoding */ }
      }

      if (pdfUrlsFound.length >= 3) break
    } catch { continue }
  }

  console.log("[v0] PDF URLs found:", pdfUrlsFound.length, "Web pages:", webPages.length)

  // Try direct PDFs -- validate each one is actual commentary
  for (const url of pdfUrlsFound.slice(0, 5)) {
    const text = await fetchPdfText(url)
    if (text && isRealCommentary(text)) {
      console.log("[v0] Validated real commentary from:", url)
      const preview = text.slice(0, 300).replace(/\s+/g, " ").trim()
      return { text: text.slice(0, 6000), sourceUrl: url, preview }
    } else if (text) {
      console.log("[v0] Skipping PDF (not real commentary):", url, "- first 200 chars:", text.slice(0, 200))
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

      const allPdfLinks = [
        ...([...html.matchAll(/href=["'](https?:\/\/[^"']+\.pdf)["']/gi)].map(m => m[1])),
        ...([...html.matchAll(/href=["'](\/[^"']+\.pdf)["']/gi)].map(m => new URL(url).origin + m[1])),
      ]

      // Prioritize links with "commentary" in the URL
      allPdfLinks.sort((a, b) => {
        const aScore = a.toLowerCase().includes("comment") ? 0 : 1
        const bScore = b.toLowerCase().includes("comment") ? 0 : 1
        return aScore - bScore
      })

      for (const pdfUrl of allPdfLinks.slice(0, 5)) {
        const pdfText = await fetchPdfText(pdfUrl)
        if (pdfText && isRealCommentary(pdfText)) {
          console.log("[v0] Validated commentary via page scrape:", pdfUrl)
          const preview = pdfText.slice(0, 300).replace(/\s+/g, " ").trim()
          return { text: pdfText.slice(0, 6000), sourceUrl: pdfUrl, preview }
        }
      }
    } catch { continue }
  }

  console.log("[v0] No real commentary found for", ticker)
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
      userContent += `\n\nFUND COMPANY COMMENTARY (scraped from their quarterly PDF at ${commentary.sourceUrl} -- use this heavily to inform your analysis):\n${commentary.text}`
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

    return Response.json({
      ...parsed,
      hasCommentary: !!commentary,
      commentarySource: commentary?.sourceUrl || null,
      commentaryPreview: commentary?.preview || null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ""
    console.error("[v0] Fund lookup generate error:", msg, stack)
    return Response.json({ error: msg, stack: stack?.slice(0, 500) }, { status: 500 })
  }
}
