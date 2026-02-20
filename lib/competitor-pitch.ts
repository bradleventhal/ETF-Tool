import type { FundData, WarRoom, CompetitorArgument, Rebuttal, DifficultyTier, ConfidenceTag } from "./fund-types"

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

function findCompetitorAdvantages(us: FundData, them: FundData): RawAdvantage[] {
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

  // Historical spread stress: if our fund has >15% securitized, competitor can cite 2022/2020
  if (secPct(us) > 0.15 && secPct(them) < secPct(us) - 0.10) {
    // Difficulty scales with duration — short duration = easier to counter
    const durFactor = nz(us.duration) < 1 ? 0.4 : nz(us.duration) < 2 ? 0.7 : 1.0
    advantages.push({ id: "2022_stress", metric: "2022 Securitized Drawdown", magnitude: Math.min(55 * durFactor, 100), theirValue: "Corporate-heavy, less impacted", ourValue: (secPct(us) * 100).toFixed(0) + "% securitized", deltaBps: 0, category: "spread_history" })
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
    "Let's look at what's driving that yield number — it's not just about the headline.",
    "Yield matters, but context matters more. Here's the real comparison.",
    "Sure, look at their SEC yield. Now look at what they're holding to get it.",
    "I hear you on the yield. But let me show you the full picture.",
    "Fair point on yield. Now let me show you why our clients don't mind.",
    "The yield gap is real. But here's why it's misleading in isolation.",
    "Yield is one number. Let me show you the three numbers that matter more.",
    "I get the yield comparison. But let's talk about what that yield is actually buying you.",
    "Before we anchor on yield, let's look at what's generating it and whether it's sustainable.",
    "The yield delta sounds big until you look at the risk you're taking to get it.",
  ],
  dist_yield: [
    "Distribution yield is a headline number. Let me show you what's behind it.",
    "I don't argue with the distribution number — I argue with what you have to hold to generate it.",
    "Higher distribution sounds great until you look at the credit risk funding it.",
    "Let's unpack that distribution yield and see where the income is actually coming from.",
    "That distribution gap closes when you look at risk-adjusted income. Here's why.",
    "I won't dispute their distribution yield. I'll dispute whether it's sustainable.",
    "Distribution yield is what catches your eye. Risk-adjusted total return is what builds wealth.",
    "Fair — their distribution is higher. But at what cost in terms of credit and rate risk?",
    "Let me reframe the distribution comparison with credit quality in the picture.",
    "Higher distribution ≠ better fund. Let me show you why.",
  ],
  expense: [
    "Yeah the sticker price is lower, but let's look at what you're actually getting for that difference.",
    "Fee conversation is fair. Let me show you why our clients are happy to pay the difference.",
    "I don't sell on fees — I sell on net-of-fee outcomes. Here's the comparison that matters.",
    "Cheaper doesn't mean better. Let me show you the net-of-fee performance.",
    "The fee gap looks big until you see what it delivers. Net-of-fee, we more than offset it.",
    "I'd rather pay a little more and get meaningfully more income. Here's the math.",
    "Let's move past the fee sticker and look at what the client actually keeps after fees.",
    "You can save on fees or you can earn more income. Let me show you which wins.",
    "Fee sensitivity is smart. But not if it costs you more in lost yield than you save in fees.",
    "Fair point on fees. Now let me show you the income advantage that more than covers the gap.",
    "The expense ratio debate ends when you look at net returns. We've earned our fee.",
    "Sure, we're more expensive. But we deliver more income and better risk-adjusted returns to justify it.",
  ],
  "3y_perf": [
    "The 3-year number includes 2022, which was a unique event. Let me put that in context.",
    "I won't pretend the 3-year number doesn't exist. But here's what it's not telling you.",
    "The 3-year return includes the worst securitized credit environment in a decade. Context matters.",
    "That 3-year gap has a clear explanation, and it's actually the reason to own us going forward.",
    "3-year return includes a period that's unlikely to repeat. Let me show you recent trajectory.",
    "The 3-year look-back is anchored to 2022. Strip that out and the picture changes completely.",
    "I'd rather address the 3-year number head on than dance around it. Here's the real story.",
    "That 3-year comparison is backward-looking through the worst rate shock in decades. Let's look forward.",
    "The 3Y gap comes from one year — 2022. Since then, we've been the better performer.",
    "I acknowledge the 3-year number. Now let me show you why it's the wrong number to anchor on.",
  ],
  "1y_perf": [
    "The 1-year number is real. But a lot can change in 12 months — here's the longer view.",
    "Over the last year, they've had a tailwind. Let me show you why that's shifting.",
    "1-year performance is a snapshot. Here's the broader context.",
    "I don't dismiss the 1-year number. But let me show you where the trend is heading.",
    "Fair — they had a better trailing year. Now let me show you the current setup.",
    "The 1Y is in their favor. Here's why the forward-looking story favors us.",
    "Trailing 1-year comparisons are noisy. Let me give you the signal beneath the noise.",
    "That 1-year gap doesn't tell you about the next 12 months. Here's what does.",
    "One year is a short window. Let me show you what the positioning looks like going forward.",
    "I won't deny the 1-year number. But let me contextualize it with current positioning.",
  ],
  std_dev: [
    "Vol is part of the picture, but it's not the only part. Let me show you risk-adjusted returns.",
    "Slightly higher vol, but meaningfully higher income. Here's the tradeoff your client should know about.",
    "We run a little more vol because we're accessing higher-yielding opportunities. The Sharpe tells the real story.",
    "A touch more volatility for significantly more yield is a trade most income clients want to make.",
    "The vol difference is real but modest. The income difference is real and significant.",
    "Higher vol in exchange for higher yield is a feature, not a bug, for income portfolios.",
    "Let me put the vol number next to the yield number and let your client decide.",
    "Marginally higher vol, materially higher income. That's a tradeoff most advisors are happy to explain.",
    "Vol matters, but so does what you're getting for it. We're not taking uncompensated risk.",
    "The standard deviation gap is small. The income gap is not. Risk-adjusted, we look better.",
  ],
  sharpe: [
    "Sharpe ratio is a backward-looking metric. Let me show you the forward-looking setup.",
    "Their Sharpe benefits from lower vol, but that lower vol came from avoiding the highest-yielding sectors.",
    "Sharpe ratio includes periods that may not repeat. Let me show you current positioning.",
    "I respect the Sharpe comparison. But let me show you what drives our returns going forward.",
    "A higher Sharpe with less income isn't necessarily what your client wants. Let me explain.",
    "The Sharpe ratio doesn't pay your client's bills. Yield does. Let me reframe.",
    "Better Sharpe, lower income. For retirement accounts, which matters more?",
    "I'd rather have a slightly lower Sharpe with meaningfully higher yield for income clients.",
    "The Sharpe gap reflects different risk-reward philosophies. Ours delivers more income.",
    "Sharpe is one lens. Let me show you the income and total return lens.",
  ],
  credit: [
    "Higher IG doesn't automatically mean safer. Let me show you where our credit risk actually lives.",
    "We hold more non-IG because that's where the opportunity is — and our selection has been strong.",
    "Credit quality is about underwriting, not just ratings. Let me walk you through our exposures.",
    "More IG sounds safer, but in a tight spread environment, IG corporate is actually the crowded trade.",
    "Our credit allocation is intentional. We're picking up spread in sectors with strong fundamentals.",
    "IG corporate is at historically tight spreads right now. More IG exposure means more spread tightening risk.",
    "We hold less IG because we found better risk-adjusted income elsewhere. Here's the evidence.",
    "Rating labels don't capture the full picture. Our non-IG exposure is in sectors with strong structural protections.",
    "Higher IG% doesn't mean lower risk in this environment. IG corporate spreads have nowhere to go.",
    "I'd rather own well-underwritten securitized credit at wide spreads than tight IG corporate right now.",
  ],
  duration: [
    "We're longer, but that's by design. Here's why the duration profile works for income generation.",
    "The duration difference is real. But let me show you the yield we're earning for that duration.",
    "A little more duration for a lot more income is a tradeoff income clients should consider.",
    "Duration works both ways. In a falling rate environment, our duration is actually an advantage.",
    "We manage duration actively. The current profile reflects where we see opportunity.",
    "The duration gap sounds wide until you see the income advantage it generates.",
    "If rates stabilize or fall, our duration positioning outperforms. And we earn more income while we wait.",
    "Duration is a risk factor, but it's also a return factor. We're getting paid for the exposure.",
    "Yes, we're longer. And that's exactly why we yield more. The question is whether the trade is worth it.",
    "More duration isn't always more risk — it depends on the rate environment. Here's why we're positioned this way.",
  ],
  "2022_stress": [
    "2022 happened. I'm not going to pretend it didn't. But here's what happened after, and why it matters more.",
    "I acknowledge 2022 was tough for securitized. Now let me show you the recovery and current opportunity.",
    "2022 was a Fed-induced rate shock — not a credit event. The fundamentals never broke. Here's the proof.",
    "Yes, 2022 hit securitized hard. And 2023-2024 rewarded those who stayed invested. Here's the full picture.",
    "If someone cites 2022, they're telling you half the story. Let me give you the other half.",
    "2022 was painful. But the same conditions that caused the drawdown created the opportunity we're harvesting now.",
    "I won't defend 2022. I'll explain why 2022 is actually the reason securitized is attractive today.",
    "2022 widened securitized spreads dramatically. That's why the entry point is so attractive right now.",
    "The 2022 sell-off was about rate shock, not credit deterioration. Underwriting standards held. Recovery followed.",
    "Anybody who cites 2022 is looking in the rearview mirror. The spread opportunity it created is in front of us.",
    "2022 reset securitized spreads. 2023-2024 proved the recovery. Current spreads say the opportunity is still here.",
    "I hear the 2022 objection a lot. Here's my response: 2022 created the best entry point in securitized in years.",
  ],
}

function generateRebuttal(adv: RawAdvantage & { tier?: DifficultyTier }, us: FundData, them: FundData): Rebuttal {
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
      // Never defend 2022 directly — acknowledge and pivot
      bullets.push("The 3Y period includes 2022's rate shock — a once-in-a-cycle event that hit securitized credit hardest. 2023-2024 saw strong recovery.")
      if (secPct(us) > 0.15) bullets.push(`Current securitized spreads are wide vs IG corporates — the same sell-off that hurt 2022 returns created today's attractive entry point.`)
      if (durShort) bullets.push(`At ${nz(us.duration).toFixed(2)} years duration, our portfolio re-prices quickly, limiting the impact of rate-driven drawdowns.`)
      else {
        const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
        if (secYieldAdv > 0) bullets.push(`Current yield advantage of ${Math.round(secYieldAdv)}bps suggests forward-looking income will drive outperformance.`)
      }
      break
    }
    case "1y_perf": {
      if ((nz(us.threeYear) - nz(them.threeYear)) * 100 > 0) bullets.push(`Over 3 years, we've outperformed — the longer time horizon favors our approach.`)
      const secYieldAdv = (nz(us.secYield) - nz(them.secYield)) * 10000
      if (secYieldAdv > 10) bullets.push(`Current SEC yield advantage of ${Math.round(secYieldAdv)}bps supports a stronger forward income trajectory.`)
      bullets.push("Current portfolio positioning and sector allocation suggest improving relative performance going forward.")
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
      // Never defend 2022 directly
      bullets.push("2022 was a rate-driven event (Fed hiked 425bps), not a credit deterioration event — fundamentals held and recovery followed in 2023-2024.")
      bullets.push("Securitized credit was among the top performers in 2023-2024 as spreads compressed — the recovery more than rewarded staying invested.")
      if (durShort) bullets.push(`At ${nz(us.duration).toFixed(2)} years duration, the impact of rate-driven sell-offs is structurally limited — short duration cushions the blow.`)
      else bullets.push("Current securitized spreads remain wide vs IG corporates — the sell-off created a historically attractive entry point that still persists.")
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
export function buildWarRoom(us: FundData, them: FundData): WarRoom {
  const rawAdvantages = findCompetitorAdvantages(us, them)

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

  const rebuttals: Rebuttal[] = ranked.map(adv => generateRebuttal(adv as any, us, them))

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
