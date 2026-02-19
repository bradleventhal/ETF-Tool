import type { FundData, AnalysisMode, AnalysisResult, ComparisonRow, SectorRow } from "./fund-types"

// --- Utility functions ---

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

function fmtBps(val: number): string {
  const abs = Math.abs(Math.round(val))
  return `${val >= 0 ? "+" : "\u2212"}${abs}bps`
}

function isComparable(a: number | null, b: number | null, thresh: number): boolean {
  const aVal = nz(a)
  const bVal = nz(b)
  return !(aVal === 0 && bVal === 0) && Math.abs(aVal - bVal) <= thresh
}

// --- Sector composition helpers ---

function getSecuritizedPct(d: FundData): number {
  return nz(d.nonAgencyRmbs) + nz(d.agencyRmbs) + nz(d.abs) + nz(d.clo) + nz(d.cmbs)
}

function getDominantSector(d: FundData): { name: string; pct: number } {
  const sectors = [
    { name: "Non-Agency RMBS", pct: nz(d.nonAgencyRmbs) },
    { name: "Agency RMBS", pct: nz(d.agencyRmbs) },
    { name: "CLO", pct: nz(d.clo) },
    { name: "ABS", pct: nz(d.abs) },
    { name: "CMBS", pct: nz(d.cmbs) },
    { name: "Corporate Credit", pct: nz(d.corporateCredit) },
    { name: "Government/Cash", pct: nz(d.governmentCash) },
  ]
  return sectors.reduce((max, s) => (s.pct > max.pct ? s : max), sectors[0])
}

function getIg(d: FundData): number {
  return nz(d.aaa) + nz(d.aa) + nz(d.a) + nz(d.bbb)
}

function getHy(d: FundData): number {
  return nz(d.bb) + nz(d.b) + nz(d.ccc) + nz(d.belowCcc)
}

// --- Narrative builders ---

function buildStructureText(
  a: FundData, b: FundData,
  tA: string, tB: string,
  durComp: boolean, creditComp: boolean,
  igA: number, igB: number
): string {
  const parts: string[] = []

  // Duration
  if (durComp) {
    parts.push(`Duration is broadly comparable (${fmtNum(a.duration, 2)} vs ${fmtNum(b.duration, 2)} years), meaning similar interest rate sensitivity.`)
  } else {
    const durDiff = nz(a.duration) - nz(b.duration)
    const longer = durDiff > 0 ? tA : tB
    const shorter = durDiff > 0 ? tB : tA
    parts.push(`${longer} carries ${Math.abs(durDiff).toFixed(2)} years more duration than ${shorter} (${fmtNum(a.duration, 2)} vs ${fmtNum(b.duration, 2)}), implying meaningfully different rate exposure.`)
  }

  // Credit
  if (creditComp) {
    parts.push(`Credit profiles are aligned\u2014investment grade allocation at ${fmtPct(igA, 0)} vs ${fmtPct(igB, 0)}.`)
  } else {
    const higherIg = igA > igB ? tA : tB
    const lowerIg = igA > igB ? tB : tA
    parts.push(`Credit quality diverges: ${higherIg} is ${fmtPct(Math.max(igA, igB), 0)} IG vs ${lowerIg} at ${fmtPct(Math.min(igA, igB), 0)}. The lower IG allocation implies greater exposure to sub-investment grade spread risk.`)
  }

  return parts.join(" ")
}

function buildSectorText(
  a: FundData, b: FundData,
  tA: string, tB: string,
  mode: AnalysisMode
): string {
  const secA = getSecuritizedPct(a)
  const secB = getSecuritizedPct(b)
  const corpA = nz(a.corporateCredit)
  const corpB = nz(b.corporateCredit)
  const domA = getDominantSector(a)
  const domB = getDominantSector(b)
  const parts: string[] = []

  // Securitized vs Corporate tilt
  const secDiff = Math.abs(secA - secB)
  if (secDiff > 0.15) {
    const secHeavy = secA > secB ? tA : tB
    const corpHeavy = secA > secB ? tB : tA
    const secHeavyPct = Math.max(secA, secB)
    const corpHeavyPct = secA > secB ? corpB : corpA

    parts.push(`Fundamentally different sector orientation: ${secHeavy} is ${fmtPct(secHeavyPct, 0)} securitized while ${corpHeavy} leans corporate at ${fmtPct(corpHeavyPct, 0)}.`)

    if (mode === "internal") {
      parts.push(`Securitized credit typically offers wider spreads per unit of duration versus comparably-rated corporates, which partially explains the yield differential. Securitized sectors also carry less sensitivity to corporate spread widening events.`)
    } else {
      parts.push(`This structural difference means return drivers are distinct\u2014one portfolio is driven by prepayment and housing dynamics, the other by corporate fundamentals and credit spreads.`)
    }
  } else if (secDiff > 0.05) {
    parts.push(`Both funds blend securitized and corporate exposure, though ${secA > secB ? tA : tB} tilts more heavily toward securitized sectors (${fmtPct(Math.max(secA, secB), 0)} vs ${fmtPct(Math.min(secA, secB), 0)}).`)
  } else {
    parts.push(`Sector allocations are broadly similar with securitized at ${fmtPct(secA, 0)} vs ${fmtPct(secB, 0)}.`)
  }

  // Dominant sector callout
  if (domA.name !== domB.name && domA.pct > 0.2 && domB.pct > 0.2) {
    parts.push(`${tA} is anchored in ${domA.name} (${fmtPct(domA.pct, 0)}) while ${tB} concentrates in ${domB.name} (${fmtPct(domB.pct, 0)}), creating differentiated risk/return profiles.`)
  }

  // CLO callout
  const cloA = nz(a.clo), cloB = nz(b.clo)
  if (Math.abs(cloA - cloB) > 0.1 && (cloA > 0.1 || cloB > 0.1)) {
    const cloHeavy = cloA > cloB ? tA : tB
    parts.push(`Notable CLO allocation difference: ${cloHeavy} at ${fmtPct(Math.max(cloA, cloB), 0)} vs ${fmtPct(Math.min(cloA, cloB), 0)}. CLOs offer floating-rate exposure and structural protections but carry complexity premium.`)
  }

  // Non-Agency RMBS callout
  const naRmbsA = nz(a.nonAgencyRmbs), naRmbsB = nz(b.nonAgencyRmbs)
  if (Math.abs(naRmbsA - naRmbsB) > 0.1 && (naRmbsA > 0.1 || naRmbsB > 0.1)) {
    const rmbsHeavy = naRmbsA > naRmbsB ? tA : tB
    if (mode === "internal") {
      parts.push(`${rmbsHeavy}'s non-agency RMBS overweight (${fmtPct(Math.max(naRmbsA, naRmbsB), 0)}) targets spread pickup from residential mortgage credit risk, which has historically exhibited lower correlation to corporate spreads.`)
    }
  }

  return parts.join(" ")
}

function buildIncomeText(
  a: FundData, b: FundData,
  tA: string, tB: string,
  secDiffBps: number,
  mode: AnalysisMode
): string {
  const parts: string[] = []

  parts.push(`SEC yield: ${tA} at ${fmtPct(a.secYield, 2)} vs ${tB} at ${fmtPct(b.secYield, 2)} (${fmtBps(secDiffBps)} differential).`)

  // Explain WHY the yield differs using sector/credit data
  const secA = getSecuritizedPct(a), secB = getSecuritizedPct(b)
  const igA = getIg(a), igB = getIg(b)
  const higher = secDiffBps >= 0 ? tA : tB
  const lower = secDiffBps >= 0 ? tB : tA

  if (Math.abs(secDiffBps) > 20) {
    if (Math.abs(secA - secB) > 0.15) {
      const secHeavy = secA > secB ? tA : tB
      if (secHeavy === higher) {
        parts.push(`The yield advantage is largely attributable to ${higher}'s heavier securitized allocation, where structured credit spreads have remained wider than comparably-rated corporates.`)
      } else {
        parts.push(`Despite ${lower}'s larger securitized allocation, ${higher} achieves the yield pickup through credit positioning and duration extension.`)
      }
    } else if (Math.abs(igA - igB) > 0.1) {
      const lowerIg = igA < igB ? tA : tB
      if (lowerIg === higher) {
        parts.push(`The yield advantage reflects ${higher}'s greater allocation to sub-IG credit, where spread compensation is wider.`)
      }
    }
  }

  // Distribution yield comparison if meaningful
  if (nz(a.distributionYield) > 0 && nz(b.distributionYield) > 0) {
    const distDiff = (nz(a.distributionYield) - nz(b.distributionYield)) * 10000
    if (Math.abs(distDiff) > 20) {
      parts.push(`Distribution yield also favors ${distDiff > 0 ? tA : tB} at ${fmtPct(distDiff > 0 ? a.distributionYield : b.distributionYield, 2)} vs ${fmtPct(distDiff > 0 ? b.distributionYield : a.distributionYield, 2)}.`)
    }
  }

  return parts.join(" ")
}

function buildRiskText(
  a: FundData, b: FundData,
  tA: string, tB: string,
  mode: AnalysisMode
): string {
  const volComp = isComparable(a.stdDev, b.stdDev, 0.1)
  const parts: string[] = []

  if (volComp) {
    parts.push(`Volatility is comparable (${fmtNum(a.stdDev, 2)} vs ${fmtNum(b.stdDev, 2)}), suggesting similar realized risk despite structural differences.`)
  } else {
    const higher = nz(a.stdDev) > nz(b.stdDev) ? tA : tB
    const lower = nz(a.stdDev) > nz(b.stdDev) ? tB : tA
    parts.push(`${higher} exhibits higher volatility (${fmtNum(nz(a.stdDev) > nz(b.stdDev) ? a.stdDev : b.stdDev, 2)} vs ${fmtNum(nz(a.stdDev) > nz(b.stdDev) ? b.stdDev : a.stdDev, 2)}), indicating greater price dispersion in returns.`)
  }

  // Sharpe ratio
  const sharpeA = nz(a.sharpe), sharpeB = nz(b.sharpe)
  if (sharpeA > 0 && sharpeB > 0) {
    const better = sharpeA > sharpeB ? tA : tB
    const worse = sharpeA > sharpeB ? tB : tA
    if (Math.abs(sharpeA - sharpeB) > 0.2) {
      if (mode === "internal") {
        if (better === tA) {
          parts.push(`Sharpe ratio favors us at ${fmtNum(a.sharpe, 2)} vs ${fmtNum(b.sharpe, 2)}\u2014strong risk-adjusted return story.`)
        } else {
          parts.push(`Sharpe ratio is lower (${fmtNum(a.sharpe, 2)} vs ${fmtNum(b.sharpe, 2)}). Avoid leading with risk-adjusted metrics; pivot to income and structural differentiation.`)
        }
      } else {
        parts.push(`Risk-adjusted returns favor ${better} with a Sharpe of ${fmtNum(sharpeA > sharpeB ? a.sharpe : b.sharpe, 2)} vs ${fmtNum(sharpeA > sharpeB ? b.sharpe : a.sharpe, 2)}.`)
      }
    } else {
      parts.push(`Sharpe ratios are comparable (${fmtNum(a.sharpe, 2)} vs ${fmtNum(b.sharpe, 2)}).`)
    }
  }

  // Expense commentary
  const expDiff = (nz(a.expense) - nz(b.expense)) * 10000
  if (Math.abs(expDiff) > 10) {
    const cheaper = expDiff < 0 ? tA : tB
    const pricier = expDiff < 0 ? tB : tA
    parts.push(`${pricier} carries a ${Math.abs(Math.round(expDiff))}bps expense premium over ${cheaper} (${fmtPct(expDiff < 0 ? b.expense : a.expense, 2)} vs ${fmtPct(expDiff < 0 ? a.expense : b.expense, 2)}).`)
  }

  return parts.join(" ")
}

function buildPerformanceText(
  a: FundData, b: FundData,
  tA: string, tB: string,
  mode: AnalysisMode
): string {
  const ytdDiff = (nz(a.ytd) - nz(b.ytd)) * 100
  const oneYrDiff = (nz(a.oneYear) - nz(b.oneYear)) * 100
  const threeYrDiff = (nz(a.threeYear) - nz(b.threeYear)) * 100
  const parts: string[] = []

  // Near-term
  if (Math.abs(ytdDiff) > 0.5 || Math.abs(oneYrDiff) > 0.5) {
    const nearBetter = (ytdDiff + oneYrDiff) / 2 > 0 ? tA : tB
    parts.push(`Near-term performance favors ${nearBetter}: YTD ${fmtPct(a.ytd, 2)} vs ${fmtPct(b.ytd, 2)}, 1Y ${fmtPct(a.oneYear, 2)} vs ${fmtPct(b.oneYear, 2)}.`)
  } else {
    parts.push(`Near-term performance is closely matched (YTD: ${fmtPct(a.ytd, 2)} vs ${fmtPct(b.ytd, 2)}).`)
  }

  // 3-year
  if (nz(a.threeYear) !== 0 && nz(b.threeYear) !== 0) {
    if (Math.abs(threeYrDiff) > 1) {
      const better3y = threeYrDiff > 0 ? tA : tB
      parts.push(`Over 3 years, ${better3y} has outperformed by ${Math.abs(threeYrDiff).toFixed(1)} percentage points (${fmtPct(a.threeYear, 2)} vs ${fmtPct(b.threeYear, 2)}), which speaks to manager skill and sector selection.`)
    } else {
      parts.push(`3-year returns are comparable at ${fmtPct(a.threeYear, 2)} vs ${fmtPct(b.threeYear, 2)}.`)
    }
  }

  return parts.join(" ")
}

function buildSummary(
  a: FundData, b: FundData,
  tA: string, tB: string,
  mode: AnalysisMode,
  secDiffBps: number, durComp: boolean, creditComp: boolean
): string {
  const igA = getIg(a), igB = getIg(b)
  const secA = getSecuritizedPct(a), secB = getSecuritizedPct(b)
  const threeYrDiff = (nz(a.threeYear) - nz(b.threeYear)) * 100
  const expDiffBps = (nz(a.expense) - nz(b.expense)) * 10000
  const sharpeDiff = nz(a.sharpe) - nz(b.sharpe)

  if (mode === "advisor") {
    if (secDiffBps > 30 && durComp && creditComp) {
      let s = `${tA} offers a clear income upgrade: ${fmtBps(secDiffBps)} yield advantage with comparable duration and credit quality. `
      if (Math.abs(secA - secB) > 0.15) {
        s += `The yield differential is driven by sector allocation\u2014specifically, greater exposure to securitized credit where spread levels remain attractive relative to corporates. `
      }
      if (threeYrDiff > 1) s += "The multi-year track record validates the quality of the income advantage."
      else s += "This makes it a straightforward income-enhancement opportunity."
      return s
    }
    if (secDiffBps > 0) {
      let s = `${tA} delivers ${fmtBps(secDiffBps)} more yield, but with structural tradeoffs in `
      if (!durComp) s += "duration positioning"
      else if (!creditComp) s += "credit quality"
      else s += `sector allocation (${fmtPct(secA, 0)} securitized vs ${fmtPct(secB, 0)})`
      s += `. The additional income reflects a deliberate risk/return choice rather than free alpha. Suitability depends on the portfolio's rate and credit outlook.`
      return s
    }
    let s = `The primary case for ${tA} is structural differentiation rather than yield. `
    if (threeYrDiff > 2) {
      s += `Multi-year outperformance of ${threeYrDiff.toFixed(1)}pp demonstrates value creation through `
      s += Math.abs(secA - secB) > 0.15 ? "sector selection and securitized credit expertise." : "active portfolio management."
    } else {
      s += "Evaluate based on portfolio diversification benefits and forward-looking sector views."
    }
    return s
  }

  // Internal mode
  if (secDiffBps > 30 && durComp && creditComp) {
    let s = `LEAD WITH: ${fmtBps(secDiffBps)} yield pickup, no structural sacrifice. `
    if (Math.abs(secA - secB) > 0.15) {
      s += `KEY DIFFERENTIATOR: Our securitized allocation (${fmtPct(secA, 0)}) vs their corporate tilt (${fmtPct(nz(b.corporateCredit), 0)}) captures wider structured credit spreads without taking corporate event risk. `
    }
    s += `TALKING POINTS: (1) meaningful income advantage, (2) `
    s += threeYrDiff > 1 ? `${threeYrDiff.toFixed(1)}pp 3Y outperformance validates, ` : "comparable risk characteristics, "
    s += `(3) expense of ${fmtPct(a.expense, 2)} justified by alpha generation. `
    if (sharpeDiff < -0.3) {
      s += `HANDLE: Lower Sharpe (${fmtNum(a.sharpe, 2)} vs ${fmtNum(b.sharpe, 2)})\u2014pivot to total return and income. `
    }
    if (expDiffBps > 10) {
      s += `HANDLE: ${Math.round(expDiffBps)}bps expense gap\u2014offset by ${Math.round(secDiffBps)}bps yield advantage. `
    }
    return s
  }
  if (secDiffBps > 0) {
    let s = `POSITIONING: Tactical income upgrade with sector shift. ${fmtBps(secDiffBps)} pickup driven by `
    if (Math.abs(secA - secB) > 0.15) {
      s += `securitized credit overweight\u2014structured spreads remain historically wide vs corporates. `
    } else if (!durComp) {
      const durDiff = nz(a.duration) - nz(b.duration)
      s += `${Math.abs(durDiff).toFixed(1)}yr duration ${durDiff > 0 ? "extension" : "reduction"}. `
    } else if (!creditComp) {
      s += `credit positioning (${fmtPct(igA, 0)} IG vs ${fmtPct(igB, 0)}). `
    } else {
      s += "portfolio construction differences. "
    }
    s += "BE TRANSPARENT about the structural difference and frame it as intentional. "
    const oneYrDiff = (nz(a.oneYear) - nz(b.oneYear)) * 100
    if (oneYrDiff < -1) {
      s += `HANDLE: Recent underperformance (${oneYrDiff.toFixed(1)}pp 1Y)\u2014acknowledge, emphasize ${threeYrDiff > 0 ? "3Y track record" : "forward income and sector positioning"}.`
    }
    return s
  }
  let s = "CHALLENGE: No yield advantage. "
  if (threeYrDiff > 2) {
    s += `BEST ANGLE: ${threeYrDiff.toFixed(1)}pp 3Y outperformance\u2014position as alpha-generating manager swap. `
    if (Math.abs(secA - secB) > 0.15) {
      s += `Differentiated securitized exposure (${fmtPct(secA, 0)} vs ${fmtPct(secB, 0)}) provides diversification from corporate spread risk. `
    }
    if (expDiffBps > 10) s += `Justify ${Math.round(expDiffBps)}bps expense premium with alpha generation track record.`
  } else {
    s += "Lead with structural diversification: "
    if (Math.abs(secA - secB) > 0.15) {
      s += `distinct sector profile (${fmtPct(secA, 0)} securitized vs ${fmtPct(secB, 0)}) reduces correlation to corporate-heavy allocations. `
    }
    s += "This requires a consultative portfolio-fit conversation rather than a simple swap story."
  }
  return s
}

// --- Build comparison tables ---

function buildKeyStats(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "Duration", valueA: fmtNum(a.duration, 2), valueB: fmtNum(b.duration, 2), numA: a.duration, numB: b.duration, higherIsBetter: false },
    { label: "YTW / YTM", valueA: fmtPct(a.ytwYtm, 2), valueB: fmtPct(b.ytwYtm, 2), numA: a.ytwYtm, numB: b.ytwYtm, higherIsBetter: true },
    { label: "SEC Yield", valueA: fmtPct(a.secYield, 2), valueB: fmtPct(b.secYield, 2), numA: a.secYield, numB: b.secYield, higherIsBetter: true },
    { label: "Distribution Yield", valueA: fmtPct(a.distributionYield, 2), valueB: fmtPct(b.distributionYield, 2), numA: a.distributionYield, numB: b.distributionYield, higherIsBetter: true },
    { label: "Expense Ratio", valueA: fmtPct(a.expense, 2), valueB: fmtPct(b.expense, 2), numA: a.expense, numB: b.expense, higherIsBetter: false },
    { label: "Std Deviation", valueA: fmtNum(a.stdDev, 2), valueB: fmtNum(b.stdDev, 2), numA: a.stdDev, numB: b.stdDev, higherIsBetter: false },
    { label: "Sharpe Ratio", valueA: fmtNum(a.sharpe, 2), valueB: fmtNum(b.sharpe, 2), numA: a.sharpe, numB: b.sharpe, higherIsBetter: true },
    { label: "Correlation", valueA: fmtNum(a.correlation, 2), valueB: fmtNum(b.correlation, 2), numA: a.correlation, numB: b.correlation, higherIsBetter: false },
  ]
}

function buildPerformanceComp(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "YTD", valueA: fmtPct(a.ytd, 2), valueB: fmtPct(b.ytd, 2), numA: a.ytd, numB: b.ytd, higherIsBetter: true },
    { label: "1 Year", valueA: fmtPct(a.oneYear, 2), valueB: fmtPct(b.oneYear, 2), numA: a.oneYear, numB: b.oneYear, higherIsBetter: true },
    { label: "Common Inception", valueA: fmtPct(a.commonInception, 2), valueB: fmtPct(b.commonInception, 2), numA: a.commonInception, numB: b.commonInception, higherIsBetter: true },
    { label: "3 Year", valueA: fmtPct(a.threeYear, 2), valueB: fmtPct(b.threeYear, 2), numA: a.threeYear, numB: b.threeYear, higherIsBetter: true },
  ]
}

function buildCreditQuality(a: FundData, b: FundData): ComparisonRow[] {
  return [
    { label: "AAA / Gov", valueA: fmtPct(a.aaa, 0), valueB: fmtPct(b.aaa, 0), numA: a.aaa, numB: b.aaa, higherIsBetter: true },
    { label: "AA", valueA: fmtPct(a.aa, 0), valueB: fmtPct(b.aa, 0), numA: a.aa, numB: b.aa, higherIsBetter: true },
    { label: "A", valueA: fmtPct(a.a, 0), valueB: fmtPct(b.a, 0), numA: a.a, numB: b.a, higherIsBetter: true },
    { label: "BBB", valueA: fmtPct(a.bbb, 0), valueB: fmtPct(b.bbb, 0), numA: a.bbb, numB: b.bbb, higherIsBetter: true },
    { label: "BB", valueA: fmtPct(a.bb, 0), valueB: fmtPct(b.bb, 0), numA: a.bb, numB: b.bb, higherIsBetter: false },
    { label: "B", valueA: fmtPct(a.b, 0), valueB: fmtPct(b.b, 0), numA: a.b, numB: b.b, higherIsBetter: false },
    { label: "CCC & Below", valueA: fmtPct(nz(a.ccc) + nz(a.belowCcc), 0), valueB: fmtPct(nz(b.ccc) + nz(b.belowCcc), 0), numA: nz(a.ccc) + nz(a.belowCcc), numB: nz(b.ccc) + nz(b.belowCcc), higherIsBetter: false },
  ].filter((r) => r.numA !== 0 || r.numB !== 0)
}

function buildSectorAllocation(a: FundData, b: FundData): ComparisonRow[] {
  const rows: ComparisonRow[] = []
  const add = (label: string, vA: number | null, vB: number | null) => {
    if (nz(vA) > 0.01 || nz(vB) > 0.01) {
      rows.push({ label, valueA: fmtPct(vA, 1), valueB: fmtPct(vB, 1), numA: vA, numB: vB, higherIsBetter: true })
    }
  }
  add("Non-Agency RMBS", a.nonAgencyRmbs, b.nonAgencyRmbs)
  add("Agency RMBS", a.agencyRmbs, b.agencyRmbs)
  add("ABS", a.abs, b.abs)
  add("CLO", a.clo, b.clo)
  add("CMBS", a.cmbs, b.cmbs)
  add("Corporate Credit", a.corporateCredit, b.corporateCredit)
  add("Government / Cash", a.governmentCash, b.governmentCash)
  if (nz(a.other) > 0.01 || nz(b.other) > 0.01) {
    rows.push({ label: "Other", valueA: fmtPct(a.other, 1), valueB: fmtPct(b.other, 1), numA: a.other, numB: b.other, higherIsBetter: true })
  }
  return rows
}

// --- Main entry ---

export function runAnalysis(
  dataA: FundData,
  dataB: FundData,
  mode: AnalysisMode
): AnalysisResult {
  const tA = dataA.ticker, tB = dataB.ticker
  const igA = getIg(dataA), igB = getIg(dataB)
  const durComp = isComparable(dataA.duration, dataB.duration, 0.75)
  const creditComp = isComparable(igA, igB, 0.1)
  const secDiffBps = (nz(dataA.secYield) - nz(dataB.secYield)) * 10000

  return {
    title: `${tA} vs ${tB}`,
    structureText: buildStructureText(dataA, dataB, tA, tB, durComp, creditComp, igA, igB),
    sectorText: buildSectorText(dataA, dataB, tA, tB, mode),
    incomeText: buildIncomeText(dataA, dataB, tA, tB, secDiffBps, mode),
    riskText: buildRiskText(dataA, dataB, tA, tB, mode),
    performanceText: buildPerformanceText(dataA, dataB, tA, tB, mode),
    summaryLabel: mode === "advisor" ? "Summary" : "Takeaway",
    summaryText: buildSummary(dataA, dataB, tA, tB, mode, secDiffBps, durComp, creditComp),
    keyStats: buildKeyStats(dataA, dataB),
    performanceComp: buildPerformanceComp(dataA, dataB),
    creditQuality: buildCreditQuality(dataA, dataB),
    sectorAllocation: buildSectorAllocation(dataA, dataB),
    chartData: [
      { period: "YTD", fundA: nz(dataA.ytd) * 100, fundB: nz(dataB.ytd) * 100 },
      { period: "1Y", fundA: nz(dataA.oneYear) * 100, fundB: nz(dataB.oneYear) * 100 },
      { period: "3Y", fundA: nz(dataA.threeYear) * 100, fundB: nz(dataB.threeYear) * 100 },
    ],
    tickerA: tA,
    tickerB: tB,
    durComp,
    creditComp,
  }
}
