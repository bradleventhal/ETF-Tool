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

export interface AnalysisResult {
  tickerA: string
  tickerB: string
  nameA: string
  nameB: string
  mode: AnalysisMode
  advisorSummary: string
  bullets: { text: string; type: "edge" | "neutral" | "handle" }[]
  keyStats: ComparisonRow[]
  performance: ComparisonRow[]
  sectorAllocation: ComparisonRow[]
  creditQuality: ComparisonRow[]
  chartData: { period: string; fundA: number; fundB: number }[]
}
