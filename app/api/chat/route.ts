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

FOLLOW-UP QUESTIONS:
- After your main answer, output exactly 3 follow-up questions the user would logically want to ask next, based on what you just said.
- Format them on separate lines at the very end of your response, each prefixed with "FOLLOWUP:" (no space before the prefix, one space after the colon).
- These should be practical, specific, and build on your answer -- not generic.
- Example format:
FOLLOWUP: How does this yield advantage hold up in a rising rate scenario?
FOLLOWUP: What's the best way to frame the duration difference for a risk-averse client?
FOLLOWUP: Can you compare the credit risk profiles in more detail?

Primary Objective:
Increase analytical clarity and strengthen sales positioning through disciplined, technically grounded responses.`

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

    const raw = completion.choices[0]?.message?.content || "No response generated."

    // Parse follow-up questions from the response
    const lines = raw.split("\n")
    const followUps: string[] = []
    const contentLines: string[] = []

    for (const line of lines) {
      if (line.startsWith("FOLLOWUP:")) {
        followUps.push(line.replace("FOLLOWUP:", "").trim())
      } else {
        contentLines.push(line)
      }
    }

    // Clean trailing empty lines from content
    while (contentLines.length > 0 && contentLines[contentLines.length - 1].trim() === "") {
      contentLines.pop()
    }

    return Response.json({
      content: contentLines.join("\n"),
      followUps: followUps.slice(0, 3),
    })
  } catch (err: unknown) {
    console.error('[v0] Chat error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
