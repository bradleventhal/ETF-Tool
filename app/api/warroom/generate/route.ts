import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import type { FundData, YahooAnalytics, WarRoom } from '@/lib/fund-types'

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const maxDuration = 30

const SYSTEM_PROMPT = `You are a fixed income ETF competitive analyst. Given two fund data objects, generate a competitive war room briefing as JSON.

OUTPUT FORMAT — return ONLY valid JSON matching this exact structure:
{
  "overallDifficulty": "Easy Win" | "Winnable" | "Tough" | "Very Tough",
  "difficultySummary": "1-2 sentence summary of competitive difficulty",
  "leadWith": "comma-separated key advantages to lead with",
  "isLayup": true/false,
  "layupMessage": "message if easy win, else null",
  "marketContext": "1-2 sentence current market positioning context",
  "competitorArguments": [
    {
      "id": "unique-id",
      "title": "short title",
      "severity": "high" | "medium" | "low",
      "detail": "what the competitor would argue",
      "confidence": "data-backed" | "narrative" | "speculative"
    }
  ],
  "rebuttals": [
    {
      "id": "unique-id",
      "argumentId": "matches a competitorArgument id",
      "title": "short rebuttal title",
      "detail": "the rebuttal text with specific data points",
      "confidence": "data-backed" | "narrative" | "speculative",
      "oneLiner": "quick one-line comeback"
    }
  ]
}

RULES:
- Use ONLY data provided. Never fabricate numbers.
- FundA is always OUR fund. FundB is the competitor.
- Frame everything from FundA's perspective.
- Include 2-4 competitor arguments and matching rebuttals.
- Return ONLY the JSON object, no markdown, no explanation.`

function buildDataPayload(fundA: FundData, fundB: FundData, yahoo: YahooAnalytics | null): string {
  const lines: string[] = []
  lines.push(`=== OUR FUND: ${fundA.ticker} ===`)
  lines.push(`30-Day SEC Yield: ${fundA.secYield ?? 'N/A'}`)
  lines.push(`Distribution Yield: ${fundA.distYield ?? 'N/A'}`)
  lines.push(`Duration: ${fundA.duration ?? 'N/A'}`)
  lines.push(`Avg Credit Quality: ${fundA.avgCreditQuality ?? 'N/A'}`)
  lines.push(`Expense Ratio: ${fundA.expenseRatio ?? 'N/A'}`)
  lines.push(`AUM: ${fundA.aum ?? 'N/A'}`)
  lines.push(`Sharpe Ratio: ${fundA.sharpeRatio ?? 'N/A'}`)
  if (fundA.ytdReturn != null) lines.push(`YTD Return: ${fundA.ytdReturn}`)
  if (fundA.oneYearReturn != null) lines.push(`1Y Return: ${fundA.oneYearReturn}`)
  if (fundA.threeYearReturn != null) lines.push(`3Y Return: ${fundA.threeYearReturn}`)

  lines.push('')
  lines.push(`=== COMPETITOR: ${fundB.ticker} ===`)
  lines.push(`30-Day SEC Yield: ${fundB.secYield ?? 'N/A'}`)
  lines.push(`Distribution Yield: ${fundB.distYield ?? 'N/A'}`)
  lines.push(`Duration: ${fundB.duration ?? 'N/A'}`)
  lines.push(`Avg Credit Quality: ${fundB.avgCreditQuality ?? 'N/A'}`)
  lines.push(`Expense Ratio: ${fundB.expenseRatio ?? 'N/A'}`)
  lines.push(`AUM: ${fundB.aum ?? 'N/A'}`)
  lines.push(`Sharpe Ratio: ${fundB.sharpeRatio ?? 'N/A'}`)
  if (fundB.ytdReturn != null) lines.push(`YTD Return: ${fundB.ytdReturn}`)
  if (fundB.oneYearReturn != null) lines.push(`1Y Return: ${fundB.oneYearReturn}`)
  if (fundB.threeYearReturn != null) lines.push(`3Y Return: ${fundB.threeYearReturn}`)

  // Credit quality breakdown
  lines.push('')
  lines.push('=== CREDIT QUALITY ===')
  lines.push(`${fundA.ticker}: AAA=${fundA.aaa ?? 0}, AA=${fundA.aa ?? 0}, A=${fundA.a ?? 0}, BBB=${fundA.bbb ?? 0}, BB=${fundA.bb ?? 0}, B=${fundA.b ?? 0}`)
  lines.push(`${fundB.ticker}: AAA=${fundB.aaa ?? 0}, AA=${fundB.aa ?? 0}, A=${fundB.a ?? 0}, BBB=${fundB.bbb ?? 0}, BB=${fundB.bb ?? 0}, B=${fundB.b ?? 0}`)

  // Sector allocation
  lines.push('')
  lines.push('=== SECTOR ALLOCATION ===')
  lines.push(`${fundA.ticker}: NonAgencyRMBS=${fundA.nonAgencyRmbs ?? 0}, CLO=${fundA.clo ?? 0}, ABS=${fundA.abs ?? 0}, CMBS=${fundA.cmbs ?? 0}, CorpCredit=${fundA.corporateCredit ?? 0}, Govt=${fundA.govtCash ?? 0}`)
  lines.push(`${fundB.ticker}: NonAgencyRMBS=${fundB.nonAgencyRmbs ?? 0}, CLO=${fundB.clo ?? 0}, ABS=${fundB.abs ?? 0}, CMBS=${fundB.cmbs ?? 0}, CorpCredit=${fundB.corporateCredit ?? 0}, Govt=${fundB.govtCash ?? 0}`)

  if (yahoo) {
    lines.push('')
    lines.push('=== MARKET ANALYTICS ===')
    if (yahoo.fundA1Y != null) lines.push(`${fundA.ticker} 1Y total return: ${yahoo.fundA1Y}%`)
    if (yahoo.fundB1Y != null) lines.push(`${fundB.ticker} 1Y total return: ${yahoo.fundB1Y}%`)
    if (yahoo.correlation != null) lines.push(`Correlation: ${yahoo.correlation}`)
  }

  return lines.join('\n')
}

export async function POST(req: Request) {
  try {
    const { fundA, fundB, yahoo } = (await req.json()) as {
      fundA: FundData
      fundB: FundData
      yahoo: YahooAnalytics | null
    }

    if (!fundA?.ticker || !fundB?.ticker) {
      return Response.json({ error: 'Missing fund data' }, { status: 400 })
    }

    const dataPayload = buildDataPayload(fundA, fundB, yahoo)

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt: `Generate the war room briefing for ${fundA.ticker} (our fund) vs ${fundB.ticker} (competitor).\n\nDATA:\n${dataPayload}`,
      temperature: 0.3,
      maxOutputTokens: 2500,
    })

    const text = result.text || ''
    // Parse the JSON from GPT response
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const warRoom: WarRoom = JSON.parse(cleaned)
    return Response.json(warRoom)
  } catch (err: unknown) {
    console.error('[v0] War room generate error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
