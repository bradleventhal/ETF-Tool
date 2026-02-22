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
const MARKET_CONTEXT = "Market context as of Feb 2026: Securitized credit spreads remain wide vs IG corporates. IG corporate spreads are near historically tight levels. Relative value opportunity in securitized vs corporates is historically attractive."

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

  // Historical spread stress: use real Yahoo drawdown data if available
  const has2022Data = yahoo && yahoo.drawdown2022A != null && yahoo.drawdown2022B != null
  if (has2022Data) {
    // Only show if our drawdown was worse than theirs by >1%
    const ddA = Math.abs(yahoo.drawdown2022A!)
    const ddB = Math.abs(yahoo.drawdown2022B!)
    if (ddA > ddB + 1 && secPct(us) > 0.10) {
      const durFactor = nz(us.duration) < 1 ? 0.4 : nz(us.duration) < 2 ? 0.7 : 1.0
      advantages.push({
        id: "2022_stress", metric: "2022 Securitized Drawdown", magnitude: Math.min(55 * durFactor, 100),
        theirValue: `-${ddB.toFixed(1)}% max drawdown`,
        ourValue: `-${ddA.toFixed(1)}% max drawdown`,
        deltaBps: 0, category: "spread_history"
      })
    }
  } else if (secPct(us) > 0.15 && secPct(them) < secPct(us) - 0.10) {
    // Fallback: only if fund has 3Y data (existed in 2022)
    const fundHas3YData = us.threeYear != null && us.threeYear !== 0
    if (fundHas3YData) {
      const durFactor = nz(us.duration) < 1 ? 0.4 : nz(us.duration) < 2 ? 0.7 : 1.0
      advantages.push({ id: "2022_stress", metric: "2022 Securitized Drawdown", magnitude: Math.min(55 * durFactor, 100), theirValue: "Corporate-heavy, less impacted", ourValue: (secPct(us) * 100).toFixed(0) + "% securitized", deltaBps: 0, category: "spread_history" })
    }
  }

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
    "We're delivering {delta}bps more yield right now at {their}. That's not a rounding error — that's real income your clients are missing.",
    "Your clients could be earning {their} in SEC yield instead of {our}. That's {delta}bps more income hitting their account every month.",
    "Look at the yield differential — {their} vs {our}. That {delta}bps gap adds up fast when you're compounding monthly.",
    "From a pure income standpoint, we're putting up {their} vs their {our}. Why would you accept less income?",
    "The SEC yield tells the story — {delta}bps of additional income on the table at {their}. That's meaningful for any income-oriented client.",
    "{delta}bps is {delta}bps. We're at {their}, they're at {our}. For income clients, that difference compounds into real money over time.",
    "If income is the priority, and it usually is, we're ahead by {delta}bps on SEC yield. {their} vs {our} — the numbers speak.",
    "That {delta}bps yield gap at {their} doesn't just show up on paper — it flows through to your client's distributions every single month.",
    "We're giving your client {delta}bps more income at {their} without stretching further down the credit spectrum to get it.",
    "Simple math: {their} vs {our} in SEC yield. {delta}bps more income. Ask your client if they'd rather have more or less.",
    "When you strip out the noise, yield is what pays the bills. We're at {their}, they're at {our}. {delta}bps matters.",
    "Your income clients aren't getting paid in Sharpe ratios. They want yield. We're {delta}bps higher at {their}.",
  ],
  dist_yield: [
    "Our distribution yield is {their} vs their {our}. That's {delta}bps more cash flow for clients who need income now, not later.",
    "Distribution yield of {their} vs {our} — that's a {delta}bps cash flow advantage your clients can feel every month.",
    "We're putting {delta}bps more distribution into client accounts at {their}. That's the number retirees care about.",
    "When the client opens their statement, they see distributions. Ours: {their}. Theirs: {our}. That {delta}bps gap matters.",
    "For income-focused accounts, {their} distribution yield vs {our} is the headline number. {delta}bps of real cash flow difference.",
    "Distribution yield is what clients live on. We're at {their}, they're stuck at {our}. That's a {delta}bps gap the client feels.",
    "If your clients need reliable income, the distribution yield says it all — {their} vs {our}, a {delta}bps advantage.",
    "We're distributing {delta}bps more than they are. {their} vs {our}. For income portfolios, that's the number that matters most.",
    "The distribution yield gap of {delta}bps ({their} vs {our}) translates directly into more income hitting client accounts.",
    "Retirees don't care about total return decomposition. They care about what lands in their account. We're {delta}bps higher.",
  ],
  expense: [
    "We're {delta}bps cheaper at {their}. Over 10 years that fee drag compounds — your clients keep more of what they earn.",
    "Expense ratio: {their} vs {our}. That {delta}bps difference is the easiest money your client will ever save.",
    "Before either fund earns a single basis point, your clients are already behind {delta}bps with the more expensive option.",
    "At {their} vs {our}, we're saving your clients {delta}bps a year in fees. That compounds over every year they hold it.",
    "Fee conversation is simple: {their} vs {our}. {delta}bps less fee drag. Same style, lower cost.",
    "Every basis point in fees is a basis point your client doesn't earn. We're {delta}bps lighter at {their}.",
    "We do the same job for {delta}bps less. {their} vs {our}. In a low-return environment, fees matter more than ever.",
    "That {delta}bps fee gap ({their} vs {our}) is one of the few variables you can actually control for your client.",
    "Think about it this way — {delta}bps in fees every year for 10 years. We're at {their}, they're at {our}. That adds up.",
    "Lower fees aren't glamorous, but {delta}bps less drag at {their} vs {our} gives your client a structural edge from day one.",
    "In fixed income where returns are tighter, {delta}bps in fees ({their} vs {our}) makes an outsized difference.",
    "Your client is paying {delta}bps more for essentially the same exposure. We charge {their}. They charge {our}.",
  ],
  "3y_perf": [
    "Over 3 years, we've outperformed by {delta_pct}%. That's not noise — that's a real performance gap at {their} vs {our}.",
    "3-year total return: {their} vs {our}. That {delta_pct}% gap is telling you something about portfolio construction.",
    "Past performance aside, 3 years is a meaningful time horizon. We're ahead by {delta_pct}% at {their} total return.",
    "The 3-year number is hard to argue with — {their} vs {our}. That's {delta_pct}% of outperformance through a full cycle.",
    "If your client had been with us 3 years ago, they'd have an extra {delta_pct}% in their pocket. {their} vs {our}.",
    "Three-year track record: {their} vs {our}. A {delta_pct}% gap over that time horizon reflects a real difference in execution.",
    "We've delivered {delta_pct}% more over 3 years. {their} vs {our}. At some point, performance has to matter.",
    "The 3Y comparison favors us by {delta_pct}% ({their} vs {our}). That's through rate hikes, volatility, everything.",
    "Performance over 3 years — {their} vs {our}. {delta_pct}% better outcome. Full stop.",
    "Your client's 3-year return would have been {delta_pct}% higher with us. {their} vs {our}. The track record is clear.",
  ],
  "1y_perf": [
    "Trailing 1-year: {their} vs {our}. We've delivered {delta_pct}% more in the most recent period.",
    "The 1-year number is fresh — {their} vs {our}. That {delta_pct}% gap is current and relevant.",
    "Over the last 12 months, we've outperformed by {delta_pct}%. {their} vs {our} in total return.",
    "Recent performance matters. 1-year: {their} vs {our}. {delta_pct}% better for clients who were with us.",
    "Trailing year performance: {delta_pct}% ahead ({their} vs {our}). That's the most recent data speaking.",
    "Looking at the last 12 months, we've put up {their} vs their {our}. {delta_pct}% spread in our favor.",
    "The 1Y return is {their} for us vs {our} for them — {delta_pct}% of outperformance in the most recent window.",
    "In the most recent 1-year window, we're ahead by {delta_pct}% ({their} vs {our}). Momentum is on our side.",
    "What's happening now matters. 1Y: {their} vs {our}. We've delivered {delta_pct}% more.",
    "The last year's track record: {delta_pct}% better outcome with us. {their} vs {our}.",
  ],
  std_dev: [
    "Our standard deviation is {their} vs their {our}. We're delivering a smoother ride for clients who don't want surprises.",
    "Volatility matters for client retention. We're at {their} std dev vs {our} — less stomach-churning for the client.",
    "Lower vol, better sleep. {their} vs {our} in standard deviation. Clients stay invested when the ride is smooth.",
    "We run with less volatility — {their} vs {our}. For conservative clients, that matters as much as return.",
    "Standard deviation of {their} vs {our}. We're giving your client the same income with less drama.",
    "Volatility: {their} vs {our}. In fixed income, the whole point is stability. We deliver that better.",
    "Your risk-averse clients will notice that {their} vs {our} vol difference. Smoother path to the same destination.",
    "We keep vol lower at {their} vs their {our}. That means fewer uncomfortable conversations with your clients.",
    "For clients who care about risk-adjusted returns, our {their} vol vs their {our} is a clear differentiator.",
    "The volatility gap ({their} vs {our}) means your client's portfolio won't whipsaw as hard in drawdowns.",
  ],
  sharpe: [
    "Our Sharpe ratio is {their} vs {our}. We're generating more return per unit of risk — better risk-adjusted performance.",
    "Sharpe of {their} vs {our}. That's not just performance, that's performance efficiency. More return for the risk taken.",
    "Risk-adjusted returns tell the real story. {their} Sharpe vs {our}. We're doing more with less risk.",
    "If you care about how efficiently a fund earns its return, the Sharpe ratio is {their} vs {our}. We win.",
    "Our {their} Sharpe says we're generating better returns per unit of risk than their {our}. That's smart money management.",
    "Sharpe ratio: {their} vs {our}. We're not just performing, we're performing efficiently.",
    "Better Sharpe ({their} vs {our}) means your client is getting paid more for each unit of risk they're taking.",
    "The Sharpe differential ({their} vs {our}) shows we're taking smarter risks, not more risks.",
    "For a risk-adjusted comparison, our {their} Sharpe vs their {our} is the cleanest metric there is.",
    "When you adjust for risk, the picture gets clearer: {their} Sharpe vs {our}. We're delivering more per unit of vol.",
  ],
  credit: [
    "We're {their} investment grade vs their {our}. Higher quality portfolio with {delta_pct}% more IG exposure.",
    "Credit quality: {their} vs {our}. We're not reaching into lower quality paper to generate returns.",
    "Our IG allocation of {their} vs their {our} means less credit risk for your conservative clients.",
    "We maintain {their} IG exposure compared to their {our}. That's a cleaner credit profile for risk-averse allocations.",
    "For clients who care about credit quality, {their} IG vs {our} IG tells the story. We're higher quality.",
    "The credit profile favors us — {their} IG vs {our}. Less credit risk, more sleep-at-night factor.",
    "We're running a tighter credit book at {their} IG vs their {our}. For conservative allocators, that matters.",
    "Investment grade allocation: {their} vs {our}. We're taking less credit risk to deliver our returns.",
    "Higher IG allocation ({their} vs {our}) means our fund is better positioned for a credit downturn.",
    "When spreads widen, credit quality matters. We're sitting at {their} IG vs their {our}. We're better protected.",
  ],
  duration: [
    "We're shorter at {their} vs their {our}. Less rate sensitivity, quicker recovery if rates move against you.",
    "Duration of {their} vs {our}. In a rate-volatile environment, shorter duration is your client's friend.",
    "We manage at {their} duration vs their {our}. Less interest rate risk baked into every basis point of yield.",
    "Shorter duration ({their} vs {our}) means our fund re-prices faster when rates move. More nimble positioning.",
    "For clients worried about rates, {their} duration vs {our} is a significant difference in rate exposure.",
    "Rate risk comparison: {their} vs {our} years. We're carrying less exposure to the direction of rates.",
    "Every year of duration is rate sensitivity. We're at {their}, they're at {our}. Less rate risk with us.",
    "If rates move higher from here, shorter duration at {their} vs their {our} protects your client better.",
    "Duration: {their} vs {our}. We're lighter on rate risk, which matters in an uncertain rate environment.",
    "We run {their} duration vs their {our}. That's meaningfully less rate exposure with comparable income.",
  ],
  "2022_stress": [
    "Let's talk about 2022. With {our} in securitized, your fund took a meaningful hit when the Fed hiked 425bps. Our clients didn't have that drawdown.",
    "2022 was brutal for securitized credit. Your fund, heavy at {our} securitized, felt the full force. We were largely insulated with our corporate positioning.",
    "The 2022 stress test showed exactly what happens to securitized-heavy portfolios. At {our} securitized, your fund was exposed. We weren't.",
    "When the Fed hiked 425bps in 2022, securitized credit got hammered. Your fund at {our} securitized carried that exposure. Our clients avoided the worst of it.",
    "2022 proved that securitized concentration is a real risk. At {our} securitized exposure, your fund clients lived through that. Ours didn't.",
    "History matters. 2022 showed that securitized-heavy funds at {our} got hit hard. Our corporate-focused approach provided a smoother path.",
    "Ask your clients how 2022 felt with {our} in securitized. That kind of drawdown erodes trust. We offered stability.",
    "When rates spiked 425bps, securitized credit at {our} of the portfolio was a liability. We had less exposure to that sell-off.",
    "The 2022 rate shock hit securitized credit the hardest. A portfolio with {our} securitized carried that pain. Our clients saw less damage.",
    "We don't have to go far back — 2022 showed exactly what securitized concentration risk ({our}) means in a hiking cycle.",
    "2022 was the stress test nobody asked for. Securitized-heavy at {our}? That was a tough year. Our approach held up better.",
    "If securitized is the driver at {our} of the portfolio, 2022 is the counterargument. 425bps of hikes hit that sector hardest.",
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
      // Use real Yahoo 3Y return data if available
      if (yahoo && yahoo.returnsA["3y"] != null && yahoo.returnsB["3y"] != null) {
        const retA3 = yahoo.returnsA["3y"]!
        const retB3 = yahoo.returnsB["3y"]!
        bullets.push(`3Y total return: us ${retA3.toFixed(2)}% vs them ${retB3.toFixed(2)}%. The gap is ${Math.abs(retA3 - retB3).toFixed(2)}%.`)
      }
      const has3YHistory = us.threeYear != null && us.threeYear !== 0
      if (has3YHistory) {
        bullets.push("The 3Y period includes 2022's rate shock — a once-in-a-cycle event. 2023-2024 recovery followed.")
      } else {
        bullets.push("Shorter track record reflects a different market entry point — not a performance deficit.")
      }
      // Inject best period if we outperform
      if (yahoo && yahoo.bestPeriodSpread > 0) {
        bullets.push(`${yahoo.bestPeriodLabel}: we outperform by ${yahoo.bestPeriodSpread.toFixed(2)}%.`)
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
      // Use real Yahoo 1Y/3Y data if available
      if (yahoo && yahoo.returnsA["3y"] != null && yahoo.returnsB["3y"] != null) {
        const spread3 = yahoo.returnsA["3y"]! - yahoo.returnsB["3y"]!
        if (spread3 > 0) bullets.push(`Over 3 years (Yahoo data), we outperform by ${spread3.toFixed(2)}% — the longer horizon favors our approach.`)
      } else if ((nz(us.threeYear) - nz(them.threeYear)) * 100 > 0) {
        bullets.push(`Over 3 years, we've outperformed — the longer time horizon favors our approach.`)
      }
      const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
      if (secYieldAdv > 10) bullets.push(`Current SEC yield advantage of ${Math.round(secYieldAdv)}bps supports stronger forward income.`)
      if (yahoo && yahoo.bestPeriodSpread > 0) {
        bullets.push(`${yahoo.bestPeriodLabel}: we outperform by ${yahoo.bestPeriodSpread.toFixed(2)}%.`)
      } else {
        bullets.push("Current portfolio positioning and sector allocation suggest improving relative performance.")
      }
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
    case "2022_stress": {
      // Use real Yahoo drawdown/recovery data if available
      if (yahoo && yahoo.drawdown2022A != null) {
        const ddA = Math.abs(yahoo.drawdown2022A)
        const ddB = yahoo.drawdown2022B != null ? Math.abs(yahoo.drawdown2022B) : null
        bullets.push(`2022 was a rate-driven event (Fed hiked 425bps), not credit deterioration. Our max drawdown was -${ddA.toFixed(1)}%${ddB != null ? ` vs their -${ddB.toFixed(1)}%` : ""}.`)
        if (yahoo.recovery2022A) {
          const recoveryDate = new Date(yahoo.recovery2022A + "T00:00:00")
          const troughDate = yahoo.trough2022A ? new Date(yahoo.trough2022A + "T00:00:00") : null
          const months = troughDate ? Math.round((recoveryDate.getTime() - troughDate.getTime()) / (30 * 24 * 60 * 60 * 1000)) : null
          bullets.push(`Full recovery achieved by ${recoveryDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}${months ? ` — ${months} months from trough` : ""}. Staying invested was rewarded.`)
        }
        // Add since-CI return if available
        if (yahoo.returnsA.ci != null && yahoo.returnsB.ci != null) {
          const spread = (yahoo.returnsA.ci - yahoo.returnsB.ci).toFixed(2)
          const ciDate = new Date(yahoo.commonInceptionDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })
          if (parseFloat(spread) > 0) bullets.push(`Since common inception (${ciDate}), we've outperformed by ${spread}% total return — the full cycle favors us.`)
        }
      } else {
        bullets.push("2022 was a rate-driven event (Fed hiked 425bps), not credit deterioration — fundamentals held and recovery followed in 2023-2024.")
        bullets.push("Securitized credit was among the top performers in 2023-2024 as spreads compressed — the recovery more than rewarded staying invested.")
      }
      if (durShort) bullets.push(`At ${nz(us.duration).toFixed(2)} years duration, rate-driven sell-offs are structurally limited.`)
      else bullets.push("Current securitized spreads remain wide vs IG corporates — the sell-off created the entry point we're capturing now.")
      break
    }
  }

  // Assign confidence
  let confidence: ConfidenceTag = "Strong"
  if (adv.id === "expense" && (nz(us.threeYear) - nz(them.threeYear)) * 100 > 0) confidence = "Airtight"
  else if (adv.id === "sec_yield" && igPct(us) > igPct(them) + 0.05) confidence = "Airtight"
  else if (adv.id === "3y_perf" && (nz(them.threeYear) - nz(us.threeYear)) * 100 > 3) confidence = "Use With Caution"
  else if (adv.id === "1y_perf" && (nz(them.oneYear) - nz(us.oneYear)) * 100 > 3) confidence = "Use With Caution"
  else if (adv.id === "2022_stress" && nz(us.duration) > 3) confidence = "Use With Caution"
  else if (adv.id === "credit" && igPct(them) - igPct(us) > 0.20) confidence = "Use With Caution"
  // If we have clear offsetting advantages, upgrade to Airtight
  const yieldWin = (nz(us.secYield) - nz(them.secYield)) * 10000 > 20
  const creditWin = igPct(us) > igPct(them) + 0.03
  const perfWin = (nz(us.threeYear) - nz(them.threeYear)) * 100 > 1
  if (confidence === "Strong" && ((yieldWin && creditWin) || (yieldWin && perfWin) || (creditWin && perfWin))) {
    confidence = "Airtight"
  }

  return {
    argumentId: adv.id,
    metric: adv.metric,
    opener,
    bullets: bullets.slice(0, 3),
    confidence,
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

  const hardestStr = hardest.join(" and ")
  const counterStr = ourWins.length > 0 ? ` but your ${ourWins.join(", ")} give${ourWins.length === 1 ? "s" : ""} you strong counters` : ""
  const difficultySummary = `${overall} — their ${hardestStr} edge is real${counterStr}.`

  // Check if all differentials are within a tight band
  const magnitudes = ranked.map(r => r.magnitude)
  const maxDiff = Math.max(...magnitudes) - Math.min(...magnitudes)
  const allSmall = Math.max(...magnitudes) < 20
  const tightBand = allSmall && maxDiff < 10

  const finalSummary = tightBand
    ? "The data doesn't separate these funds materially. This comes down to relationship and service — lead with that."
    : difficultySummary

  // Generate arguments and rebuttals
  const competitorArguments: CompetitorArgument[] = ranked.map(adv => ({
    id: adv.id,
    metric: adv.metric,
    difficulty: (adv as any).tier || "Moderate",
    argument: generateArgument(adv, us, them),
    theirValue: adv.theirValue,
    ourValue: adv.ourValue,
    deltaBps: adv.deltaBps,
  }))

  const rebuttals: Rebuttal[] = ranked.map(adv => generateRebuttal(adv as any, us, them, yahoo))

  return {
    overallDifficulty: tightBand ? "Easy" : overall,
    difficultySummary: finalSummary,
    isLayup: false,
    layupMessage: null,
    marketContext: MARKET_CONTEXT,
    competitorArguments,
    rebuttals,
  }
}
