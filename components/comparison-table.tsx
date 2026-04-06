"use client"

import type { ComparisonRow, FundData } from "@/lib/fund-types"
import { ExternalLink } from "lucide-react"

interface Props {
  title: string
  rows: ComparisonRow[]
  tickerA: string
  tickerB: string
  highlight?: boolean
  fundA?: FundData | null
  fundB?: FundData | null
  sourcesA?: Record<string, string> | null
  sourcesB?: Record<string, string> | null
}

// Map row labels to source field keys
const LABEL_TO_KEY: Record<string, string> = {
  "SEC Yield": "secYield", "30d SEC Yield": "secYield",
  "Distribution Yield": "distributionYield", "Dist Yield": "distributionYield",
  "Duration": "duration", "Eff Duration": "duration",
  "Expense Ratio": "expense", "Expense": "expense",
  "YTW / YTM": "ytwYtm", "YTW/YTM": "ytwYtm",
  "Sharpe Ratio": "sharpe", "Sharpe": "sharpe",
  "Std Deviation": "stdDev", "Std Dev": "stdDev",
  "YTD": "ytd", "1 Year": "oneYear", "1Y": "oneYear",
  "3 Year": "threeYear", "3Y": "threeYear",
  "Common Inception": "commonInception", "Inception": "commonInception",
  "Non-Agency RMBS": "nonAgencyRmbs", "Agency RMBS": "agencyRmbs",
  "ABS": "abs", "CLO": "clo", "CMBS": "cmbs",
  "Corporate Credit": "corporateCredit", "Government / Cash": "governmentCash",
  "AAA / US Gov": "aaa", "AA": "aa", "A": "a",
  "BBB": "bbb", "BB": "bb", "B": "b",
  "Below B": "belowCcc", "CCC & Below": "belowCcc",
  "Not Rated": "creditOther", "Other": "creditOther",
  "Morningstar Rating": "morningstarRating",
}

function SourcedValue({ value, url, style }: { value: string; url?: string; style: React.CSSProperties }) {
  if (!url || value === "\u2014") {
    return <span style={style}>{value}</span>
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="group inline-flex items-center gap-0.5"
      style={style}
      title="Click to verify source">
      <span className="group-hover:underline">{value}</span>
      <ExternalLink size={8} className="opacity-0 transition-opacity group-hover:opacity-40" style={{ flexShrink: 0 }} />
    </a>
  )
}

function VerifyLink({ url }: { url?: string | null }) {
  if (!url) return <span style={{ color: "#cbd5e1" }}>{"\u2014"}</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-[10px] font-medium hover:underline"
      style={{ color: "#94a3b8" }}>
      Verify <ExternalLink size={9} />
    </a>
  )
}

export function ComparisonTable({ title, rows, tickerA, tickerB, highlight = false, fundA, fundB, sourcesA, sourcesB }: Props) {
  if (rows.length === 0) return null

  function cellStyle(row: ComparisonRow, side: "a" | "b"): React.CSSProperties {
    if (!highlight || row.better === "none") return { color: "#334155" }
    const mine = side === "a" ? row.nA : row.nB
    const theirs = side === "a" ? row.nB : row.nA
    if (mine == null || theirs == null || mine === 0 || theirs === 0) return { color: "#334155" }
    const wins = row.better === "high" ? mine > theirs : mine < theirs
    return wins ? { color: "#0f3d6b", fontWeight: 700 } : { color: "#334155" }
  }

  function getSourceUrl(row: ComparisonRow, side: "a" | "b"): string | undefined {
    const key = LABEL_TO_KEY[row.label]
    if (!key) return undefined
    const sources = side === "a" ? sourcesA : sourcesB
    return sources?.[key]
  }

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider sm:px-4" style={{ color: "#64748b" }}>{title}</th>
              <th className="px-3 py-2.5 text-right font-mono text-[11px] font-bold uppercase tracking-wider sm:px-4" style={{ color: "#0f3d6b" }}>{tickerA}</th>
              <th className="px-3 py-2.5 text-right font-mono text-[11px] font-bold uppercase tracking-wider sm:px-4" style={{ color: "#64748b" }}>{tickerB}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                <td className="whitespace-nowrap px-3 py-2 text-[12px] sm:px-4 sm:text-[13px]" style={{ color: "#64748b" }}>{row.label}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]">
                  {row.a === "\u2014" && fundA?.websiteUrl
                    ? <VerifyLink url={fundA.websiteUrl} />
                    : <SourcedValue value={row.a} url={getSourceUrl(row, "a")} style={cellStyle(row, "a")} />
                  }
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]">
                  {row.b === "\u2014" && fundB?.websiteUrl
                    ? <VerifyLink url={fundB.websiteUrl} />
                    : <SourcedValue value={row.b} url={getSourceUrl(row, "b")} style={cellStyle(row, "b")} />
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
