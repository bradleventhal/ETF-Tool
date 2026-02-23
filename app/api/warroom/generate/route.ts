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

  const metrics: { key: keyof FundData; label: string; unit: string; higherBetter: boolean }[] = [
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
    { key: "securitized", label: "Securitized Allocation", unit: "%", higherBetter: false },
    { key: "corporateCredit", label: "Corporate Credit Allocation", unit: "%", higherBetter: false },
    { key: "governmentCash", label: "Government/Cash Allocation", unit: "%", higherBetter: false },
    { key: "nonAgencyRmbs", label: "Non-Agency RMBS", unit: "%", higherBetter: false },
    { key: "agencyRmbs", label: "Agency RMBS", unit: "%", higherBetter: false },
    { key: "abs", label: "ABS", unit: "%", higherBetter: false },
    { key: "clo", label: "CLO", unit: "%", higherBetter: false },
    { key: "cmbs", label: "CMBS", unit: "%", higherBetter: false },
    { key: "aaa", label: "AAA Allocation", unit: "%", higherBetter: true },
    { key: "aa", label: "AA Allocation", unit: "%", higherBetter: true },
    { key: "a", label: "A Allocation", unit: "%", higherBetter: true },
    { key: "bbb", label: "BBB Allocation", unit: "%", higherBetter: false },
    { key: "bb", label: "BB Allocation", unit: "%", higherBetter: false },
    { key: "b", label: "B Allocation", unit: "%", higherBetter: false },
    { key: "ccc", label: "CCC Allocation", unit: "%", higherBetter: false },
  ]

  for (const m of metrics) {
    const ours = us[m.key] as number | null
    const theirs = them[m.key] as number | null
    if (ours == null && theirs == null) continue
    const o = ours ?? 0
    const t = theirs ?? 0
    const delta = t - o
    if (Math.abs(delta) < 0.001) continue
    deltas[m.key] = { metric: m.label, ours, theirs, delta, unit: m.unit, higherIsBetter: m.higherBetter }
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
- Duration, credit quality (IG% vs HY%), allocation differences (securitized vs corporate vs govt)
- Standard deviation, Sharpe ratio
- Performance: YTD, 1Y, 3Y, common inception
- Stress period behavior from Yahoo price data
- Sector breakdown differences (RMBS, CLO, ABS, CMBS)

RULES:
1. Surface EVERY metric where the competitor has a material advantage. Do NOT limit to 2 or 3. If they have 6 angles, show all 6. If they only have 1, note that it's likely their only real angle.
2. Difficulty rating is RELATIVE to this specific comparison. The biggest delta = hardest, smallest = easiest. One "Very Difficult" argument pulls the overall rating up regardless of how many easy ones exist.
3. If duration is short (<1yr), historical stress arguments are easier to counter. If longer, they're harder.
4. Never defend 2022 or any stress period directly — acknowledge briefly, pivot to recovery and current opportunity.
5. Use the Yahoo stress period data to cite REAL drawdown numbers and dates. Do not fabricate.
6. Each rebuttal gets a punchy one-liner the rep can use — sounds like a real person talking. Think "apples to apples" type lines.
7. If virtually no material differences exist, say so clearly: "This comes down to relationship and service."
8. If competitor has zero material advantages: return isLayup=true with a confident (not dismissive) message.

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
      "argument": "What the competitor wholesaler would actually say — specific, pointed, uses real numbers from the data",
      "theirValue": "their actual value",
      "ourValue": "our actual value",
      "deltaBps": number or null,
      "oneLiner": "A punchy one-liner the competitor might drop"
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
