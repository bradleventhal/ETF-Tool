"use client"

import type { ComparisonRow, AnalysisMode } from "@/lib/fund-types"

interface ComparisonTableProps {
  title: string
  rows: ComparisonRow[]
  tickerA: string
  tickerB: string
  mode: AnalysisMode
}

export function ComparisonTable({ title, rows, tickerA, tickerB, mode }: ComparisonTableProps) {
  if (rows.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border bg-secondary/60">
            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</th>
            <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">{tickerA}</th>
            <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">{tickerB}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            let cellAExtra = ""
            let cellBExtra = ""

            if (mode === "internal" && row.numA != null && row.numB != null && row.numA !== 0 && row.numB !== 0) {
              if (row.higherIsBetter) {
                if (row.numA > row.numB) cellAExtra = " bg-emerald-50 text-emerald-800 font-bold"
                else if (row.numB > row.numA) cellBExtra = " bg-emerald-50 text-emerald-800 font-bold"
              } else {
                if (row.numA < row.numB) cellAExtra = " bg-emerald-50 text-emerald-800 font-bold"
                else if (row.numB < row.numA) cellBExtra = " bg-emerald-50 text-emerald-800 font-bold"
              }
            }

            return (
              <tr key={row.label} className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "bg-card" : "bg-secondary/20"}`}>
                <td className="px-3 py-1.5 text-muted-foreground">{row.label}</td>
                <td className={`px-3 py-1.5 text-right font-mono font-semibold text-foreground${cellAExtra}`}>{row.valueA}</td>
                <td className={`px-3 py-1.5 text-right font-mono font-semibold text-foreground${cellBExtra}`}>{row.valueB}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
