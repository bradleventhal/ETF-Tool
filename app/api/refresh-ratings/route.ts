import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

async function fetchRating(ticker: string): Promise<{ rating: number | null; category: string | null }> {
  // Try Yahoo Finance v10 API -- most reliable for star ratings
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=fundProfile,defaultKeyStatistics`
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const json = await res.json()
      const result = json?.quoteSummary?.result?.[0]
      const cat = result?.fundProfile?.categoryName || null
      const rawRating = result?.defaultKeyStatistics?.morningStarOverallRating?.raw
      const rating = rawRating >= 1 && rawRating <= 5 ? rawRating : null
      if (rating || cat) return { rating, category: cat }
    }
  } catch { /* continue to next source */ }

  // Fallback: try v6
  try {
    const url = `https://query1.finance.yahoo.com/v6/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=fundProfile,defaultKeyStatistics`
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const json = await res.json()
      const result = json?.quoteSummary?.result?.[0]
      const cat = result?.fundProfile?.categoryName || null
      const rawRating = result?.defaultKeyStatistics?.morningStarOverallRating?.raw
      const rating = rawRating >= 1 && rawRating <= 5 ? rawRating : null
      if (rating || cat) return { rating, category: cat }
    }
  } catch { /* continue */ }

  return { rating: null, category: null }
}

export async function POST() {
  const supabase = createClient()

  // Get all tickers
  const { data: funds, error: fetchErr } = await supabase
    .from("funds")
    .select("ticker, morningstar_rating, morningstar_category")
    .order("ticker")

  if (fetchErr || !funds) {
    return NextResponse.json({ error: fetchErr?.message ?? "No funds" }, { status: 500 })
  }

  const results: { ticker: string; oldRating: number | null; newRating: number | null; category: string | null }[] = []

  // Process in batches of 5 to avoid rate limiting
  const BATCH = 5
  for (let i = 0; i < funds.length; i += BATCH) {
    const batch = funds.slice(i, i + BATCH)
    const fetched = await Promise.all(
      batch.map(async (f) => {
        const { rating, category } = await fetchRating(f.ticker)
        return { ticker: f.ticker, oldRating: f.morningstar_rating, rating, category }
      })
    )

    // Update DB for each fund that got a result
    for (const f of fetched) {
      const updates: Record<string, unknown> = {}
      if (f.rating != null) updates.morningstar_rating = f.rating
      if (f.category != null) updates.morningstar_category = f.category

      if (Object.keys(updates).length > 0) {
        await supabase.from("funds").update(updates).eq("ticker", f.ticker)
      }

      results.push({
        ticker: f.ticker,
        oldRating: f.oldRating,
        newRating: f.rating ?? f.oldRating,
        category: f.category,
      })
    }

    // Small delay between batches
    if (i + BATCH < funds.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const updated = results.filter(r => r.newRating !== r.oldRating).length
  return NextResponse.json({
    success: true,
    total: results.length,
    updated,
    results,
  })
}
