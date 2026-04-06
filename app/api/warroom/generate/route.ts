import OpenAI from "openai"
import type { FundData, YahooAnalytics, WarRoom, CompetitorArgument, Rebuttal, DifficultyTier, ConfidenceTag } from '@/lib/fund-types'

export const maxDuration = 30

const SYSTEM_PROMPT = `You are a fixed income ETF competitive analyst. Given two fund data objects and a baseline war room analysis, enhance the analysis with deeper market intelligence.

You will receive:
1. Fund data for both funds (ours and competitor)
2. A baseline war room analysis with competitor arguments and rebuttals

Your job: improve the arguments and rebuttals with sharper language and deeper market context while preserving the data-backed structure.

OUTPUT FORMAT — return ONLY valid JSON matching this exact structure:
{
  "overallDifficulty": "Very Easy" | "Easy" | "Moderate" | "Difficult" | "Very Difficult",
  "difficultySummary": "1-2 sentence coaching summary for the wholesaler",
  "leadWith": "comma-separated key advantages to lead with, or null",
  "isLayup": true/false,
  "layupMessage": "message if easy win, else null",
  "marketContext": "1-2 sentence current market positioning context",
  "competitorArguments": [
    {
      "id": "matches original id",
      "metric": "metric name",
      "difficulty": "Very Easy" | "Easy" | "Moderate" | "Difficult" | "Very Difficult",
      "argument": "what the competitor would say — sharp, specific, data-backed",
      "theirValue": "their metric value",
      "ourValue": "our metric value",
      "deltaBps": 0,
      "oneLiner": "quick one-line comeback for the wholesaler to memorize"
    }
  ],
  "rebuttals": [
    {
      "argumentId": "matches competitorArgument id",
      "metric": "metric name",
      "opener": "opening rebuttal line",
      "bullets": ["2-3 specific data-backed rebuttal points"],
      "confidence": "Airtight" | "Strong" | "Use With Caution",
      "oneLiner": "punchy one-line comeback — the thing you say in the hallway after the meeting"
    }
  ]
}

RULES:
- Use ONLY data provided. Never fabricate numbers.
- FundA is always OUR fund. FundB is the competitor.
- Frame everything from FundA's perspective — we are defending our fund.
- Preserve all ids and metric names from the baseline analysis.
- Add oneLiner to every argument and rebuttal — these are the memorable soundbites.
- Return ONLY the JSON object, no markdown, no explanation.`

function buildDataPayload(fundA: FundData, fundB: FundData, yahoo: YahooAnalytics | null, baseline: WarRoom): string {
  const lines: string[] = []
  lines.push(`=== OUR FUND: ${fundA.ticker} (${fundA.name}) ===`)
  lines.push(`30-Day SEC Yield: ${fundA.secYield ?? 'N/A'}`)
  lines.push(`Distribution Yield: ${fundA.distributionYield ?? 'N/A'}`)
  lines.push(`Duration: ${fundA.duration ?? 'N/A'}`)
  lines.push(`Expense Ratio: ${fundA.expense ?? 'N/A'}`)
  lines.push(`Sharpe Ratio: ${fundA.sharpe ?? 'N/A'}`)
  lines.push(`Std Dev: ${fundA.stdDev ?? 'N/A'}`)
  if (fundA.ytd != null) lines.push(`YTD Return: ${fundA.ytd}`)
  if (fundA.oneYear != null) lines.push(`1Y Return: ${fundA.oneYear}`)
  if (fundA.threeYear != null) lines.push(`3Y Return: ${fundA.threeYear}`)
  if (fundA.commonInception != null) lines.push(`Common Inception Return: ${fundA.commonInception}`)

  lines.push('')
  lines.push(`=== COMPETITOR: ${fundB.ticker} (${fundB.name}) ===`)
  lines.push(`30-Day SEC Yield: ${fundB.secYield ?? 'N/A'}`)
  lines.push(`Distribution Yield: ${fundB.distributionYield ?? 'N/A'}`)
  lines.push(`Duration: ${fundB.duration ?? 'N/A'}`)
  lines.push(`Expense Ratio: ${fundB.expense ?? 'N/A'}`)
  lines.push(`Sharpe Ratio: ${fundB.sharpe ?? 'N/A'}`)
  lines.push(`Std Dev: ${fundB.stdDev ?? 'N/A'}`)
  if (fundB.ytd != null) lines.push(`YTD Return: ${fundB.ytd}`)
  if (fundB.oneYear != null) lines.push(`1Y Return: ${fundB.oneYear}`)
  if (fundB.threeYear != null) lines.push(`3Y Return: ${fundB.threeYear}`)
  if (fundB.commonInception != null) lines.push(`Common Inception Return: ${fundB.commonInception}`)

  // Credit quality breakdown
  lines.push('')
  lines.push('=== CREDIT QUALITY ===')
  lines.push(`${fundA.ticker}: AAA=${fundA.aaa ?? 0}, AA=${fundA.aa ?? 0}, A=${fundA.a ?? 0}, BBB=${fundA.bbb ?? 0}, BB=${fundA.bb ?? 0}, B=${fundA.b ?? 0}, CCC=${fundA.ccc ?? 0}`)
  lines.push(`${fundB.ticker}: AAA=${fundB.aaa ?? 0}, AA=${fundB.aa ?? 0}, A=${fundB.a ?? 0}, BBB=${fundB.bbb ?? 0}, BB=${fundB.bb ?? 0}, B=${fundB.b ?? 0}, CCC=${fundB.ccc ?? 0}`)

  // Sector allocation
  lines.push('')
  lines.push('=== SECTOR ALLOCATION ===')
  lines.push(`${fundA.ticker}: NonAgencyRMBS=${fundA.nonAgencyRmbs ?? 0}, AgencyRMBS=${fundA.agencyRmbs ?? 0}, CLO=${fundA.clo ?? 0}, ABS=${fundA.abs ?? 0}, CMBS=${fundA.cmbs ?? 0}, CorpCredit=${fundA.corporateCredit ?? 0}, Govt/Cash=${fundA.governmentCash ?? 0}`)
  lines.push(`${fundB.ticker}: NonAgencyRMBS=${fundB.nonAgencyRmbs ?? 0}, AgencyRMBS=${fundB.agencyRmbs ?? 0}, CLO=${fundB.clo ?? 0}, ABS=${fundB.abs ?? 0}, CMBS=${fundB.cmbs ?? 0}, CorpCredit=${fundB.corporateCredit ?? 0}, Govt/Cash=${fundB.governmentCash ?? 0}`)

  if (yahoo) {
    lines.push('')
    lines.push('=== YAHOO ANALYTICS ===')
    if (yahoo.periodReturns?.length) {
      for (const pr of yahoo.periodReturns) {
        lines.push(`${pr.label}: ${fundA.ticker}=${pr.returnA.toFixed(2)}%, ${fundB.ticker}=${pr.returnB.toFixed(2)}%, Spread=${pr.spread.toFixed(2)}%`)
      }
    }
    if (yahoo.maxDrawdownA) lines.push(`${fundA.ticker} max drawdown: ${yahoo.maxDrawdownA.drawdown.toFixed(2)}% (${yahoo.maxDrawdownA.peakDate} to ${yahoo.maxDrawdownA.troughDate})`)
    if (yahoo.maxDrawdownB) lines.push(`${fundB.ticker} max drawdown: ${yahoo.maxDrawdownB.drawdown.toFixed(2)}% (${yahoo.maxDrawdownB.peakDate} to ${yahoo.maxDrawdownB.troughDate})`)
  }

  // Include baseline analysis for GPT to enhance
  lines.push('')
  lines.push('=== BASELINE ANALYSIS (enhance this) ===')
  lines.push(JSON.stringify(baseline, null, 2))

  return lines.join('\n')
}

function validateWarRoom(data: unknown): data is WarRoom {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!d.overallDifficulty || !d.difficultySummary) return false
  if (!Array.isArray(d.competitorArguments) || !Array.isArray(d.rebuttals)) return false
  return d.competitorArguments.every((a: Record<string, unknown>) =>
    a.id && a.metric && a.argument
  )
}

export async function POST(req: Request) {
  try {
    const { fundA, fundB, yahoo, baseline } = (await req.json()) as {
      fundA: FundData
      fundB: FundData
      yahoo: YahooAnalytics | null
      baseline: WarRoom | null
    }

    if (!fundA?.ticker || !fundB?.ticker) {
      return Response.json({ error: 'Missing fund data' }, { status: 400 })
    }

    // If no baseline provided, return error — caller should generate baseline first
    if (!baseline || !baseline.competitorArguments?.length) {
      return Response.json({ error: 'Baseline war room required' }, { status: 400 })
    }

    const dataPayload = buildDataPayload(fundA, fundB, yahoo, baseline)

    const openai = new OpenAI()
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Enhance the war room briefing for ${fundA.ticker} (our fund) vs ${fundB.ticker} (competitor). Add oneLiner to every argument and rebuttal. Sharpen the language.\n\nDATA:\n${dataPayload}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    })

    const text = completion.choices[0]?.message?.content || ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let gptWarRoom: unknown
    try {
      gptWarRoom = JSON.parse(cleaned)
    } catch {
      console.error('[warroom] GPT returned invalid JSON, using baseline')
      return Response.json(baseline)
    }

    if (validateWarRoom(gptWarRoom)) {
      return Response.json(gptWarRoom)
    }

    // GPT output didn't match schema — return baseline
    console.error('[warroom] GPT output failed validation, using baseline')
    return Response.json(baseline)
  } catch (err: unknown) {
    console.error('[warroom] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
