import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  try {
    // Try v6 quote endpoint first (includes fund-specific fields)
    const url = `https://query2.finance.yahoo.com/v6/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,fundProfile`
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    })
    if (!res.ok) {
      // Fallback: try v8 finance/quote
      const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d&includePrePost=false`
      const res2 = await fetch(url2, { headers: { "User-Agent": "Mozilla/5.0" } })
      if (!res2.ok) throw new Error("Both endpoints failed")
      // v8 doesn't have morningstar data, return null
      return NextResponse.json({ ticker, morningstarRating: null, morningstarRiskRating: null, category: null })
    }
    const json = await res.json()
    const stats = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics
    const profile = json?.quoteSummary?.result?.[0]?.fundProfile

    const rating = stats?.morningStarOverallRating?.raw ?? null
    const riskRating = stats?.morningStarRiskRating?.raw ?? null
    const category = profile?.categoryName ?? stats?.categoryName ?? null

    console.log("[v0] Morningstar lookup for", ticker, "- rating:", rating, "category:", category)

    return NextResponse.json({ ticker, morningstarRating: rating, morningstarRiskRating: riskRating, category })
  } catch (err) {
    console.error("[v0] Morningstar fetch error:", err)
    return NextResponse.json({ ticker, morningstarRating: null, morningstarRiskRating: null, category: null })
  }
}
