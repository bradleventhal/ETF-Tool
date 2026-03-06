import type { FundData } from "@/lib/fund-types"

// Raw fetch to OpenAI - completely bypasses AI SDK and Gateway
async function callOpenAI(system: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${res.status} ${err}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ""
}

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

/** Fetch a PDF from a URL (follows redirects, checks content-type) and extract its text */
async function fetchPdfText(url: string): Promise<string | null> {
  try {
    console.log("[v0] Trying PDF:", url)
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/pdf,*/*" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    })
    if (!res.ok) { console.log("[v0] PDF fetch failed:", res.status); return null }
    const contentType = res.headers.get("content-type") || ""
    const finalUrl = res.url || url
    // Accept if content-type says PDF, or URL ends in .pdf, or original URL ends in .pdf
    const isPdf = contentType.includes("pdf") || finalUrl.toLowerCase().endsWith(".pdf") || url.toLowerCase().endsWith(".pdf")
    if (!isPdf) {
      // Could be a redirect to a PDF -- check if body starts with %PDF
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 4 && buf.toString("ascii", 0, 5) === "%PDF-") {
        console.log("[v0] Detected PDF by magic bytes from:", url)
        const text = await parsePdf(buf)
        return text && text.length > 100 ? text : null
      }
      console.log("[v0] Not a PDF, content-type:", contentType, "final URL:", finalUrl)
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

/** Check if PDF text is real commentary AND is for the correct fund.
 *  STRICT: the PDF must contain the ticker (e.g. "UYLD") in the first 2000 chars. */
function isRealCommentary(text: string, ticker: string, _fundName: string): boolean {
  const lower = text.toLowerCase()
  const tickerLower = ticker.toLowerCase()

  // The PDF MUST mention this fund's ticker in the header/first section.
  // This is the only reliable way to confirm it's for the right fund.
  const headerSection = lower.slice(0, 2000)
  if (!headerSection.includes(tickerLower)) {
    // Also check the full fund name as it appears in titles (e.g. "UltraShort Income ETF")
    // Build the specific fund product name by removing the company prefix
    const fundWords = _fundName.split(/\s+/)
    // Find where the "product" part starts (after company name)
    const productKeywords = ["ultrashort", "ultra-short", "short-term", "short", "high", "total", "core", "income", "mortgage", "strategic", "floating", "enhanced", "dynamic", "flexible", "multi"]
    let productStart = 0
    for (let i = 0; i < fundWords.length; i++) {
      if (productKeywords.includes(fundWords[i].toLowerCase())) { productStart = i; break }
    }
    const productName = fundWords.slice(productStart).join(" ").toLowerCase()
    if (productName.length > 8 && headerSection.includes(productName)) {
      console.log("[v0] PDF header matches product name:", productName)
    } else {
      console.log("[v0] PDF header doesn't contain ticker", ticker, "or product name. Skipping.")
      return false
    }
  }

  // Second: check for commentary-style narrative language
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
  return hits >= 3
}

/** Extract all PDF URLs from an HTML page -- checks href, src, embed, JS redirects */
function extractPdfUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const addUrl = (raw: string) => {
    try {
      const full = raw.startsWith("http") ? raw : new URL(raw, baseUrl).href
      if (!seen.has(full)) { seen.add(full); urls.push(full) }
    } catch { /* bad URL */ }
  }

  // href="...pdf"
  for (const m of html.matchAll(/href=["']((?:https?:\/\/)?[^"']+\.pdf)["']/gi)) addUrl(m[1])
  // src="...pdf" (embed, iframe, object)
  for (const m of html.matchAll(/src=["']((?:https?:\/\/)?[^"']+\.pdf)["']/gi)) addUrl(m[1])
  // JS: window.location.replace('...pdf') or window.location = '...pdf'
  for (const m of html.matchAll(/location(?:\.replace)?\s*\(\s*['"]([^'"]+\.pdf)['"]\s*\)/gi)) addUrl(m[1])
  // Direct link in quotes ending in .pdf
  for (const m of html.matchAll(/['"]((https?:\/\/)[^'"]+\.pdf)['"]/gi)) addUrl(m[1])

  return urls
}

/** Try to find and fetch the commentary PDF for any fund.
 *  Strategy: derive the fund company domain from the fund name, crawl their site for commentary links. */
async function fetchCommentary(ticker: string, fundName: string): Promise<CommentaryResult> {
  console.log("[v0] Searching commentary for:", ticker, fundName)

  // Step 1: Derive the company domain from the fund name
  // Common patterns: "Angel Oak UltraShort Income ETF" -> "angeloakcapital.com"
  //                  "PIMCO Enhanced Short Maturity" -> "pimco.com"
  //                  "Vanguard Short-Term Bond ETF" -> "vanguard.com"
  // We try to guess the domain and then crawl common commentary paths

  // Extract the company name (everything before common fund-type words)
  const fundWords = fundName.split(/\s+/)
  const stopWords = ["fund", "etf", "trust", "portfolio", "bond", "income", "credit",
    "short", "ultra", "ultrashort", "long", "high", "low", "total", "return",
    "enhanced", "strategic", "multi", "core", "plus", "select", "active",
    "flexible", "dynamic", "floating", "rate", "term", "maturity", "duration",
    "yield", "opportunities", "securitized", "mortgage", "corporate", "government"]
  
  let companyWords: string[] = []
  for (const w of fundWords) {
    if (stopWords.includes(w.toLowerCase().replace(/[-]/g, ""))) break
    companyWords.push(w)
  }
  if (companyWords.length === 0) companyWords = fundWords.slice(0, 2)
  const companyName = companyWords.join(" ")
  console.log("[v0] Derived company name:", companyName)

  // Generate possible domains
  const slug = companyWords.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, "")).join("")
  const slugDash = companyWords.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, "")).join("-")
  const possibleDomains = [
    `${slug}.com`,
    `${slugDash}.com`,
    `${slug}capital.com`,
    `${slug}funds.com`,
    `${slug}investments.com`,
    `www.${slug}.com`,
  ]
  // Remove duplicates
  const domains = [...new Set(possibleDomains)]
  console.log("[v0] Trying domains:", domains)

  // Common paths where fund companies host commentary
  const commentaryPaths = [
    "/quarterly-fund-commentaries",
    "/insights",
    "/commentary",
    "/resources/commentary",
    "/fund-commentary",
    "/quarterly-commentary",
    "/market-insights",
    "/investment-insights",
    "/resources",
    "/etf/commentary",
  ]

  const pdfUrls: string[] = []
  const redirectPages: string[] = []

  // Step 2: Crawl each domain for commentary pages
  for (const domain of domains) {
    for (const path of commentaryPaths) {
      const url = `https://${domain}${path}`
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(6000),
          redirect: "follow",
        })
        if (!res.ok) continue
        const html = await res.text()
        console.log("[v0] Found page:", url, "length:", html.length)

        // Extract PDF links from the page
        const pdfs = extractPdfUrls(html, url)
        for (const p of pdfs) {
          if (!pdfUrls.includes(p)) pdfUrls.push(p)
        }

        // Also find links that contain "commentary" -- these might be redirect pages
        const commentaryLinks = [...html.matchAll(/href=["']([^"']+)["'][^>]*>[^<]*(?:commentary|quarterly)[^<]*/gi)]
        for (const m of commentaryLinks) {
          try {
            const linkUrl = m[1].startsWith("http") ? m[1] : new URL(m[1], url).href
            // Only follow links that could be about THIS fund
            const linkLower = linkUrl.toLowerCase()
            const tickerLower = ticker.toLowerCase()
            const nameWords = fundName.toLowerCase().split(/\s+/)
            // Check if the link URL seems relevant to this fund
            if (linkLower.includes(tickerLower) ||
                nameWords.some(w => w.length > 4 && linkLower.includes(w)) ||
                linkLower.includes("commentary")) {
              if (!redirectPages.includes(linkUrl)) redirectPages.push(linkUrl)
            }
          } catch { /* bad URL */ }
        }

        // If we found results, stop trying more paths on this domain
        if (pdfUrls.length > 0 || redirectPages.length > 0) break
      } catch { continue }
    }
    // Stop trying domains if we found something
    if (pdfUrls.length > 0 || redirectPages.length > 0) break
  }

  console.log("[v0] Direct PDFs:", pdfUrls.length, "Redirect pages:", redirectPages.length)

  // Sort redirect pages: prioritize ones whose URL contains the ticker or fund-specific terms
  const tickerLower = ticker.toLowerCase()
  const fundSlugWords = fundName.toLowerCase().split(/\s+/)
    .filter(w => w.length > 4 && !["fund", "income", "trust", "securities", "investment"].includes(w))
  redirectPages.sort((a, b) => {
    const aL = a.toLowerCase()
    const bL = b.toLowerCase()
    const aHasTicker = aL.includes(tickerLower) ? 0 : 1
    const bHasTicker = bL.includes(tickerLower) ? 0 : 1
    if (aHasTicker !== bHasTicker) return aHasTicker - bHasTicker
    const aNameHits = fundSlugWords.filter(w => aL.includes(w)).length
    const bNameHits = fundSlugWords.filter(w => bL.includes(w)).length
    return bNameHits - aNameHits // more name hits = higher priority
  })
  console.log("[v0] Sorted redirect pages:", redirectPages.slice(0, 4))

  // Step 3: Follow redirect pages -- these often have embedded PDFs in <embed> or JS
  for (const url of redirectPages.slice(0, 6)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      })
      if (!res.ok) continue
      const ct = res.headers.get("content-type") || ""

      // If the redirect resolved directly to a PDF
      if (ct.includes("pdf")) {
        const buffer = Buffer.from(await res.arrayBuffer())
        const text = await parsePdf(buffer)
        if (text && isRealCommentary(text, ticker, fundName)) {
          const preview = text.slice(0, 300).replace(/\s+/g, " ").trim()
          return { text: text.slice(0, 6000), sourceUrl: url, preview }
        }
        continue
      }

      // Otherwise parse HTML for embedded PDF links
      const html = await res.text()
      const embeddedPdfs = extractPdfUrls(html, url)
      console.log("[v0] Redirect page", url, "has", embeddedPdfs.length, "embedded PDFs")
      for (const pdfUrl of embeddedPdfs) {
        if (!pdfUrls.includes(pdfUrl)) pdfUrls.unshift(pdfUrl) // high priority
      }
    } catch { continue }
  }

  // Step 4: Download and validate all found PDFs
  // Prioritize URLs with ticker or "commentary" in them
  pdfUrls.sort((a, b) => {
    const aL = a.toLowerCase()
    const bL = b.toLowerCase()
    const aScore = (aL.includes(tickerLower) ? 0 : 3) + (aL.includes("comment") ? 0 : 2) + (aL.includes("quarter") ? 0 : 1)
    const bScore = (bL.includes(tickerLower) ? 0 : 3) + (bL.includes("comment") ? 0 : 2) + (bL.includes("quarter") ? 0 : 1)
    return aScore - bScore
  })

  console.log("[v0] Total PDF URLs to try:", pdfUrls.length)
  for (const url of pdfUrls.slice(0, 8)) {
    const text = await fetchPdfText(url)
    if (text && isRealCommentary(text, ticker, fundName)) {
      console.log("[v0] Validated commentary from:", url)
      const preview = text.slice(0, 300).replace(/\s+/g, " ").trim()
      return { text: text.slice(0, 6000), sourceUrl: url, preview }
    }
  }

  console.log("[v0] No commentary found for", ticker)
  return null
}

const SYSTEM_PROMPT = `You are an expert fixed income analyst. You will receive a fund's data and possibly commentary scraped from the fund company's quarterly PDF.

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

    const text = await callOpenAI(SYSTEM_PROMPT, userContent)

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
