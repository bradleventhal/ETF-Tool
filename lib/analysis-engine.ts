import type { FundData, AnalysisMode, AnalysisResult, ComparisonRow } from "./fund-types"

// --- Helpers ---
function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) || v === 0 ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }
function fBps(v: number): string { const a = Math.abs(Math.round(v)); return `${v >= 0 ? "+" : "\u2212"}${a}bps` }
function secPct(d: FundData) { return nz(d.nonAgencyRmbs) + nz(d.agencyRmbs) + nz(d.abs) + nz(d.clo) + nz(d.cmbs) }
function igPct(d: FundData) { return nz(d.aaa) + nz(d.aa) + nz(d.a) + nz(d.bbb) }
function hyPct(d: FundData) { return nz(d.bb) + nz(d.b) + nz(d.ccc) + nz(d.belowCcc) }

// --- Internal mode: bullet-point takeaway ---
interface Bullet { text: string; type: "edge" | "neutral" | "handle" }

function internalBullets(a: FundData, b: FundData, tA: string, tB: string): Bullet[] {
  const out: Bullet[] = []
  const secBps = (nz(a.secYield) - nz(b.secYield)) * 10000
  const sA = secPct(a), sB = secPct(b)
  const iA = igPct(a), iB = igPct(b)
  const thrD = (nz(a.threeYear) - nz(b.threeYear)) * 100
  const expBps = (nz(a.expense) - nz(b.expense)) * 10000
  const shA = nz(a.sharpe), shB = nz(b.sharpe)

  // Yield
  if (secBps > 20) out.push({ text: `${fBps(secBps)} SEC yield advantage`, type: "edge" })
  else if (secBps < -20) out.push({ text: `${fBps(secBps)} SEC yield vs ${tB}`, type: "handle" })
  else out.push({ text: `SEC yields are comparable (${fPct(a.secYield)} vs ${fPct(b.secYield)})`, type: "neutral" })

  // Duration
  const durDiff = Math.abs(nz(a.duration) - nz(b.duration))
  if (durDiff <= 0.75) out.push({ text: `Duration aligned (${fNum(a.duration)} vs ${fNum(b.duration)})`, type: "edge" })
  else out.push({ text: `Duration gap of ${durDiff.toFixed(2)}yr (${fNum(a.duration)} vs ${fNum(b.duration)})`, type: "neutral" })

  // Credit
  if (Math.abs(iA - iB) <= 0.1) out.push({ text: `Comparable IG allocation (${fPct(iA, 0)} vs ${fPct(iB, 0)})`, type: "edge" })
  else if (iA > iB) out.push({ text: `Higher quality: ${fPct(iA, 0)} IG vs ${fPct(iB, 0)}`, type: "edge" })
  else out.push({ text: `Lower IG allocation (${fPct(iA, 0)} vs ${fPct(iB, 0)})`, type: "handle" })

  // Sector differentiation
  if (Math.abs(sA - sB) > 0.15) {
    out.push({ text: `Securitized: ${fPct(sA, 0)} vs ${fPct(sB, 0)} \u2014 different sector profile`, type: "neutral" })
  }

  // Performance
  if (thrD > 1) out.push({ text: `3Y outperformance of ${thrD.toFixed(1)}pp`, type: "edge" })
  else if (thrD < -1) out.push({ text: `3Y underperformance of ${Math.abs(thrD).toFixed(1)}pp`, type: "handle" })
  else if (nz(a.threeYear) !== 0 && nz(b.threeYear) !== 0) out.push({ text: `3Y performance comparable`, type: "neutral" })

  // Sharpe
  if (shA > 0 && shB > 0) {
    if (shA > shB + 0.2) out.push({ text: `Better risk-adjusted return (Sharpe ${fNum(a.sharpe)} vs ${fNum(b.sharpe)})`, type: "edge" })
    else if (shB > shA + 0.2) out.push({ text: `Lower Sharpe (${fNum(a.sharpe)} vs ${fNum(b.sharpe)}) \u2014 pivot to income`, type: "handle" })
  }

  // Expense
  if (expBps > 10) out.push({ text: `${Math.round(expBps)}bps expense premium (${fPct(a.expense)} vs ${fPct(b.expense)})`, type: "handle" })
  else if (expBps < -10) out.push({ text: `${Math.abs(Math.round(expBps))}bps cheaper (${fPct(a.expense)} vs ${fPct(b.expense)})`, type: "edge" })

  return out
}

// --- Advisor mode: clean summary paragraphs ---
function advisorSummary(a: FundData, b: FundData, tA: string, tB: string): string {
  const secBps = (nz(a.secYield) - nz(b.secYield)) * 10000
  const durDiff = Math.abs(nz(a.duration) - nz(b.duration))
  const iA = igPct(a), iB = igPct(b)
  const sA = secPct(a), sB = secPct(b)
  const thrD = (nz(a.threeYear) - nz(b.threeYear)) * 100
  const parts: string[] = []

  // Lead
  if (secBps > 20) {
    parts.push(`${tA} offers a ${fBps(secBps)} yield advantage over ${tB}.`)
  } else if (secBps < -20) {
    parts.push(`${tB} holds a ${fBps(Math.abs(secBps))} yield edge, though ${tA} differs in key structural areas.`)
  } else {
    parts.push(`Both funds offer comparable current income.`)
  }

  // Duration
  if (durDiff <= 0.75) {
    parts.push(`Duration profiles are aligned at ${fNum(a.duration)} and ${fNum(b.duration)} years, so rate sensitivity is similar.`)
  } else {
    const longer = nz(a.duration) > nz(b.duration) ? tA : tB
    parts.push(`${longer} carries more duration (${fNum(a.duration)} vs ${fNum(b.duration)}), resulting in different rate sensitivity.`)
  }

  // Sector
  if (Math.abs(sA - sB) > 0.15) {
    const secH = sA > sB ? tA : tB
    const secL = sA > sB ? tB : tA
    parts.push(`${secH} is primarily securitized credit (${fPct(Math.max(sA, sB), 0)}) while ${secL} leans corporate (${fPct(secH === tA ? nz(b.corporateCredit) : nz(a.corporateCredit), 0)}).`)
  }

  // Performance
  if (thrD > 1) {
    parts.push(`Over 3 years, ${tA} has outperformed by ${thrD.toFixed(1)} percentage points.`)
  } else if (thrD < -1) {
    parts.push(`Over 3 years, ${tB} has outperformed by ${Math.abs(thrD).toFixed(1)} percentage points.`)
  }

  return parts.join(" ")
}

// --- Tables ---
function keyStats(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "Duration", a: fNum(a.duration), b: fNum(b.duration), nA: a.duration, nB: b.duration, better: "low" },
    { label: "YTW / YTM", a: fPct(a.ytwYtm), b: fPct(b.ytwYtm), nA: a.ytwYtm, nB: b.ytwYtm, better: "high" },
    { label: "30-Day SEC Yield", a: fPct(a.secYield), b: fPct(b.secYield), nA: a.secYield, nB: b.secYield, better: "high" },
    { label: "Distribution Yield", a: fPct(a.distributionYield), b: fPct(b.distributionYield), nA: a.distributionYield, nB: b.distributionYield, better: "high" },
    { label: "Expense Ratio", a: fPct(a.expense), b: fPct(b.expense), nA: a.expense, nB: b.expense, better: "low" },
    { label: "Std Deviation", a: fNum(a.stdDev), b: fNum(b.stdDev), nA: a.stdDev, nB: b.stdDev, better: "low" },
    { label: "Sharpe Ratio", a: fNum(a.sharpe), b: fNum(b.sharpe), nA: a.sharpe, nB: b.sharpe, better: "high" },
    { label: "Correlation", a: fNum(a.correlation), b: fNum(b.correlation), nA: a.correlation, nB: b.correlation, better: "none" },
  ].filter(r => r.a !== "\u2014" || r.b !== "\u2014")
}

function perfTable(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "YTD", a: fPct(a.ytd), b: fPct(b.ytd), nA: a.ytd, nB: b.ytd, better: "high" },
    { label: "1 Year", a: fPct(a.oneYear), b: fPct(b.oneYear), nA: a.oneYear, nB: b.oneYear, better: "high" },
    { label: "Common Inception", a: fPct(a.commonInception), b: fPct(b.commonInception), nA: a.commonInception, nB: b.commonInception, better: "high" },
    { label: "3 Year", a: fPct(a.threeYear), b: fPct(b.threeYear), nA: a.threeYear, nB: b.threeYear, better: "high" },
  ].filter(r => r.a !== "\u2014" || r.b !== "\u2014")
}

function sectorTable(a: FundData, b: FundData): ComparisonRow[] {
  const rows: ComparisonRow[] = []
  const add = (l: string, vA: number | null, vB: number | null) => {
    if (nz(vA) > 0.005 || nz(vB) > 0.005)
      rows.push({ label: l, a: fPct(vA, 1), b: fPct(vB, 1), nA: vA, nB: vB, better: "none" })
  }
  add("Non-Agency RMBS", a.nonAgencyRmbs, b.nonAgencyRmbs)
  add("Agency RMBS", a.agencyRmbs, b.agencyRmbs)
  add("ABS", a.abs, b.abs)
  add("CLO", a.clo, b.clo)
  add("CMBS", a.cmbs, b.cmbs)
  add("Corporate Credit", a.corporateCredit, b.corporateCredit)
  add("Government / Cash", a.governmentCash, b.governmentCash)
  if (nz(a.other) > 0.005 || nz(b.other) > 0.005)
    rows.push({ label: "Other", a: fPct(a.other, 1), b: fPct(b.other, 1), nA: a.other, nB: b.other, better: "none" })
  return rows
}

function creditTable(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "AAA / US Gov", a: fPct(a.aaa, 1), b: fPct(b.aaa, 1), nA: a.aaa, nB: b.aaa, better: "none" },
    { label: "AA", a: fPct(a.aa, 1), b: fPct(b.aa, 1), nA: a.aa, nB: b.aa, better: "none" },
    { label: "A", a: fPct(a.a, 1), b: fPct(b.a, 1), nA: a.a, nB: b.a, better: "none" },
    { label: "BBB", a: fPct(a.bbb, 1), b: fPct(b.bbb, 1), nA: a.bbb, nB: b.bbb, better: "none" },
    { label: "BB", a: fPct(a.bb, 1), b: fPct(b.bb, 1), nA: a.bb, nB: b.bb, better: "none" },
    { label: "B", a: fPct(a.b, 1), b: fPct(b.b, 1), nA: a.b, nB: b.b, better: "none" },
    { label: "CCC", a: fPct(a.ccc, 1), b: fPct(b.ccc, 1), nA: a.ccc, nB: b.ccc, better: "none" },
    { label: "Below CCC", a: fPct(a.belowCcc, 1), b: fPct(b.belowCcc, 1), nA: a.belowCcc, nB: b.belowCcc, better: "none" },
  ].filter(r => (r.nA != null && nz(r.nA) > 0.001) || (r.nB != null && nz(r.nB) > 0.001))
}

// --- Main ---
export function runAnalysis(dataA: FundData, dataB: FundData, mode: AnalysisMode): AnalysisResult {
  const tA = dataA.ticker, tB = dataB.ticker
  return {
    tickerA: tA, tickerB: tB,
    nameA: dataA.name, nameB: dataB.name,
    mode,
    advisorSummary: mode === "advisor" ? advisorSummary(dataA, dataB, tA, tB) : "",
    bullets: mode === "internal" ? internalBullets(dataA, dataB, tA, tB) : [],
    keyStats: keyStats(dataA, dataB),
    performance: perfTable(dataA, dataB),
    sectorAllocation: sectorTable(dataA, dataB),
    creditQuality: creditTable(dataA, dataB),
    chartData: [
      { period: "YTD", fundA: nz(dataA.ytd) * 100, fundB: nz(dataB.ytd) * 100 },
      { period: "1Y", fundA: nz(dataA.oneYear) * 100, fundB: nz(dataB.oneYear) * 100 },
      ...(nz(dataA.commonInception) !== 0 || nz(dataB.commonInception) !== 0 ? [{ period: "Inception", fundA: nz(dataA.commonInception) * 100, fundB: nz(dataB.commonInception) * 100 }] : []),
      ...(nz(dataA.threeYear) !== 0 || nz(dataB.threeYear) !== 0 ? [{ period: "3Y", fundA: nz(dataA.threeYear) * 100, fundB: nz(dataB.threeYear) * 100 }] : []),
    ],
  }
}
