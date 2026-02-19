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

  // Sector breakdown
  nonAgencyRmbs: number | null
  agencyRmbs: number | null
  abs: number | null
  clo: number | null
  cmbs: number | null
  securitized: number | null
  corporateCredit: number | null
  governmentCash: number | null
  other: number | null

  // Credit quality (detailed)
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
  valueA: string
  valueB: string
  numA: number | null
  numB: number | null
  higherIsBetter: boolean
}

export interface SectorRow {
  label: string
  valueA: string
  valueB: string
}

export interface AnalysisResult {
  title: string
  structureText: string
  sectorText: string
  incomeText: string
  riskText: string
  performanceText: string
  summaryLabel: string
  summaryText: string
  keyStats: ComparisonRow[]
  performanceComp: ComparisonRow[]
  creditQuality: ComparisonRow[]
  sectorAllocation: ComparisonRow[]
  chartData: { period: string; fundA: number; fundB: number }[]
  tickerA: string
  tickerB: string
  durComp: boolean
  creditComp: boolean
}
