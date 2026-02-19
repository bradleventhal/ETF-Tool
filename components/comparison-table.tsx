"use client"

import type { ComparisonRow, AnalysisMode } from "@/lib/fund-types"

interface Props {
  title: string
  rows: ComparisonRow[]
  tickerA: string
  tickerB: string
  highlight?: boolean
}

export function ComparisonTable({ title, rows, tickerA, tickerB, highlight = false }: Props) {
  if (rows.length === 0) return null

  function winClass(row: ComparisonRow, side: "a" | "b"): string {
    if (!highlight || row.better === "none") return "text-foreground"
    const mine = side === "a" ? row.nA : row.nB
    const theirs = side === "a" ? row.nB : row.nA
    if (mine == null || theirs == null || mine === 0 || theirs === 0) return "text-foreground"
    const wins = row.better === "high" ? mine > theirs : mine < theirs
    return wins ? "text-primary font-bold" : "text-foreground"
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</th>
            <th className="px-4 py-2.5 text-right font-mono text-[11px] font-bold uppercase tracking-wider text-primary">{tickerA}</th>
            <th className="px-4 py-2.5 text-right font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tickerB}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
              <td className="px-4 py-2 text-[13px] text-muted-foreground">{row.label}</td>
              <td className={`px-4 py-2 text-right font-mono text-[13px] ${winClass(row, "a")}`}>{row.a}</td>
              <td className={`px-4 py-2 text-right font-mono text-[13px] ${winClass(row, "b")}`}>{row.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
