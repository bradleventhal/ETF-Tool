import OpenAI from "openai"
import { NextResponse } from "next/server"
import type { FundData, YahooAnalytics } from "@/lib/fund-types"

export const maxDuration = 30

function nz(v: number | null | undefined): number {
  return v == null || isNaN(v) ? 0 : v
}

function fPct(v: number | null | undefined, d = 2): string {
  return v == null ? "—" : (v * 100).toFixed(d) + "%"
}

function bps(a: number, b: number): number {
  return Math.round((nz(a) - nz(b)) * 10000)
}

interface Delta {
  metric: string
  ours: string
  theirs: string
  deltaBps: number
  direction: string
}

function computeDeltas(a: FundData, b: FundData): Delta[] {
  const deltas: Delta[] = []

  const metrics: { key: keyof FundData; label: string; unit: string; higherBetter: boolean; neutral?: boolean }[] = [
    { key: "secYield", label: "SEC Yield", unit: "%", higherBetter: true },
    { key: "distributionYield", label: "Distribution Yield", unit: "%", higherBetter: true },
    { key: "expense", label: "Expense Ratio", unit: "%", higherBetter: false },
    { key: "duration", label: "Duration", unit: "yrs", higherBetter: false },
    { key: "stdDev", label: "Std Dev", unit: "%", higherBetter: false },
    { key: "sharpe", label: "Sharpe Ratio", unit: "", higherBetter: true },
    { key: "threeYear", label: "3Y Return", unit: "%", higherBetter: true },
    { key: "oneYear", label: "1Y Return", unit: "%", higherBetter: true },
    { key: "securitized", label: "Securitized Allocation", unit: "%", higherBetter: false, neutral: true },
    { key: "corporateCredit", label: "Corporate Credit Allocation", unit: "%", higherBetter: false, neutral: true },
  ]

  for (const m of metrics) {
    const av = nz(a[m.key] as number)
    const bv = nz(b[m.key] as number)
    const d = bps(av, bv)
    if (Math.abs(d) < 1 && !m.neutral) continue

    let direction: string
    if (m.neutral) {
      direction = "neutral_allocation"
    } else if ((m.higherBetter && d > 0) || (!m.higherBetter && d < 0)) {
      direction = "advantage_ours"
    } else {
      direction = "advantage_theirs"
    }

    deltas.push({
      metric: m.label,
      ours: m.unit === "%" ? fPct(av / 100) : av.toFixed(2),
      theirs: m.unit === "%" ? fPct(bv / 100) : bv.toFixed(2),
      deltaBps: d,
      direction,
    })
  }
  return deltas
}

function buildDataPayload(a: FundData, b: FundData, yahoo: YahooAnalytics | null, deltas: Delta[]): string {
  const lines: string[] = []
  lines.push(`OUR FUND: ${a.ticker} (${a.name})`)
  lines.push(`COMPETITOR: ${b.ticker} (${b.name})`)
  lines.push("")
  lines.push("METRIC DELTAS:")
  for (const d of deltas) {
    lines.push(`  ${d.metric}: ${a.ticker}=${d.ours} vs ${b.ticker}=${d.theirs} (${d.deltaBps > 0 ? "+" : ""}${d.deltaBps}bps, ${d.direction})`)
  }
  lines.push("")
  lines.push("CREDIT QUALITY:")
  lines.push(`  ${a.ticker}: AAA=${fPct(a.aaa)}, AA=${fPct(a.aa)}, A=${fPct(a.a)}, BBB=${fPct(a.bbb)}`)
  lines.push(`  ${b.ticker}: AAA=${fPct(b.aaa)}, AA=${fPct(b.aa)}, A=${fPct(b.a)}, BBB=${fPct(b.bbb)}`)

  if (yahoo) {
    lines.push("")
    lines.push("YAHOO FINANCE DATA:")
    if (yahoo.correlationToAGG != null) lines.push(`  Correlation to AGG: ${a.ticker}=${yahoo.correlationToAGG.toFixed(2)}`)
    if (yahoo.maxDrawdownA != null) lines.push(`  Max Drawdown ${a.ticker}: ${(yahoo.maxDrawdownA * 100).toFixed(1)}%`)
    if (yahoo.maxDrawdownB != null) lines.push(`  Max Drawdown ${b.ticker}: ${(yahoo.maxDrawdownB * 100).toFixed(1)}%`)
  }
  return lines.join("\n")
}

const SYSTEM_PROMPT = `You are a senior fixed income portfolio strategist generating competitive war room briefings for fund wholesalers.

OUTPUT: Return valid JSON matching this schema:
{
  "overallDifficulty": "Very Easy" | "Easy" | "Moderate" | "Difficult" | "Very Difficult",
  "difficultySummary": "CONVERSATIONAL 2-3 sentences talking directly to the rep like a coach. If easy: 'This is a layup. They have nothing real.' If moderate: 'Winnable but be ready — their X edge is real, have your response loaded.' If hard: 'This one's tough — their X is hard to argue against. Lean on Y.'",
  "leadWith": "Comma-separated list of our fund's key advantages to lead with (e.g. 'yield advantage, higher credit quality, comparable duration'). Null if layup.",
  "isLayup": boolean,
  "layupMessage": string | null,
  "marketContext": "1-2 sentence current market context relevant to this comparison",
  "competitorArguments": [
    {
      "id": "string",
      "metric": "string",
      "difficulty": "Very Easy" | "Easy" | "Moderate" | "Difficult" | "Very Difficult",
      "argument": "What the competitor rep would say (1-2 sentences, in quotes)",
      "theirValue": "their metric value",
      "ourValue": "our metric value",
      "deltaBps": number
    }
  ],
  "rebuttals": [
    {
      "id": "string",
      "targetMetric": "string",
      "approach": "The rebuttal strategy name",
      "script": "Word-for-word rebuttal script the wholesaler can use (2-3 sentences)",
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "oneLiner": "One punchy line summary"
    }
  ]
}

CRITICAL RULES:
- Items with direction "neutral_allocation" are NOT advantages for either side. Do NOT treat higher securitized or corporate allocation as inherently better.
- Focus on metrics that MATTER: yield, risk-adjusted performance, credit quality, duration.
- Allocation differences should only be mentioned as context, never as arguments.
- Generate 1-5 competitor arguments based on what data actually supports.
- Each argument needs a matching rebuttal.
- Be honest — if the competitor has a real edge, acknowledge it and provide the best possible counter.
- Return ONLY valid JSON, no markdown, no code fences.`

export async function POST(req: Request) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

    const { fundA, fundB, yahoo } = (await req.json()) as {
      fundA: FundData
      fundB: FundData
      yahoo: YahooAnalytics | null
    }

    if (!fundA?.ticker || !fundB?.ticker) {
      return NextResponse.json({ error: "Missing fund data" }, { status: 400 })
    }

    const deltas = computeDeltas(fundA, fundB)
    const dataPayload = buildDataPayload(fundA, fundB, yahoo, deltas)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate the war room briefing for ${fundA.ticker} (our fund) vs ${fundB.ticker} (competitor).\n\nDATA:\n${dataPayload}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    })

    const raw = completion.choices[0]?.message?.content || ""

    // Parse JSON from response (strip code fences if present)
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    console.error("[v0] War room generate error:", err)
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
