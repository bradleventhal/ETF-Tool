import OpenAI from "openai"

const SYSTEM_PROMPT = `You are a senior external wholesaler's pitch coach. Given two funds (ours vs competitor) and their data, generate a tight, ready-to-use elevator pitch.

Rules:
- The pitch should be 3-4 sentences MAX. Something you can say in 30 seconds.
- Lead with the strongest differentiator.
- Include one specific number (yield, duration, Sharpe, performance -- whatever hits hardest).
- End with a sharp, specific question that flows naturally from what you just said. NOT "let's discuss" or "let's connect" -- ask something that makes the advisor think. Example: "When's the last time you stress-tested that allocation against a 50bps move?"
- No filler. No "in today's market" generic openers.
- Tone: confident, direct, not salesy. Like you're talking to a sharp advisor who's heard it all.
- ALWAYS use actual ticker symbols and fund names. Never say "our fund", "their fund", "the competitor", or "the fund they're currently using". Use the real tickers (e.g. "UYLD" and "VNLA").

Also generate 3 VARIATIONS of the pitch for different client scenarios:
1. For an advisor moving clients OUT OF MONEY MARKETS / CASH
2. For an advisor whose client is WORRIED ABOUT CREDIT RISK
3. For an advisor looking for INCOME without extending duration

Format your response EXACTLY like this (including the labels):
MAIN:
[main pitch text]

CASH_MOVE:
[pitch for money market move]

CREDIT_WORRY:
[pitch for credit-worried client]

INCOME_FOCUS:
[pitch for income-focused client]`

export async function POST(req: Request) {
  try {
    const { fundContext } = await req.json()

    const openai = new OpenAI()
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: fundContext },
      ],
      temperature: 0.5,
      max_tokens: 800,
    })

    const raw = completion.choices[0]?.message?.content || ""

    // Parse the labeled sections
    const sections: Record<string, string> = {}
    const labels = ["MAIN", "CASH_MOVE", "CREDIT_WORRY", "INCOME_FOCUS"]
    for (const label of labels) {
      const regex = new RegExp(`${label}:\\s*\\n([\\s\\S]*?)(?=\\n(?:${labels.join("|")}):|$)`)
      const match = raw.match(regex)
      if (match) {
        sections[label] = match[1].trim()
      }
    }

    return Response.json({
      main: sections.MAIN || raw.trim(),
      variations: [
        { label: "Moving Out of Cash", pitch: sections.CASH_MOVE || "" },
        { label: "Credit Risk Concerns", pitch: sections.CREDIT_WORRY || "" },
        { label: "Income Without Duration", pitch: sections.INCOME_FOCUS || "" },
      ].filter(v => v.pitch),
    })
  } catch (err: unknown) {
    console.error("[v0] Elevator pitch error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
