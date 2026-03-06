import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

const STARTER_SYSTEM_PROMPT = `You are generating starter questions for an analytical copilot chat about a fund comparison.

You will receive war room analysis data including competitive difficulty, counter-arguments, rebuttals, and fund comparison data.

Generate exactly 4 questions that a senior wholesaler would realistically ask in the field. These should be:
- Practical and situational (not things already answered in the war room)
- Focused on analytical deep-dives, client objection handling, market context, and competitive scenarios
- Specific to the actual data and competitive dynamics shown
- Different from each other in topic (one about a specific metric/risk, one about a client objection, one about market conditions, one about competitive positioning)
- NEVER ask for an "elevator pitch" or "30-second pitch" -- there is already a separate elevator pitch generator. Focus on analytical and tactical questions instead.

Return ONLY the questions, one per line, no numbering, no prefixes.`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const warRoomContext: string = body.warRoomContext || ""

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: STARTER_SYSTEM_PROMPT,
      prompt: warRoomContext,
      temperature: 0.4,
      maxOutputTokens: 400,
    })

    const raw = result.text || ""
    const questions = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 10)
      .slice(0, 4)

    return Response.json({ questions })
  } catch (err: unknown) {
    console.error("[v0] Starter questions error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return Response.json({ questions: [], error: message }, { status: 500 })
  }
}
