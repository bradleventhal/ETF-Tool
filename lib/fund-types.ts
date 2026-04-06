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
  morningstarRating: number | null
  morningstarCategory: string | null
  websiteUrl?: string | null
  morningstarRatingNote?: string | null
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

export interface StressPeriod {
  label: string
  startDate: string
  endDate: string
  drawdownA: number
  drawdownB: number
  recoveryDateA: string | null
  recoveryDateB: string | null
  winner: "A" | "B" | "tie"
  narrative: string
}

export interface PeriodReturn {
  label: string
  startDate: string
  returnA: number
  returnB: number
  spread: number
}

export interface YahooAnalytics {
  commonInceptionDate: string
  lastDate: string
  tickerA: string
  tickerB: string
  periodReturns: PeriodReturn[]
  stressPeriods: StressPeriod[]
  bestPeriodForA: PeriodReturn | null
  bestPeriodForB: PeriodReturn | null
  maxDrawdownA: { drawdown: number; peakDate: string; troughDate: string; recoveryDate: string | null }
  maxDrawdownB: { drawdown: number; peakDate: string; troughDate: string; recoveryDate: string | null }
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
  oneLiner?: string
}

export interface Rebuttal {
  argumentId: string
  metric: string
  opener: string
  bullets: string[]
  confidence: ConfidenceTag
  oneLiner?: string
}

export interface WarRoom {
  overallDifficulty: DifficultyTier
  difficultySummary: string
  leadWith: string | null
  isLayup: boolean
  layupMessage: string | null
  marketContext: string
  competitorArguments: CompetitorArgument[]
  rebuttals: Rebuttal[]
}
