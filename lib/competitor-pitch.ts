import type { FundData, WarRoom, CompetitorArgument, Rebuttal, DifficultyTier, ConfidenceTag, YahooAnalytics } from "./fund-types"

// ========================================================================
// HELPERS
// ========================================================================
function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function pct(v: number | null, d = 2): string { return v == null ? "—" : (v * 100).toFixed(d) + "%" }
function bps(v: number): number { return Math.round(v * 10000) }
function absBps(a: number, b: number): number { return Math.abs(bps(nz(a) - nz(b))) }
function secPct(d: FundData) { return nz(d.nonAgencyRmbs) + nz(d.clo) + nz(d.abs) }
function igPct(d: FundData) { return nz(d.aaa) + nz(d.aa) + nz(d.a) + nz(d.bbb) }

// Deterministic but varied: hash two tickers to pick from template arrays
function pickTemplate(templates: string[], tickerA: string, tickerB: string, salt: string): string {
  let h = 0
  const s = tickerA + tickerB + salt
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0 }
  return templates[Math.abs(h) % templates.length]
}

// ========================================================================
// MARKET CONTEXT (hardcoded per spec — editable later via UI)
// ========================================================================
// Market context — update quarterly or when spread regime changes
const MARKET_CONTEXT_DATE = "Q2 2026"
const MARKET_CONTEXT = `Market context as of ${MARKET_CONTEXT_DATE}: Securitized credit spreads remain wide vs IG corporates. IG corporate spreads are near historically tight levels. Relative value opportunity in securitized vs corporates is historically attractive. Geopolitical risk (Iran/Hormuz) keeping oil elevated, adding inflation uncertainty.`

// ========================================================================
// STEP 1: IDENTIFY COMPETITOR ADVANTAGES
// ========================================================================
interface RawAdvantage {
  id: string
  metric: string
  magnitude: number // normalized 0-100 score for ranking
  theirValue: string
  ourValue: string
  deltaBps: number
  category: "yield" | "expense" | "performance" | "risk" | "credit" | "spread_history"
}

function findCompetitorAdvantages(us: FundData, them: FundData, yahoo?: YahooAnalytics): RawAdvantage[] {
  const advantages: RawAdvantage[] = []
  const tUs = us.ticker, tThem = them.ticker

  // SEC Yield: they win if higher by > 10bps
  const secDelta = absBps(them.secYield, us.secYield)
  if (nz(them.secYield) > nz(us.secYield) && secDelta > 10) {
    advantages.push({ id: "sec_yield", metric: "SEC Yield", magnitude: Math.min(secDelta / 2, 100), theirValue: pct(them.secYield), ourValue: pct(us.secYield), deltaBps: secDelta, category: "yield" })
  }

  // Distribution Yield
  const distDelta = absBps(them.distributionYield, us.distributionYield)
  if (nz(them.distributionYield) > nz(us.distributionYield) && distDelta > 10) {
    advantages.push({ id: "dist_yield", metric: "Distribution Yield", magnitude: Math.min(distDelta / 2, 100), theirValue: pct(them.distributionYield), ourValue: pct(us.distributionYield), deltaBps: distDelta, category: "yield" })
  }

  // Expense Ratio: they win if cheaper by > 5bps
  const expDelta = absBps(us.expense, them.expense)
  if (nz(us.expense) > nz(them.expense) && expDelta > 5) {
    advantages.push({ id: "expense", metric: "Expense Ratio", magnitude: Math.min(expDelta / 1.5, 100), theirValue: pct(them.expense), ourValue: pct(us.expense), deltaBps: expDelta, category: "expense" })
  }

  // 3Y Performance: they win if ahead by > 0.3%
  const perf3Delta = (nz(them.threeYear) - nz(us.threeYear)) * 100
  if (perf3Delta > 0.3) {
    advantages.push({ id: "3y_perf", metric: "3Y Total Return", magnitude: Math.min(perf3Delta * 8, 100), theirValue: pct(them.threeYear), ourValue: pct(us.threeYear), deltaBps: Math.round(perf3Delta * 100), category: "performance" })
  }

  // 1Y Performance
  const perf1Delta = (nz(them.oneYear) - nz(us.oneYear)) * 100
  if (perf1Delta > 0.5) {
    advantages.push({ id: "1y_perf", metric: "1Y Total Return", magnitude: Math.min(perf1Delta * 6, 100), theirValue: pct(them.oneYear), ourValue: pct(us.oneYear), deltaBps: Math.round(perf1Delta * 100), category: "performance" })
  }

  // Std Deviation: they win if lower by meaningful amount
  const stdDelta = nz(us.stdDev) - nz(them.stdDev)
  if (stdDelta > 0.3 && nz(them.stdDev) > 0) {
    advantages.push({ id: "std_dev", metric: "Volatility", magnitude: Math.min(stdDelta * 15, 100), theirValue: nz(them.stdDev).toFixed(2), ourValue: nz(us.stdDev).toFixed(2), deltaBps: 0, category: "risk" })
  }

  // Sharpe: they win if materially higher
  const sharpeDelta = nz(them.sharpe) - nz(us.sharpe)
  if (sharpeDelta > 0.15) {
    advantages.push({ id: "sharpe", metric: "Sharpe Ratio", magnitude: Math.min(sharpeDelta * 40, 100), theirValue: nz(them.sharpe).toFixed(2), ourValue: nz(us.sharpe).toFixed(2), deltaBps: 0, category: "risk" })
  }

  // Credit quality: they win if higher IG %
  const igDelta = (igPct(them) - igPct(us)) * 100
  if (igDelta > 5) {
    advantages.push({ id: "credit", metric: "Credit Quality", magnitude: Math.min(igDelta * 2, 100), theirValue: (igPct(them) * 100).toFixed(0) + "% IG", ourValue: (igPct(us) * 100).toFixed(0) + "% IG", deltaBps: 0, category: "credit" })
  }

  // Duration: they win if meaningfully shorter (only if our fund is > 1yr duration)
  const durDelta = nz(us.duration) - nz(them.duration)
  if (durDelta > 0.3 && nz(us.duration) > 1) {
    advantages.push({ id: "duration", metric: "Duration", magnitude: Math.min(durDelta * 12, 100), theirValue: nz(them.duration).toFixed(2) + " yrs", ourValue: nz(us.duration).toFixed(2) + " yrs", deltaBps: 0, category: "risk" })
  }

  // Allocation differences are ONLY handled by GPT — the template engine
  // cannot judge whether an allocation difference is an advantage or not.

  return advantages
}

// ========================================================================
// STEP 2: RANK AND ASSIGN DIFFICULTY (RELATIVE, NOT FIXED)
// ========================================================================
function assignDifficulties(advantages: RawAdvantage[]): RawAdvantage[] {
  if (advantages.length === 0) return []
  const sorted = [...advantages].sort((a, b) => b.magnitude - a.magnitude)
  const maxMag = sorted[0].magnitude
  const minMag = sorted[sorted.length - 1].magnitude

  return sorted.map(adv => {
    let tier: DifficultyTier
    if (advantages.length === 1) {
      // Single advantage: rate by absolute magnitude
      tier = adv.magnitude > 70 ? "Very Difficult" : adv.magnitude > 45 ? "Difficult" : adv.magnitude > 25 ? "Moderate" : adv.magnitude > 10 ? "Easy" : "Very Easy"
    } else {
      // Relative ranking
      const range = maxMag - minMag || 1
      const pctile = (adv.magnitude - minMag) / range
      tier = pctile > 0.85 ? "Very Difficult" : pctile > 0.6 ? "Difficult" : pctile > 0.35 ? "Moderate" : pctile > 0.12 ? "Easy" : "Very Easy"
    }
    return { ...adv, tier } as RawAdvantage & { tier: DifficultyTier }
  })
}

function overallDifficulty(ranked: (RawAdvantage & { tier?: DifficultyTier })[]): DifficultyTier {
  if (ranked.length === 0) return "Very Easy"
  const tierToNum: Record<DifficultyTier, number> = { "Very Easy": 1, "Easy": 2, "Moderate": 3, "Difficult": 4, "Very Difficult": 5 }
  const numToTier: Record<number, DifficultyTier> = { 1: "Very Easy", 2: "Easy", 3: "Moderate", 4: "Difficult", 5: "Very Difficult" }

  // Weight: hardest 1-2 get 60%, rest 40%
  const sorted = [...ranked].sort((a, b) => b.magnitude - a.magnitude)
  const hardest = sorted.slice(0, 2)
  const rest = sorted.slice(2)

  const hardAvg = hardest.reduce((s, r) => s + tierToNum[(r as any).tier || "Moderate"], 0) / hardest.length
  const restAvg = rest.length > 0 ? rest.reduce((s, r) => s + tierToNum[(r as any).tier || "Moderate"], 0) / rest.length : hardAvg

  const weighted = hardAvg * 0.6 + restAvg * 0.4
  const rounded = Math.round(weighted)
  return numToTier[Math.max(1, Math.min(5, rounded))]
}

// ========================================================================
// STEP 3: GENERATE COMPETITOR ARGUMENTS (10-15+ variants per type)
// ========================================================================
const ARG_TEMPLATES: Record<string, string[]> = {
  sec_yield: [
    "SEC yield: {their} vs {our}. {delta}bps more income. For income-oriented accounts, that gap compounds.",
    "{delta}bps higher SEC yield at {their}. That's real income your clients are leaving on the table.",
    "SEC yield comparison: {their} vs {our}. The {delta}bps gap flows through to monthly distributions.",
    "Income clients care about yield. {their} vs {our} — {delta}bps advantage.",
    "{their} SEC yield vs {our}. {delta}bps of additional income without stretching credit quality.",
    "Yield differential: {delta}bps. {their} vs {our}. Income is the metric that matters here.",
  ],
  dist_yield: [
    "Distribution yield: {their} vs {our}. {delta}bps more cash flow hitting client accounts monthly.",
    "{delta}bps higher distribution at {their}. The number clients see on their statement.",
    "Distribution yield gap: {their} vs {our}. {delta}bps of real cash flow difference for income accounts.",
    "{their} distribution vs {our}. {delta}bps more income — the metric retirees live on.",
    "Cash flow comparison: {their} vs {our} distribution yield. {delta}bps advantage.",
    "Distribution is what clients feel. {their} vs {our} — {delta}bps gap.",
  ],
  expense: [
    "Expense ratio: {their} vs {our}. {delta}bps less drag. Same category, lower cost.",
    "{delta}bps cheaper at {their}. Fee drag compounds — your clients keep more.",
    "Fees are a controllable variable. {their} vs {our}. {delta}bps saved annually.",
    "{their} vs {our} expense. {delta}bps gap compounds against higher-cost funds over every holding period.",
    "In fixed income where returns are tight, {delta}bps in fees ({their} vs {our}) moves the needle.",
    "Expense ratio: {their} vs {our}. {delta}bps structural advantage from day one.",
  ],
  "3y_perf": [
    "3Y total return: {their} vs {our}. {delta_pct}% outperformance through a full cycle.",
    "3-year track record: {their} vs {our}. {delta_pct}% gap reflects portfolio construction.",
    "{delta_pct}% ahead over 3 years ({their} vs {our}). Through rate hikes and volatility.",
    "3Y performance: {their} vs {our}. A {delta_pct}% spread over a meaningful time horizon.",
    "Three-year return comparison: {their} vs {our}. {delta_pct}% better outcome.",
    "{delta_pct}% of 3Y outperformance. {their} vs {our}. The track record is the data.",
  ],
  "1y_perf": [
    "Trailing 1Y: {their} vs {our}. {delta_pct}% outperformance in the most recent period.",
    "1-year return: {their} vs {our}. {delta_pct}% spread. Current and relevant.",
    "Last 12 months: {their} vs {our}. {delta_pct}% ahead.",
    "1Y performance: {delta_pct}% advantage ({their} vs {our}). Most recent window.",
    "Trailing year: {their} vs {our}. {delta_pct}% better outcome in the current environment.",
    "1Y total return: {delta_pct}% ahead. {their} vs {our}.",
  ],
  std_dev: [
    "Standard deviation: {their} vs {our}. Lower volatility, smoother path.",
    "Vol comparison: {their} vs {our}. Less drawdown risk for conservative allocations.",
    "{their} std dev vs {our}. Stability matters in fixed income — we deliver it.",
    "Volatility: {their} vs {our}. The risk-averse allocation favors lower vol.",
    "Standard deviation gap: {their} vs {our}. Less portfolio whipsaw in drawdowns.",
    "{their} vol vs {our}. For clients who prioritize stability, the data is clear.",
  ],
  sharpe: [
    "Sharpe ratio: {their} vs {our}. More return per unit of risk.",
    "{their} Sharpe vs {our}. Risk-adjusted performance favors us.",
    "Sharpe differential: {their} vs {our}. Better returns for the risk taken.",
    "Risk-adjusted comparison: {their} Sharpe vs {our}. Cleaner risk-reward.",
    "Sharpe: {their} vs {our}. Generating more return per unit of vol.",
    "{their} vs {our} Sharpe. Smarter risk, not more risk.",
  ],
  credit: [
    "Credit quality: {their} IG vs {our}. Higher quality portfolio, less credit risk.",
    "{their} IG allocation vs {our}. Tighter credit book, better positioned for a widening.",
    "IG exposure: {their} vs {our}. Less credit risk without sacrificing the income objective.",
    "Credit profile: {their} IG vs {our}. Cleaner risk profile for conservative allocations.",
    "{their} vs {our} in investment grade. When spreads widen, credit quality matters.",
    "Higher IG at {their} vs {our}. Less downside exposure in a credit downturn.",
  ],
  duration: [
    "Duration: {their} vs {our} years. Less rate sensitivity, quicker re-pricing.",
    "{their} duration vs {our}. Less interest rate risk per basis point of yield.",
    "Shorter duration at {their} vs {our}. Re-prices faster when rates move.",
    "Rate risk: {their} vs {our} years of duration. Significant difference in exposure.",
    "Duration comparison: {their} vs {our}. Less rate exposure with comparable income.",
    "{their} vs {our} duration. In a rate-volatile environment, shorter wins.",
  ],

}

function generateArgument(adv: RawAdvantage, us: FundData, them: FundData): string {
  const templates = ARG_TEMPLATES[adv.id] || ARG_TEMPLATES[adv.category] || [`Their ${adv.metric} at ${adv.theirValue} beats your ${adv.ourValue}.`]
  const raw = pickTemplate(templates, us.ticker, them.ticker, adv.id)
  const deltaPct = adv.deltaBps > 0 ? (adv.deltaBps / 100).toFixed(1) : "0"
  return raw
    .replace(/\{delta\}/g, String(adv.deltaBps))
    .replace(/\{delta_pct\}/g, deltaPct)
    .replace(/\{their\}/g, adv.theirValue)
    .replace(/\{our\}/g, adv.ourValue)
}

// ========================================================================
// STEP 4: GENERATE REBUTTALS
// ========================================================================
const REBUTTAL_OPENERS: Record<string, string[]> = {
  sec_yield: [
    "The yield gap is real. What's driving it matters more than the headline number.",
    "Yield in isolation is misleading. Here's the full risk-adjusted picture.",
    "Look at what they're holding to generate that yield — that's the real comparison.",
    "The yield delta narrows significantly on a risk-adjusted basis.",
    "Fair on yield. Now look at credit quality and what that yield is actually buying.",
    "Yield is one input. Credit quality, duration, and risk-adjusted return complete the picture.",
    "Before anchoring on yield, consider what's generating it and whether it's sustainable.",
    "The yield gap is real but comes with tradeoffs the headline doesn't show.",
    "Higher yield at the cost of lower credit quality is not a free lunch.",
    "That yield delta tells you half the story. Risk-adjusted returns tell the other half.",
  ],
  dist_yield: [
    "Distribution yield is a headline number. What's behind it matters more.",
    "The distribution gap closes on a risk-adjusted basis. Here's the data.",
    "Higher distribution funded by lower credit quality is not sustainable income.",
    "Unpack the distribution yield — the source of income matters as much as the level.",
    "The distribution gap narrows when you factor in credit risk and sustainability.",
    "Distribution yield without context is misleading. Credit quality completes the picture.",
    "Distribution is what catches the eye. Risk-adjusted total return is what builds wealth.",
    "Higher distribution at the cost of credit quality and rate risk is a tradeoff, not a win.",
    "Reframe: distribution adjusted for credit quality and duration tells a different story.",
    "Higher distribution does not equal better fund. The risk budget matters.",
  ],
  expense: [
    "Fee conversation is fair. Net-of-fee outcomes tell a different story.",
    "Cheaper doesn't mean better. Net-of-fee performance is the relevant comparison.",
    "The fee gap is real. The income advantage that more than offsets it is also real.",
    "Net-of-fee, the higher expense is more than earned back in yield and performance.",
    "Fee sensitivity matters. Losing more in yield than you save in fees matters more.",
    "The fee delta is one input. Net-of-fee total return is the output that matters.",
    "Lower fee, lower income. The math favors paying for the yield advantage.",
    "Fee sticker vs net-of-fee outcome — the client keeps more with higher yield, even after fees.",
    "The expense ratio debate ends at net returns. The fee has been earned.",
    "More expensive, more income, better risk-adjusted returns. The tradeoff is clear.",
  ],
  "3y_perf": [
    "The 3Y gap has a specific driver. Here's what the number isn't telling you.",
    "Context on the 3-year number:",
    "The 3Y comparison requires context — the composition of that time period matters.",
    "3-year return alone doesn't capture the forward-looking opportunity. Here's why.",
    "Strip out the anomalous period and the trajectory changes materially.",
    "The 3Y number is backward-looking through a specific stress event. Current positioning matters more.",
    "Acknowledged. Now here's the data that reframes it.",
    "That 3Y gap comes from a specific period that reshaped the opportunity set in our favor.",
    "The 3-year comparison anchors to a period that created the current opportunity.",
    "The 3Y number is real. What it implies about the future is not.",
  ],
  "1y_perf": [
    "The 1Y number is real. The longer view and current positioning tell a different story.",
    "1-year performance is a snapshot. Broader context matters.",
    "Trailing 1Y comparisons are noisy. The forward-looking setup favors our positioning.",
    "That 1Y gap is backward-looking. Current yield and positioning favor us going forward.",
    "One year is a short window. Current sector allocation and spread environment matter more.",
    "1Y in their favor. Forward-looking income trajectory and positioning favor us.",
    "The 1Y gap reflects a specific period. Current data points to a different trajectory.",
    "Acknowledged on the 1Y. Current yield advantage and positioning reframe the outlook.",
    "1-year snapshot vs current positioning — the forward story is more relevant.",
    "Trailing 1Y doesn't predict the next 12 months. Current setup does.",
  ],
  std_dev: [
    "Vol is one input. Risk-adjusted returns and yield tell the full story.",
    "Slightly higher vol, meaningfully higher income. The tradeoff is compensated.",
    "Higher vol is accessing higher-yielding sectors. The Sharpe ratio confirms the risk is paid for.",
    "Modest vol increase for significant yield pickup. That's compensated risk.",
    "The vol difference is modest. The income difference is not. Net effect favors us.",
    "Higher vol in exchange for higher yield is a feature for income portfolios, not a bug.",
    "Vol next to yield — the income advantage more than compensates for the volatility.",
    "Marginally higher vol, materially higher income. Risk-adjusted, the tradeoff is clear.",
    "The vol is compensated. Uncompensated risk is the concern — this isn't that.",
    "Small vol gap, large income gap. Risk-adjusted comparison favors the higher-yielding fund.",
  ],
  sharpe: [
    "Sharpe is backward-looking. Forward-looking positioning and yield matter more.",
    "Their Sharpe benefits from lower vol — which came from avoiding higher-yielding sectors.",
    "Sharpe includes periods that may not repeat. Current positioning is more relevant.",
    "Higher Sharpe with less income is not necessarily what income clients need.",
    "Sharpe doesn't pay bills. Yield does. Different objectives, different metrics.",
    "Better Sharpe, lower income. For income accounts, yield is the priority metric.",
    "Slightly lower Sharpe, meaningfully higher yield. The tradeoff is deliberate.",
    "The Sharpe gap reflects different risk-reward philosophies. Ours prioritizes income.",
    "Sharpe is one lens. Income and total return are the lenses that matter for this client base.",
    "Sharpe ratio context: lower vol ≠ better outcome for income-oriented portfolios.",
  ],
  credit: [
    "Higher IG % does not automatically mean lower risk. Depends where the IG exposure sits.",
    "Non-IG allocation is intentional — picking up spread in sectors with strong structural protections.",
    "Credit quality is about underwriting, not just ratings. Our non-IG is senior, collateralized.",
    "IG corporate is at historically tight spreads. More IG exposure = more spread compression risk.",
    "Intentional credit allocation. Securitized at wide spreads vs IG corporate at tight spreads.",
    "IG corporate spreads are near all-time tights. More IG means more valuation risk, not less.",
    "Less IG because better risk-adjusted income exists elsewhere. Securitized spreads confirm this.",
    "Rating labels miss structural protections. Senior securitized tranches have different risk profiles than IG corporate.",
    "Higher IG% in a tight spread environment means you're buying the most expensive part of the market.",
    "Well-underwritten securitized credit at wide spreads vs tight IG corporate. The relative value is clear.",
  ],
  duration: [
    "Longer by design. The duration profile is earning more income for the rate risk taken.",
    "The duration gap is real. The yield earned for that duration more than compensates.",
    "More duration for more income. The tradeoff is compensated and actively managed.",
    "Duration cuts both ways. In a stable or falling rate environment, longer duration outperforms.",
    "Active duration management. Current profile reflects the rate outlook, not a passive bet.",
    "The duration gap narrows when you see the income advantage it generates.",
    "If rates stabilize or fall, duration positioning outperforms while earning higher carry.",
    "Duration is both a risk factor and a return factor. The exposure is compensated.",
    "Longer duration is why the yield is higher. The question is whether the carry justifies the risk.",
    "More duration is not always more risk. Depends on the rate environment and the carry earned.",
  ],
  "2022_stress": [
    "2022 was a rate event, not a credit event. Fundamentals held. Recovery followed in 2023-2024.",
    "2022 context: Fed hiked 425bps. Securitized got hit on rate duration, not credit deterioration.",
    "The 2022 sell-off widened securitized spreads. That's exactly why current entry points are attractive.",
    "2022 hit securitized hard. 2023-2024 rewarded those who stayed. The full cycle tells a different story.",
    "2022 is half the story. The recovery and current spread opportunity is the other half.",
    "The same conditions that caused the 2022 drawdown created the opportunity the fund is harvesting now.",
    "2022 reset securitized spreads. That's the reason the current risk/reward is attractive.",
    "Rate shock, not credit deterioration. Underwriting standards held. Recovery proved the thesis.",
    "2022 is the rearview mirror. Current securitized spreads vs IG corporates is the windshield.",
    "2022 created the best entry point in securitized credit in years. That opportunity persists.",
  ],
}

function generateRebuttal(adv: RawAdvantage & { tier?: DifficultyTier }, us: FundData, them: FundData, yahoo?: YahooAnalytics): Rebuttal {
  const openers = REBUTTAL_OPENERS[adv.id] || REBUTTAL_OPENERS[adv.category] || ["Let me address that directly."]
  const opener = pickTemplate(openers, us.ticker, them.ticker, adv.id + "_reb")

  const bullets: string[] = []
  const durShort = nz(us.duration) < 1

  // Build contextual bullets based on argument type
  switch (adv.id) {
    case "sec_yield":
    case "dist_yield": {
      // Counter yield argument — find our advantages
      if (igPct(us) > igPct(them)) bullets.push(`Higher credit quality (${(igPct(us) * 100).toFixed(0)}% IG vs ${(igPct(them) * 100).toFixed(0)}%) — more yield at lower credit risk.`)
      if (nz(us.duration) < nz(them.duration) - 0.2) bullets.push(`Shorter duration (${nz(us.duration).toFixed(2)} vs ${nz(them.duration).toFixed(2)}) — achieving comparable income with less rate risk.`)
      if (nz(us.sharpe) > nz(them.sharpe)) bullets.push(`Better Sharpe ratio (${nz(us.sharpe).toFixed(2)} vs ${nz(them.sharpe).toFixed(2)}) — more efficient risk-adjusted returns.`)
      if ((nz(us.threeYear) - nz(them.threeYear)) * 100 > 0.3) bullets.push(`3Y total return still favors us by ${((nz(us.threeYear) - nz(them.threeYear)) * 100).toFixed(1)}% despite the yield gap.`)
      if (bullets.length === 0) bullets.push("The yield gap narrows significantly when you account for risk-adjusted returns and credit quality.")
      break
    }
    case "expense": {
      const netPerfDiff = (nz(us.threeYear) - nz(them.threeYear)) * 100
      if (netPerfDiff > 0) bullets.push(`Net-of-fee 3Y performance favors us by ${netPerfDiff.toFixed(1)}% — the fee more than pays for itself.`)
      const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
      if (secYieldAdv > 10) bullets.push(`${Math.round(secYieldAdv)}bps higher SEC yield more than offsets the ${adv.deltaBps}bps fee difference.`)
      bullets.push(`Ask the client: would you rather save ${adv.deltaBps}bps on fees or earn ${secYieldAdv > 10 ? Math.round(secYieldAdv) + "bps" : "meaningfully"} more income?`)
      break
    }
    case "3y_perf": {
      // Use Yahoo period returns if available
      if (yahoo && yahoo.periodReturns) {
        const pr3 = yahoo.periodReturns.find(p => p.label === "3Y")
        if (pr3) bullets.push(`3Y total return (Yahoo): ${us.ticker} ${pr3.returnA.toFixed(2)}% vs ${them.ticker} ${pr3.returnB.toFixed(2)}%.`)
        if (yahoo.bestPeriodForA && yahoo.bestPeriodForA.spread > 0) {
          bullets.push(`Best period for ${us.ticker}: ${yahoo.bestPeriodForA.label} — outperforms by ${yahoo.bestPeriodForA.spread.toFixed(2)}%.`)
        }
      }
      const has3YHistory = us.threeYear != null && us.threeYear !== 0
      if (has3YHistory) {
        bullets.push("The 3Y window may include stress events — the full cycle matters more than any single period.")
      } else {
        bullets.push("Shorter track record reflects a different market entry point — not a performance deficit.")
      }
      if (secPct(us) > 0.15) bullets.push(`Current securitized spreads wide vs IG corporates — attractive relative value.`)
      if (durShort) bullets.push(`At ${nz(us.duration).toFixed(2)} years duration, rate-driven drawdowns structurally limited.`)
      else {
        const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
        if (secYieldAdv > 0) bullets.push(`Current yield advantage of ${Math.round(secYieldAdv)}bps supports stronger forward income.`)
      }
      break
    }
    case "1y_perf": {
      // Use Yahoo period returns if available
      if (yahoo && yahoo.periodReturns) {
        const pr3 = yahoo.periodReturns.find(p => p.label === "3Y")
        if (pr3 && pr3.spread < 0) bullets.push(`Over 3 years, ${us.ticker} outperforms by ${Math.abs(pr3.spread).toFixed(2)}% — the longer horizon favors our approach.`)
        if (yahoo.bestPeriodForA && yahoo.bestPeriodForA.spread > 0) {
          bullets.push(`Best period for ${us.ticker}: ${yahoo.bestPeriodForA.label} — outperforms by ${yahoo.bestPeriodForA.spread.toFixed(2)}%.`)
        }
      } else if ((nz(us.threeYear) - nz(them.threeYear)) * 100 > 0) {
        bullets.push(`Over 3 years, we've outperformed — the longer time horizon favors our approach.`)
      }
      const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
      if (secYieldAdv > 10) bullets.push(`Current SEC yield advantage of ${Math.round(secYieldAdv)}bps supports stronger forward income.`)
      bullets.push("Current portfolio positioning and sector allocation suggest improving relative performance.")
      break
    }
    case "std_dev": {
      const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
      if (secYieldAdv > 10) bullets.push(`${Math.round(secYieldAdv)}bps more SEC yield compensates for the modest volatility difference.`)
      if (nz(us.sharpe) >= nz(them.sharpe) - 0.05) bullets.push(`Sharpe ratios are comparable (${nz(us.sharpe).toFixed(2)} vs ${nz(them.sharpe).toFixed(2)}) — we're earning our vol.`)
      bullets.push("The volatility difference is modest relative to the income advantage — risk-adjusted, the tradeoff favors income.")
      break
    }
    case "sharpe": {
      const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
      if (secYieldAdv > 10) bullets.push(`${Math.round(secYieldAdv)}bps higher yield means more income for the client — Sharpe alone doesn't capture income utility.`)
      bullets.push("For income-oriented clients, total yield and cash flow matter more than Sharpe — the risk-return tradeoff is deliberate.")
      if (igPct(us) > igPct(them)) bullets.push(`Higher credit quality (${(igPct(us) * 100).toFixed(0)}% IG) provides structural protection that Sharpe doesn't reflect.`)
      break
    }
    case "credit": {
      bullets.push(MARKET_CONTEXT.includes("wide") ? "IG corporate spreads are at historically tight levels — more IG exposure means more spread tightening risk." : "Our credit allocation reflects deliberate sector selection, not a reach for yield.")
      if (secPct(us) > 0.15) bullets.push(`Securitized spreads are wide vs IG corporates — our allocation captures a relative value opportunity that IG-heavy portfolios miss.`)
      bullets.push("Our non-IG exposure is concentrated in sectors with strong structural protections (senior tranches, collateralized cash flows).")
      break
    }
    case "duration": {
      const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
      if (secYieldAdv > 10) bullets.push(`The extra duration earns ${Math.round(secYieldAdv)}bps more yield — duration is a compensated risk factor here.`)
      bullets.push("If rates stabilize or fall, our duration positioning outperforms while still earning higher carry.")
      bullets.push("Duration is actively managed and reflects our current rate outlook — it's not a passive bet.")
      break
    }

  }

  // Assign confidence
  let confidence: ConfidenceTag = "Strong"
  if (adv.id === "expense" && (nz(us.threeYear) - nz(them.threeYear)) * 100 > 0) confidence = "Airtight"
  else if (adv.id === "sec_yield" && igPct(us) > igPct(them) + 0.05) confidence = "Airtight"
  else if (adv.id === "3y_perf" && (nz(them.threeYear) - nz(us.threeYear)) * 100 > 3) confidence = "Use With Caution"
  else if (adv.id === "1y_perf" && (nz(them.oneYear) - nz(us.oneYear)) * 100 > 3) confidence = "Use With Caution"
  else if (adv.id === "credit" && igPct(them) - igPct(us) > 0.20) confidence = "Use With Caution"
  // If we have clear offsetting advantages, upgrade to Airtight
  const yieldWin = (nz(us.secYield) - nz(them.secYield)) * 10000 > 20
  const creditWin = igPct(us) > igPct(them) + 0.03
  const perfWin = (nz(us.threeYear) - nz(them.threeYear)) * 100 > 1
  if (confidence === "Strong" && ((yieldWin && creditWin) || (yieldWin && perfWin) || (creditWin && perfWin))) {
    confidence = "Airtight"
  }

  // Generate memorable one-liner comeback
  const ONE_LINERS: Record<string, string[]> = {
    sec_yield: [
      "Yield without credit quality is just risk you haven't been paid for yet.",
      "Higher yield, lower quality. Which one shows up in a downturn?",
      "We'll take less yield with better credit all day long.",
    ],
    dist_yield: [
      "Distribution yield is a vanity metric. Risk-adjusted income is the real number.",
      "More distribution funded by more risk isn't income — it's leverage.",
      "Check the credit quality behind that distribution. That's the real story.",
    ],
    expense: [
      "Cheap doesn't mean good. Net-of-fee returns tell you who actually earned it.",
      "Save 20bps in fees, lose 50bps in yield. That math doesn't work.",
      "The fee pays for itself in income. Run the numbers.",
    ],
    "3y_perf": [
      "Backward-looking. Forward-looking yield and positioning favor us.",
      "Three years includes a stress period that reset the opportunity in our favor.",
      "Past performance, future positioning. We like where we sit.",
    ],
    "1y_perf": [
      "One year is noise. Current yield and positioning is signal.",
      "Trailing 12 months doesn't predict the next 12. Current carry does.",
      "Short window, backward-looking. Our setup going forward is stronger.",
    ],
    std_dev: [
      "Slightly more vol, meaningfully more income. That's compensated risk.",
      "We earn our volatility. The Sharpe ratio proves it.",
      "Vol is the price of income. We're getting paid for it.",
    ],
    sharpe: [
      "Sharpe doesn't pay bills. Yield does.",
      "Better Sharpe, less income. Different priorities, different funds.",
      "Risk-adjusted is one lens. Income is the one clients care about.",
    ],
    credit: [
      "More IG at historically tight spreads means more valuation risk, not less.",
      "We're in securitized at wide spreads. They're in corporate at tight spreads. Who has more room?",
      "Ratings don't capture structural protections. Our non-IG is senior and collateralized.",
    ],
    duration: [
      "More duration earns more carry. If rates stabilize, we outperform.",
      "Duration is a feature when it's earning income. Ours is.",
      "The extra duration is deliberate and compensated. Not a passive bet.",
    ],
  }
  const oneLiners = ONE_LINERS[adv.id] || ONE_LINERS[adv.category] || ["The data tells a different story when you look at the full picture."]
  const oneLiner = pickTemplate(oneLiners, us.ticker, them.ticker, adv.id + "_1liner")

  return {
    argumentId: adv.id,
    metric: adv.metric,
    opener,
    bullets: bullets.slice(0, 3),
    confidence,
    oneLiner,
  }
}

// ========================================================================
// MAIN EXPORT
// ========================================================================
export function buildWarRoom(us: FundData, them: FundData, yahoo?: YahooAnalytics): WarRoom {
  const rawAdvantages = findCompetitorAdvantages(us, them, yahoo)

  // Layup check
  if (rawAdvantages.length === 0) {
    // Find the smallest possible gap to mention
    const secDelta = absBps(them.secYield, us.secYield)
    const lowestMetric = secDelta > 0 ? `SEC yield (${pct(them.secYield)} vs ${pct(us.secYield)})` : "any core metric"
  return {
  overallDifficulty: "Very Easy",
  difficultySummary: "This is a layup. There are no material data-driven arguments working against you.",
  leadWith: null,
  isLayup: true,
      layupMessage: `This is a layup. There are no material data-driven arguments working against you. The one thing they might try is ${lowestMetric} — but the gap is immaterial and easily addressed with your broader positioning story.`,
      marketContext: MARKET_CONTEXT,
      competitorArguments: [],
      rebuttals: [],
    }
  }

  const ranked = assignDifficulties(rawAdvantages)
  const overall = overallDifficulty(ranked as any)

  // Build difficulty summary
  const hardest = ranked.slice(0, 2).map(r => r.metric.toLowerCase())
  const ourWins: string[] = []
  if ((nz(us.secYield) - nz(them.secYield)) * 10000 > 20) ourWins.push("yield advantage")
  if (igPct(us) > igPct(them) + 0.03) ourWins.push("credit quality")
  if (nz(us.duration) < nz(them.duration) - 0.2) ourWins.push("shorter duration")
  if ((nz(us.threeYear) - nz(them.threeYear)) * 100 > 0.5) ourWins.push("3Y performance")
  if (nz(us.sharpe) > nz(them.sharpe) + 0.1) ourWins.push("Sharpe ratio")

  // Build "lead with" string from our advantages
  const leads: string[] = []
  if ((nz(us.secYield) - nz(them.secYield)) * 10000 > 10) leads.push("yield advantage")
  // Credit quality: check BOTH total IG% AND quality-within-IG (AAA+AA vs their AAA+AA)
  const highQualUs = nz(us.aaa) + nz(us.aa)
  const highQualThem = nz(them.aaa) + nz(them.aa)
  if (igPct(us) > igPct(them) + 0.03 || highQualUs > highQualThem + 0.05) leads.push("higher credit quality")
  if (nz(us.duration) < nz(them.duration) - 0.2) leads.push("shorter duration")
  else if (Math.abs(nz(us.duration) - nz(them.duration)) <= 0.2) leads.push("comparable duration")
  if ((nz(us.threeYear) - nz(them.threeYear)) * 100 > 0.5) leads.push("3Y outperformance")
  if (nz(us.stdDev) < nz(them.stdDev)) leads.push("lower volatility")
  const leadWith = leads.length > 0 ? leads.join(", ") : null

  // Conversational difficulty summary -- talk to the rep like a coach
  let difficultySummary: string
  const argCount = ranked.length
  if (overall === "Very Easy" || overall === "Easy") {
    if (argCount <= 1) {
      const leadsSnippet = leads.length > 0 ? ` You're picking up ${leads.slice(0, 2).join(" and ")} — that's a strong story.` : ""
      difficultySummary = `This is a layup. They have ${argCount === 0 ? "nothing" : "one thin angle"} to work with.${leadsSnippet}`
    } else {
      difficultySummary = `You're in great shape here. They have ${argCount} points but none of them are hard to counter. Lead with your strengths and you'll close this.`
    }
  } else if (overall === "Moderate") {
    const hardestStr = hardest.join(" and ")
    difficultySummary = `Winnable but be ready. Their ${hardestStr} edge is real — have your response ready for that. ${ourWins.length > 0 ? `Your ${ourWins.join(" and ")} ${ourWins.length === 1 ? "gives" : "give"} you strong ammo.` : ""}`
  } else {
    const hardestStr = hardest.join(" and ")
    difficultySummary = `This one's tough — their ${hardestStr} ${hardest.length === 1 ? "is" : "are"} hard to argue against. ${ourWins.length > 0 ? `Lean on your ${ourWins.join(" and ")} and don't let them control the conversation.` : "You'll need to reframe the conversation around what their numbers don't show."}`
  }

  // Generate arguments and rebuttals
  const competitorArguments: CompetitorArgument[] = ranked.map(adv => ({
    id: adv.id,
    metric: adv.metric,
    difficulty: (adv as any).tier || "Moderate",
    argument: generateArgument(adv, us, them),
    theirValue: adv.theirValue,
    ourValue: adv.ourValue,
    deltaBps: adv.deltaBps,
    oneLiner: generateArgument(adv, us, them).split('.')[0] + '.',
  }))

  const rebuttals: Rebuttal[] = ranked.map(adv => generateRebuttal(adv as any, us, them, yahoo))

  return {
    overallDifficulty: overall,
    difficultySummary,
    leadWith,
    isLayup: false,
    layupMessage: null,
    marketContext: MARKET_CONTEXT,
    competitorArguments,
    rebuttals,
  }
}
