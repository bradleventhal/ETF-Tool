import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tickerA = searchParams.get("tickerA")
  const tickerB = searchParams.get("tickerB")

  if (!tickerA || !tickerB) {
    return NextResponse.json({ error: "tickerA and tickerB required" }, { status: 400 })
  }

  const startTs = Math.floor(new Date("2012-01-01").getTime() / 1000)
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

    // Common dates
    const commonDates = [...fundA.priceMap.keys()].filter(d => fundB.priceMap.has(d)).sort()
    if (commonDates.length < 5) {
      return NextResponse.json({ error: "Insufficient overlapping data" }, { status: 400 })
    }

    const commonInceptionDate = commonDates[0]
    const lastDate = commonDates[commonDates.length - 1]

    // Total return with dividend reinvestment from startIdx to end
    function totalReturn(priceMap: Map<string, number>, divMap: Map<string, number>, dates: string[]): number {
      if (dates.length < 2) return 0
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

    // Max drawdown within a date range (peak-to-trough)
    function maxDrawdown(priceMap: Map<string, number>, divMap: Map<string, number>, dates: string[]): { drawdown: number; troughDate: string; peakDate: string; recoveryDate: string | null } {
      if (dates.length < 2) return { drawdown: 0, troughDate: dates[0] || "", peakDate: dates[0] || "", recoveryDate: null }
      const basePrice = priceMap.get(dates[0])!
      let shares = 1.0
      let peak = basePrice
      let peakDate = dates[0]
      let maxDd = 0
      let troughDate = dates[0]
      let bestPeakDate = dates[0]

      // Track portfolio values for recovery
      const values: { date: string; value: number }[] = []

      for (const date of dates) {
        const close = priceMap.get(date)!
        const div = divMap.get(date)
        if (div && div > 0) {
          shares += (div * shares) / close
        }
        const value = shares * close
        values.push({ date, value })

        if (value > peak) {
          peak = value
          peakDate = date
        }
        const dd = (value - peak) / peak
        if (dd < maxDd) {
          maxDd = dd
          troughDate = date
          bestPeakDate = peakDate
        }
      }

      // Find recovery date (when value first exceeds the pre-drawdown peak after trough)
      let recoveryDate: string | null = null
      const troughIdx = values.findIndex(v => v.date === troughDate)
      const prePeak = values.find(v => v.date === bestPeakDate)?.value || 0
      if (troughIdx >= 0) {
        for (let i = troughIdx + 1; i < values.length; i++) {
          if (values[i].value >= prePeak) {
            recoveryDate = values[i].date
            break
          }
        }
      }

      return { drawdown: maxDd * 100, troughDate, peakDate: bestPeakDate, recoveryDate }
    }

    // Period returns for standard timeframes
    function periodReturn(priceMap: Map<string, number>, divMap: Map<string, number>, startDate: string, allDates: string[]): number | null {
      const startIdx = allDates.findIndex(d => d >= startDate)
      if (startIdx === -1 || allDates.length - startIdx < 2) return null
      return totalReturn(priceMap, divMap, allDates.slice(startIdx))
    }

    const now = new Date()
    const ytdStart = `${now.getFullYear()}-01-01`
    const y1Start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    const y3Start = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    const y5Start = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString().slice(0, 10)

    const returnsA: Record<string, number | null> = {
      ytd: periodReturn(fundA.priceMap, fundA.divMap, ytdStart, commonDates),
      "1y": periodReturn(fundA.priceMap, fundA.divMap, y1Start, commonDates),
      "3y": periodReturn(fundA.priceMap, fundA.divMap, y3Start, commonDates),
      "5y": periodReturn(fundA.priceMap, fundA.divMap, y5Start, commonDates),
      ci: totalReturn(fundA.priceMap, fundA.divMap, commonDates),
    }
    const returnsB: Record<string, number | null> = {
      ytd: periodReturn(fundB.priceMap, fundB.divMap, ytdStart, commonDates),
      "1y": periodReturn(fundB.priceMap, fundB.divMap, y1Start, commonDates),
      "3y": periodReturn(fundB.priceMap, fundB.divMap, y3Start, commonDates),
      "5y": periodReturn(fundB.priceMap, fundB.divMap, y5Start, commonDates),
      ci: totalReturn(fundB.priceMap, fundB.divMap, commonDates),
    }

    // 2022 drawdown analysis (only if fund existed pre-2022)
    const dates2022 = commonDates.filter(d => d >= "2021-12-01" && d <= "2023-06-30")
    let drawdown2022A: number | null = null
    let drawdown2022B: number | null = null
    let recovery2022A: string | null = null
    let recovery2022B: string | null = null
    let trough2022A: string | null = null
    let trough2022B: string | null = null

    if (dates2022.length > 20 && commonInceptionDate < "2022-01-01") {
      const ddA = maxDrawdown(fundA.priceMap, fundA.divMap, dates2022)
      const ddB = maxDrawdown(fundB.priceMap, fundB.divMap, dates2022)
      drawdown2022A = parseFloat(ddA.drawdown.toFixed(2))
      drawdown2022B = parseFloat(ddB.drawdown.toFixed(2))
      recovery2022A = ddA.recoveryDate
      recovery2022B = ddB.recoveryDate
      trough2022A = ddA.troughDate
      trough2022B = ddB.troughDate
    }

    // Find best outperformance period for Fund A
    // Test Jan 1 of each year + common inception
    const firstYear = parseInt(commonDates[0].slice(0, 4))
    const currentYear = now.getFullYear()

    const candidates: { label: string; startDate: string }[] = [
      { label: `Since Common Inception (${commonInceptionDate})`, startDate: commonInceptionDate },
    ]
    for (let year = firstYear; year <= currentYear; year++) {
      candidates.push({ label: `Since Jan ${year}`, startDate: `${year}-01-01` })
    }
    // Also add YTD, 1Y, 3Y
    candidates.push({ label: "YTD", startDate: ytdStart })
    candidates.push({ label: "Trailing 1Y", startDate: y1Start })
    candidates.push({ label: "Trailing 3Y", startDate: y3Start })

    let bestPeriodLabel = "Since Common Inception"
    let bestPeriodSpread = -Infinity
    let bestPeriodStartDate = commonInceptionDate

    for (const candidate of candidates) {
      const startIdx = commonDates.findIndex(d => d >= candidate.startDate)
      if (startIdx === -1 || commonDates.length - startIdx < 10) continue
      const datesFromStart = commonDates.slice(startIdx)
      const retA = totalReturn(fundA.priceMap, fundA.divMap, datesFromStart)
      const retB = totalReturn(fundB.priceMap, fundB.divMap, datesFromStart)
      const spread = retA - retB
      if (spread > bestPeriodSpread) {
        bestPeriodSpread = spread
        bestPeriodLabel = candidate.label
        bestPeriodStartDate = candidate.startDate
      }
    }

    return NextResponse.json({
      commonInceptionDate,
      lastDate,
      drawdown2022A,
      drawdown2022B,
      recovery2022A,
      recovery2022B,
      trough2022A,
      trough2022B,
      returnsA,
      returnsB,
      bestPeriodLabel,
      bestPeriodSpread: parseFloat(bestPeriodSpread.toFixed(2)),
      bestPeriodStartDate,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
