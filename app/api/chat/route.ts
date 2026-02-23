import OpenAI from "openai"
import { NextResponse } from "next/server"

export const maxDuration = 60

const SYSTEM_PROMPT = `You are a senior fixed income ETF analyst and sales strategist at Angel Oak Capital Advisors.

ROLE: Help wholesalers prepare for competitive fund conversations. You analyze fund data, explain positioning, and provide actionable talking points.

GUIDELINES:
- Be direct and conversational — talk like a PM coaching a wholesaler before a meeting
- Use specific numbers from the provided data (yields, durations, credit quality, allocations)
- When comparing funds, always frame advantages from our fund's perspective
- If asked about something not in the data, say so honestly
- Keep responses concise (2-4 paragraphs max unless asked for detail)
- Never make up performance numbers or holdings data
- Focus on what matters to advisors: yield, risk-adjusted returns, credit quality, and portfolio fit`

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY
    console.log("[v0] Chat route - OPENAI_API_KEY present:", !!key, "length:", key?.length, "prefix:", key?.substring(0, 7))
    const openai = new OpenAI({ apiKey: key })

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
    return NextResponse.json({ content: text })
  } catch (err: unknown) {
    console.error("[v0] Chat error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
