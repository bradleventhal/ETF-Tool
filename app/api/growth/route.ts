import { NextRequest, NextResponse } from "next/server"

// Fetch daily close prices AND dividend events, then compute total return
// with dividends reinvested at ex-date (matches Morningstar "Growth wDiv")
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tickers = searchParams.get("tickers")
  const start = searchParams.get("start")
  const end = searchParams.get("end")

  if (!tickers || !start || !end) {
    return NextResponse.json({ error: "tickers, start, end required" }, { status: 400 })
  }

  const tickerList = tickers.split(",").map(t => t.trim().toUpperCase()).slice(0, 2)
  // Fetch a few days before start so we have a base price on or before the start date
  const bufferStart = new Date(start)
  bufferStart.setDate(bufferStart.getDate() - 10)
  const startTs = Math.floor(bufferStart.getTime() / 1000)
  const endTs = Math.floor(new Date(end).getTime() / 1000)

  try {
    const results = await Promise.all(
      tickerList.map(async (ticker) => {
        // Fetch prices + dividends in one call
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${startTs}&period2=${endTs}&interval=1d&events=div`
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
        })
        if (!res.ok) throw new Error(`Yahoo returned ${res.status} for ${ticker}`)
        const json = await res.json()
        const result = json.chart?.result?.[0]
        if (!result) throw new Error(`No data for ${ticker}`)

        const timestamps = result.timestamp as number[]
        const closes = result.indicators?.quote?.[0]?.close as number[]
        if (!timestamps || !closes) throw new Error(`Missing price data for ${ticker}`)

        // Build date -> close map
        const priceMap: Map<string, number> = new Map()
        for (let i = 0; i < timestamps.length; i++) {
          if (closes[i] == null) continue
          const d = new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
          priceMap.set(d, closes[i])
        }

        // Build dividend map: date -> amount per share
        const divMap: Map<string, number> = new Map()
        const divEvents = result.events?.dividends
        if (divEvents) {
          for (const key of Object.keys(divEvents)) {
            const ev = divEvents[key]
            const d = new Date(ev.date * 1000).toISOString().slice(0, 10)
            divMap.set(d, ev.amount)
          }
        }

        // Sort dates and find the first date on or after the requested start
        const allDates = [...priceMap.keys()].sort()
        const startIdx = allDates.findIndex(d => d >= start)
        if (startIdx === -1) throw new Error(`No data for ${ticker} in range`)
        const dates = allDates.slice(startIdx)

        // Compute total return with dividend reinvestment
        // Start with 1 "share" worth of investment at base price
        const basePrice = priceMap.get(dates[0])!
        let shares = 1.0
        let prevClose = basePrice

        const series: { date: string; growth: number }[] = []
        for (const date of dates) {
          const close = priceMap.get(date)!

          // If there's a dividend on this date, reinvest it
          const div = divMap.get(date)
          if (div && div > 0) {
            // Dividend per share * number of shares = total dividend received
            // Reinvest at the closing price on ex-date
            const totalDiv = div * shares
            shares += totalDiv / close
          }

          // Portfolio value = shares * current price
          const portfolioValue = shares * close
          const growthPct = ((portfolioValue - basePrice) / basePrice) * 100

          series.push({ date, growth: growthPct })
          prevClose = close
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

    const normalized = results.map(r => ({
      ticker: r.ticker,
      data: r.series,
    }))

    return NextResponse.json({ funds: normalized })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
