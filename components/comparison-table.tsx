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
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="bg-secondary px-4 py-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
          {title}
        </h4>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-primary/5">
            <th className="px-4 py-2 text-left text-xs font-semibold text-foreground">
              Metric
            </th>
            <th className="px-4 py-2 text-center text-xs font-semibold text-foreground">
              {tickerA}
            </th>
            <th className="px-4 py-2 text-center text-xs font-semibold text-foreground">
              {tickerB}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isAlt = i % 2 === 0

            let cellAClass = "px-4 py-2 text-center text-sm font-semibold text-foreground"
            let cellBClass = "px-4 py-2 text-center text-sm font-semibold text-foreground"

            // Green highlight logic in internal mode (from VBA AddCompRow)
            if (
              mode === "internal" &&
              row.numA !== null && row.numB !== null &&
              row.numA !== 0 && row.numB !== 0
            ) {
              if (row.higherIsBetter) {
                if (row.numA > row.numB) cellAClass += " bg-emerald-100 text-emerald-900"
                else if (row.numB > row.numA) cellBClass += " bg-emerald-100 text-emerald-900"
              } else {
                if (row.numA < row.numB) cellAClass += " bg-emerald-100 text-emerald-900"
                else if (row.numB < row.numA) cellBClass += " bg-emerald-100 text-emerald-900"
              }
            }

            return (
              <tr
                key={row.label}
                className={`border-b border-border last:border-b-0 ${isAlt ? "bg-card" : "bg-background"}`}
              >
                <td className="px-4 py-2 text-sm text-muted-foreground">
                  {row.label}
                </td>
                <td className={cellAClass}>{row.valueA}</td>
                <td className={cellBClass}>{row.valueB}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
