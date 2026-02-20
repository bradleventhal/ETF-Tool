import { generateText } from "ai"

export const maxDuration = 60

const DAILY_LIMIT = 25
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 })
    return { allowed: true, remaining: DAILY_LIMIT - 1 }
  }
  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 }
  }
  entry.count++
  return { allowed: true, remaining: DAILY_LIMIT - entry.count }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const { allowed, remaining } = checkRateLimit(ip)
    if (!allowed) {
      return Response.json(
        { error: `Daily limit reached (${DAILY_LIMIT} messages). Resets in 24 hours.` },
        { status: 429 }
      )
    }

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
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      messages: userMessages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    })

    return Response.json({ content: text }, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    })
  } catch (err: unknown) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
