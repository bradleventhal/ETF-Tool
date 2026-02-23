import OpenAI from "openai"

const STARTER_SYSTEM_PROMPT = `You are generating starter questions for an analytical copilot chat about a fund comparison.

You will receive war room analysis data including competitive difficulty, counter-arguments, rebuttals, and fund comparison data.

Generate exactly 4 questions that a senior wholesaler would realistically ask in the field. These should be:
- Practical and situational (not things already answered in the war room)
- Focused on sales positioning, client conversations, and competitive scenarios
- Specific to the actual data and competitive dynamics shown
- Different from each other in topic (one about positioning, one about a specific objection, one about a client scenario, one about market context)

Return ONLY the questions, one per line, no numbering, no prefixes.`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const warRoomContext: string = body.warRoomContext || ""

    const openai = new OpenAI()
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: STARTER_SYSTEM_PROMPT },
        { role: "user", content: warRoomContext },
      ],
      temperature: 0.4,
      max_tokens: 400,
    })

    const raw = completion.choices[0]?.message?.content || ""
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
