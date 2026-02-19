import type { FundData, AnalysisMode, AnalysisResult, ComparisonRow, NarrativeSection } from "./fund-types"

// --- Helpers ---
function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) || v === 0 ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }
function fBps(v: number): string { const a = Math.abs(Math.round(v)); return `${v >= 0 ? "+" : "\u2212"}${a}bps` }
function secPct(d: FundData) { return nz(d.nonAgencyRmbs) + nz(d.agencyRmbs) + nz(d.abs) + nz(d.clo) + nz(d.cmbs) }
function igPct(d: FundData) { return nz(d.aaa) + nz(d.aa) + nz(d.a) + nz(d.bbb) }

// --- Narrative sections ---
function buildNarrative(a: FundData, b: FundData, tA: string, tB: string, mode: AnalysisMode): NarrativeSection[] {
  const sections: NarrativeSection[] = []
  const secBps = (nz(a.secYield) - nz(b.secYield)) * 10000
  const sA = secPct(a), sB = secPct(b)
  const cA = nz(a.corporateCredit), cB = nz(b.corporateCredit)
  const iA = igPct(a), iB = igPct(b)
  const durA = nz(a.duration), durB = nz(b.duration)
  const thrD = (nz(a.threeYear) - nz(b.threeYear)) * 100
  const shA = nz(a.sharpe), shB = nz(b.sharpe)
  const expBps = (nz(a.expense) - nz(b.expense)) * 10000

  // --- Sector ---
  const secLines: string[] = []
  if (Math.abs(sA - sB) > 0.10) {
    const secH = sA > sB ? tA : tB, secL = sA > sB ? tB : tA
    secLines.push(`${secH} is securitized-heavy at ${fPct(sA > sB ? sA : sB, 0)} vs ${fPct(sA > sB ? sB : sA, 0)} for ${secL}.`)
    if (cA > 0.10 || cB > 0.10) {
      const corpH = cA > cB ? tA : tB
      secLines.push(`${corpH} carries the larger corporate allocation (${fPct(Math.max(cA, cB), 0)} vs ${fPct(Math.min(cA, cB), 0)}).`)
    }
  } else {
    secLines.push(`Both funds have similar securitized weightings (${fPct(sA, 0)} vs ${fPct(sB, 0)}).`)
  }
  // Sub-sector callouts
  const clA = nz(a.clo), clB = nz(b.clo)
  if (Math.abs(clA - clB) > 0.05) {
    const clH = clA > clB ? tA : tB
    secLines.push(`CLO divergence: ${clH} at ${fPct(Math.max(clA, clB), 0)} vs ${fPct(Math.min(clA, clB), 0)}.`)
  }
  const rA = nz(a.nonAgencyRmbs), rB = nz(b.nonAgencyRmbs)
  if (Math.abs(rA - rB) > 0.05) {
    const rH = rA > rB ? tA : tB
    secLines.push(`Non-agency RMBS: ${rH} at ${fPct(Math.max(rA, rB), 0)} vs ${fPct(Math.min(rA, rB), 0)}.`)
  }
  const agA = nz(a.agencyRmbs), agB = nz(b.agencyRmbs)
  if (Math.abs(agA - agB) > 0.05) {
    const agH = agA > agB ? tA : tB
    secLines.push(`Agency RMBS: ${agH} at ${fPct(Math.max(agA, agB), 0)} vs ${fPct(Math.min(agA, agB), 0)}.`)
  }
  sections.push({ title: "Sector Allocation", lines: secLines })

  // --- Income ---
  const incLines: string[] = []
  if (Math.abs(secBps) > 20) {
    const hi = secBps > 0 ? tA : tB
    incLines.push(`${hi} offers a ${fBps(Math.abs(secBps))} SEC yield advantage (${fPct(a.secYield)} vs ${fPct(b.secYield)}).`)
    // Attribute to sector if meaningful
    if (Math.abs(sA - sB) > 0.15) {
      const secH = sA > sB ? tA : tB
      if (secH === hi) incLines.push(`Yield pickup aligns with the heavier securitized allocation.`)
      else incLines.push(`Yield pickup despite a lower securitized allocation, driven by credit positioning and duration.`)
    }
  } else {
    incLines.push(`SEC yields are comparable (${fPct(a.secYield)} vs ${fPct(b.secYield)}).`)
  }
  if (nz(a.distributionYield) > 0 || nz(b.distributionYield) > 0) {
    incLines.push(`Distribution yield: ${fPct(a.distributionYield)} vs ${fPct(b.distributionYield)}.`)
  }
  if (nz(a.ytwYtm) > 0 || nz(b.ytwYtm) > 0) {
    incLines.push(`YTW/YTM: ${fPct(a.ytwYtm)} vs ${fPct(b.ytwYtm)}.`)
  }
  sections.push({ title: "Income", lines: incLines })

  // --- Risk ---
  const riskLines: string[] = []
  const durDiff = Math.abs(durA - durB)
  if (durDiff <= 0.5) {
    riskLines.push(`Duration is aligned (${fNum(a.duration)} vs ${fNum(b.duration)}).`)
  } else {
    const longer = durA > durB ? tA : tB
    riskLines.push(`${longer} runs longer duration at ${fNum(durA > durB ? durA : durB)} vs ${fNum(durA > durB ? durB : durA)}.`)
  }
  if (nz(a.stdDev) > 0 && nz(b.stdDev) > 0) {
    const hvol = nz(a.stdDev) > nz(b.stdDev) ? tA : tB
    riskLines.push(`${hvol} shows higher vol (${fNum(a.stdDev)} vs ${fNum(b.stdDev)} std dev).`)
  }
  if (shA > 0 && shB > 0) {
    if (Math.abs(shA - shB) > 0.15) {
      const better = shA > shB ? tA : tB
      riskLines.push(`${better} has the better Sharpe (${fNum(shA > shB ? shA : shB)} vs ${fNum(shA > shB ? shB : shA)}).`)
    } else {
      riskLines.push(`Sharpe ratios are comparable (${fNum(shA)} vs ${fNum(shB)}).`)
    }
  }
  // Credit quality
  if (Math.abs(iA - iB) > 0.08) {
    const hiIg = iA > iB ? tA : tB
    riskLines.push(`${hiIg} is higher quality (${fPct(iA > iB ? iA : iB, 0)} IG vs ${fPct(iA > iB ? iB : iA, 0)}).`)
  }
  if (expBps > 10 || expBps < -10) {
    const pricier = expBps > 0 ? tA : tB
    riskLines.push(`${pricier} is ${Math.abs(Math.round(expBps))}bps more expensive (${fPct(a.expense)} vs ${fPct(b.expense)}).`)
  }
  sections.push({ title: "Risk & Structure", lines: riskLines })

  // --- Performance ---
  const perfLines: string[] = []
  if (nz(a.ytd) !== 0 || nz(b.ytd) !== 0) perfLines.push(`YTD: ${fPct(a.ytd)} vs ${fPct(b.ytd)}.`)
  if (nz(a.oneYear) !== 0 || nz(b.oneYear) !== 0) perfLines.push(`1Y: ${fPct(a.oneYear)} vs ${fPct(b.oneYear)}.`)
  if (nz(a.threeYear) !== 0 || nz(b.threeYear) !== 0) {
    perfLines.push(`3Y: ${fPct(a.threeYear)} vs ${fPct(b.threeYear)}${Math.abs(thrD) > 1 ? ` (${thrD > 0 ? tA : tB} by ${Math.abs(thrD).toFixed(1)}pp)` : ""}.`)
  }
  if (nz(a.commonInception) !== 0 || nz(b.commonInception) !== 0) perfLines.push(`Common inception: ${fPct(a.commonInception)} vs ${fPct(b.commonInception)}.`)
  sections.push({ title: "Performance", lines: perfLines })

  // --- Takeaway ---
  const tkLines: string[] = []
  if (mode === "internal") {
    // Lean-on / handle / positioning
    if (secBps > 30 && Math.abs(sA - sB) > 0.15) {
      tkLines.push(`Lead with the ${fBps(Math.abs(secBps))} yield pickup -- directly tied to the securitized overweight (${fPct(sA, 0)} vs ${fPct(sB, 0)}).`)
    } else if (secBps > 20) {
      tkLines.push(`${fBps(secBps)} income advantage is the primary talking point.`)
    }
    if (thrD > 1.5) tkLines.push(`3Y outperformance of ${thrD.toFixed(1)}pp supports the track record argument.`)
    if (expBps > 10) tkLines.push(`Expect the expense objection (${Math.round(expBps)}bps premium) -- offset with net-of-fee returns and income differential.`)
    if (shA > shB + 0.2) tkLines.push(`Sharpe advantage (${fNum(shA)} vs ${fNum(shB)}) helps on the risk-adjusted angle.`)
    else if (shB > shA + 0.2) tkLines.push(`They have the Sharpe edge (${fNum(shB)} vs ${fNum(shA)}) -- pivot to income and absolute return.`)
    if (durDiff <= 0.5 && Math.abs(iA - iB) <= 0.1 && secBps > 20) {
      tkLines.push(`Comparable duration and credit quality make this a clean income upgrade story.`)
    }
    if (tkLines.length === 0) tkLines.push(`Positioning depends on client priorities -- income, risk-adjusted return, or sector diversification.`)
  } else {
    // Advisor -- cleaner summary
    if (secBps > 20) tkLines.push(`${tA} provides additional yield (${fBps(Math.abs(secBps))}) through its securitized allocation.`)
    else if (secBps < -20) tkLines.push(`${tB} offers higher current income, though ${tA} differs in sector composition and risk profile.`)
    if (durDiff <= 0.5) tkLines.push(`Both funds have similar rate sensitivity.`)
    if (thrD > 1.5) tkLines.push(`${tA} has outperformed over 3 years by ${thrD.toFixed(1)} percentage points.`)
    else if (thrD < -1.5) tkLines.push(`${tB} has outperformed over 3 years by ${Math.abs(thrD).toFixed(1)} percentage points.`)
    if (tkLines.length === 0) tkLines.push(`Both funds are broadly comparable across key metrics.`)
  }
  sections.push({ title: "Takeaway", lines: tkLines })

  return sections
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

// --- Main ---
export function runAnalysis(dataA: FundData, dataB: FundData, mode: AnalysisMode): AnalysisResult {
  const tA = dataA.ticker, tB = dataB.ticker
  return {
    tickerA: tA, tickerB: tB, nameA: dataA.name, nameB: dataB.name, mode,
    narrative: buildNarrative(dataA, dataB, tA, tB, mode),
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
