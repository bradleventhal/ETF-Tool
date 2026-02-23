import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,fundProfile`
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`)
    const json = await res.json()
    const stats = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics
    const profile = json?.quoteSummary?.result?.[0]?.fundProfile

    const rating = stats?.morningStarOverallRating?.raw ?? null
    const riskRating = stats?.morningStarRiskRating?.raw ?? null
    const category = profile?.categoryName ?? stats?.categoryName ?? null

    return NextResponse.json({ ticker, morningstarRating: rating, morningstarRiskRating: riskRating, category })
  } catch {
    return NextResponse.json({ ticker, morningstarRating: null, morningstarRiskRating: null, category: null })
  }
}
