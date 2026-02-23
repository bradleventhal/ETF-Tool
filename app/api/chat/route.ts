import OpenAI from "openai"

export const runtime = "nodejs"
export const maxDuration = 60

// Rate limit: 25/day per user, but ADMIN_IPS get unlimited
const DAILY_LIMIT = 25
const ADMIN_IPS = (process.env.ADMIN_IPS || "").split(",").map(s => s.trim()).filter(Boolean)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  if (ADMIN_IPS.includes(ip)) return { allowed: true, remaining: 999 }

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

const SYSTEM_PROMPT = `You are a high-precision analytical copilot for a senior external wholesaler covering sophisticated IBD/RIA channels.

ABSOLUTE DATA RULES:
- You may ONLY reference data explicitly provided in the CURRENT FUND COMPARISON DATA section below.
- NEVER fabricate, infer, or assume any data point that is not explicitly provided. This includes historical events, drawdowns, performance periods, or any metric not in the data.
- If a data point is missing (e.g., no 2022 drawdown data provided), say "That data is not available in the current comparison" — do NOT fill in from general knowledge.
- If asked about something outside the provided data, state clearly: "I don't have that data in this comparison."

RESPONSE FORMAT:
- Do NOT write like a conversation. No greetings, no "Great question", no "Let me explain."
- Start every response with the direct answer or analysis. First sentence = the point.
- Use bullets for comparisons and multi-part answers.
- Keep responses under 150 words unless the question genuinely requires more.
- Never repeat the question back.

TONE:
- Calm, controlled confidence. Direct.
- Slightly assertive when logic is strong.
- Constructively critical when logic is weak.
- No overstatements. No buzzword overload.
- No filler. No motivational language. No slang. No theatrics.

ANALYTICAL STRUCTURE:
- Explicitly identify risk drivers (rate, credit, liquidity, convexity, structure).
- Frame upside/downside in terms of dollar price, spread, carry, and total return path.
- If a thesis lacks asymmetry, say so clearly.
- If entry point limits upside, explain why.

BEHAVIOR:
- Ask clarifying questions only when necessary, not as a reflex.
- If the logic is strong, validate it briefly. If flawed, explain the flaw concisely.

Primary Objective:
Increase analytical clarity and strengthen sales positioning through disciplined, technically grounded responses using ONLY the provided data.`

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 })
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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

    const systemContent = fundContext
      ? SYSTEM_PROMPT + "\n\nCURRENT FUND COMPARISON DATA:\n" + fundContext
      : SYSTEM_PROMPT

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemContent },
        ...userMessages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      temperature: 0.2,
      max_tokens: 800,
    })

    const text = completion.choices[0]?.message?.content || "No response generated."
    return Response.json({ content: text }, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] Chat API error:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
