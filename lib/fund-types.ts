export interface FundData {
  ticker: string
  name: string
  asOfDate: string
  duration: number | null
  ytwYtm: number | null
  distributionYield: number | null
  secYield: number | null
  expense: number | null
  correlation: number | null
  stdDev: number | null
  sharpe: number | null
  ytd: number | null
  oneYear: number | null
  commonInception: number | null
  threeYear: number | null
  nonAgencyRmbs: number | null
  agencyRmbs: number | null
  abs: number | null
  clo: number | null
  cmbs: number | null
  securitized: number | null
  corporateCredit: number | null
  governmentCash: number | null
  other: number | null
  aaa: number | null
  aa: number | null
  a: number | null
  bbb: number | null
  bb: number | null
  b: number | null
  ccc: number | null
  belowCcc: number | null
  creditOther: number | null
}

export type AnalysisMode = "advisor" | "internal"

export interface ComparisonRow {
  label: string
  a: string
  b: string
  nA: number | null
  nB: number | null
  better: "high" | "low" | "none"
}

export interface NarrativeSection {
  title: string
  lines: string[]
}

export interface AnalysisResult {
  tickerA: string
  tickerB: string
  nameA: string
  nameB: string
  mode: AnalysisMode
  narrative: NarrativeSection[]
  keyStats: ComparisonRow[]
  performance: ComparisonRow[]
  sectorAllocation: ComparisonRow[]
  creditQuality: ComparisonRow[]
  pieDataA: { name: string; value: number }[]
  pieDataB: { name: string; value: number }[]
  creditPieA: { name: string; value: number }[]
  creditPieB: { name: string; value: number }[]
  avgCreditA: string
  avgCreditB: string
  chartData: { period: string; fundA: number; fundB: number }[]
  reversePitch: NarrativeSection | null
}

export interface YahooAnalytics {
  commonInceptionDate: string
  lastDate: string
  drawdown2022A: number | null
  drawdown2022B: number | null
  recovery2022A: string | null
  recovery2022B: string | null
  trough2022A: string | null
  trough2022B: string | null
  returnsA: Record<string, number | null>
  returnsB: Record<string, number | null>
  bestPeriodLabel: string
  bestPeriodSpread: number
  bestPeriodStartDate: string
}

export type DifficultyTier = "Very Easy" | "Easy" | "Moderate" | "Difficult" | "Very Difficult"
export type ConfidenceTag = "Airtight" | "Strong" | "Use With Caution"

export interface CompetitorArgument {
  id: string
  metric: string
  difficulty: DifficultyTier
  argument: string
  theirValue: string
  ourValue: string
  deltaBps?: number
}

export interface Rebuttal {
  argumentId: string
  metric: string
  opener: string
  bullets: string[]
  confidence: ConfidenceTag
}

export interface WarRoom {
  overallDifficulty: DifficultyTier
  difficultySummary: string
  isLayup: boolean
  layupMessage: string | null
  marketContext: string
  competitorArguments: CompetitorArgument[]
  rebuttals: Rebuttal[]
}
