import * as XLSX from "xlsx"
import type { FundData } from "./fund-types"

const HEADER_MAP: Record<string, keyof FundData> = {
  "Ticker": "ticker",
  "Name": "name",
  "As of Date": "asOfDate",
  "Duration": "duration",
  "YTW/YTM": "ytwYtm",
  "Distribution Yield": "distributionYield",
  "Subsidized 30-Day SEC Yield": "secYield",
  "Expense": "expense",
  "Correlation": "correlation",
  "Standard Deviation": "stdDev",
  "Sharpe Ratio": "sharpe",
  "YTD": "ytd",
  "1Y": "oneYear",
  "Common Inception Performance (Net of Fees)": "commonInception",
  "3Y": "threeYear",
  "Non-Agency MBS": "nonAgencyRmbs",
  "Agency RMBS": "agencyRmbs",
  "ABS": "abs",
  "CLO": "clo",
  "CMBS": "cmbs",
  "Securitized": "securitized",
  "Corporate Credit": "corporateCredit",
  "Government and Cash": "governmentCash",
  "Other": "other",
  "AAA or US Gov": "aaa",
  "AA": "aa",
  "A": "a",
  "BBB": "bbb",
  "BB": "bb",
  "B": "b",
  "CCC": "ccc",
  "Below CCC": "belowCcc",
}

function parseNumericValue(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (trimmed.startsWith("=")) return null
    if (trimmed === "" || trimmed === "-" || trimmed === "N/A") return null
    const cleaned = trimmed.replace(/%$/, "")
    const num = parseFloat(cleaned)
    if (isNaN(num)) return null
    // If original had %, convert from percentage to decimal
    if (trimmed.endsWith("%")) return num / 100
    return num
  }
  return null
}

function fixExpense(val: number | null): number | null {
  if (val === null) return null
  // VBA logic: if > 5 it's in basis points (e.g. 34 = 0.0034), else it's in percent (e.g. 0.34 = 0.0034)
  if (val > 5) return val / 10000
  if (val > 1) return val / 100
  return val
}

export function parseFile(buffer: ArrayBuffer, fileName: string): FundData[] {
  const isCSV = fileName.toLowerCase().endsWith(".csv")

  let workbook: XLSX.WorkBook
  if (isCSV) {
    const text = new TextDecoder().decode(buffer)
    workbook = XLSX.read(text, { type: "string" })
  } else {
    workbook = XLSX.read(buffer, { type: "array" })
  }

  // Try to find "Raw Data" sheet, or use the first sheet
  let sheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase().replace(/\s+/g, "") === "rawdata"
  )
  if (!sheetName) sheetName = workbook.SheetNames[0]

  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })

  // Build column index from headers
  const funds: FundData[] = []

  for (const row of jsonData) {
    const ticker = row["Ticker"]
    if (!ticker || typeof ticker !== "string" || ticker.trim() === "") continue


    const fund: FundData = {
      ticker: String(ticker).trim(),
      name: row["Name"] ? String(row["Name"]).trim() : ticker.trim(),
      asOfDate: row["As of Date"] ? String(row["As of Date"]) : "",
      duration: parseNumericValue(row["Duration"]),
      ytwYtm: parseNumericValue(row["YTW/YTM"]),
      distributionYield: parseNumericValue(row["Distribution Yield"]),
      secYield: parseNumericValue(row["Subsidized 30-Day SEC Yield"]),
      expense: fixExpense(parseNumericValue(row["Expense"])),
      correlation: parseNumericValue(row["Correlation"]),
      stdDev: parseNumericValue(row["Standard Deviation"]),
      sharpe: parseNumericValue(row["Sharpe Ratio"]),
      ytd: parseNumericValue(row["YTD"]),
      oneYear: parseNumericValue(row["1Y"]),
      commonInception: parseNumericValue(row["Common Inception Performance (Net of Fees)"]),
      threeYear: parseNumericValue(row["3Y"]),
      nonAgencyRmbs: parseNumericValue(row["Non-Agency MBS"]),
      agencyRmbs: parseNumericValue(row["Agency RMBS"]),
      abs: parseNumericValue(row["ABS"]),
      clo: parseNumericValue(row["CLO"]),
      cmbs: parseNumericValue(row["CMBS"]),
      securitized: parseNumericValue(row["Securitized"]),
      corporateCredit: parseNumericValue(row["Corporate Credit"]),
      governmentCash: parseNumericValue(row["Government and Cash"]),
      other: parseNumericValue(row["Other"]),
      aaa: parseNumericValue(row["AAA or US Gov"]),
      aa: parseNumericValue(row["AA"]),
      a: parseNumericValue(row["A"]),
      bbb: parseNumericValue(row["BBB"]),
      bb: parseNumericValue(row["BB"]),
      b: parseNumericValue(row["B"]),
      ccc: parseNumericValue(row["CCC"]),
      belowCcc: parseNumericValue(row["Below CCC"]),
      creditOther: parseNumericValue(row["Other"]),
    }

    funds.push(fund)
  }

  return funds
}

// Alias for backwards compatibility
export const parseFundData = parseFile
