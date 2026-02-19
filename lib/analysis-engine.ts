import type { FundData, AnalysisMode, AnalysisResult, ComparisonRow, NarrativeSection } from "./fund-types"

function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) || v === 0 ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }
function fBps(v: number): string { const a = Math.abs(Math.round(v)); return `${v >= 0 ? "+" : "\u2212"}${a}bps` }
function secPct(d: FundData) { return nz(d.nonAgencyRmbs) + nz(d.agencyRmbs) + nz(d.abs) + nz(d.clo) + nz(d.cmbs) }
function igPct(d: FundData) { return nz(d.aaa) + nz(d.aa) + nz(d.a) + nz(d.bbb) }

function buildNarrative(a: FundData, b: FundData, tA: string, tB: string, mode: AnalysisMode): NarrativeSection[] {
  const sections: NarrativeSection[] = []
  const secBps = (nz(a.secYield) - nz(b.secYield)) * 10000
  const sA = secPct(a), sB = secPct(b)
  const iA = igPct(a), iB = igPct(b)
  const durA = nz(a.duration), durB = nz(b.duration)
  const thrD = (nz(a.threeYear) - nz(b.threeYear)) * 100
  const shA = nz(a.sharpe), shB = nz(b.sharpe)
  const expBps = (nz(a.expense) - nz(b.expense)) * 10000

  // --- Takeaway (the key card) ---
  const tkLines: string[] = []
  if (mode === "internal") {
    const hi = secBps > 0 ? tA : tB
    const lo = secBps > 0 ? tB : tA
    const absBps = Math.abs(Math.round(secBps))
    const durComp = Math.abs(durA - durB) <= 0.5
    const credComp = Math.abs(iA - iB) <= 0.10
    const hiYield = absBps > 20
    const perf3 = thrD > 1.5
    const perfNeg = thrD < -1.5

    const hiCred = iA > iB + 0.05 ? tA : (iB > iA + 0.05 ? tB : null)
    const loDur = durA < durB - 0.15 ? tA : (durB < durA - 0.15 ? tB : null)

    if (hiYield && credComp && durComp && perf3 && hi === tA) {
      tkLines.push(`${tA} delivers a ${fBps(absBps)} yield advantage over ${tB} with comparable credit quality (avg ${avgCreditQuality(a)}) and duration (${fNum(durA)} vs ${fNum(durB)}). 3Y outperformance of ${thrD.toFixed(1)}% confirms the income pickup translates to total return.`)
    } else if (hiYield && hiCred === hi) {
      tkLines.push(`${hi} offers a ${fBps(absBps)} yield pickup while maintaining higher credit quality (avg ${avgCreditQuality(hi === tA ? a : b)} vs ${avgCreditQuality(hi === tA ? b : a)}).${durComp ? ` Duration profiles are comparable (${fNum(durA)} vs ${fNum(durB)}).` : ""}`)
      if (perf3) tkLines.push(`3Y performance supports: ${thrD > 0 ? tA : tB} ahead by ${Math.abs(thrD).toFixed(1)}%.`)
    } else if (hiYield && loDur === hi) {
      tkLines.push(`${hi} yields ${fBps(absBps)} more at shorter duration (${fNum(hi === tA ? durA : durB)} vs ${fNum(hi === tA ? durB : durA)}), implying comparable yield with less rate risk.`)
      if (hiCred) tkLines.push(`${hiCred} also carries higher credit quality (avg ${avgCreditQuality(hiCred === tA ? a : b)}).`)
    } else if (hiYield && durComp) {
      tkLines.push(`${hi} offers a ${fBps(absBps)} yield pickup at similar duration.${Math.abs(sA - sB) > 0.15 ? ` Differential driven by ${hi}'s securitized overweight (${fPct(hi === tA ? sA : sB, 0)}) vs ${lo}'s corporate tilt.` : ""}`)
      if (hiCred) tkLines.push(`${hiCred} maintains higher credit quality (avg ${avgCreditQuality(hiCred === tA ? a : b)} vs ${avgCreditQuality(hiCred === tA ? b : a)}).`)
      if (perf3) tkLines.push(`3Y track record supports: ${thrD > 0 ? tA : tB} ahead by ${Math.abs(thrD).toFixed(1)}%.`)
    } else if (hiYield) {
      tkLines.push(`${hi} yields ${fBps(absBps)} more but runs ${durA > durB ? (hi === tA ? "longer" : "shorter") : (hi === tA ? "shorter" : "longer")} duration (${fNum(durA)} vs ${fNum(durB)}).`)
    } else {
      tkLines.push(`Yields are comparable (${fPct(a.secYield)} vs ${fPct(b.secYield)}). Differentiation is in sector composition and risk profile.`)
    }
    if (expBps > 10) tkLines.push(`Likely Pushbacks: ${Math.round(expBps)}bps expense premium \u2014 offset by net-of-fee returns showing ${thrD > 0 ? `${thrD.toFixed(1)}% 3Y outperformance` : "comparable performance"}.`)
    if (perfNeg && hi === tA) tkLines.push(`Note: ${tB} has outperformed over 3Y despite the yield gap.`)
  } else {
    // Advisor mode -- cleaner, no sales language but still highlight advantages
    const hi = secBps > 0 ? tA : tB
    const hiCred = iA > iB + 0.05 ? tA : (iB > iA + 0.05 ? tB : null)
    const loDur = durA < durB - 0.15 ? tA : (durB < durA - 0.15 ? tB : null)

    if (Math.abs(secBps) > 20) {
      let line = `${hi} provides a ${fBps(Math.abs(secBps))} yield advantage`
      if (hiCred === hi) line += ` while maintaining higher average credit quality (${avgCreditQuality(hi === tA ? a : b)} vs ${avgCreditQuality(hi === tA ? b : a)})`
      if (Math.abs(durA - durB) <= 0.5) line += ` at a comparable duration profile`
      else if (loDur === hi) line += ` at shorter duration (${fNum(hi === tA ? durA : durB)} vs ${fNum(hi === tA ? durB : durA)})`
      tkLines.push(line + ".")
      if (hiCred && hiCred !== hi && Math.abs(iA - iB) > 0.05) tkLines.push(`${hiCred} maintains higher credit quality (avg ${avgCreditQuality(hiCred === tA ? a : b)}).`)
    } else {
      tkLines.push(`Both funds offer similar yield levels with differentiation in sector allocation and positioning.`)
    }
    if (Math.abs(thrD) > 1.5) tkLines.push(`${thrD > 0 ? tA : tB} has outperformed by ${Math.abs(thrD).toFixed(1)}% over 3 years.`)
  }
  sections.push({ title: "Takeaway", lines: tkLines })

  // --- Income ---
  const incLines: string[] = []
  if (Math.abs(secBps) > 20) {
    const hi = secBps > 0 ? tA : tB
    incLines.push(`${hi} offers a ${fBps(Math.abs(secBps))} SEC yield advantage (${fPct(a.secYield)} vs ${fPct(b.secYield)}).`)
  } else {
    incLines.push(`SEC yields are comparable at ${fPct(a.secYield)} vs ${fPct(b.secYield)}.`)
  }
  if (nz(a.distributionYield) > 0 || nz(b.distributionYield) > 0)
    incLines.push(`Distribution yield: ${fPct(a.distributionYield)} vs ${fPct(b.distributionYield)}.`)
  if (nz(a.ytwYtm) > 0 || nz(b.ytwYtm) > 0)
    incLines.push(`YTW/YTM: ${fPct(a.ytwYtm)} vs ${fPct(b.ytwYtm)}.`)
  sections.push({ title: "Income", lines: incLines })

  // --- Risk ---
  const riskLines: string[] = []
  if (Math.abs(durA - durB) <= 0.5) riskLines.push(`Duration is aligned (${fNum(a.duration)} vs ${fNum(b.duration)}).`)
  else { const l = durA > durB ? tA : tB; riskLines.push(`${l} runs longer at ${fNum(Math.max(durA, durB))} vs ${fNum(Math.min(durA, durB))}.`) }
  if (nz(a.stdDev) > 0 && nz(b.stdDev) > 0) { const h = nz(a.stdDev) > nz(b.stdDev) ? tA : tB; riskLines.push(`${h} higher vol (${fNum(a.stdDev)} vs ${fNum(b.stdDev)}).`) }
  if (Math.abs(shA - shB) > 0.15) { const w = shA > shB ? tA : tB; riskLines.push(`${w} better Sharpe (${fNum(Math.max(shA, shB))} vs ${fNum(Math.min(shA, shB))}).`) }
  else if (shA > 0) riskLines.push(`Sharpe ratios comparable (${fNum(shA)} vs ${fNum(shB)}).`)
  if (expBps > 10 || expBps < -10) { const p = expBps > 0 ? tA : tB; riskLines.push(`${p} is ${Math.abs(Math.round(expBps))}bps more expensive (${fPct(a.expense)} vs ${fPct(b.expense)}).`) }
  sections.push({ title: "Risk & Structure", lines: riskLines })

  return sections
}

function keyStats(a: FundData, b: FundData, mode: AnalysisMode): ComparisonRow[] {
  const rows: ComparisonRow[] = [
    { label: "Duration", a: fNum(a.duration), b: fNum(b.duration), nA: a.duration, nB: b.duration, better: "low" },
  ]

  if (mode === "advisor") {
    // Only show yield metrics where "our fund" (a) looks better
    const secA = nz(a.secYield), secB = nz(b.secYield)
    const distA = nz(a.distributionYield), distB = nz(b.distributionYield)
    const ytwA = nz(a.ytwYtm), ytwB = nz(b.ytwYtm)
    if (secA >= secB && secA > 0) rows.push({ label: "30-Day SEC Yield", a: fPct(a.secYield), b: fPct(b.secYield), nA: a.secYield, nB: b.secYield, better: "high" })
    if (distA >= distB && distA > 0) rows.push({ label: "Distribution Yield", a: fPct(a.distributionYield), b: fPct(b.distributionYield), nA: a.distributionYield, nB: b.distributionYield, better: "high" })
    if (ytwA >= ytwB && ytwA > 0) rows.push({ label: "YTW / YTM", a: fPct(a.ytwYtm), b: fPct(b.ytwYtm), nA: a.ytwYtm, nB: b.ytwYtm, better: "high" })
    // If none are better, show SEC yield anyway
    if (rows.length === 1) rows.push({ label: "30-Day SEC Yield", a: fPct(a.secYield), b: fPct(b.secYield), nA: a.secYield, nB: b.secYield, better: "high" })
  } else {
    rows.push(
      { label: "YTW / YTM", a: fPct(a.ytwYtm), b: fPct(b.ytwYtm), nA: a.ytwYtm, nB: b.ytwYtm, better: "high" },
      { label: "30-Day SEC Yield", a: fPct(a.secYield), b: fPct(b.secYield), nA: a.secYield, nB: b.secYield, better: "high" },
      { label: "Distribution Yield", a: fPct(a.distributionYield), b: fPct(b.distributionYield), nA: a.distributionYield, nB: b.distributionYield, better: "high" },
    )
  }

  rows.push(
    { label: "Expense Ratio", a: fPct(a.expense), b: fPct(b.expense), nA: a.expense, nB: b.expense, better: "low" },
    { label: "Std Deviation", a: fNum(a.stdDev), b: fNum(b.stdDev), nA: a.stdDev, nB: b.stdDev, better: "low" },
    { label: "Sharpe Ratio", a: fNum(a.sharpe), b: fNum(b.sharpe), nA: a.sharpe, nB: b.sharpe, better: "high" },
    { label: "Correlation", a: fNum(a.correlation), b: fNum(b.correlation), nA: a.correlation, nB: b.correlation, better: "none" },
  )

  return rows.filter(r => r.a !== "\u2014" || r.b !== "\u2014")
}

function perfTable(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "YTD", a: fPct(a.ytd), b: fPct(b.ytd), nA: a.ytd, nB: b.ytd, better: "high" },
    { label: "1 Year", a: fPct(a.oneYear), b: fPct(b.oneYear), nA: a.oneYear, nB: b.oneYear, better: "high" },
    { label: "3 Year", a: fPct(a.threeYear), b: fPct(b.threeYear), nA: a.threeYear, nB: b.threeYear, better: "high" },
    { label: "Common Inception", a: fPct(a.commonInception), b: fPct(b.commonInception), nA: a.commonInception, nB: b.commonInception, better: "high" },
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
  add("Other", a.other, b.other)
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

function buildPieData(fund: FundData): { name: string; value: number }[] {
  const entries = [
    { name: "Non-Agency RMBS", value: nz(fund.nonAgencyRmbs) },
    { name: "Agency RMBS", value: nz(fund.agencyRmbs) },
    { name: "ABS", value: nz(fund.abs) },
    { name: "CLO", value: nz(fund.clo) },
    { name: "CMBS", value: nz(fund.cmbs) },
    { name: "Corporate Credit", value: nz(fund.corporateCredit) },
    { name: "Government / Cash", value: nz(fund.governmentCash) },
    { name: "Other", value: nz(fund.other) },
  ]
  return entries.filter(e => Math.abs(e.value) > 0.005).map(e => ({ ...e, value: Math.round(e.value * 1000) / 10 }))
}

function buildCreditPieData(fund: FundData): { name: string; value: number }[] {
  const entries = [
    { name: "AAA / US Gov", value: nz(fund.aaa) },
    { name: "AA", value: nz(fund.aa) },
    { name: "A", value: nz(fund.a) },
    { name: "BBB", value: nz(fund.bbb) },
    { name: "BB", value: nz(fund.bb) },
    { name: "B", value: nz(fund.b) },
    { name: "CCC", value: nz(fund.ccc) },
    { name: "Below CCC", value: nz(fund.belowCcc) },
  ]
  return entries.filter(e => e.value > 0.005).map(e => ({ ...e, value: Math.round(e.value * 1000) / 10 }))
}

function avgCreditQuality(fund: FundData): string {
  // Weighted average: AAA=1, AA=2, A=3, BBB=4, BB=5, B=6, CCC=7, <CCC=8
  const buckets = [
    { w: 1, v: nz(fund.aaa) }, { w: 2, v: nz(fund.aa) }, { w: 3, v: nz(fund.a) },
    { w: 4, v: nz(fund.bbb) }, { w: 5, v: nz(fund.bb) }, { w: 6, v: nz(fund.b) },
    { w: 7, v: nz(fund.ccc) }, { w: 8, v: nz(fund.belowCcc) },
  ]
  const total = buckets.reduce((s, b) => s + b.v, 0)
  if (total < 0.01) return "\u2014"
  const avg = buckets.reduce((s, b) => s + b.w * b.v, 0) / total
  const labels = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "Below CCC"]
  return labels[Math.max(0, Math.min(7, Math.round(avg) - 1))]
}

export function runAnalysis(dataA: FundData, dataB: FundData, mode: AnalysisMode): AnalysisResult {
  return {
    tickerA: dataA.ticker, tickerB: dataB.ticker, nameA: dataA.name, nameB: dataB.name, mode,
    narrative: buildNarrative(dataA, dataB, dataA.ticker, dataB.ticker, mode),
    keyStats: keyStats(dataA, dataB, mode),
    performance: perfTable(dataA, dataB),
    sectorAllocation: sectorTable(dataA, dataB),
    creditQuality: creditTable(dataA, dataB),
    pieDataA: buildPieData(dataA),
    pieDataB: buildPieData(dataB),
    creditPieA: buildCreditPieData(dataA),
    creditPieB: buildCreditPieData(dataB),
    avgCreditA: avgCreditQuality(dataA),
    avgCreditB: avgCreditQuality(dataB),
    chartData: [
      { period: "YTD", fundA: nz(dataA.ytd) * 100, fundB: nz(dataB.ytd) * 100 },
      { period: "1Y", fundA: nz(dataA.oneYear) * 100, fundB: nz(dataB.oneYear) * 100 },
      ...(nz(dataA.commonInception) !== 0 || nz(dataB.commonInception) !== 0 ? [{ period: "Inception", fundA: nz(dataA.commonInception) * 100, fundB: nz(dataB.commonInception) * 100 }] : []),
      ...(nz(dataA.threeYear) !== 0 || nz(dataB.threeYear) !== 0 ? [{ period: "3Y", fundA: nz(dataA.threeYear) * 100, fundB: nz(dataB.threeYear) * 100 }] : []),
    ],
  }
}
