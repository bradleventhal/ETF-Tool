import { NextRequest, NextResponse } from "next/server"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

async function tryYahooV10(ticker: string): Promise<{ rating: number | null; category: string | null }> {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=fundProfile,defaultKeyStatistics`
  const res = await fetch(url, { headers: { "User-Agent": UA } })
  if (!res.ok) return { rating: null, category: null }
  const json = await res.json()
  const result = json?.quoteSummary?.result?.[0]
  const cat = result?.fundProfile?.categoryName || null
  const rawRating = result?.defaultKeyStatistics?.morningStarOverallRating?.raw
  const rating = rawRating >= 1 && rawRating <= 5 ? rawRating : null
  console.log("[v0] Yahoo v10 result for", ticker, "rating:", rating, "category:", cat)
  return { rating, category: cat }
}

async function tryYahooV6(ticker: string): Promise<{ rating: number | null; category: string | null }> {
  const url = `https://query1.finance.yahoo.com/v6/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=fundProfile,defaultKeyStatistics`
  const res = await fetch(url, { headers: { "User-Agent": UA } })
  if (!res.ok) return { rating: null, category: null }
  const json = await res.json()
  const result = json?.quoteSummary?.result?.[0]
  const cat = result?.fundProfile?.categoryName || null
  const rawRating = result?.defaultKeyStatistics?.morningStarOverallRating?.raw
  const rating = rawRating >= 1 && rawRating <= 5 ? rawRating : null
  console.log("[v0] Yahoo v6 result for", ticker, "rating:", rating, "category:", cat)
  return { rating, category: cat }
}

async function tryMorningstarScrape(ticker: string): Promise<{ rating: number | null; category: string | null }> {
  const searchUrl = `https://www.morningstar.com/search?query=${encodeURIComponent(ticker)}`
  const res = await fetch(searchUrl, {
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
  })
  if (!res.ok) return { rating: null, category: null }
  const html = await res.text()

  const ratingMatch = html.match(/"starRating"\s*:\s*(\d)/i)
    || html.match(/"overallRating"\s*:\s*(\d)/i)
    || html.match(/"performanceRating"\s*:\s*(\d)/i)
  const rawRating = ratingMatch ? parseInt(ratingMatch[1]) : null
  const rating = rawRating && rawRating >= 1 && rawRating <= 5 ? rawRating : null

  const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/i)
  const category = catMatch ? catMatch[1] : null
  console.log("[v0] Morningstar scrape result for", ticker, "rating:", rating, "category:", category)
  return { rating, category }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  let rating: number | null = null
  let category: string | null = null

  // Try multiple sources in parallel
  try {
    const [yahoo10, yahoo6, mstar] = await Promise.allSettled([
      tryYahooV10(ticker),
      tryYahooV6(ticker),
      tryMorningstarScrape(ticker),
    ])

    // Merge results: prefer Yahoo for rating (structured data), Morningstar for category
    for (const result of [yahoo10, yahoo6, mstar]) {
      if (result.status === "fulfilled") {
        if (!rating && result.value.rating) rating = result.value.rating
        if (!category && result.value.category) category = result.value.category
      }
    }
  } catch (err) {
    console.error("[v0] All sources failed for", ticker, err)
  }

  console.log("[v0] Final morningstar result:", ticker, "rating:", rating, "category:", category)
  return NextResponse.json({ ticker, morningstarRating: rating, category })
}
