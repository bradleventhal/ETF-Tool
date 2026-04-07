"use client"

import { useState, useMemo } from "react"
import type { AnalysisResult } from "@/lib/fund-types"
import { Zap, ChevronDown, ChevronRight, TrendingDown, TrendingUp, AlertTriangle, Shield } from "lucide-react"

interface Scenario {
  id: string
  name: string
  description: string
  category: "spread" | "rate" | "crisis" | "regime"
  icon: string
  // What moves in this scenario
  spreadMove: number       // bps change in credit spreads (positive = wider)
  rateMove: number         // bps change in rates (positive = higher)
  shortRateMove: number    // front end (2Y) rate move
  longRateMove: number     // back end (10Y+) rate move
  hySpreadMove: number     // HY-specific spread move
  igSpreadMove: number     // IG-specific spread move
  securitizedMove: number  // securitized spread move (can decouple from IG/HY)
  liquidityImpact: number  // -1 to 1 (negative = liquidity stress)
}

const SCENARIOS: Scenario[] = [
  {
    id: "spread_widen_mild",
    name: "Spreads Widen 50bps",
    description: "Mild risk-off. IG widens 25bps, HY widens 75bps, securitized widens 40bps. Rates unchanged.",
    category: "spread",
    icon: "📊",
    spreadMove: 50, rateMove: 0, shortRateMove: 0, longRateMove: 0,
    hySpreadMove: 75, igSpreadMove: 25, securitizedMove: 40, liquidityImpact: -0.2,
  },
  {
    id: "spread_widen_severe",
    name: "Credit Crisis (Spreads +200bps)",
    description: "Severe risk-off. IG widens 100bps, HY widens 300bps, securitized widens 150bps. Flight to quality pushes Treasuries down 50bps.",
    category: "crisis",
    icon: "🔴",
    spreadMove: 200, rateMove: -50, shortRateMove: -75, longRateMove: -30,
    hySpreadMove: 300, igSpreadMove: 100, securitizedMove: 150, liquidityImpact: -0.8,
  },
  {
    id: "rate_hike_100",
    name: "Rates +100bps (Parallel)",
    description: "Fed tightens. Entire curve shifts up 100bps. Spreads unchanged.",
    category: "rate",
    icon: "📈",
    spreadMove: 0, rateMove: 100, shortRateMove: 100, longRateMove: 100,
    hySpreadMove: 0, igSpreadMove: 0, securitizedMove: 0, liquidityImpact: 0,
  },
  {
    id: "curve_steepen",
    name: "Curve Steepens (2Y -50, 10Y +75)",
    description: "Fed cuts short end, long end sells off. Steepening trade. Good for short duration, bad for long.",
    category: "rate",
    icon: "📐",
    spreadMove: 0, rateMove: 0, shortRateMove: -50, longRateMove: 75,
    hySpreadMove: -15, igSpreadMove: -10, securitizedMove: -20, liquidityImpact: 0.2,
  },
  {
    id: "curve_flatten",
    name: "Curve Flattens (2Y +75, 10Y -25)",
    description: "Fed hikes aggressively, recession fears pull long end down. Inversion risk.",
    category: "rate",
    icon: "📏",
    spreadMove: 25, rateMove: 0, shortRateMove: 75, longRateMove: -25,
    hySpreadMove: 50, igSpreadMove: 20, securitizedMove: 15, liquidityImpact: -0.3,
  },
  {
    id: "covid_replay",
    name: "COVID Replay (March 2020)",
    description: "Liquidity crisis. Everything sells off. Spreads blow out 400bps+. Rates crash. Securitized hit hardest due to liquidity premium.",
    category: "crisis",
    icon: "🦠",
    spreadMove: 400, rateMove: -150, shortRateMove: -150, longRateMove: -100,
    hySpreadMove: 600, igSpreadMove: 200, securitizedMove: 500, liquidityImpact: -1.0,
  },
  {
    id: "soft_landing",
    name: "Soft Landing",
    description: "Fed cuts 150bps over 12 months. Spreads tighten 30bps. Risk assets rally. Best case for carry trades.",
    category: "regime",
    icon: "🎯",
    spreadMove: -30, rateMove: -150, shortRateMove: -175, longRateMove: -100,
    hySpreadMove: -50, igSpreadMove: -20, securitizedMove: -40, liquidityImpact: 0.5,
  },
  {
    id: "stagflation",
    name: "Stagflation",
    description: "Growth slows but inflation persists. Rates stay high, spreads widen. Worst case for long duration + credit risk.",
    category: "regime",
    icon: "🔥",
    spreadMove: 100, rateMove: 50, shortRateMove: 25, longRateMove: 75,
    hySpreadMove: 200, igSpreadMove: 75, securitizedMove: 80, liquidityImpact: -0.5,
  },
  {
    id: "securitized_rally",
    name: "Securitized Spreads Normalize",
    description: "Securitized credit spreads tighten toward historical averages vs IG corporate. The Angel Oak thesis plays out.",
    category: "spread",
    icon: "✨",
    spreadMove: -20, rateMove: 0, shortRateMove: 0, longRateMove: 0,
    hySpreadMove: -10, igSpreadMove: 5, securitizedMove: -60, liquidityImpact: 0.3,
  },
  {
    id: "oil_shock",
    name: "Oil Spike ($150+)",
    description: "Geopolitical shock. Oil spikes, inflation surges, Fed trapped. Rates up on inflation, spreads widen on growth fears.",
    category: "crisis",
    icon: "🛢️",
    spreadMove: 75, rateMove: 50, shortRateMove: 25, longRateMove: 75,
    hySpreadMove: 150, igSpreadMove: 50, securitizedMove: 60, liquidityImpact: -0.4,
  },
]

function estimateImpact(
  scenario: Scenario,
  duration: number,
  secYield: number,
  isHY: boolean,
  isSecuritized: boolean,
  isIG: boolean,
  isGovt: boolean,
  isUltrashort: boolean,
): { priceReturn: number; carry: number; totalReturn: number; narrative: string } {
  // Rate impact: -duration * rate_move / 100
  // Use weighted rate move based on duration bucket
  const effectiveRateMove = duration < 2
    ? scenario.shortRateMove * 0.8 + scenario.longRateMove * 0.2
    : duration < 5
    ? scenario.shortRateMove * 0.4 + scenario.longRateMove * 0.6
    : scenario.shortRateMove * 0.2 + scenario.longRateMove * 0.8

  const rateImpact = -duration * (effectiveRateMove / 10000)

  // Spread impact: depends on what the fund holds
  let spreadImpact = 0
  if (isHY) {
    spreadImpact = -duration * (scenario.hySpreadMove / 10000)
  } else if (isSecuritized) {
    spreadImpact = -duration * (scenario.securitizedMove / 10000)
    // Securitized gets extra hit in liquidity stress
    if (scenario.liquidityImpact < -0.5) {
      spreadImpact *= 1.3 // Liquidity premium widens more
    }
  } else if (isIG) {
    spreadImpact = -duration * (scenario.igSpreadMove / 10000)
  } else if (isGovt) {
    spreadImpact = 0 // No spread risk
  } else {
    // Multisector — blend
    spreadImpact = -duration * (scenario.spreadMove / 10000)
  }

  // Ultrashort gets minimal rate impact
  if (isUltrashort) {
    spreadImpact *= 0.3 // Much less spread sensitivity
  }

  const priceReturn = rateImpact + spreadImpact
  const carry = secYield / 4 // Assume 3-month scenario (quarterly carry)
  const totalReturn = priceReturn + carry

  // Generate narrative
  let narrative = ""
  if (totalReturn > 0.01) {
    narrative = "Positive scenario — carry more than offsets any mark-to-market."
  } else if (totalReturn > -0.01) {
    narrative = "Roughly flat — carry offsets most of the price decline."
  } else if (totalReturn > -0.03) {
    narrative = "Modest drawdown — duration and spread exposure create headwinds."
  } else {
    narrative = "Significant drawdown — high sensitivity to this scenario."
  }

  if (isUltrashort && totalReturn > -0.005) {
    narrative = "Minimal impact — ultrashort duration provides strong insulation."
  }

  return { priceReturn, carry, totalReturn, narrative }
}

const CATEGORY_COLORS: Record<string, string> = {
  spread: "#3b82f6",
  rate: "#f59e0b",
  crisis: "#dc2626",
  regime: "#8b5cf6",
}

interface Props {
  result: AnalysisResult
  fundACategory?: string
  fundBCategory?: string
  fundADuration?: number
  fundBDuration?: number
  fundAYield?: number
  fundBYield?: number
}

export function WhatIfScenarios({ result, fundACategory, fundBCategory, fundADuration, fundBDuration, fundAYield, fundBYield }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)

  const durA = fundADuration || 3.0
  const durB = fundBDuration || 3.0
  const yieldA = fundAYield || 0.05
  const yieldB = fundBYield || 0.05
  const catA = (fundACategory || "").toLowerCase()
  const catB = (fundBCategory || "").toLowerCase()

  const isHY_A = catA.includes("high yield")
  const isHY_B = catB.includes("high yield")
  const isSec_A = catA.includes("securitized") || catA.includes("mortgage")
  const isSec_B = catB.includes("securitized") || catB.includes("mortgage")
  const isIG_A = catA.includes("core") || catA.includes("corporate")
  const isIG_B = catB.includes("core") || catB.includes("corporate")
  const isGovt_A = catA.includes("government") || catA.includes("treasury")
  const isGovt_B = catB.includes("government") || catB.includes("treasury")
  const isUS_A = catA.includes("ultrashort")
  const isUS_B = catB.includes("ultrashort")

  const scenarioResults = useMemo(() => {
    return SCENARIOS.map(s => {
      const impactA = estimateImpact(s, durA, yieldA, isHY_A, isSec_A, isIG_A, isGovt_A, isUS_A)
      const impactB = estimateImpact(s, durB, yieldB, isHY_B, isSec_B, isIG_B, isGovt_B, isUS_B)
      return { scenario: s, impactA, impactB }
    })
  }, [durA, durB, yieldA, yieldB, isHY_A, isHY_B, isSec_A, isSec_B, isIG_A, isIG_B, isGovt_A, isGovt_B, isUS_A, isUS_B])

  const selected = selectedScenario ? scenarioResults.find(r => r.scenario.id === selectedScenario) : null

  // Scoreboard
  const aWins = scenarioResults.filter(r => r.impactA.totalReturn > r.impactB.totalReturn).length
  const bWins = scenarioResults.filter(r => r.impactB.totalReturn > r.impactA.totalReturn).length

  const fPct = (v: number) => (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%"
  const fBps = (v: number) => (v >= 0 ? "+" : "") + Math.round(v * 10000) + "bps"

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 border-b px-3.5 py-3 text-left sm:gap-3 sm:px-5 sm:py-3.5"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
      >
        <Zap size={16} style={{ color: "#0f3d6b", flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>
            What If Scenarios
          </span>
          <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
            Spreads, rates, crises — how does each fund react?
          </span>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: "#94a3b8" }} /> : <ChevronRight size={14} style={{ color: "#94a3b8" }} />}
      </button>

      {expanded && (
        <div className="p-4 sm:p-5">
          {/* Scoreboard */}
          <div className="mb-4 flex items-center justify-between rounded p-3" style={{ backgroundColor: "#f8fafc" }}>
            <div className="text-center">
              <div className="text-xs font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</div>
              <div className="text-2xl font-bold" style={{ color: "#0f3d6b" }}>{aWins}</div>
              <div className="text-[9px]" style={{ color: "#94a3b8" }}>scenarios favor</div>
            </div>
            <div className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>of {SCENARIOS.length} scenarios</div>
            <div className="text-center">
              <div className="text-xs font-bold" style={{ color: "#64748b" }}>{result.tickerB}</div>
              <div className="text-2xl font-bold" style={{ color: "#64748b" }}>{bWins}</div>
              <div className="text-[9px]" style={{ color: "#94a3b8" }}>scenarios favor</div>
            </div>
          </div>

          {/* Scenario grid */}
          <div className="space-y-2">
            {scenarioResults.map(({ scenario: s, impactA, impactB }) => {
              const isSelected = selectedScenario === s.id
              const aWin = impactA.totalReturn > impactB.totalReturn
              const diff = impactA.totalReturn - impactB.totalReturn

              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenario(isSelected ? null : s.id)}
                  className="w-full rounded border p-3 text-left transition-colors"
                  style={{
                    borderColor: isSelected ? "#0f3d6b" : "#e2e8f0",
                    backgroundColor: isSelected ? "#f0f7ff" : "#fff",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{s.icon}</span>
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                          style={{ backgroundColor: CATEGORY_COLORS[s.category] + "15", color: CATEGORY_COLORS[s.category] }}>
                          {s.category}
                        </span>
                        <span className="text-[12px] font-bold" style={{ color: "#334155" }}>{s.name}</span>
                      </div>
                      <div className="mt-0.5 text-[10px]" style={{ color: "#94a3b8" }}>{s.description}</div>
                    </div>

                    <div className="flex gap-4 text-right">
                      <div>
                        <div className="text-[9px] font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</div>
                        <div className="font-mono text-[12px] font-bold" style={{ color: impactA.totalReturn >= 0 ? "#16a34a" : "#dc2626" }}>
                          {fPct(impactA.totalReturn)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold" style={{ color: "#64748b" }}>{result.tickerB}</div>
                        <div className="font-mono text-[12px] font-bold" style={{ color: impactB.totalReturn >= 0 ? "#16a34a" : "#dc2626" }}>
                          {fPct(impactB.totalReturn)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Winner badge */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                      style={{ backgroundColor: aWin ? "#ecfdf5" : "#fef2f2", color: aWin ? "#16a34a" : "#dc2626" }}>
                      {aWin ? result.tickerA : result.tickerB} outperforms by {fBps(Math.abs(diff))}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="mt-3 grid grid-cols-2 gap-4 border-t pt-3" style={{ borderColor: "#e2e8f0" }}>
                      {[
                        { label: result.tickerA, impact: impactA, color: "#0f3d6b" },
                        { label: result.tickerB, impact: impactB, color: "#64748b" },
                      ].map(({ label, impact, color }) => (
                        <div key={label}>
                          <div className="mb-2 text-[10px] font-bold" style={{ color }}>{label}</div>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span style={{ color: "#64748b" }}>Price return</span>
                              <span className="font-mono font-medium" style={{ color: impact.priceReturn >= 0 ? "#16a34a" : "#dc2626" }}>
                                {fPct(impact.priceReturn)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: "#64748b" }}>Carry (3mo)</span>
                              <span className="font-mono font-medium" style={{ color: "#16a34a" }}>
                                +{(impact.carry * 100).toFixed(2)}%
                              </span>
                            </div>
                            <div className="flex justify-between border-t pt-1" style={{ borderColor: "#f1f5f9" }}>
                              <span className="font-semibold" style={{ color: "#334155" }}>Total return</span>
                              <span className="font-mono font-bold" style={{ color: impact.totalReturn >= 0 ? "#16a34a" : "#dc2626" }}>
                                {fPct(impact.totalReturn)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 text-[10px] italic" style={{ color: "#94a3b8" }}>{impact.narrative}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-3 text-[9px] leading-relaxed" style={{ color: "#b0b8c4" }}>
            Estimates based on duration, spread sensitivity, and sector exposure. Assumes 3-month holding period.
            Actual results will vary based on portfolio positioning, convexity, and market conditions.
            Not a guarantee of future performance.
          </div>
        </div>
      )}
    </div>
  )
}
