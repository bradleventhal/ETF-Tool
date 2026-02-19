import type { FundData, AnalysisMode, AnalysisResult, ComparisonRow, NarrativeSection } from "./fund-types"

// --- Helpers ---

function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }
function fBps(v: number): string { const a = Math.abs(Math.round(v)); return `${v >= 0 ? "+" : "\u2212"}${a}bps` }
function comp(a: number | null, b: number | null, t: number) {
  const av = nz(a), bv = nz(b)
  return !(av === 0 && bv === 0) && Math.abs(av - bv) <= t
}
function secPct(d: FundData) { return nz(d.nonAgencyRmbs) + nz(d.agencyRmbs) + nz(d.abs) + nz(d.clo) + nz(d.cmbs) }
function igPct(d: FundData) { return nz(d.aaa) + nz(d.aa) + nz(d.a) + nz(d.bbb) }
function hyPct(d: FundData) { return nz(d.bb) + nz(d.b) + nz(d.ccc) + nz(d.belowCcc) }

function dominant(d: FundData): { name: string; pct: number } {
  const s = [
    { name: "Non-Agency RMBS", pct: nz(d.nonAgencyRmbs) },
    { name: "Agency RMBS", pct: nz(d.agencyRmbs) },
    { name: "CLO", pct: nz(d.clo) },
    { name: "ABS", pct: nz(d.abs) },
    { name: "CMBS", pct: nz(d.cmbs) },
    { name: "Corporate Credit", pct: nz(d.corporateCredit) },
    { name: "Government/Cash", pct: nz(d.governmentCash) },
  ]
  return s.reduce((m, x) => x.pct > m.pct ? x : m, s[0])
}

// --- Narrative builders ---

function structure(a: FundData, b: FundData, tA: string, tB: string, durC: boolean, credC: boolean, igA: number, igB: number): string {
  const p: string[] = []
  if (durC) {
    p.push(`Duration is broadly comparable at ${fNum(a.duration)} vs ${fNum(b.duration)} years, so interest-rate sensitivity is similar.`)
  } else {
    const diff = nz(a.duration) - nz(b.duration)
    const longer = diff > 0 ? tA : tB, shorter = diff > 0 ? tB : tA
    p.push(`${longer} carries ${Math.abs(diff).toFixed(2)} years more duration than ${shorter} (${fNum(a.duration)} vs ${fNum(b.duration)}), implying meaningfully different rate exposure.`)
  }
  if (credC) {
    p.push(`Credit profiles are aligned\u2014IG allocation at ${fPct(igA, 0)} vs ${fPct(igB, 0)}.`)
  } else {
    const hi = igA > igB ? tA : tB, lo = igA > igB ? tB : tA
    p.push(`Credit quality diverges: ${hi} is ${fPct(Math.max(igA, igB), 0)} IG vs ${lo} at ${fPct(Math.min(igA, igB), 0)}.`)
    const hyHi = igA > igB ? tB : tA
    const hyVal = igA > igB ? hyPct(b) : hyPct(a)
    if (hyVal > 0.05) {
      p.push(`${hyHi}'s ${fPct(hyVal, 0)} sub-IG allocation introduces spread widening risk in a credit downturn, but offers higher current income as compensation.`)
    }
  }
  return p.join(" ")
}

function sectors(a: FundData, b: FundData, tA: string, tB: string, mode: AnalysisMode): string {
  const sA = secPct(a), sB = secPct(b)
  const cA = nz(a.corporateCredit), cB = nz(b.corporateCredit)
  const dA = dominant(a), dB = dominant(b)
  const p: string[] = []
  const secDiff = Math.abs(sA - sB)

  if (secDiff > 0.15) {
    const secH = sA > sB ? tA : tB, corpH = sA > sB ? tB : tA
    const secHpct = Math.max(sA, sB), corpHpct = sA > sB ? cB : cA
    p.push(`Fundamentally different sector orientation: ${secH} is ${fPct(secHpct, 0)} securitized while ${corpH} leans corporate at ${fPct(corpHpct, 0)}.`)
    if (mode === "internal") {
      p.push(`Securitized credit typically trades at wider spreads per unit of duration versus comparably-rated corporates. As of recent market levels, AAA CLO tranches offer 120\u2013150bps while AAA-rated corporates price inside 60bps\u2014this structural spread advantage partially explains the yield differential. Securitized sectors also exhibit lower sensitivity to corporate spread widening events given distinct collateral and cash flow dynamics.`)
    } else {
      p.push(`This structural difference means return drivers are distinct: one is driven by prepayment, housing, and consumer credit dynamics, the other by corporate fundamentals, M&A activity, and credit spreads.`)
    }
  } else if (secDiff > 0.05) {
    p.push(`Both funds blend securitized and corporate exposure, though ${sA > sB ? tA : tB} tilts more toward securitized (${fPct(Math.max(sA, sB), 0)} vs ${fPct(Math.min(sA, sB), 0)}).`)
    if (mode === "internal" && cA > 0.15 && cB > 0.15) {
      p.push(`The shared corporate allocation means both carry some exposure to IG/HY spread movements, but the securitized overweight provides marginal diversification.`)
    }
  } else {
    p.push(`Sector allocations are broadly similar with securitized at ${fPct(sA, 0)} vs ${fPct(sB, 0)}.`)
  }

  // Dominant sector
  if (dA.name !== dB.name && dA.pct > 0.2 && dB.pct > 0.2) {
    p.push(`${tA} is anchored in ${dA.name} (${fPct(dA.pct, 0)}) vs ${tB} in ${dB.name} (${fPct(dB.pct, 0)})\u2014creating differentiated risk/return profiles.`)
  }

  // CLO
  const clA = nz(a.clo), clB = nz(b.clo)
  if (Math.abs(clA - clB) > 0.1 && (clA > 0.1 || clB > 0.1)) {
    const clH = clA > clB ? tA : tB
    p.push(`Notable CLO divergence: ${clH} at ${fPct(Math.max(clA, clB), 0)} vs ${fPct(Math.min(clA, clB), 0)}.`)
    if (mode === "internal") {
      p.push(`CLOs offer floating-rate exposure and structural subordination, but carry complexity and liquidity premiums that widen in risk-off environments.`)
    }
  }

  // Non-Agency RMBS
  const rA = nz(a.nonAgencyRmbs), rB = nz(b.nonAgencyRmbs)
  if (Math.abs(rA - rB) > 0.1 && (rA > 0.1 || rB > 0.1)) {
    const rH = rA > rB ? tA : tB
    p.push(`${rH}'s non-agency RMBS overweight (${fPct(Math.max(rA, rB), 0)}) targets residential mortgage credit risk, which historically exhibits lower correlation to corporate spreads and benefits from housing appreciation tailwinds.`)
  }

  // Agency RMBS
  const agA = nz(a.agencyRmbs), agB = nz(b.agencyRmbs)
  if (Math.abs(agA - agB) > 0.15 && (agA > 0.15 || agB > 0.15)) {
    const agH = agA > agB ? tA : tB
    p.push(`${agH} carries a meaningful Agency RMBS position (${fPct(Math.max(agA, agB), 0)})\u2014government-guaranteed but subject to prepayment and negative convexity risk.`)
  }

  return p.join(" ")
}

function income(a: FundData, b: FundData, tA: string, tB: string, secBps: number, mode: AnalysisMode): string {
  const p: string[] = []
  p.push(`SEC yield: ${tA} at ${fPct(a.secYield)} vs ${tB} at ${fPct(b.secYield)} (${fBps(secBps)} differential).`)

  const sA = secPct(a), sB = secPct(b)
  const iA = igPct(a), iB = igPct(b)
  const hi = secBps >= 0 ? tA : tB

  if (Math.abs(secBps) > 20) {
    if (Math.abs(sA - sB) > 0.15) {
      const secH = sA > sB ? tA : tB
      if (secH === hi) {
        p.push(`The yield advantage is largely attributable to ${hi}'s heavier securitized allocation, where structured credit spreads remain wider than comparably-rated corporates\u2014a function of complexity premium and less index-driven demand.`)
      } else {
        p.push(`Despite ${secBps >= 0 ? tB : tA}'s larger securitized allocation, ${hi} achieves the yield pickup through credit positioning and duration extension.`)
      }
    } else if (Math.abs(iA - iB) > 0.1) {
      const loIg = iA < iB ? tA : tB
      if (loIg === hi) {
        p.push(`The yield advantage reflects ${hi}'s greater sub-IG allocation where spread compensation is wider\u2014approximately 200\u2013400bps over IG in current markets.`)
      }
    } else if (Math.abs(nz(a.duration) - nz(b.duration)) > 0.5) {
      const longD = nz(a.duration) > nz(b.duration) ? tA : tB
      if (longD === hi) {
        p.push(`Duration extension contributes to the yield differential\u2014${hi}'s longer profile captures term premium.`)
      }
    }
  }

  const dA = nz(a.distributionYield), dB = nz(b.distributionYield)
  if (dA > 0 && dB > 0) {
    const dd = (dA - dB) * 10000
    if (Math.abs(dd) > 20) {
      p.push(`Distribution yield also favors ${dd > 0 ? tA : tB} (${fPct(dd > 0 ? a.distributionYield : b.distributionYield)} vs ${fPct(dd > 0 ? b.distributionYield : a.distributionYield)}).`)
    }
  }

  if (nz(a.ytwYtm) > 0 && nz(b.ytwYtm) > 0) {
    const ytwD = (nz(a.ytwYtm) - nz(b.ytwYtm)) * 10000
    if (Math.abs(ytwD) > 30) {
      p.push(`YTW/YTM spread of ${fBps(ytwD)} further underscores the income opportunity.`)
    }
  }

  return p.join(" ")
}

function risk(a: FundData, b: FundData, tA: string, tB: string, mode: AnalysisMode): string {
  const p: string[] = []
  const volC = comp(a.stdDev, b.stdDev, 0.1)
  if (volC) {
    p.push(`Volatility is comparable (${fNum(a.stdDev)} vs ${fNum(b.stdDev)}), suggesting similar realized risk despite structural differences.`)
  } else {
    const hv = nz(a.stdDev) > nz(b.stdDev) ? tA : tB
    const lv = hv === tA ? tB : tA
    p.push(`${hv} exhibits higher volatility (${fNum(hv === tA ? a.stdDev : b.stdDev)} vs ${fNum(hv === tA ? b.stdDev : a.stdDev)}), indicating greater price dispersion.`)
    const sH = secPct(hv === tA ? a : b), sL = secPct(lv === tA ? a : b)
    if (sH > sL + 0.15) {
      p.push(`This likely reflects the mark-to-market nature of securitized holdings, which can gap wider in liquidity-driven selloffs even when fundamental credit quality remains intact.`)
    }
  }

  const shA = nz(a.sharpe), shB = nz(b.sharpe)
  if (shA > 0 && shB > 0) {
    const diff = Math.abs(shA - shB)
    const better = shA > shB ? tA : tB
    if (diff > 0.2) {
      if (mode === "internal") {
        if (better === tA) p.push(`Sharpe ratio favors us (${fNum(a.sharpe)} vs ${fNum(b.sharpe)})\u2014strong risk-adjusted return story.`)
        else p.push(`Sharpe ratio is lower (${fNum(a.sharpe)} vs ${fNum(b.sharpe)}). Pivot to income and structural differentiation.`)
      } else {
        p.push(`Risk-adjusted returns favor ${better} (Sharpe ${fNum(shA > shB ? a.sharpe : b.sharpe)} vs ${fNum(shA > shB ? b.sharpe : a.sharpe)}).`)
      }
    } else {
      p.push(`Sharpe ratios are comparable (${fNum(a.sharpe)} vs ${fNum(b.sharpe)}).`)
    }
  }

  const expBps = (nz(a.expense) - nz(b.expense)) * 10000
  if (Math.abs(expBps) > 10) {
    const cheaper = expBps < 0 ? tA : tB, pricier = expBps < 0 ? tB : tA
    p.push(`${pricier} carries a ${Math.abs(Math.round(expBps))}bps expense premium over ${cheaper} (${fPct(expBps < 0 ? b.expense : a.expense)} vs ${fPct(expBps < 0 ? a.expense : b.expense)}).`)
    if (mode === "internal" && pricier === tA) {
      p.push(`Frame the cost as access to active securitized credit management, which requires specialized analytics and deal-level diligence.`)
    }
  }

  return p.join(" ")
}

function perf(a: FundData, b: FundData, tA: string, tB: string): string {
  const p: string[] = []
  const ytdD = (nz(a.ytd) - nz(b.ytd)) * 100
  const oneD = (nz(a.oneYear) - nz(b.oneYear)) * 100
  const thrD = (nz(a.threeYear) - nz(b.threeYear)) * 100

  if (Math.abs(ytdD) > 0.5 || Math.abs(oneD) > 0.5) {
    const nb = (ytdD + oneD) / 2 > 0 ? tA : tB
    p.push(`Near-term performance favors ${nb}: YTD ${fPct(a.ytd)} vs ${fPct(b.ytd)}, 1Y ${fPct(a.oneYear)} vs ${fPct(b.oneYear)}.`)
  } else {
    p.push(`Near-term returns are closely matched (YTD: ${fPct(a.ytd)} vs ${fPct(b.ytd)}).`)
  }
  if (nz(a.threeYear) !== 0 && nz(b.threeYear) !== 0) {
    if (Math.abs(thrD) > 1) {
      const b3 = thrD > 0 ? tA : tB
      p.push(`Over 3 years, ${b3} outperformed by ${Math.abs(thrD).toFixed(1)}pp (${fPct(a.threeYear)} vs ${fPct(b.threeYear)}), pointing to sustained manager skill and sector selection.`)
    } else {
      p.push(`3-year returns are comparable (${fPct(a.threeYear)} vs ${fPct(b.threeYear)}).`)
    }
  }
  if (nz(a.commonInception) !== 0 && nz(b.commonInception) !== 0) {
    const ciD = (nz(a.commonInception) - nz(b.commonInception)) * 100
    if (Math.abs(ciD) > 1) {
      p.push(`Common inception return: ${fPct(a.commonInception)} vs ${fPct(b.commonInception)}.`)
    }
  }
  return p.join(" ")
}

function summary(a: FundData, b: FundData, tA: string, tB: string, mode: AnalysisMode, secBps: number, durC: boolean, credC: boolean): string {
  const iA = igPct(a), iB = igPct(b)
  const sA = secPct(a), sB = secPct(b)
  const thrD = (nz(a.threeYear) - nz(b.threeYear)) * 100
  const expBps = (nz(a.expense) - nz(b.expense)) * 10000
  const shD = nz(a.sharpe) - nz(b.sharpe)

  if (mode === "advisor") {
    if (secBps > 30 && durC && credC) {
      let s = `${tA} offers a clear income upgrade: ${fBps(secBps)} yield advantage with comparable duration and credit quality. `
      if (Math.abs(sA - sB) > 0.15) s += `The differential is sector-driven\u2014securitized credit spreads remain attractive relative to corporates at current levels. `
      s += thrD > 1 ? "The multi-year track record validates the quality of the income advantage." : "This makes it a straightforward income-enhancement opportunity."
      return s
    }
    if (secBps > 0) {
      let s = `${tA} delivers ${fBps(secBps)} more yield, with structural tradeoffs in `
      s += !durC ? "duration positioning" : !credC ? "credit quality" : `sector allocation (${fPct(sA, 0)} securitized vs ${fPct(sB, 0)})`
      s += `. The additional income reflects a deliberate risk/return choice. Suitability depends on rate and credit outlook.`
      return s
    }
    let s = `The primary case for ${tA} is structural differentiation. `
    if (thrD > 2) s += `Multi-year outperformance of ${thrD.toFixed(1)}pp demonstrates value creation through ${Math.abs(sA - sB) > 0.15 ? "securitized credit expertise" : "active management"}.`
    else s += "Evaluate based on portfolio diversification benefits and forward-looking sector views."
    return s
  }

  // Internal
  if (secBps > 30 && durC && credC) {
    let s = `LEAD WITH: ${fBps(secBps)} yield pickup, no structural sacrifice. `
    if (Math.abs(sA - sB) > 0.15) s += `KEY DIFFERENTIATOR: Securitized allocation (${fPct(sA, 0)}) vs corporate tilt (${fPct(nz(b.corporateCredit), 0)}) captures wider structured credit spreads without corporate event risk. `
    s += `TALKING POINTS: (1) meaningful income advantage, (2) ${thrD > 1 ? `${thrD.toFixed(1)}pp 3Y outperformance` : "comparable risk characteristics"}, (3) expense of ${fPct(a.expense)} justified by alpha generation. `
    if (shD < -0.3) s += `HANDLE: Lower Sharpe\u2014pivot to total return and income. `
    if (expBps > 10) s += `HANDLE: ${Math.round(expBps)}bps expense gap offset by ${Math.round(secBps)}bps yield advantage. `
    return s
  }
  if (secBps > 0) {
    let s = `POSITIONING: Tactical income upgrade. ${fBps(secBps)} pickup driven by `
    if (Math.abs(sA - sB) > 0.15) s += `securitized overweight\u2014structured spreads remain historically wide vs corporates. `
    else if (!durC) s += `duration extension of ${Math.abs(nz(a.duration) - nz(b.duration)).toFixed(1)}yr. `
    else if (!credC) s += `credit positioning (${fPct(iA, 0)} IG vs ${fPct(iB, 0)}). `
    else s += "portfolio construction. "
    s += "BE TRANSPARENT about the structural difference and frame as intentional."
    return s
  }
  let s = "CHALLENGE: No yield advantage. "
  if (thrD > 2) s += `BEST ANGLE: ${thrD.toFixed(1)}pp 3Y outperformance\u2014position as alpha-generating manager swap. ${Math.abs(sA - sB) > 0.15 ? `Differentiated securitized exposure provides diversification from corporate spread risk. ` : ""}`
  else s += `Lead with structural diversification${Math.abs(sA - sB) > 0.15 ? ` (${fPct(sA, 0)} securitized vs ${fPct(sB, 0)})` : ""}. This requires a consultative portfolio-fit conversation.`
  return s
}

// --- Tables ---

function keyStats(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "Duration", valueA: fNum(a.duration), valueB: fNum(b.duration), numA: a.duration, numB: b.duration, higherIsBetter: false },
    { label: "YTW / YTM", valueA: fPct(a.ytwYtm), valueB: fPct(b.ytwYtm), numA: a.ytwYtm, numB: b.ytwYtm, higherIsBetter: true },
    { label: "SEC Yield", valueA: fPct(a.secYield), valueB: fPct(b.secYield), numA: a.secYield, numB: b.secYield, higherIsBetter: true },
    { label: "Distribution Yield", valueA: fPct(a.distributionYield), valueB: fPct(b.distributionYield), numA: a.distributionYield, numB: b.distributionYield, higherIsBetter: true },
    { label: "Expense Ratio", valueA: fPct(a.expense), valueB: fPct(b.expense), numA: a.expense, numB: b.expense, higherIsBetter: false },
    { label: "Std Deviation", valueA: fNum(a.stdDev), valueB: fNum(b.stdDev), numA: a.stdDev, numB: b.stdDev, higherIsBetter: false },
    { label: "Sharpe Ratio", valueA: fNum(a.sharpe), valueB: fNum(b.sharpe), numA: a.sharpe, numB: b.sharpe, higherIsBetter: true },
    { label: "Correlation", valueA: fNum(a.correlation), valueB: fNum(b.correlation), numA: a.correlation, numB: b.correlation, higherIsBetter: false },
  ]
}

function perfComp(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "YTD", valueA: fPct(a.ytd), valueB: fPct(b.ytd), numA: a.ytd, numB: b.ytd, higherIsBetter: true },
    { label: "1 Year", valueA: fPct(a.oneYear), valueB: fPct(b.oneYear), numA: a.oneYear, numB: b.oneYear, higherIsBetter: true },
    { label: "Common Inception", valueA: fPct(a.commonInception), valueB: fPct(b.commonInception), numA: a.commonInception, numB: b.commonInception, higherIsBetter: true },
    { label: "3 Year", valueA: fPct(a.threeYear), valueB: fPct(b.threeYear), numA: a.threeYear, numB: b.threeYear, higherIsBetter: true },
  ]
}

function creditQ(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "AAA / Gov", valueA: fPct(a.aaa, 0), valueB: fPct(b.aaa, 0), numA: a.aaa, numB: b.aaa, higherIsBetter: true },
    { label: "AA", valueA: fPct(a.aa, 0), valueB: fPct(b.aa, 0), numA: a.aa, numB: b.aa, higherIsBetter: true },
    { label: "A", valueA: fPct(a.a, 0), valueB: fPct(b.a, 0), numA: a.a, numB: b.a, higherIsBetter: true },
    { label: "BBB", valueA: fPct(a.bbb, 0), valueB: fPct(b.bbb, 0), numA: a.bbb, numB: b.bbb, higherIsBetter: true },
    { label: "BB", valueA: fPct(a.bb, 0), valueB: fPct(b.bb, 0), numA: a.bb, numB: b.bb, higherIsBetter: false },
    { label: "B", valueA: fPct(a.b, 0), valueB: fPct(b.b, 0), numA: a.b, numB: b.b, higherIsBetter: false },
    { label: "CCC & Below", valueA: fPct(nz(a.ccc) + nz(a.belowCcc), 0), valueB: fPct(nz(b.ccc) + nz(b.belowCcc), 0), numA: nz(a.ccc) + nz(a.belowCcc), numB: nz(b.ccc) + nz(b.belowCcc), higherIsBetter: false },
  ].filter(r => r.numA !== 0 || r.numB !== 0)
}

function sectorAlloc(a: FundData, b: FundData): ComparisonRow[] {
  const rows: ComparisonRow[] = []
  const add = (l: string, vA: number | null, vB: number | null) => {
    if (nz(vA) > 0.01 || nz(vB) > 0.01)
      rows.push({ label: l, valueA: fPct(vA, 1), valueB: fPct(vB, 1), numA: vA, numB: vB, higherIsBetter: true })
  }
  add("Non-Agency RMBS", a.nonAgencyRmbs, b.nonAgencyRmbs)
  add("Agency RMBS", a.agencyRmbs, b.agencyRmbs)
  add("ABS", a.abs, b.abs)
  add("CLO", a.clo, b.clo)
  add("CMBS", a.cmbs, b.cmbs)
  add("Corporate Credit", a.corporateCredit, b.corporateCredit)
  add("Government / Cash", a.governmentCash, b.governmentCash)
  if (nz(a.other) > 0.01 || nz(b.other) > 0.01)
    rows.push({ label: "Other", valueA: fPct(a.other, 1), valueB: fPct(b.other, 1), numA: a.other, numB: b.other, higherIsBetter: true })
  return rows
}

// --- Main ---

export function runAnalysis(dataA: FundData, dataB: FundData, mode: AnalysisMode): AnalysisResult {
  const tA = dataA.ticker, tB = dataB.ticker
  const iA = igPct(dataA), iB = igPct(dataB)
  const durC = comp(dataA.duration, dataB.duration, 0.75)
  const credC = comp(iA, iB, 0.1)
  const secBps = (nz(dataA.secYield) - nz(dataB.secYield)) * 10000

  const sections: NarrativeSection[] = [
    { heading: "Structure & Duration", body: structure(dataA, dataB, tA, tB, durC, credC, iA, iB), type: "text" },
    { heading: "Sector Allocation", body: sectors(dataA, dataB, tA, tB, mode), type: "text" },
    { heading: "Income & Yield", body: income(dataA, dataB, tA, tB, secBps, mode), type: "text" },
    { heading: "Risk & Expenses", body: risk(dataA, dataB, tA, tB, mode), type: "text" },
    { heading: "Performance", body: perf(dataA, dataB, tA, tB), type: "text" },
    { heading: mode === "advisor" ? "Summary" : "Takeaway", body: summary(dataA, dataB, tA, tB, mode, secBps, durC, credC), type: "callout" },
  ]

  return {
    tickerA: tA, tickerB: tB,
    nameA: dataA.name, nameB: dataB.name,
    sections,
    keyStats: keyStats(dataA, dataB),
    performanceComp: perfComp(dataA, dataB),
    creditQuality: creditQ(dataA, dataB),
    sectorAllocation: sectorAlloc(dataA, dataB),
    chartData: [
      { period: "YTD", fundA: nz(dataA.ytd) * 100, fundB: nz(dataB.ytd) * 100 },
      { period: "1Y", fundA: nz(dataA.oneYear) * 100, fundB: nz(dataB.oneYear) * 100 },
      { period: "3Y", fundA: nz(dataA.threeYear) * 100, fundB: nz(dataB.threeYear) * 100 },
    ],
    durComp: durC, creditComp: credC,
  }
}
