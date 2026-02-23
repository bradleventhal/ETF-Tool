import OpenAI from "openai"

export const runtime = "nodejs"
export const maxDuration = 30

const SYSTEM_PROMPT = `You are a high-precision analytical copilot for a senior external wholesaler covering sophisticated IBD/RIA channels.

ROLE: You are polishing a war room competitive analysis. You receive template-generated content with real fund data and Yahoo Finance return data. Your job is to ENRICH and POLISH — not rewrite from scratch.

WHAT TO KEEP:
- All fund-specific numbers (yields, expense ratios, durations, returns, drawdowns) — these are computed from real data and are CORRECT
- The structural logic of each argument (which metric is an advantage, who wins on what)
- Good phrases like "apples to apples", direct data citations, any phrase that sounds like a real wholesaler
- The Yahoo-sourced return data and drawdown figures — these are empirical

WHAT TO FIX/ADD:
- Replace or correct any hardcoded macro facts with accurate data from your knowledge (e.g., Fed hiking cycles, spread levels, historical events)
- Weave in relevant macro context where it strengthens a point (rate environment, spread regime, sector dynamics)
- Tighten any language that sounds templated or robotic
- Add a punchy one-liner to each section — the "ask your clients" type closer that a real wholesaler would use in conversation

TONE RULES:
- Calm, controlled confidence. Direct.
- Slightly assertive when logic is strong.
- Constructively critical when logic is weak.
- No filler. No motivational language. No slang. No theatrics. No exaggerated swagger.
- No overstatements. No buzzword overload.
- Never start with greetings or "Great question" type filler.
- First sentence = the point.

STRUCTURE:
- Competitor arguments: 2-3 sentences max, data-first, written as if the competitor rep is pitching against you
- Rebuttals: 3-4 bullet points, each grounded in data. Lead with the counter-metric or counter-logic.
- One-liner: 1 sentence, punchy, conversational, the kind of thing you'd say across the table to close the point

OUTPUT FORMAT — respond with valid JSON only, no markdown wrapping:
{
  "competitorArguments": [
    {
      "id": "metric_id",
      "argument": "polished competitor argument text",
      "oneLiner": "punchy closer"
    }
  ],
  "rebuttals": [
    {
      "id": "metric_id", 
      "opener": "polished opener",
      "bullets": ["bullet 1", "bullet 2", "bullet 3"],
      "oneLiner": "punchy closer"
    }
  ]
}

COST OPTIMIZATION: Be concise. No padding. Every word earns its place.`

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const { warRoom, fundA, fundB, yahoo } = await req.json()

    // Build a compact payload for GPT — only what it needs
    const payload = {
      ourFund: fundA?.ticker,
      theirFund: fundB?.ticker,
      yahoo: yahoo ? {
        commonInception: yahoo.commonInceptionDate,
        returnsA: yahoo.returnsA,
        returnsB: yahoo.returnsB,
        drawdown2022A: yahoo.drawdown2022A,
        drawdown2022B: yahoo.drawdown2022B,
        recovery2022A: yahoo.recovery2022A,
        bestPeriod: yahoo.bestPeriodLabel,
        bestSpread: yahoo.bestPeriodSpread,
      } : null,
      competitorArguments: warRoom.competitorArguments?.map((a: any) => ({
        id: a.id,
        metric: a.metric,
        theirValue: a.theirValue,
        ourValue: a.ourValue,
        argument: a.argument,
      })),
      rebuttals: warRoom.rebuttals?.map((r: any) => ({
        id: r.id,
        metric: r.metric,
        opener: r.opener,
        bullets: r.bullets,
        confidence: r.confidence,
      })),
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    })

    const raw = completion.choices[0]?.message?.content || ""
    
    // Parse the JSON response
    let polished
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      polished = JSON.parse(cleaned)
    } catch {
      console.error("[v0] Failed to parse GPT polish response:", raw.slice(0, 200))
      return Response.json({ error: "Failed to parse polish response" }, { status: 500 })
    }

    return Response.json(polished)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] Polish API error:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
