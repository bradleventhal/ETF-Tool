import type { FundData, AnalysisMode, AnalysisResult, ComparisonRow, NarrativeSection } from "./fund-types"

function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) || v === 0 ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }
function fBps(v: number): string { const a = Math.abs(Math.round(v)); return `${v >= 0 ? "+" : "\u2212"}${a}bps` }
function secPct(d: FundData) {
  // Securitized = Non-Agency RMBS + CLO + ABS (Agency RMBS and CMBS are NOT securitized)
  return nz(d.nonAgencyRmbs) + nz(d.clo) + nz(d.abs)
}
function creditRank(label: string): number {
  const ranks: Record<string, number> = { "AAA": 1, "AA": 2, "A": 3, "BBB": 4, "BB": 5, "B": 6, "CCC": 7, "Below CCC": 8 }
  return ranks[label] ?? 9
}
function igPct(d: FundData) { return nz(d.aaa) + nz(d.aa) + nz(d.a) + nz(d.bbb) }
function topCreditBuckets(d: FundData): string {
  const buckets = [
    { label: "AAA/US Gov", v: nz(d.aaa) }, { label: "AA", v: nz(d.aa) }, { label: "A", v: nz(d.a) },
    { label: "BBB", v: nz(d.bbb) }, { label: "BB", v: nz(d.bb) }, { label: "B", v: nz(d.b) },
    { label: "CCC", v: nz(d.ccc) }, { label: "Below CCC", v: nz(d.belowCcc) },
  ].filter(b => b.v > 0.01).sort((a, b) => b.v - a.v)
  const top = buckets.slice(0, 3)
  return top.map(b => `${b.label} (${(b.v * 100).toFixed(0)}%)`).join(", ")
}

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
  // Shared metrics
  const hi = secBps > 0 ? tA : tB
  const lo = secBps > 0 ? tB : tA
  const absBps = Math.abs(Math.round(secBps))
  const durComp = Math.abs(durA - durB) <= 0.5
  const hiYield = absBps > 20
  const perf3 = thrD > 1.5
  const perfNeg = thrD < -1.5
  // Credit: any step difference is meaningful (AA vs A, etc.)
  const avgCredA = avgCreditQuality(a), avgCredB = avgCreditQuality(b)
  const credRankA = creditRank(avgCredA), credRankB = creditRank(avgCredB)
  const hiCred = credRankA < credRankB ? tA : (credRankB < credRankA ? tB : null)
  const loDur = durA < durB - 0.15 ? tA : (durB < durA - 0.15 ? tB : null)
  const relExpBps = Math.round((nz(a.expense) - nz(b.expense)) * 10000)
  const secLabel = "30-Day SEC Yield"

  // Duration category helper
  function durCategory(d: number): string {
    if (d < 1) return "Ultrashort"
    if (d < 2) return "Short"
    if (d < 5) return "Intermediate"
    if (d < 7) return "Core/Core Plus"
    return "Long Duration"
  }
  const catA = durCategory(durA), catB = durCategory(durB)
  const sameCat = catA === catB

  // Sector exposure description
  function sectorDesc(ticker: string, secVal: number): string {
    if (secVal < 0.01) return `${ticker} has no meaningful securitized exposure`
    return `${ticker}'s securitized allocation of ${fPct(secVal, 0)}`
  }

  if (mode === "internal") {
    // ---- HEADLINE ----
    if (hiYield) {
      tkLines.push(`${hi} delivers a ${fBps(absBps)} ${secLabel} advantage over ${lo} (${fPct(a.secYield)} vs ${fPct(b.secYield)}).`)
    } else {
      tkLines.push(`SEC yields are comparable (${fPct(a.secYield)} vs ${fPct(b.secYield)}). Differentiation is in sector composition and risk profile.`)
    }

    // ---- CREDIT QUALITY ----
    if (hiCred) {
      const credDiff = Math.abs(credRankA - credRankB)
      const emphasis = credDiff >= 2 ? "significantly " : ""
      tkLines.push(`${hiCred} carries ${emphasis}higher average credit quality (${hiCred === tA ? avgCredA : avgCredB} vs ${hiCred === tA ? avgCredB : avgCredA}).${hiYield && hiCred === hi ? " Higher yield AND better credit quality is a strong positioning story." : ""}`)
    } else {
      tkLines.push(`Credit quality is in line across both funds (avg ${avgCredA}).`)
    }

    // ---- DURATION ----
    if (loDur && hiYield && loDur === hi) {
      tkLines.push(`${hi} achieves this yield advantage at shorter duration (${fNum(hi === tA ? durA : durB)} vs ${fNum(hi === tA ? durB : durA)}). Both funds are classified as ${catA} (${sameCat ? "same" : `${catA} vs ${catB}`} category), meaning comparable income with less rate risk.`)
    } else if (durComp) {
      tkLines.push(`Duration profiles are aligned at ${fNum(durA)} vs ${fNum(durB)} \u2014 both ${catA} duration. This makes it a clean apples-to-apples income comparison within the same investment category.`)
    } else {
      const longer = durA > durB ? tA : tB
      const shorter = durA > durB ? tB : tA
      tkLines.push(`${longer} runs longer duration (${fNum(Math.max(durA, durB))} \u2014 ${durA > durB ? catA : catB}) vs ${shorter} (${fNum(Math.min(durA, durB))} \u2014 ${durA > durB ? catB : catA}). The category difference matters for rate risk context.`)
    }

    // ---- SECTOR DRIVER ----
    if (Math.abs(sA - sB) > 0.15) {
      const hiSec = sA > sB ? tA : tB
      const loSec = sA > sB ? tB : tA
      const loSecVal = sA > sB ? sB : sA
      const hiSecVal = sA > sB ? sA : sB
      if (loSecVal < 0.01) {
        tkLines.push(`Yield differential is driven by ${hiSec}'s securitized overweight (${fPct(hiSecVal, 0)}). ${sectorDesc(loSec, loSecVal)} \u2014 it is primarily corporate/government focused.`)
      } else {
        tkLines.push(`Yield differential is driven by ${hiSec}'s securitized overweight (${fPct(hiSecVal, 0)} securitized) vs ${loSec}'s lower securitized allocation (${fPct(loSecVal, 0)}).`)
      }
    }

    // ---- PERFORMANCE ----
    if (perf3) {
      tkLines.push(`3Y total return confirms the income story: ${tA} has outperformed by ${Math.abs(thrD).toFixed(1)}%.`)
    } else if (perfNeg) {
      tkLines.push(`Note: ${tB} has outperformed over 3Y (${Math.abs(thrD).toFixed(1)}%) despite the yield gap. Be prepared to address this.`)
    } else if (Math.abs(thrD) > 0.01) {
      tkLines.push(`3Y performance is closely matched: ${thrD > 0 ? tA : tB} ahead by ${Math.abs(thrD).toFixed(1)}%.`)
    }

    // ---- LEAD WITH / PUSHBACKS ----
    const leads: string[] = []
    if (hiYield && hi === tA) leads.push("yield advantage")
    if (hiCred === tA) leads.push("higher credit quality")
    if (loDur === tA) leads.push("shorter duration")
    else if (durComp) leads.push("comparable duration")
    if (leads.length > 0) tkLines.push(`Lead with: ${leads.join(", ")}.`)

    if (relExpBps > 5) {
      tkLines.push(`Likely Pushbacks: ${relExpBps}bps higher expense ratio (${fPct(a.expense)} vs ${fPct(b.expense)}) \u2014 counter with net-of-fee performance${perf3 ? ` showing ${Math.abs(thrD).toFixed(1)}% 3Y outperformance` : ""}.`)
    }
    if (perfNeg && hi === tA && !perf3) {
      tkLines.push(`Likely Pushbacks: 3Y underperformance of ${Math.abs(thrD).toFixed(1)}% \u2014 address with recent trend improvement and yield carry.`)
    }
  } else {
    // ---- ADVISOR MODE ----
    if (hiYield) {
      tkLines.push(`${hi} provides a ${fBps(absBps)} ${secLabel} advantage (${fPct(a.secYield)} vs ${fPct(b.secYield)}).`)
    } else {
      tkLines.push(`Both funds offer similar yield levels (${fPct(a.secYield)} vs ${fPct(b.secYield)}) with differentiation in sector allocation and positioning.`)
    }

    if (hiCred) {
      const credDiff = Math.abs(credRankA - credRankB)
      const emphasis = credDiff >= 2 ? "meaningfully " : ""
  tkLines.push(`${hiCred} maintains ${emphasis}higher average credit quality (${hiCred === tA ? avgCredA : avgCredB} vs ${hiCred === tA ? avgCredB : avgCredA}).${hiYield && hiCred === hi ? " The combination of higher yield and better credit quality is notable." : ""}`)
    } else {
      tkLines.push(`Credit quality is in line across both funds (avg ${avgCredA}).`)
    }

    if (loDur && hiYield && loDur === hi) {
      tkLines.push(`${hi} achieves this at shorter duration (${fNum(hi === tA ? durA : durB)} vs ${fNum(hi === tA ? durB : durA)}). Both are classified as ${catA} duration, suggesting comparable income with reduced rate sensitivity.`)
    } else if (durComp) {
      tkLines.push(`Duration profiles are aligned at ${fNum(durA)} vs ${fNum(durB)} \u2014 both ${catA} duration.`)
    }

    if (Math.abs(sA - sB) > 0.15) {
      const hiSec = sA > sB ? tA : tB
      const loSec = sA > sB ? tB : tA
      const loSecVal = sA > sB ? sB : sA
      const hiSecVal = sA > sB ? sA : sB
      if (loSecVal < 0.01) {
        tkLines.push(`The income differential reflects ${hiSec}'s securitized positioning (${fPct(hiSecVal, 0)}), while ${loSec} is primarily corporate/government focused.`)
      } else {
        tkLines.push(`The income differential reflects ${hiSec}'s securitized positioning (${fPct(hiSecVal, 0)}) relative to ${loSec}'s allocation (${fPct(loSecVal, 0)}).`)
      }
    }

    if (Math.abs(thrD) > 1.5) {
      tkLines.push(`3Y performance: ${thrD > 0 ? tA : tB} ahead by ${Math.abs(thrD).toFixed(1)}%.`)
    } else if (Math.abs(thrD) > 0.01) {
      tkLines.push(`3Y performance is closely matched: ${thrD > 0 ? tA : tB} ahead by ${Math.abs(thrD).toFixed(1)}%.`)
    }
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
    { label: "Duration", a: fNum(a.duration), b: fNum(b.duration), nA: a.duration, nB: b.duration, better: "none" },
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
    if (Math.abs(nz(vA)) > 0.001 || Math.abs(nz(vB)) > 0.001)
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
  // Generate reverse pitch: run the engine as if competitor (B) is pitching against us (A)
  let reversePitch: NarrativeSection | null = null
  if (mode === "internal") {
    const flippedNarrative = buildNarrative(dataB, dataA, dataB.ticker, dataA.ticker, "internal")
    const flippedTakeaway = flippedNarrative.find(s => s.title === "Takeaway")
    if (flippedTakeaway) {
      reversePitch = { title: "Competitor\u2019s Pitch", lines: flippedTakeaway.lines }
    }
  }
  return {
    tickerA: dataA.ticker, tickerB: dataB.ticker, nameA: dataA.name, nameB: dataB.name, mode,
    narrative: buildNarrative(dataA, dataB, dataA.ticker, dataB.ticker, mode),
    reversePitch,
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
