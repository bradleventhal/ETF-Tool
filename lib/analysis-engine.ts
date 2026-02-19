import type { FundData, AnalysisMode, AnalysisResult, ComparisonRow, SectorRow } from "./fund-types"

// --- Utility functions ported from VBA ---

function nz(val: number | null): number {
  return val === null || val === undefined || isNaN(val) ? 0 : val
}

function fmtPct(val: number | null, decimals: number): string {
  if (val === null || val === undefined || isNaN(val)) return "\u2014"
  return (val * 100).toFixed(decimals) + "%"
}

function fmtNum(val: number | null, decimals: number): string {
  if (val === null || val === undefined || isNaN(val)) return "\u2014"
  return val.toFixed(decimals)
}

function isComparable(a: number | null, b: number | null, thresh: number): boolean {
  const aVal = nz(a)
  const bVal = nz(b)
  return !(aVal === 0 && bVal === 0) && Math.abs(aVal - bVal) <= thresh
}

// --- Build the narrative sections (Discovery) ---

function buildStructureText(
  dataA: FundData, dataB: FundData,
  tickerA: string, tickerB: string,
  durComp: boolean, creditComp: boolean,
  igA: number, igB: number
): string {
  if (durComp && creditComp) {
    return `Duration and credit quality are broadly comparable. Duration: ${fmtNum(dataA.duration, 2)} vs ${fmtNum(dataB.duration, 2)}. Investment grade: ${fmtPct(igA, 0)} vs ${fmtPct(igB, 0)}.`
  }

  let text = ""
  if (!durComp) {
    text += `Duration differs meaningfully: ${fmtNum(dataA.duration, 2)} vs ${fmtNum(dataB.duration, 2)}. `
  } else {
    text += `Duration is comparable: ${fmtNum(dataA.duration, 2)} vs ${fmtNum(dataB.duration, 2)}. `
  }
  if (!creditComp) {
    text += `Credit quality differs. Investment grade: ${fmtPct(igA, 0)} vs ${fmtPct(igB, 0)}.`
  } else {
    text += `Credit quality is comparable. Investment grade: ${fmtPct(igA, 0)} vs ${fmtPct(igB, 0)}.`
  }
  return text
}

function buildIncomeText(
  dataA: FundData, dataB: FundData,
  tickerA: string, tickerB: string,
  secDiffBps: number
): string {
  let text = `SEC yield: ${tickerA} at ${fmtPct(dataA.secYield, 2)} vs ${tickerB} at ${fmtPct(dataB.secYield, 2)}.`
  text += ` Differential: ${secDiffBps >= 0 ? "+" : ""}${Math.round(secDiffBps)} basis points.`
  return text
}

function buildRiskText(
  dataA: FundData, dataB: FundData,
  tickerA: string, tickerB: string,
  mode: AnalysisMode
): string {
  const volComp = isComparable(dataA.stdDev, dataB.stdDev, 0.1)
  let text = `Volatility is ${volComp ? "broadly similar" : "meaningfully different"} (${fmtNum(dataA.stdDev, 2)} vs ${fmtNum(dataB.stdDev, 2)}). `

  if (mode === "advisor") {
    if (nz(dataA.sharpe) > nz(dataB.sharpe) && nz(dataA.sharpe) > 0) {
      text += `Risk-adjusted performance favors ${tickerA}. Sharpe ratio: ${fmtNum(dataA.sharpe, 2)} vs ${fmtNum(dataB.sharpe, 2)}.`
    }
  } else {
    if (nz(dataA.sharpe) > 0 && nz(dataB.sharpe) > 0) {
      if (nz(dataA.sharpe) >= nz(dataB.sharpe)) {
        text += `Sharpe ratio favors us: ${fmtNum(dataA.sharpe, 2)} vs ${fmtNum(dataB.sharpe, 2)}.`
      } else {
        text += `Sharpe ratio is lower: ${fmtNum(dataA.sharpe, 2)} vs ${fmtNum(dataB.sharpe, 2)}. Avoid leading with risk-adjusted return metrics in the pitch.`
      }
    }
  }
  return text
}

function buildDetailedSummary(
  dataA: FundData, dataB: FundData,
  tickerA: string, tickerB: string,
  mode: AnalysisMode,
  secDiffBps: number, durComp: boolean, creditComp: boolean
): string {
  const igA = nz(dataA.aaa) + nz(dataA.aa) + nz(dataA.a) + nz(dataA.bbb)
  const igB = nz(dataB.aaa) + nz(dataB.aa) + nz(dataB.a) + nz(dataB.bbb)
  const ytdDiff = (nz(dataA.ytd) - nz(dataB.ytd)) * 100
  const oneYrDiff = (nz(dataA.oneYear) - nz(dataB.oneYear)) * 100
  const threeYrDiff = (nz(dataA.threeYear) - nz(dataB.threeYear)) * 100
  const sharpeDiff = nz(dataA.sharpe) - nz(dataB.sharpe)
  const expDiffBps = (nz(dataA.expense) - nz(dataB.expense)) * 10000

  if (mode === "advisor") {
    if (secDiffBps > 30 && durComp && creditComp) {
      let s = `This represents a clear income upgrade with comparable structural positioning. The ${Math.round(secDiffBps)} basis point yield advantage provides meaningful additional income while maintaining similar duration and credit exposure. `
      if (threeYrDiff > 1) {
        s += "The longer-term track record supports the quality of the yield advantage."
      }
      return s
    } else if (secDiffBps > 0) {
      let s = `This comparison shows an income-focused opportunity with structural tradeoffs. The yield differential of ${Math.round(secDiffBps)} basis points reflects a deliberate positioning difference in `
      if (!durComp) s += "duration profile"
      else if (!creditComp) s += "credit quality"
      else s += "sector allocation"
      s += " that delivers the additional income."
      return s
    } else {
      let s = "The primary differentiation is structural and performance-based rather than yield-focused. "
      if (threeYrDiff > 2) {
        s += `The multi-year performance advantage of ${threeYrDiff.toFixed(1)} percentage points demonstrates value creation through ${!durComp ? "active duration management" : "portfolio construction"}.`
      } else {
        s += "Consider whether the structural differences align with your portfolio objectives."
      }
      return s
    }
  }

  // Internal mode
  if (secDiffBps > 30 && durComp && creditComp) {
    let s = `PRIMARY PITCH: Lead with the ${Math.round(secDiffBps)} basis point yield pickup. This is a straightforward income upgrade story. Key talking points: (1) meaningful yield advantage with no structural sacrifice, (2) `
    if (threeYrDiff > 1) {
      s += `multi-year outperformance of ${threeYrDiff.toFixed(1)}pp validates the yield advantage, (3) `
    } else {
      s += "similar risk characteristics make this a clean swap, (3) "
    }
    s += `expense ratio of ${fmtPct(dataA.expense, 2)} is justified by performance. `
    if (sharpeDiff < -0.5) {
      s += `OBJECTION: If they cite our lower Sharpe (${fmtNum(dataA.sharpe, 2)} vs ${fmtNum(dataB.sharpe, 2)}), pivot to total return and the ${Math.round(secDiffBps)}bps yield advantage. `
    }
    if (expDiffBps > 5) {
      s += `OBJECTION: If they push back on our ${Math.round(expDiffBps)}bps higher expense, justify with yield pickup and `
      s += threeYrDiff > 0 ? "superior 3Y performance. " : "income generation capability. "
    }
    return s
  } else if (secDiffBps > 0) {
    let s = `POSITIONING: Frame as tactical income play with structure shift. The ${Math.round(secDiffBps)}bps yield pickup comes with `
    if (!durComp) {
      const durDiff = nz(dataA.duration) - nz(dataB.duration)
      s += `${Math.abs(durDiff).toFixed(1)} years of ${durDiff > 0 ? "additional" : "reduced"} duration. `
      s += "Message: deliberate rate positioning that also delivers more income. "
    } else if (!creditComp) {
      s += "different credit profile. "
      s += `Message: targeted allocation to ${igA < igB ? "higher-quality" : "higher-yielding"} credit for specific needs. `
    }
    s += "DO NOT oversell structural comparability - be transparent about the difference and position it as a feature tied to the income objective. "
    if (oneYrDiff < -1) {
      s += `OBJECTION: If they cite recent performance lag (${oneYrDiff.toFixed(1)}pp), acknowledge but emphasize `
      s += threeYrDiff > 0 ? "longer-term track record and structural rationale. " : "income objective and forward positioning. "
    }
    return s
  } else {
    let s = "CHALLENGE: Yield is NOT the story"
    if (ytdDiff < -0.5 && oneYrDiff < -0.5) {
      s += " and recent performance trails. This is a tough comp. Best angle: focus on structural diversification benefits or highlight specific sector exposures (e.g., RMBS alpha) that justify consideration. Be prepared to defend the expense ratio and set realistic expectations on near-term performance."
    } else if (threeYrDiff > 2) {
      s += ` but longer-term performance is strong. Lead with the multi-year track record: ${threeYrDiff.toFixed(1)} percentage points of outperformance demonstrates manager skill. Position this as a quality manager swap where you are paying for expertise rather than just buying yield. `
      if (expDiffBps > 5) {
        s += `OBJECTION: If they question ${Math.round(expDiffBps)}bps higher expense, justify with 3Y alpha generation. `
      }
    } else {
      s += ". Lead with structural differentiation: different sector exposures, risk management approach, or portfolio construction methodology. This requires a more consultative conversation about portfolio fit rather than a simple performance or yield story."
    }
    return s
  }
}

// --- Build comparison tables ---

function buildSectorNarrativeTable(dataA: FundData, dataB: FundData, tickerA: string, tickerB: string): SectorRow[] {
  const rows: SectorRow[] = []
  const rmbsA = nz(dataA.nonAgencyRmbs) + nz(dataA.agencyRmbs)
  const rmbsB = nz(dataB.nonAgencyRmbs) + nz(dataB.agencyRmbs)
  if (rmbsA > 0.05 || rmbsB > 0.05) rows.push({ label: "RMBS", valueA: fmtPct(rmbsA, 0), valueB: fmtPct(rmbsB, 0) })
  if (nz(dataA.clo) > 0.05 || nz(dataB.clo) > 0.05) rows.push({ label: "CLO", valueA: fmtPct(dataA.clo, 0), valueB: fmtPct(dataB.clo, 0) })
  if (nz(dataA.corporateCredit) > 0.05 || nz(dataB.corporateCredit) > 0.05) rows.push({ label: "Corporate", valueA: fmtPct(dataA.corporateCredit, 0), valueB: fmtPct(dataB.corporateCredit, 0) })
  if (nz(dataA.abs) > 0.05 || nz(dataB.abs) > 0.05) rows.push({ label: "ABS", valueA: fmtPct(dataA.abs, 0), valueB: fmtPct(dataB.abs, 0) })
  return rows
}

function buildPerformanceNarrativeTable(dataA: FundData, dataB: FundData, tickerA: string, tickerB: string): SectorRow[] {
  return [
    { label: "YTD", valueA: fmtPct(dataA.ytd, 2), valueB: fmtPct(dataB.ytd, 2) },
    { label: "1 Year", valueA: fmtPct(dataA.oneYear, 2), valueB: fmtPct(dataB.oneYear, 2) },
    { label: "3 Year", valueA: fmtPct(dataA.threeYear, 2), valueB: fmtPct(dataB.threeYear, 2) },
  ]
}

function buildKeyStats(dataA: FundData, dataB: FundData): ComparisonRow[] {
  return [
    { label: "Duration", valueA: fmtNum(dataA.duration, 2), valueB: fmtNum(dataB.duration, 2), numA: dataA.duration, numB: dataB.duration, higherIsBetter: false },
    { label: "SEC Yield", valueA: fmtPct(dataA.secYield, 2), valueB: fmtPct(dataB.secYield, 2), numA: dataA.secYield, numB: dataB.secYield, higherIsBetter: true },
    { label: "Expense", valueA: fmtPct(dataA.expense, 2), valueB: fmtPct(dataB.expense, 2), numA: dataA.expense, numB: dataB.expense, higherIsBetter: false },
    { label: "Std Dev", valueA: fmtNum(dataA.stdDev, 2), valueB: fmtNum(dataB.stdDev, 2), numA: dataA.stdDev, numB: dataB.stdDev, higherIsBetter: false },
    { label: "Sharpe", valueA: fmtNum(dataA.sharpe, 2), valueB: fmtNum(dataB.sharpe, 2), numA: dataA.sharpe, numB: dataB.sharpe, higherIsBetter: true },
  ]
}

function buildPerformanceComp(dataA: FundData, dataB: FundData): ComparisonRow[] {
  return [
    { label: "YTD", valueA: fmtPct(dataA.ytd, 2), valueB: fmtPct(dataB.ytd, 2), numA: dataA.ytd, numB: dataB.ytd, higherIsBetter: true },
    { label: "1 Year", valueA: fmtPct(dataA.oneYear, 2), valueB: fmtPct(dataB.oneYear, 2), numA: dataA.oneYear, numB: dataB.oneYear, higherIsBetter: true },
    { label: "3 Year", valueA: fmtPct(dataA.threeYear, 2), valueB: fmtPct(dataB.threeYear, 2), numA: dataA.threeYear, numB: dataB.threeYear, higherIsBetter: true },
  ]
}

function buildCreditQuality(dataA: FundData, dataB: FundData): ComparisonRow[] {
  const igA = nz(dataA.aaa) + nz(dataA.aa) + nz(dataA.a) + nz(dataA.bbb)
  const igB = nz(dataB.aaa) + nz(dataB.aa) + nz(dataB.a) + nz(dataB.bbb)
  const hyA = nz(dataA.bb) + nz(dataA.b) + nz(dataA.ccc)
  const hyB = nz(dataB.bb) + nz(dataB.b) + nz(dataB.ccc)
  return [
    { label: "IG %", valueA: fmtPct(igA, 0), valueB: fmtPct(igB, 0), numA: igA, numB: igB, higherIsBetter: true },
    { label: "HY %", valueA: fmtPct(hyA, 0), valueB: fmtPct(hyB, 0), numA: hyA, numB: hyB, higherIsBetter: false },
  ]
}

function buildSectorAllocation(dataA: FundData, dataB: FundData): ComparisonRow[] {
  const rows: ComparisonRow[] = []
  const rmbsA = nz(dataA.nonAgencyRmbs) + nz(dataA.agencyRmbs)
  const rmbsB = nz(dataB.nonAgencyRmbs) + nz(dataB.agencyRmbs)
  if (rmbsA > 0.05 || rmbsB > 0.05) rows.push({ label: "RMBS", valueA: fmtPct(rmbsA, 0), valueB: fmtPct(rmbsB, 0), numA: rmbsA, numB: rmbsB, higherIsBetter: true })
  if (nz(dataA.clo) > 0.05 || nz(dataB.clo) > 0.05) rows.push({ label: "CLO", valueA: fmtPct(dataA.clo, 0), valueB: fmtPct(dataB.clo, 0), numA: dataA.clo, numB: dataB.clo, higherIsBetter: true })
  if (nz(dataA.corporateCredit) > 0.05 || nz(dataB.corporateCredit) > 0.05) rows.push({ label: "Corporate", valueA: fmtPct(dataA.corporateCredit, 0), valueB: fmtPct(dataB.corporateCredit, 0), numA: dataA.corporateCredit, numB: dataB.corporateCredit, higherIsBetter: true })
  if (nz(dataA.abs) > 0.05 || nz(dataB.abs) > 0.05) rows.push({ label: "ABS", valueA: fmtPct(dataA.abs, 0), valueB: fmtPct(dataB.abs, 0), numA: dataA.abs, numB: dataB.abs, higherIsBetter: true })
  return rows
}

// --- Main entry point ---

export function runAnalysis(
  dataA: FundData,
  dataB: FundData,
  mode: AnalysisMode
): AnalysisResult {
  const tickerA = dataA.ticker
  const tickerB = dataB.ticker

  const igA = nz(dataA.aaa) + nz(dataA.aa) + nz(dataA.a) + nz(dataA.bbb)
  const igB = nz(dataB.aaa) + nz(dataB.aa) + nz(dataB.a) + nz(dataB.bbb)

  const durComp = isComparable(dataA.duration, dataB.duration, 0.75)
  const creditComp = isComparable(igA, igB, 0.1)

  const secDiffBps = (nz(dataA.secYield) - nz(dataB.secYield)) * 10000

  return {
    title: `${tickerA} vs ${tickerB}`,
    structureText: buildStructureText(dataA, dataB, tickerA, tickerB, durComp, creditComp, igA, igB),
    sectorTable: buildSectorNarrativeTable(dataA, dataB, tickerA, tickerB),
    incomeText: buildIncomeText(dataA, dataB, tickerA, tickerB, secDiffBps),
    riskText: buildRiskText(dataA, dataB, tickerA, tickerB, mode),
    performanceTable: buildPerformanceNarrativeTable(dataA, dataB, tickerA, tickerB),
    summaryLabel: mode === "advisor" ? "SUMMARY" : "TAKEAWAY",
    summaryText: buildDetailedSummary(dataA, dataB, tickerA, tickerB, mode, secDiffBps, durComp, creditComp),
    keyStats: buildKeyStats(dataA, dataB),
    performanceComp: buildPerformanceComp(dataA, dataB),
    creditQuality: buildCreditQuality(dataA, dataB),
    sectorAllocation: buildSectorAllocation(dataA, dataB),
    chartData: [
      { period: "YTD", fundA: nz(dataA.ytd) * 100, fundB: nz(dataB.ytd) * 100 },
      { period: "1Y", fundA: nz(dataA.oneYear) * 100, fundB: nz(dataB.oneYear) * 100 },
      { period: "3Y", fundA: nz(dataA.threeYear) * 100, fundB: nz(dataB.threeYear) * 100 },
    ],
    tickerA,
    tickerB,
    durComp,
    creditComp,
  }
}
