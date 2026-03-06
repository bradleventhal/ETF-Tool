import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `You are a writing assistant for a fixed income ETF wholesaler. Your job is to write follow up emails after advisor meetings. You must match the rep's exact writing style — their tone, length, structure, greeting, and sign off. Never sound like AI. Never use generic phrases like 'I hope this email finds you well' or 'It was a pleasure meeting with you.' Write like a real person who just had a real conversation. Keep it warm but professional. Reference specific things from the meeting notes to make it feel personal. If a next step was mentioned, include it clearly. If a fund was discussed, reference it naturally — don't make it sound like a sales pitch.`

const FUND_MATERIALS: Record<string, string[]> = {
  "UYLD": ["UYLD Fact Sheet", "UYLD vs VNLA Comparison"],
  "AOUIX": ["AOUIX Fact Sheet", "Ultrashort Fund Overview"],
  "ANGIX": ["ANGIX Fact Sheet", "Multi-Strategy Income Overview"],
  "CARY": ["CARY Fact Sheet", "Income ETF Comparison"],
  "AOHY": ["AOHY Fact Sheet", "High Yield ETF Overview"],
  "ASCIX": ["ASCIX Fact Sheet", "Strategic Credit Overview"],
  "MBS": ["MBS ETF Fact Sheet", "Agency MBS Overview"],
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      repName,
      contactName,
      contactFirm,
      contactCity,
      contactState,
      contactStatus,
      relevantStrategies,
      meetingNotes,
      meetingDate,
      fundsDiscussed,
      nextStep,
    } = body

    if (!repName || !contactName || !meetingNotes) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Fetch rep's style profile
    const { data: profile } = await supabase
      .from("rep_style_profiles")
      .select("style_summary")
      .eq("rep_name", repName)
      .single()

    const styleSummary = profile?.style_summary || "Write in a warm, professional tone. Keep it concise and direct."

    // Build the prompt
    const userPrompt = `Rep writing style profile:
${styleSummary}

Contact info:
- Name: ${contactName}
- Firm: ${contactFirm || "Unknown"}
- City: ${contactCity || "Unknown"}, ${contactState || ""}
- Existing relationship: ${contactStatus || "Unknown"}
- AO strategies on file: ${relevantStrategies || "None specified"}

Meeting notes:
${meetingNotes}

Funds discussed: ${fundsDiscussed?.join(", ") || "None specified"}
Next step: ${nextStep || "None specified"}
Meeting date: ${meetingDate || "Today"}

Write a follow up email from the rep to this advisor. Match the rep's writing style exactly. Reference the meeting naturally. Include the next step if provided. Do not mention specific AUM numbers or performance figures unless the rep included them in their notes. Keep it genuine and human.

Return ONLY the email with this format:
SUBJECT: [subject line]

[email body]`

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.6,
      maxOutputTokens: 1000,
    })

    const raw = result.text || ""

    // Parse subject and body
    let subject = ""
    let body_text = raw

    const subjectMatch = raw.match(/^SUBJECT:\s*(.+?)(?:\n|$)/i)
    if (subjectMatch) {
      subject = subjectMatch[1].trim()
      body_text = raw.slice(subjectMatch[0].length).trim()
    }

    // Generate suggested attachments
    const suggestedAttachments: string[] = []
    if (fundsDiscussed && fundsDiscussed.length > 0) {
      for (const fund of fundsDiscussed) {
        const materials = FUND_MATERIALS[fund.toUpperCase()]
        if (materials) {
          suggestedAttachments.push(...materials)
        }
      }
    }

    return Response.json({
      subject,
      body: body_text,
      suggestedAttachments: [...new Set(suggestedAttachments)],
    })
  } catch (err: unknown) {
    console.error("[v0] Generate follow-up error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
