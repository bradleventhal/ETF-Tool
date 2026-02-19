"use client"

import type { ComparisonRow, AnalysisMode } from "@/lib/fund-types"

interface Props {
  title: string
  rows: ComparisonRow[]
  tickerA: string
  tickerB: string
  mode: AnalysisMode
}

export function ComparisonTable({ title, rows, tickerA, tickerB, mode }: Props) {
  if (rows.length === 0) return null

  function winClass(row: ComparisonRow, side: "a" | "b"): string {
    if (mode !== "internal" || row.better === "none") return ""
    const mine = side === "a" ? row.nA : row.nB
    const theirs = side === "a" ? row.nB : row.nA
    if (mine == null || theirs == null || mine === 0 || theirs === 0) return ""
    const wins = row.better === "high" ? mine > theirs : mine < theirs
    return wins ? "bg-emerald-900/30 text-emerald-300 font-bold" : ""
  }

  return (
    <div className="overflow-hidden rounded border border-[#1e3048]">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#0f1c2e]">
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</th>
            <th className="px-3 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-200">{tickerA}</th>
            <th className="px-3 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest text-slate-200">{tickerB}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label} className={`border-t border-[#1e3048] ${i % 2 === 0 ? "bg-[#101b2e]" : "bg-[#0c1624]"}`}>
              <td className="px-3 py-2 text-slate-400">{row.label}</td>
              <td className={`px-3 py-2 text-right font-mono text-slate-200 ${winClass(row, "a")}`}>{row.a}</td>
              <td className={`px-3 py-2 text-right font-mono text-slate-200 ${winClass(row, "b")}`}>{row.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
