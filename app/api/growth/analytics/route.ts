import { NextRequest, NextResponse } from "next/server"

export interface StressPeriod {
  label: string
  startDate: string
  endDate: string
  drawdownA: number
  drawdownB: number
  recoveryDateA: string | null
  recoveryDateB: string | null
  winner: "A" | "B" | "tie"
  narrative: string // e.g. "Fund A held up better during this period"
}

export interface PeriodReturn {
  label: string
  startDate: string
  returnA: number
  returnB: number
  spread: number // A minus B
}

export interface YahooAnalyticsResponse {
  commonInceptionDate: string
  lastDate: string
  tickerA: string
  tickerB: string
  periodReturns: PeriodReturn[]
  stressPeriods: StressPeriod[]
  bestPeriodForA: PeriodReturn | null
  bestPeriodForB: PeriodReturn | null
  maxDrawdownA: { drawdown: number; peakDate: string; troughDate: string; recoveryDate: string | null }
  maxDrawdownB: { drawdown: number; peakDate: string; troughDate: string; recoveryDate: string | null }
}

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

    const commonDates = [...fundA.priceMap.keys()].filter(d => fundB.priceMap.has(d)).sort()
    if (commonDates.length < 5) {
      return NextResponse.json({ error: "Insufficient overlapping data" }, { status: 400 })
    }

    const commonInceptionDate = commonDates[0]
    const lastDate = commonDates[commonDates.length - 1]

    // --- Utility functions ---

    function totalReturn(priceMap: Map<string, number>, divMap: Map<string, number>, dates: string[]): number {
      if (dates.length < 2) return 0
      const basePrice = priceMap.get(dates[0])!
      let shares = 1.0
      for (const date of dates) {
        const close = priceMap.get(date)!
        const div = divMap.get(date)
        if (div && div > 0) shares += (div * shares) / close
      }
      const lastClose = priceMap.get(dates[dates.length - 1])!
      return ((shares * lastClose - basePrice) / basePrice) * 100
    }

    function maxDrawdown(priceMap: Map<string, number>, divMap: Map<string, number>, dates: string[]) {
      if (dates.length < 2) return { drawdown: 0, troughDate: dates[0] || "", peakDate: dates[0] || "", recoveryDate: null as string | null }
      const basePrice = priceMap.get(dates[0])!
      let shares = 1.0
      let peak = basePrice, peakDate = dates[0]
      let maxDd = 0, troughDate = dates[0], bestPeakDate = dates[0]
      const values: { date: string; value: number }[] = []

      for (const date of dates) {
        const close = priceMap.get(date)!
        const div = divMap.get(date)
        if (div && div > 0) shares += (div * shares) / close
        const value = shares * close
        values.push({ date, value })
        if (value > peak) { peak = value; peakDate = date }
        const dd = (value - peak) / peak
        if (dd < maxDd) { maxDd = dd; troughDate = date; bestPeakDate = peakDate }
      }

      let recoveryDate: string | null = null
      const troughIdx = values.findIndex(v => v.date === troughDate)
      const prePeak = values.find(v => v.date === bestPeakDate)?.value || 0
      if (troughIdx >= 0) {
        for (let i = troughIdx + 1; i < values.length; i++) {
          if (values[i].value >= prePeak) { recoveryDate = values[i].date; break }
        }
      }

      return { drawdown: parseFloat((maxDd * 100).toFixed(2)), troughDate, peakDate: bestPeakDate, recoveryDate }
    }

    // --- Period returns (every standard timeframe) ---

    const now = new Date()
    const periodDefs: { label: string; start: string }[] = [
      { label: "YTD", start: `${now.getFullYear()}-01-01` },
      { label: "1Y", start: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10) },
      { label: "3Y", start: new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()).toISOString().slice(0, 10) },
      { label: "5Y", start: new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString().slice(0, 10) },
      { label: "Common Inception", start: commonInceptionDate },
    ]

    // Add every Jan 1 as a candidate
    const firstYear = parseInt(commonDates[0].slice(0, 4))
    for (let year = firstYear; year <= now.getFullYear(); year++) {
      const key = `Since Jan ${year}`
      if (!periodDefs.find(p => p.label === key)) {
        periodDefs.push({ label: key, start: `${year}-01-01` })
      }
    }

    const periodReturns: PeriodReturn[] = []
    for (const pd of periodDefs) {
      const startIdx = commonDates.findIndex(d => d >= pd.start)
      if (startIdx === -1 || commonDates.length - startIdx < 5) continue
      const slice = commonDates.slice(startIdx)
      const retA = totalReturn(fundA.priceMap, fundA.divMap, slice)
      const retB = totalReturn(fundB.priceMap, fundB.divMap, slice)
      periodReturns.push({
        label: pd.label,
        startDate: pd.start,
        returnA: parseFloat(retA.toFixed(2)),
        returnB: parseFloat(retB.toFixed(2)),
        spread: parseFloat((retA - retB).toFixed(2)),
      })
    }

    // Best period for each fund
    const bestForA = periodReturns.reduce((best, p) => p.spread > (best?.spread ?? -Infinity) ? p : best, null as PeriodReturn | null)
    const bestForB = periodReturns.reduce((best, p) => p.spread < (best?.spread ?? Infinity) ? p : best, null as PeriodReturn | null)

    // --- Dynamic stress period detection ---
    // Find periods where EITHER fund dropped >2% from a recent peak in a rolling 60-day window
    // Group overlapping drops into stress events

    function buildTotalReturnIndex(priceMap: Map<string, number>, divMap: Map<string, number>, dates: string[]): number[] {
      const idx: number[] = [100]
      let shares = 1.0
      const base = priceMap.get(dates[0])!
      for (let i = 1; i < dates.length; i++) {
        const close = priceMap.get(dates[i])!
        const div = divMap.get(dates[i])
        if (div && div > 0) shares += (div * shares) / close
        idx.push((shares * close / base) * 100)
      }
      return idx
    }

    const triA = buildTotalReturnIndex(fundA.priceMap, fundA.divMap, commonDates)
    const triB = buildTotalReturnIndex(fundB.priceMap, fundB.divMap, commonDates)

    // --- Dynamic stress period detection for fixed income ---
    // In fixed income, a 1% NAV drop in a short period is significant.
    // We detect any period where either fund drops >1% from a recent peak.
    // We also classify: broad (both funds drop) vs idiosyncratic (only one drops).
    const STRESS_THRESHOLD = -1.0 // 1% drop is significant in FI
    const RECOVERY_THRESHOLD = -0.25 // considered "recovered" when within 25bps of prior peak

    interface RawStress { startIdx: number; troughIdx: number; endIdx: number; worstDdA: number; worstDdB: number }
    const rawStresses: RawStress[] = []

    let peakA = triA[0], peakB = triB[0], peakIdxA = 0, peakIdxB = 0
    let inStress = false, stressStart = 0, stressTroughIdx = 0
    let stressDdA = 0, stressDdB = 0

    for (let i = 1; i < commonDates.length; i++) {
      if (triA[i] > peakA) { peakA = triA[i]; peakIdxA = i }
      if (triB[i] > peakB) { peakB = triB[i]; peakIdxB = i }

      const ddA = ((triA[i] - peakA) / peakA) * 100
      const ddB = ((triB[i] - peakB) / peakB) * 100

      const eitherStressed = ddA < STRESS_THRESHOLD || ddB < STRESS_THRESHOLD

      if (eitherStressed && !inStress) {
        inStress = true
        stressStart = Math.min(peakIdxA, peakIdxB)
        stressTroughIdx = i
        stressDdA = ddA
        stressDdB = ddB
      } else if (eitherStressed && inStress) {
        if (ddA < stressDdA || ddB < stressDdB) {
          stressTroughIdx = i
          stressDdA = Math.min(stressDdA, ddA)
          stressDdB = Math.min(stressDdB, ddB)
        }
      } else if (!eitherStressed && inStress) {
        if (ddA > RECOVERY_THRESHOLD && ddB > RECOVERY_THRESHOLD) {
          rawStresses.push({ startIdx: stressStart, troughIdx: stressTroughIdx, endIdx: i, worstDdA: stressDdA, worstDdB: stressDdB })
          inStress = false
          peakA = triA[i]; peakB = triB[i]; peakIdxA = i; peakIdxB = i
        }
      }
    }
    if (inStress) {
      rawStresses.push({ startIdx: stressStart, troughIdx: stressTroughIdx, endIdx: commonDates.length - 1, worstDdA: stressDdA, worstDdB: stressDdB })
    }

    // Convert to StressPeriod objects
    // Classify each: "broad" (both >0.75% drop), "idiosyncratic_A" (only A dropped meaningfully), "idiosyncratic_B"
    const stressPeriods: StressPeriod[] = rawStresses
      .filter(s => s.troughIdx - s.startIdx >= 3) // at least 3 trading days (not just noise)
      .sort((a, b) => Math.min(a.worstDdA, a.worstDdB) - Math.min(b.worstDdA, b.worstDdB))
      .slice(0, 10) // keep top 10 events
      .map(s => {
        const startDate = commonDates[s.startIdx]
        const endDate = commonDates[s.endIdx]

        const windowDates = commonDates.slice(s.startIdx, s.endIdx + 1)
        const ddInfoA = maxDrawdown(fundA.priceMap, fundA.divMap, windowDates)
        const ddInfoB = maxDrawdown(fundB.priceMap, fundB.divMap, windowDates)

        const winner = ddInfoA.drawdown > ddInfoB.drawdown ? "A" as const
          : ddInfoB.drawdown > ddInfoA.drawdown ? "B" as const
          : "tie" as const

        // Classify: broad market event vs idiosyncratic
        const bothDropped = ddInfoA.drawdown < -0.75 && ddInfoB.drawdown < -0.75
        const onlyADropped = ddInfoA.drawdown < -0.75 && ddInfoB.drawdown > -0.5
        const onlyBDropped = ddInfoB.drawdown < -0.75 && ddInfoA.drawdown > -0.5

        let eventType = "broad"
        if (onlyADropped) eventType = `idiosyncratic_${tickerA}`
        else if (onlyBDropped) eventType = `idiosyncratic_${tickerB}`

        const startMonth = new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })
        const endMonth = new Date(endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })
        const durationDays = s.endIdx - s.startIdx

        return {
          label: `${startMonth}${startMonth !== endMonth ? ` - ${endMonth}` : ""} (${durationDays} trading days)`,
          startDate,
          endDate,
          drawdownA: ddInfoA.drawdown,
          drawdownB: ddInfoB.drawdown,
          recoveryDateA: ddInfoA.recoveryDate,
          recoveryDateB: ddInfoB.recoveryDate,
          winner,
          narrative: eventType === "broad"
            ? `Broad market stress: ${tickerA} ${ddInfoA.drawdown.toFixed(2)}% vs ${tickerB} ${ddInfoB.drawdown.toFixed(2)}%. ${winner === "A" ? tickerA + " held up better." : winner === "B" ? tickerB + " held up better." : "Similar impact."}`
            : eventType === `idiosyncratic_${tickerA}`
              ? `Idiosyncratic to ${tickerA}: dropped ${ddInfoA.drawdown.toFixed(2)}% while ${tickerB} was largely unaffected (${ddInfoB.drawdown.toFixed(2)}%).`
              : eventType === `idiosyncratic_${tickerB}`
                ? `Idiosyncratic to ${tickerB}: dropped ${ddInfoB.drawdown.toFixed(2)}% while ${tickerA} was largely unaffected (${ddInfoA.drawdown.toFixed(2)}%).`
                : `${tickerA} ${ddInfoA.drawdown.toFixed(2)}% vs ${tickerB} ${ddInfoB.drawdown.toFixed(2)}%.`,
        }
      })

    // Full-history max drawdowns
    const fullDdA = maxDrawdown(fundA.priceMap, fundA.divMap, commonDates)
    const fullDdB = maxDrawdown(fundB.priceMap, fundB.divMap, commonDates)

    return NextResponse.json({
      commonInceptionDate,
      lastDate,
      tickerA,
      tickerB,
      periodReturns,
      stressPeriods,
      bestPeriodForA: bestForA,
      bestPeriodForB: bestForB,
      maxDrawdownA: fullDdA,
      maxDrawdownB: fullDdB,
    } satisfies YahooAnalyticsResponse)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
