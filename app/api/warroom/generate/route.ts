import OpenAI from "openai"
import type { FundData, YahooAnalytics, WarRoom } from "@/lib/fund-types"

export const runtime = "nodejs"
export const maxDuration = 30

// Build a compact data payload for GPT (minimize tokens)
function buildDataPayload(fundA: FundData, fundB: FundData, yahoo: YahooAnalytics | null, deltas: Record<string, any>) {
  return JSON.stringify({
    ourFund: fundA.ticker,
    competitor: fundB.ticker,
    ourData: fundA,
    theirData: fundB,
    metricDeltas: deltas,
    yahooData: yahoo ? {
      commonInception: yahoo.commonInceptionDate,
      periodReturns: yahoo.periodReturns,
      stressPeriods: yahoo.stressPeriods,
      bestPeriodForUs: yahoo.bestPeriodForA,
      bestPeriodForThem: yahoo.bestPeriodForB,
      ourMaxDrawdown: yahoo.maxDrawdownA,
      theirMaxDrawdown: yahoo.maxDrawdownB,
    } : null,
  })
}

// Compute all deltas between both funds
function computeDeltas(us: FundData, them: FundData) {
  const deltas: Record<string, { metric: string; ours: number | null; theirs: number | null; delta: number; unit: string; higherIsBetter: boolean }> = {}

  // Performance & risk metrics — these have clear directionality
  const directionalMetrics: { key: keyof FundData; label: string; unit: string; higherBetter: boolean }[] = [
    { key: "secYield", label: "SEC Yield", unit: "%", higherBetter: true },
    { key: "distributionYield", label: "Distribution Yield", unit: "%", higherBetter: true },
    { key: "expense", label: "Expense Ratio", unit: "%", higherBetter: false },
    { key: "duration", label: "Duration", unit: "yrs", higherBetter: false },
    { key: "stdDev", label: "Standard Deviation", unit: "%", higherBetter: false },
    { key: "sharpe", label: "Sharpe Ratio", unit: "", higherBetter: true },
    { key: "ytd", label: "YTD Return", unit: "%", higherBetter: true },
    { key: "oneYear", label: "1Y Return", unit: "%", higherBetter: true },
    { key: "threeYear", label: "3Y Return", unit: "%", higherBetter: true },
    { key: "commonInception", label: "Common Inception Return", unit: "%", higherBetter: true },
  ]

  // Allocation & sector metrics — NO directionality. GPT decides what matters.
  const neutralMetrics: { key: keyof FundData; label: string; unit: string }[] = [
    { key: "securitized", label: "Securitized Allocation", unit: "%" },
    { key: "corporateCredit", label: "Corporate Credit Allocation", unit: "%" },
    { key: "governmentCash", label: "Government/Cash Allocation", unit: "%" },
    { key: "nonAgencyRmbs", label: "Non-Agency RMBS", unit: "%" },
    { key: "agencyRmbs", label: "Agency RMBS", unit: "%" },
    { key: "abs", label: "ABS", unit: "%" },
    { key: "clo", label: "CLO", unit: "%" },
    { key: "cmbs", label: "CMBS", unit: "%" },
    { key: "aaa", label: "AAA Allocation", unit: "%" },
    { key: "aa", label: "AA Allocation", unit: "%" },
    { key: "a", label: "A Allocation", unit: "%" },
    { key: "bbb", label: "BBB Allocation", unit: "%" },
    { key: "bb", label: "BB Allocation", unit: "%" },
    { key: "b", label: "B Allocation", unit: "%" },
    { key: "ccc", label: "CCC Allocation", unit: "%" },
  ]

  for (const m of directionalMetrics) {
    const ours = us[m.key] as number | null
    const theirs = them[m.key] as number | null
    if (ours == null && theirs == null) continue
    const o = ours ?? 0
    const t = theirs ?? 0
    const delta = t - o
    if (Math.abs(delta) < 0.001) continue
    deltas[m.key] = { metric: m.label, ours, theirs, delta, unit: m.unit, type: "directional", higherIsBetter: m.higherBetter }
  }

  for (const m of neutralMetrics) {
    const ours = us[m.key] as number | null
    const theirs = them[m.key] as number | null
    if (ours == null && theirs == null) continue
    const o = ours ?? 0
    const t = theirs ?? 0
    const delta = t - o
    if (Math.abs(delta) < 0.005) continue // 0.5% threshold for allocations
    deltas[m.key] = { metric: m.label, ours, theirs, delta, unit: m.unit, type: "neutral_allocation" }
  }
  return deltas
}

const SYSTEM_PROMPT = `You are a war room strategist for an Angel Oak fixed income ETF wholesaler. You are generating a competitive intelligence briefing.

ROLE: You are preparing our wholesaler to sell AGAINST the competitor fund. You must identify EVERY angle the competitor could use, and give our rep the ammunition to handle each one.

YOUR KNOWLEDGE: You have deep knowledge of fixed income markets, macro events, credit cycles, and sector dynamics. Use this knowledge to provide accurate macro context. For example, you know the Fed hiked rates ~550bps in 2022-2023, you know April 2025 saw corporate credit stress from tariff uncertainty, you know securitized spread dynamics vs IG corporates. USE your knowledge — do not make up specific numbers but DO provide accurate directional context.

TONE RULES:
- Calm, controlled confidence. Direct.
- Slightly assertive when logic is strong.
- Constructively critical when logic is weak.
- No filler. No motivational language. No slang. No theatrics. No buzzword overload.
- No "Great question" or "Let me explain" or conversational openers.

KEY DIMENSIONS TO EVALUATE (prioritize based on magnitude):
- SEC yield, distribution yield, expense ratio
- Duration, credit quality (IG% vs HY%)
- Standard deviation, Sharpe ratio (supplementary only)
- Performance: YTD, 1Y, 3Y, common inception
- Stress period behavior from Yahoo price data
- Sector breakdown differences (RMBS, CLO, ABS, CMBS)

CRITICAL — ALLOCATION DIFFERENCES:
Metrics labeled "neutral_allocation" in the data are NOT inherently good or bad. Having more corporate credit is NOT automatically an advantage. Having more securitized is NOT automatically a disadvantage. YOU must use your fixed income knowledge to determine:
- Would a competitor ACTUALLY use this allocation difference as a pitch point? In what context?
- Is this allocation difference a VULNERABILITY in the current environment? (e.g. heavy corporate during a spread-widening episode)
- Or is it just a structural difference that doesn't give either fund a meaningful edge?
Only include allocation as a competitor argument if a real competitor wholesaler would actually lead with it. Note allocation differences in the difficultySummary as context even if they don't warrant a standalone argument.

RULES:
1. Surface EVERY metric where the competitor has a material advantage. Do NOT limit to 2 or 3. If they have 6 angles, show all 6. If they only have 1 or 2, explicitly note in the difficultySummary: "The competitor has limited ammunition — [metric] is likely their only/primary angle." This helps our rep know when the competitor is grasping at straws vs when they have real firepower. Count the angles for the rep.
2. Difficulty rating is RELATIVE to this specific comparison. The biggest delta = hardest, smallest = easiest. One "Very Difficult" argument pulls the overall rating up regardless of how many easy ones exist.
3. If both funds are in the SAME Morningstar category (e.g. both ultrashort), treat small duration/risk differences as DE MINIMIS. A 0.1yr duration difference between two ultrashort funds is NOT a material argument -- a real competitor wouldn't lead with that. Focus on what actually differentiates: allocation, sector exposure, yield, performance.
4. SHARPE RATIO is supplementary, NOT a lead argument. It can be mentioned as supporting evidence within another rebuttal but should never be the primary argument or a standalone section unless the difference is extreme (>0.5). Competitors don't lead meetings with Sharpe ratios.
5. If duration is short (<1yr), historical stress arguments are easier to counter. If longer, they're harder.
6. Never defend a stress period directly — acknowledge briefly with real numbers, pivot to recovery and current opportunity.
7. Use the Yahoo stress period data to cite REAL drawdown numbers and dates. Do not fabricate. Each stress period is classified as "Broad" (both funds dropped — likely a macro event like rate shock, spread widening, liquidity event) or "Idiosyncratic" (only one fund dropped — likely fund-specific: sector concentration, credit event, positioning). USE YOUR MACRO KNOWLEDGE to explain WHY each stress event happened (e.g. "April 2025 tariff-driven corporate spread widening", "Q1 2022 onset of Fed hiking cycle", "March 2020 COVID liquidity seizure"). This context is the whole point.
8. ALWAYS use actual ticker symbols (e.g. "UYLD", "VNLA") in arguments and rebuttals. NEVER write "our fund" or "your fund" or "Fund A" or "Fund B". Use the real tickers throughout.
9. Each rebuttal gets a punchy one-liner the rep can use — sounds like a real person talking. Think "apples to apples" type lines. One-liners ONLY go on rebuttals, NOT on competitor arguments.
10. If virtually no material differences exist, say so clearly: "This comes down to relationship and service."
11. If competitor has zero material advantages: return isLayup=true with a confident (not dismissive) message.

OUTPUT FORMAT: Return valid JSON matching this exact structure:
{
  "overallDifficulty": "Very Easy" | "Easy" | "Moderate" | "Difficult" | "Very Difficult",
  "difficultySummary": "2-3 sentence executive summary of the competitive landscape for this matchup",
  "isLayup": boolean,
  "layupMessage": string | null,
  "marketContext": "1-2 sentence current market context relevant to this comparison",
  "competitorArguments": [
    {
      "id": "unique_id",
      "metric": "Metric Name",
      "difficulty": "Easy" | "Moderate" | "Difficult" | "Very Difficult",
      "argument": "What the competitor wholesaler would actually say — specific, pointed, uses real tickers and numbers from the data",
      "theirValue": "their actual value",
      "ourValue": "our actual value",
      "deltaBps": number or null
    }
  ],
  "rebuttals": [
    {
      "argumentId": "matches the competitor argument id",
      "metric": "Metric Name",
      "opener": "One natural opening line the rep can say verbatim — human, not scripted",
      "bullets": ["Supporting point 1", "Supporting point 2", "Supporting point 3 if needed"],
      "confidence": "Airtight" | "Strong" | "Use With Caution",
      "oneLiner": "A punchy closer the rep can drop — sounds like a real wholesaler"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code fences, no explanation.`

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const body = await req.json()
    const { fundA, fundB, yahoo } = body as { fundA: FundData; fundB: FundData; yahoo: YahooAnalytics | null }

    if (!fundA || !fundB) {
      return Response.json({ error: "fundA and fundB required" }, { status: 400 })
    }

    const deltas = computeDeltas(fundA, fundB)
    const dataPayload = buildDataPayload(fundA, fundB, yahoo, deltas)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Generate the war room briefing for ${fundA.ticker} (our fund) vs ${fundB.ticker} (competitor).\n\nDATA:\n${dataPayload}` },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    })

    const raw = completion.choices[0]?.message?.content || ""

    // Parse JSON from response (handle possible markdown fences)
    let jsonStr = raw.trim()
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    }

    let warRoom: WarRoom
    try {
      warRoom = JSON.parse(jsonStr)
    } catch {
      console.error("[warroom] Failed to parse GPT response:", raw.slice(0, 200))
      return Response.json({ error: "Failed to parse war room response" }, { status: 500 })
    }

    return Response.json(warRoom)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[warroom] Error:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
