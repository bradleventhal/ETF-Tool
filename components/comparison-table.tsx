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
}

function VerifyLink({ url }: { url?: string | null }) {
  if (!url) return <span style={{ color: "#cbd5e1" }}>—</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-[10px] font-medium hover:underline"
      style={{ color: "#94a3b8" }}>
      Verify <ExternalLink size={9} />
    </a>
  )
}

export function ComparisonTable({ title, rows, tickerA, tickerB, highlight = false, fundA, fundB }: Props) {
  if (rows.length === 0) return null

  function cellStyle(row: ComparisonRow, side: "a" | "b"): React.CSSProperties {
    if (!highlight || row.better === "none") return { color: "#334155" }
    const mine = side === "a" ? row.nA : row.nB
    const theirs = side === "a" ? row.nB : row.nA
    if (mine == null || theirs == null || mine === 0 || theirs === 0) return { color: "#334155" }
    const wins = row.better === "high" ? mine > theirs : mine < theirs
    return wins ? { color: "#0f3d6b", fontWeight: 700 } : { color: "#334155" }
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
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]" style={cellStyle(row, "a")}>
                  {row.a === "\u2014" && fundA?.websiteUrl ? <VerifyLink url={fundA.websiteUrl} /> : row.a}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]" style={cellStyle(row, "b")}>
                  {row.b === "\u2014" && fundB?.websiteUrl ? <VerifyLink url={fundB.websiteUrl} /> : row.b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
