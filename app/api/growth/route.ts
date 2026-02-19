import { NextRequest, NextResponse } from "next/server"

// Yahoo Finance v8 chart endpoint -- returns adjusted close (dividends reinvested)
// For ETFs this is "growth with dividend"; for mutual funds it's NAV-based growth
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tickers = searchParams.get("tickers") // comma separated
  const start = searchParams.get("start")     // YYYY-MM-DD
  const end = searchParams.get("end")         // YYYY-MM-DD

  if (!tickers || !start || !end) {
    return NextResponse.json({ error: "tickers, start, end required" }, { status: 400 })
  }

  const tickerList = tickers.split(",").map(t => t.trim().toUpperCase()).slice(0, 2)
  const startTs = Math.floor(new Date(start).getTime() / 1000)
  const endTs = Math.floor(new Date(end).getTime() / 1000)

  try {
    const results = await Promise.all(
      tickerList.map(async (ticker) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${startTs}&period2=${endTs}&interval=1d&includeAdjustedClose=true`
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
        })
        if (!res.ok) throw new Error(`Yahoo returned ${res.status} for ${ticker}`)
        const json = await res.json()
        const result = json.chart?.result?.[0]
        if (!result) throw new Error(`No data for ${ticker}`)

        const timestamps = result.timestamp as number[]
        const adjClose = result.indicators?.adjclose?.[0]?.adjclose as number[] | undefined
        const closes = result.indicators?.quote?.[0]?.close as number[]

        // Use adjusted close (dividends reinvested) if available, else regular close
        const prices = adjClose ?? closes
        if (!timestamps || !prices) throw new Error(`Missing price data for ${ticker}`)

        // Build date -> price pairs, skip nulls
        const series: { date: string; price: number }[] = []
        for (let i = 0; i < timestamps.length; i++) {
          if (prices[i] == null) continue
          const d = new Date(timestamps[i] * 1000)
          series.push({
            date: d.toISOString().slice(0, 10),
            price: prices[i],
          })
        }
        return { ticker, series }
      })
    )

    // Align dates: only keep dates where both funds have data
    if (results.length === 2) {
      const setA = new Set(results[0].series.map(s => s.date))
      const setB = new Set(results[1].series.map(s => s.date))
      const common = new Set([...setA].filter(d => setB.has(d)))
      for (const r of results) {
        r.series = r.series.filter(s => common.has(s.date))
      }
    }

    // Normalize to cumulative % growth from first data point
    const normalized = results.map(r => {
      if (r.series.length === 0) return { ticker: r.ticker, data: [] }
      const base = r.series[0].price
      return {
        ticker: r.ticker,
        data: r.series.map(s => ({
          date: s.date,
          growth: ((s.price - base) / base) * 100,
        })),
      }
    })

    return NextResponse.json({ funds: normalized })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
