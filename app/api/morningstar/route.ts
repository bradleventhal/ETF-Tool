import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  try {
    // Scrape Morningstar search page to get the star rating
    const searchUrl = `https://www.morningstar.com/search?query=${encodeURIComponent(ticker)}`
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    })

    if (!res.ok) throw new Error(`Morningstar returned ${res.status}`)
    const html = await res.text()

    // Look for star rating pattern in the HTML
    const ratingMatch = html.match(/"starRating"\s*:\s*(\d)/i)
      || html.match(/"overallRating"\s*:\s*(\d)/i)
      || html.match(/"performanceRating"\s*:\s*(\d)/i)
      || html.match(/rating["\s]*[:=]\s*(\d)/i)
      || html.match(/(\d)\s*star/i)
      || html.match(/mstar-rating["\s:]+(\d)/i)

    const rating = ratingMatch ? parseInt(ratingMatch[1]) : null
    let validRating = rating && rating >= 1 && rating <= 5 ? rating : null

    // Also try to extract category from Morningstar HTML
    const catMatch = html.match(/"categoryName"\s*:\s*"([^"]+)"/i)
    let category = catMatch ? catMatch[1] : null

    // Use Yahoo Finance as fallback for both rating and category
    if (!validRating || !category) {
      try {
        const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=fundProfile,defaultKeyStatistics`
        const yahooRes = await fetch(yahooUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        })
        if (yahooRes.ok) {
          const yahooJson = await yahooRes.json()
          const result = yahooJson?.quoteSummary?.result?.[0]
          if (!category) {
            const yahooCat = result?.fundProfile?.categoryName
            if (yahooCat) category = yahooCat
          }
          if (!validRating) {
            const yahooRating = result?.defaultKeyStatistics?.morningStarOverallRating?.raw
              || result?.defaultKeyStatistics?.morningStarRiskRating?.raw
            if (yahooRating && yahooRating >= 1 && yahooRating <= 5) validRating = yahooRating
          }
        }
      } catch {
        // Yahoo fallback failed, that's fine
      }
    }

    console.log("[v0] Morningstar result:", ticker, "rating:", validRating, "category:", category)
    return NextResponse.json({ ticker, morningstarRating: validRating, category })
  } catch (err) {
    console.error("[v0] Morningstar fetch error:", err)
    // Even if Morningstar fails entirely, try Yahoo for both
    try {
      const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=fundProfile,defaultKeyStatistics`
      const yahooRes = await fetch(yahooUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      })
      if (yahooRes.ok) {
        const yahooJson = await yahooRes.json()
        const result = yahooJson?.quoteSummary?.result?.[0]
        const yahooCat = result?.fundProfile?.categoryName || null
        const yahooRating = result?.defaultKeyStatistics?.morningStarOverallRating?.raw || null
        const validYahooRating = yahooRating && yahooRating >= 1 && yahooRating <= 5 ? yahooRating : null
        if (yahooCat || validYahooRating) {
          return NextResponse.json({ ticker, morningstarRating: validYahooRating, category: yahooCat })
        }
      }
    } catch { /* ignore */ }
    return NextResponse.json({ ticker, morningstarRating: null, category: null })
  }
}
