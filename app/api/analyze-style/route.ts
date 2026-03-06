import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STYLE_ANALYSIS_PROMPT = `You are analyzing a sales rep's writing style from their past follow-up emails. Examine these examples carefully and describe their writing style in detail.

Analyze and describe:
1. TONE: Is it formal, conversational, warm, direct, casual? 
2. LENGTH: Do they write short punchy emails or longer detailed ones?
3. STRUCTURE: Do they use prose paragraphs or bullet points?
4. GREETING: How do they start? ("Hi John", "John,", "Hey John", etc.)
5. SIGN-OFF: How do they end? ("Best,", "Talk soon,", "Thanks,", etc.)
6. PERSONAL TOUCH: Do they reference personal details or small talk?
7. SENTENCE STYLE: Short and punchy or longer flowing sentences?
8. VOCABULARY: Simple and direct or more sophisticated?
9. FOLLOW-UP STYLE: How do they handle next steps and action items?

Write a 2-3 paragraph summary that captures their unique voice so another AI could replicate it exactly. Be specific about their patterns.`

export async function POST(req: Request) {
  try {
    const { repName, examples } = await req.json() as { repName: string; examples: string[] }

    if (!repName || !examples || examples.length < 2) {
      return Response.json({ error: "Need rep name and at least 2 email examples" }, { status: 400 })
    }

    // Analyze the style
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: STYLE_ANALYSIS_PROMPT,
      prompt: `Here are ${examples.length} email examples from ${repName}:\n\n${examples.map((e, i) => `--- EMAIL ${i + 1} ---\n${e}`).join("\n\n")}`,
      temperature: 0.3,
      maxOutputTokens: 1000,
    })

    const styleSummary = result.text || ""

    // Save to Supabase
    const { error: dbError } = await supabase
      .from("rep_style_profiles")
      .upsert({
        rep_name: repName,
        style_examples: examples,
        style_summary: styleSummary,
        updated_at: new Date().toISOString(),
      }, { onConflict: "rep_name" })

    if (dbError) {
      console.error("[v0] Supabase error:", dbError)
      return Response.json({ error: "Failed to save style profile" }, { status: 500 })
    }

    return Response.json({ styleSummary, saved: true })
  } catch (err: unknown) {
    console.error("[v0] Style analysis error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const repName = searchParams.get("repName")

    if (!repName) {
      return Response.json({ error: "Missing repName" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("rep_style_profiles")
      .select("*")
      .eq("rep_name", repName)
      .single()

    if (error || !data) {
      return Response.json({ profile: null })
    }

    return Response.json({ profile: data })
  } catch (err: unknown) {
    console.error("[v0] Get style profile error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
