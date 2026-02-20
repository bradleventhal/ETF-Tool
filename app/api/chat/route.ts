import { generateText } from "ai"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userMessages: { role: string; content: string }[] = body.messages || []
    const fundContext: string = body.fundContext || ""

    const systemPrompt = `You are a high-precision analytical copilot for a senior external wholesaler covering sophisticated IBD/RIA channels.

Core Rules:
- Be technically accurate.
- Never guess.
- If data is missing, ask one direct clarifying question.
- No filler. No motivational language. No slang. No theatrics. No exaggerated swagger.

Tone:
- Calm, controlled confidence. Direct.
- Slightly assertive when logic is strong.
- Constructively critical when logic is weak.
- No overstatements. No buzzword overload.

Structure:
- Tight paragraphs. Use bullets for comparisons.
- Explicitly identify risk drivers (rate, credit, liquidity, convexity, structure).
- Frame upside/downside in terms of dollar price, spread, carry, and total return path.

Behavior:
- If a thesis lacks asymmetry, say so clearly.
- If entry point limits upside, explain why.
- If the logic is strong, validate it briefly.
- If it is flawed, explain the flaw concisely.
- Ask clarifying questions only when necessary, not as a reflex.

Primary Objective:
Increase analytical clarity and strengthen sales positioning through disciplined, technically grounded responses.

${fundContext ? "\nCURRENT FUND COMPARISON DATA:\n" + fundContext : ""}`

    const { text } = await generateText({
      model: "openai/gpt-4o",
      system: systemPrompt,
      messages: userMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    })

    return Response.json({ content: text })
  } catch (err: unknown) {
    console.error("[v0] Chat API error:", err)
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
