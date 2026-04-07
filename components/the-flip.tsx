"use client"

import { useState } from "react"
import type { AnalysisResult, FundData } from "@/lib/fund-types"
import { ArrowRightLeft, DollarSign, TrendingUp, TrendingDown, Shield, ChevronDown, ChevronRight } from "lucide-react"

interface Props {
  result: AnalysisResult
  fundA: FundData | null
  fundB: FundData | null
}

function nz(v: number | null | undefined): number { return v ?? 0 }
function fDol(v: number): string {
  const sign = v >= 0 ? "+" : "-"
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return sign + "$" + (abs / 1_000_000).toFixed(2) + "M"
  if (abs >= 1_000) return sign + "$" + (abs / 1_000).toFixed(1) + "K"
  return sign + "$" + abs.toFixed(0)
}
function fPct(v: number, d = 2): string { return (v >= 0 ? "+" : "") + (v * 100).toFixed(d) + "%" }

export function TheFlip({ result, fundA, fundB }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [positionSize, setPositionSize] = useState(5_000_000) // $5M default

  if (!fundA || !fundB) return null

  const yieldA = nz(fundA.secYield)
  const yieldB = nz(fundB.secYield)
  const yieldDelta = yieldA - yieldB
  const incomeDelta = yieldDelta * positionSize

  const durA = nz(fundA.duration)
  const durB = nz(fundB.duration)
  const durDelta = durA - durB

  const expA = nz(fundA.expense)
  const expB = nz(fundB.expense)
  const expDelta = expA - expB
  const feeDelta = expDelta * positionSize

  const ytwA = nz(fundA.ytwYtm)
  const ytwB = nz(fundB.ytwYtm)

  // Credit quality comparison
  const igA = nz(fundA.aaa) + nz(fundA.aa) + nz(fundA.a) + nz(fundA.bbb)
  const igB = nz(fundB.aaa) + nz(fundB.aa) + nz(fundB.a) + nz(fundB.bbb)

  // Net impact = income gain - fee cost
  const netAnnualImpact = incomeDelta - feeDelta

  const gains: string[] = []
  const tradeoffs: string[] = []

  if (yieldDelta > 0.001) gains.push(`${Math.round(yieldDelta * 10000)}bps more yield (${fPct(yieldA)} vs ${fPct(yieldB)})`)
  else if (yieldDelta < -0.001) tradeoffs.push(`${Math.round(Math.abs(yieldDelta) * 10000)}bps less yield`)

  if (durDelta < -0.3) gains.push(`${Math.abs(durDelta).toFixed(1)} years shorter duration — less rate risk`)
  else if (durDelta > 0.3) tradeoffs.push(`${durDelta.toFixed(1)} years more duration`)

  if (expDelta < -0.0003) gains.push(`${Math.round(Math.abs(expDelta) * 10000)}bps lower expense ratio`)
  else if (expDelta > 0.0003) tradeoffs.push(`${Math.round(expDelta * 10000)}bps higher fees`)

  if (igA > igB + 0.03) gains.push(`Higher credit quality (${(igA * 100).toFixed(0)}% IG vs ${(igB * 100).toFixed(0)}%)`)
  else if (igB > igA + 0.03) tradeoffs.push(`Lower credit quality (${(igA * 100).toFixed(0)}% IG vs ${(igB * 100).toFixed(0)}%)`)

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 border-b px-3.5 py-3 text-left sm:gap-3 sm:px-5 sm:py-3.5"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
      >
        <ArrowRightLeft size={16} style={{ color: "#0f3d6b", flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>
            The Flip
          </span>
          <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
            What does the switch actually mean in dollars?
          </span>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: "#94a3b8" }} /> : <ChevronRight size={14} style={{ color: "#94a3b8" }} />}
      </button>

      {expanded && (
        <div className="p-4 sm:p-5">
          {/* Position size */}
          <div className="mb-4 flex items-center gap-3">
            <span className="text-[11px] font-medium" style={{ color: "#64748b" }}>Position size:</span>
            {[1_000_000, 5_000_000, 10_000_000, 25_000_000].map(size => (
              <button key={size}
                onClick={() => setPositionSize(size)}
                className="rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors"
                style={{
                  borderColor: positionSize === size ? "#0f3d6b" : "#d1d5db",
                  backgroundColor: positionSize === size ? "#0f3d6b" : "transparent",
                  color: positionSize === size ? "#fff" : "#64748b",
                }}>
                ${(size / 1_000_000).toFixed(0)}M
              </button>
            ))}
          </div>

          {/* Hero impact number */}
          <div className="mb-5 rounded-lg p-5 text-center" style={{
            backgroundColor: netAnnualImpact > 0 ? "#f0fdf4" : netAnnualImpact < 0 ? "#fef2f2" : "#f8fafc",
            border: `1px solid ${netAnnualImpact > 0 ? "#bbf7d0" : netAnnualImpact < 0 ? "#fecaca" : "#e2e8f0"}`,
          }}>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
              Switching from {result.tickerB} to {result.tickerA}
            </div>
            <div className="text-3xl font-bold" style={{ color: netAnnualImpact > 0 ? "#16a34a" : "#dc2626" }}>
              {fDol(netAnnualImpact)}
            </div>
            <div className="text-sm" style={{ color: "#64748b" }}>
              per year on a ${(positionSize / 1_000_000).toFixed(0)}M position
            </div>
            {Math.abs(incomeDelta) > 100 && (
              <div className="mt-2 text-[11px]" style={{ color: "#94a3b8" }}>
                {fDol(incomeDelta)} in income {incomeDelta > 0 ? "gain" : "reduction"}
                {Math.abs(feeDelta) > 100 && `, ${fDol(-feeDelta)} in fee ${feeDelta > 0 ? "savings" : "cost"}`}
              </div>
            )}
          </div>

          {/* What you gain / What you give up */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#16a34a" }}>
                <TrendingUp size={12} /> What you gain
              </div>
              {gains.length > 0 ? gains.map((g, i) => (
                <div key={i} className="mb-1.5 rounded border-l-2 py-1 pl-2.5 text-[11px]" style={{ borderColor: "#16a34a", backgroundColor: "#f0fdf4", color: "#334155" }}>
                  {g}
                </div>
              )) : (
                <div className="text-[11px] italic" style={{ color: "#94a3b8" }}>No clear advantages in this direction</div>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>
                <Shield size={12} /> Tradeoffs
              </div>
              {tradeoffs.length > 0 ? tradeoffs.map((t, i) => (
                <div key={i} className="mb-1.5 rounded border-l-2 py-1 pl-2.5 text-[11px]" style={{ borderColor: "#f59e0b", backgroundColor: "#fffbeb", color: "#334155" }}>
                  {t}
                </div>
              )) : (
                <div className="text-[11px] italic" style={{ color: "#94a3b8" }}>No significant tradeoffs</div>
              )}
            </div>
          </div>

          {/* Metrics comparison */}
          <div className="mt-4">
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase" style={{ color: "#94a3b8" }}></th>
                  <th className="px-2 py-1.5 text-center text-[9px] font-bold uppercase" style={{ color: "#64748b" }}>Current ({result.tickerB})</th>
                  <th className="px-2 py-1.5 text-center text-[9px] font-bold uppercase" style={{ color: "#0f3d6b" }}>After ({result.tickerA})</th>
                  <th className="px-2 py-1.5 text-center text-[9px] font-bold uppercase" style={{ color: "#64748b" }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Annual Income", before: yieldB * positionSize, after: yieldA * positionSize, fmt: "dollar" },
                  { label: "SEC Yield", before: yieldB, after: yieldA, fmt: "pct" },
                  { label: "Duration", before: durB, after: durA, fmt: "num", unit: " yrs" },
                  { label: "Annual Fees", before: expB * positionSize, after: expA * positionSize, fmt: "dollar" },
                  { label: "IG Allocation", before: igB, after: igA, fmt: "pct" },
                ].map(row => {
                  const delta = row.after - row.before
                  const isGood = row.label === "Duration" ? delta < 0 : row.label === "Annual Fees" ? delta < 0 : delta > 0
                  return (
                    <tr key={row.label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td className="px-2 py-1.5" style={{ color: "#64748b" }}>{row.label}</td>
                      <td className="px-2 py-1.5 text-center font-mono" style={{ color: "#334155" }}>
                        {row.fmt === "dollar" ? "$" + Math.round(row.before).toLocaleString() : row.fmt === "pct" ? (row.before * 100).toFixed(2) + "%" : row.before.toFixed(2) + (row.unit || "")}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono font-medium" style={{ color: "#0f3d6b" }}>
                        {row.fmt === "dollar" ? "$" + Math.round(row.after).toLocaleString() : row.fmt === "pct" ? (row.after * 100).toFixed(2) + "%" : row.after.toFixed(2) + (row.unit || "")}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono font-bold" style={{ color: isGood ? "#16a34a" : delta === 0 ? "#94a3b8" : "#dc2626" }}>
                        {row.fmt === "dollar" ? fDol(delta) : row.fmt === "pct" ? fPct(delta) : (delta >= 0 ? "+" : "") + delta.toFixed(2) + (row.unit || "")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
