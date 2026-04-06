"use client"

import { useState, useEffect, useCallback } from "react"
import type { AnalysisResult } from "@/lib/fund-types"
import { Activity, ChevronDown, ChevronRight, AlertTriangle, TrendingDown, Clock } from "lucide-react"

interface StressEvent {
  id: string
  label: string
  description: string
  startDate: string
  endDate: string
  category: "rate" | "credit" | "liquidity" | "macro"
}

interface StressResult {
  event: StressEvent
  drawdownA: number | null
  drawdownB: number | null
  recoveryDaysA: number | null
  recoveryDaysB: number | null
  winnerDrawdown: "A" | "B" | "tie" | null
  winnerRecovery: "A" | "B" | "tie" | null
  dataAvailable: boolean
}

const STRESS_EVENTS: StressEvent[] = [
  { id: "covid", label: "COVID Crash", description: "March 2020 liquidity crisis — fastest 30% drawdown in history", startDate: "2020-02-19", endDate: "2020-06-30", category: "liquidity" },
  { id: "rate2022", label: "2022 Rate Shock", description: "Fed hiked 425bps — worst bond market in 40 years", startDate: "2022-01-03", endDate: "2022-12-30", category: "rate" },
  { id: "svb", label: "SVB / Banking Crisis", description: "March 2023 regional bank failures — flight to quality", startDate: "2023-03-01", endDate: "2023-05-31", category: "credit" },
  { id: "taper2013", label: "Taper Tantrum", description: "2013 — Fed signals end of QE, bonds sell off", startDate: "2013-05-01", endDate: "2013-09-30", category: "rate" },
  { id: "q42018", label: "Q4 2018 Selloff", description: "Fed overtightening fears — credit spreads blow out", startDate: "2018-10-01", endDate: "2019-01-31", category: "credit" },
  { id: "oil2020", label: "Oil Crash 2020", description: "Oil goes negative — energy credit destruction", startDate: "2020-03-01", endDate: "2020-05-31", category: "macro" },
  { id: "rising2025", label: "2025 Rate Volatility", description: "10Y oscillates between 3.5-5% — duration whipsaw", startDate: "2025-01-02", endDate: "2025-06-30", category: "rate" },
]

const CATEGORY_COLORS: Record<string, string> = {
  rate: "#3b82f6",
  credit: "#f59e0b",
  liquidity: "#dc2626",
  macro: "#8b5cf6",
}

interface Props {
  result: AnalysisResult
}

export function StressTest({ result }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [results, setResults] = useState<StressResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  const fetchStressData = useCallback(async () => {
    setLoading(true)
    const stressResults: StressResult[] = []

    for (const event of STRESS_EVENTS) {
      try {
        const resp = await fetch(`/api/growth?tickers=${result.tickerA},${result.tickerB}&start=${event.startDate}&end=${event.endDate}`)
        if (!resp.ok) {
          stressResults.push({ event, drawdownA: null, drawdownB: null, recoveryDaysA: null, recoveryDaysB: null, winnerDrawdown: null, winnerRecovery: null, dataAvailable: false })
          continue
        }

        const data = await resp.json()
        const fundAData = data.funds?.find((f: { ticker: string }) => f.ticker === result.tickerA)
        const fundBData = data.funds?.find((f: { ticker: string }) => f.ticker === result.tickerB)

        if (!fundAData?.series?.length || !fundBData?.series?.length) {
          stressResults.push({ event, drawdownA: null, drawdownB: null, recoveryDaysA: null, recoveryDaysB: null, winnerDrawdown: null, winnerRecovery: null, dataAvailable: false })
          continue
        }

        // Calculate max drawdown for each fund during the event
        const calcDrawdown = (series: { date: string; growth: number }[]) => {
          let peak = 0
          let maxDd = 0
          let troughIdx = 0
          for (let i = 0; i < series.length; i++) {
            const val = series[i].growth
            if (val > peak) peak = val
            const dd = peak > 0 ? (val - peak) / (100 + peak) * 100 : val
            if (dd < maxDd) { maxDd = dd; troughIdx = i }
          }
          // Recovery: how many days until growth exceeds pre-drawdown peak
          let recoveryDays: number | null = null
          for (let i = troughIdx; i < series.length; i++) {
            if (series[i].growth >= peak) {
              recoveryDays = i - troughIdx
              break
            }
          }
          return { maxDd, recoveryDays }
        }

        const ddA = calcDrawdown(fundAData.series)
        const ddB = calcDrawdown(fundBData.series)

        const winnerDd = ddA.maxDd > ddB.maxDd ? "A" : ddA.maxDd < ddB.maxDd ? "B" : "tie"
        const winnerRec = ddA.recoveryDays != null && ddB.recoveryDays != null
          ? (ddA.recoveryDays < ddB.recoveryDays ? "A" : ddA.recoveryDays > ddB.recoveryDays ? "B" : "tie")
          : null

        stressResults.push({
          event,
          drawdownA: ddA.maxDd,
          drawdownB: ddB.maxDd,
          recoveryDaysA: ddA.recoveryDays,
          recoveryDaysB: ddB.recoveryDays,
          winnerDrawdown: winnerDd,
          winnerRecovery: winnerRec,
          dataAvailable: true,
        })
      } catch {
        stressResults.push({ event, drawdownA: null, drawdownB: null, recoveryDaysA: null, recoveryDaysB: null, winnerDrawdown: null, winnerRecovery: null, dataAvailable: false })
      }
    }

    setResults(stressResults)
    setLoading(false)
  }, [result.tickerA, result.tickerB])

  useEffect(() => {
    if (expanded && results.length === 0 && !loading) {
      fetchStressData()
    }
  }, [expanded, results.length, loading, fetchStressData])

  const selected = selectedEvent ? results.find(r => r.event.id === selectedEvent) : null

  // Count wins
  const aWinsDrawdown = results.filter(r => r.winnerDrawdown === "A").length
  const bWinsDrawdown = results.filter(r => r.winnerDrawdown === "B").length
  const aWinsRecovery = results.filter(r => r.winnerRecovery === "A").length
  const bWinsRecovery = results.filter(r => r.winnerRecovery === "B").length

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 border-b px-3.5 py-3 text-left sm:gap-3 sm:px-5 sm:py-3.5"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
      >
        <Activity size={16} style={{ color: "#0f3d6b", flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>
            Stress Test
          </span>
          <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
            How did these funds perform in real crises?
          </span>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: "#94a3b8" }} /> : <ChevronRight size={14} style={{ color: "#94a3b8" }} />}
      </button>

      {expanded && (
        <div className="p-4 sm:p-5">
          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm" style={{ color: "#94a3b8" }}>
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current" style={{ borderTopColor: "transparent" }} />
              Loading historical stress data...
            </div>
          )}

          {!loading && results.length > 0 && (
            <div>
              {/* Summary scoreboard */}
              <div className="mb-4 flex items-center gap-4 rounded p-3" style={{ backgroundColor: "#f8fafc" }}>
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</div>
                  <div className="text-lg font-bold" style={{ color: "#0f3d6b" }}>{aWinsDrawdown}</div>
                  <div className="text-[9px]" style={{ color: "#94a3b8" }}>less drawdown</div>
                </div>
                <div className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>vs</div>
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: "#64748b" }}>{result.tickerB}</div>
                  <div className="text-lg font-bold" style={{ color: "#64748b" }}>{bWinsDrawdown}</div>
                  <div className="text-[9px]" style={{ color: "#94a3b8" }}>less drawdown</div>
                </div>
                <div className="mx-2" style={{ width: 1, height: 40, backgroundColor: "#e2e8f0" }} />
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</div>
                  <div className="text-lg font-bold" style={{ color: "#0f3d6b" }}>{aWinsRecovery}</div>
                  <div className="text-[9px]" style={{ color: "#94a3b8" }}>faster recovery</div>
                </div>
                <div className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>vs</div>
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: "#64748b" }}>{result.tickerB}</div>
                  <div className="text-lg font-bold" style={{ color: "#64748b" }}>{bWinsRecovery}</div>
                  <div className="text-[9px]" style={{ color: "#94a3b8" }}>faster recovery</div>
                </div>
              </div>

              {/* Event list */}
              <div className="space-y-2">
                {results.map(r => {
                  const isSelected = selectedEvent === r.event.id
                  return (
                    <button
                      key={r.event.id}
                      onClick={() => setSelectedEvent(isSelected ? null : r.event.id)}
                      className="w-full rounded border p-3 text-left transition-colors"
                      style={{
                        borderColor: isSelected ? "#0f3d6b" : "#e2e8f0",
                        backgroundColor: isSelected ? "#f0f7ff" : "#fff",
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                              style={{ backgroundColor: CATEGORY_COLORS[r.event.category] + "15", color: CATEGORY_COLORS[r.event.category] }}>
                              {r.event.category}
                            </span>
                            <span className="text-[12px] font-bold" style={{ color: "#334155" }}>{r.event.label}</span>
                          </div>
                          <div className="mt-0.5 text-[10px]" style={{ color: "#94a3b8" }}>{r.event.description}</div>
                        </div>

                        {r.dataAvailable && r.drawdownA != null && r.drawdownB != null && (
                          <div className="flex gap-4 text-right">
                            <div>
                              <div className="text-[9px] font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</div>
                              <div className="font-mono text-[12px] font-bold" style={{ color: r.winnerDrawdown === "A" ? "#16a34a" : "#dc2626" }}>
                                {r.drawdownA.toFixed(1)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold" style={{ color: "#64748b" }}>{result.tickerB}</div>
                              <div className="font-mono text-[12px] font-bold" style={{ color: r.winnerDrawdown === "B" ? "#16a34a" : "#dc2626" }}>
                                {r.drawdownB.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        )}

                        {!r.dataAvailable && (
                          <span className="text-[10px]" style={{ color: "#94a3b8" }}>No data for this period</span>
                        )}
                      </div>

                      {isSelected && r.dataAvailable && (
                        <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: "#e2e8f0" }}>
                          <div className="flex items-center gap-2">
                            <TrendingDown size={12} style={{ color: "#dc2626" }} />
                            <div className="text-[11px]">
                              <span style={{ color: "#64748b" }}>Max drawdown: </span>
                              <span className="font-mono font-bold" style={{ color: r.winnerDrawdown === "A" ? "#16a34a" : "#334155" }}>
                                {result.tickerA} {r.drawdownA?.toFixed(2)}%
                              </span>
                              {" vs "}
                              <span className="font-mono font-bold" style={{ color: r.winnerDrawdown === "B" ? "#16a34a" : "#334155" }}>
                                {result.tickerB} {r.drawdownB?.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={12} style={{ color: "#3b82f6" }} />
                            <div className="text-[11px]">
                              <span style={{ color: "#64748b" }}>Recovery: </span>
                              <span className="font-mono font-bold" style={{ color: r.winnerRecovery === "A" ? "#16a34a" : "#334155" }}>
                                {result.tickerA} {r.recoveryDaysA != null ? `${r.recoveryDaysA}d` : "—"}
                              </span>
                              {" vs "}
                              <span className="font-mono font-bold" style={{ color: r.winnerRecovery === "B" ? "#16a34a" : "#334155" }}>
                                {result.tickerB} {r.recoveryDaysB != null ? `${r.recoveryDaysB}d` : "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
