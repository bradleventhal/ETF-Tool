import { NextRequest, NextResponse } from "next/server"

// Finds the best Jan 1 start date where Fund A outperforms Fund B the most.
// Only considers Jan 1 of each year. Returns the date as YYYY-01-01.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tickerA = searchParams.get("tickerA")
  const tickerB = searchParams.get("tickerB")

  if (!tickerA || !tickerB) {
    return NextResponse.json({ error: "tickerA and tickerB required" }, { status: 400 })
  }

  // Fetch max history for both funds (10 years back)
  const startTs = Math.floor(new Date("2015-01-01").getTime() / 1000)
  const endTs = Math.floor(Date.now() / 1000)

  try {
    const fetchFund = async (ticker: string) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${startTs}&period2=${endTs}&interval=1d&events=div`
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
      if (!res.ok) throw new Error(`Yahoo returned ${res.status} for ${ticker}`)
      const json = await res.json()
      const result = json.chart?.result?.[0]
      if (!result) throw new Error(`No data for ${ticker}`)

      const timestamps = result.timestamp as number[]
      const closes = result.indicators?.quote?.[0]?.close as number[]
      if (!timestamps || !closes) throw new Error(`No prices for ${ticker}`)

      const divEvents = result.events?.dividends || {}
      const divMap: Map<string, number> = new Map()
      for (const key of Object.keys(divEvents)) {
        const ev = divEvents[key]
        const d = new Date(ev.date * 1000).toISOString().slice(0, 10)
        divMap.set(d, ev.amount)
      }

      const priceMap: Map<string, number> = new Map()
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] == null) continue
        priceMap.set(new Date(timestamps[i] * 1000).toISOString().slice(0, 10), closes[i])
      }

      return { priceMap, divMap }
    }

    const [fundA, fundB] = await Promise.all([fetchFund(tickerA), fetchFund(tickerB)])

    // Get all dates that both funds share
    const commonDates = [...fundA.priceMap.keys()].filter(d => fundB.priceMap.has(d)).sort()
    if (commonDates.length < 20) {
      return NextResponse.json({ recommended: null })
    }

    // Compute total return with dividend reinvestment from a given start date to end
    function totalReturn(priceMap: Map<string, number>, divMap: Map<string, number>, dates: string[]): number {
      const basePrice = priceMap.get(dates[0])!
      let shares = 1.0
      for (const date of dates) {
        const close = priceMap.get(date)!
        const div = divMap.get(date)
        if (div && div > 0) {
          shares += (div * shares) / close
        }
      }
      const lastClose = priceMap.get(dates[dates.length - 1])!
      return ((shares * lastClose - basePrice) / basePrice) * 100
    }

    // Common inception date (first date both funds have data)
    const commonInceptionDate = commonDates[0]

    // Build candidate start dates: every Jan 1 + common inception + YTD/1Y/3Y
    const firstYear = parseInt(commonDates[0].slice(0, 4))
    const currentYear = new Date().getFullYear()
    const now = new Date()

    const candidates: { date: string; label: string }[] = [
      { date: commonInceptionDate, label: "Common Inception" },
    ]
    for (let year = firstYear; year <= currentYear; year++) {
      candidates.push({ date: `${year}-01-01`, label: `Jan ${year}` })
    }
    // Add YTD, 1Y, 3Y as candidates
    candidates.push({ date: `${now.getFullYear()}-01-01`, label: "YTD" })
    const y1 = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    candidates.push({ date: y1, label: "1Y" })
    const y3 = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    candidates.push({ date: y3, label: "3Y" })

    let bestDate: string | null = null
    let bestSpread = -Infinity
    let bestLabel = ""

    for (const candidate of candidates) {
      const startIdx = commonDates.findIndex(d => d >= candidate.date)
      if (startIdx === -1 || commonDates.length - startIdx < 20) continue

      const datesFromStart = commonDates.slice(startIdx)
      const retA = totalReturn(fundA.priceMap, fundA.divMap, datesFromStart)
      const retB = totalReturn(fundB.priceMap, fundB.divMap, datesFromStart)
      const spread = retA - retB

      if (spread > bestSpread) {
        bestSpread = spread
        bestDate = candidate.date
        bestLabel = candidate.label
      }
    }

    return NextResponse.json({
      recommended: bestDate,
      spread: bestSpread !== -Infinity ? parseFloat(bestSpread.toFixed(2)) : null,
      label: bestLabel,
      commonInceptionDate,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
