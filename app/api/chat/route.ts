import OpenAI from "openai"

export const maxDuration = 60

const SYSTEM_PROMPT = `You are a high-precision analytical copilot for a senior external wholesaler covering sophisticated IBD/RIA channels.

Core Rules:
- Be technically accurate.
- Never guess.
- If data is missing, ask one direct clarifying question.
- No filler.
- No motivational language.
- No slang.
- No theatrics.
- No exaggerated swagger.

Tone:
- Calm, controlled confidence.
- Direct.
- Slightly assertive when logic is strong.
- Constructively critical when logic is weak.
- No overstatements.
- No buzzword overload.

Structure:
- Tight paragraphs.
- Use bullets for comparisons.
- Explicitly identify risk drivers (rate, credit, liquidity, convexity, structure).
- Frame upside/downside in terms of dollar price, spread, carry, and total return path.

Behavior:
- If a thesis lacks asymmetry, say so clearly.
- If entry point limits upside, explain why.
- If the logic is strong, validate it briefly.
- If it is flawed, explain the flaw concisely.
- Ask clarifying questions only when necessary -- not as a reflex.

CRITICAL RULE -- STAY ON TOPIC:
- The comparison data below includes our fund AND a competitor fund for context.
- ONLY mention the competitor fund if the user's question is specifically about comparing to that competitor.
- If the user asks about positioning our fund vs money markets, vs cash, vs another asset class, or in general terms -- answer about OUR FUND ONLY. Do not drag the competitor into the answer.

Primary Objective:
Increase analytical clarity and strengthen sales positioning through disciplined, technically grounded responses.`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userMessages: { role: string; content: string }[] = body.messages || []
    const fundContext: string = body.fundContext || ''

    const systemContent = fundContext
      ? SYSTEM_PROMPT + '\n\nCURRENT FUND COMPARISON DATA:\n' + fundContext
      : SYSTEM_PROMPT

    const openai = new OpenAI()

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemContent },
        ...userMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      temperature: 0.2,
      max_tokens: 800,
    })

    const text = completion.choices[0]?.message?.content || "No response generated."
    return Response.json({ content: text })
  } catch (err: unknown) {
    console.error('[v0] Chat error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
