"use client"

import { useState, useMemo } from "react"
import type { AnalysisResult } from "@/lib/fund-types"
import { Sliders, TrendingDown, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Zap } from "lucide-react"

interface Props {
  result: AnalysisResult
}

interface Scenario {
  id: string
  name: string
  description: string
  category: "rate" | "spread" | "replay" | "custom"
  icon: string
  // Rate changes (bps) at different parts of the curve
  rate2y?: number
  rate5y?: number
  rate10y?: number
  rate30y?: number
  // Spread changes (bps)
  igSpread?: number
  hySpread?: number
  securitizedSpread?: number
  // For historical replays — date range
  replayStart?: string
  replayEnd?: string
  replayLabel?: string
}

const SCENARIOS: Scenario[] = [
  // Rate scenarios
  {
    id: "parallel_up100",
    name: "Rates +100bps (Parallel)",
    description: "Entire curve shifts up 100bps. The classic rate shock. Duration tells the story.",
    category: "rate", icon: "📈",
    rate2y: 100, rate5y: 100, rate10y: 100, rate30y: 100,
  },
  {
    id: "parallel_down100",
    name: "Rates -100bps (Parallel)",
    description: "Fed cuts aggressively. Duration is your friend here.",
    category: "rate", icon: "📉",
    rate2y: -100, rate5y: -100, rate10y: -100, rate30y: -100,
  },
  {
    id: "bear_flattener",
    name: "Bear Flattener",
    description: "Front end rises +150bps, long end rises +50bps. The Fed is hiking but the market sees a slowdown ahead. Short duration wins.",
    category: "rate", icon: "⚡",
    rate2y: 150, rate5y: 100, rate10y: 75, rate30y: 50,
  },
  {
    id: "bull_steepener",
    name: "Bull Steepener",
    description: "Front end drops -150bps, long end drops -50bps. Emergency cuts. Short duration barely moves, long duration rallies.",
    category: "rate", icon: "🔻",
    rate2y: -150, rate5y: -100, rate10y: -75, rate30y: -50,
  },
  {
    id: "bear_steepener",
    name: "Bear Steepener",
    description: "Long end sells off +150bps, front end flat. Term premium expansion. Bad for duration, bad for spread product.",
    category: "rate", icon: "🔥",
    rate2y: 25, rate5y: 75, rate10y: 125, rate30y: 150,
  },
  // Spread scenarios
  {
    id: "ig_widen_50",
    name: "IG Spreads Widen +50bps",
    description: "Investment grade credit sells off. Recession fears. Flights to quality. IG corporate funds get hit, treasury and agency MBS benefit.",
    category: "spread", icon: "💔",
    igSpread: 50, hySpread: 100, securitizedSpread: 30,
  },
  {
    id: "hy_blowout",
    name: "HY Spread Blowout +300bps",
    description: "High yield gets crushed. Credit crisis vibes. Default fears spike. Quality wins. This is 2008, 2020, 2022 energy.",
    category: "spread", icon: "💀",
    igSpread: 75, hySpread: 300, securitizedSpread: 100,
  },
  {
    id: "spread_compression",
    name: "Spread Compression -30bps",
    description: "Risk-on rally. Spreads tighten across the board. Credit outperforms. The carry trade works.",
    category: "spread", icon: "🎯",
    igSpread: -30, hySpread: -75, securitizedSpread: -25,
  },
  {
    id: "securitized_relative_value",
    name: "Securitized vs Corporate Reversion",
    description: "Securitized spreads tighten -50bps while IG corporate stays flat. The Angel Oak thesis: securitized is cheap relative to corporate.",
    category: "spread", icon: "🔄",
    igSpread: 0, hySpread: 0, securitizedSpread: -50,
  },
  // Historical replays
  {
    id: "covid_march2020",
    name: "March 2020 (COVID Crash)",
    description: "Liquidity freeze. Everything sells off. Then the Fed prints money. The fastest drawdown and recovery in history.",
    category: "replay", icon: "🦠",
    replayStart: "2020-02-19", replayEnd: "2020-06-30", replayLabel: "COVID Crash + Recovery",
  },
  {
    id: "rate_shock_2022",
    name: "2022 (The Rate Shock)",
    description: "Fed hikes 425bps in 12 months. Worst bond market in 40 years. Duration got destroyed. Credit was collateral damage.",
    category: "replay", icon: "⚡",
    replayStart: "2022-01-03", replayEnd: "2022-12-30", replayLabel: "2022 Rate Shock",
  },
  {
    id: "svb_2023",
    name: "March 2023 (SVB Crisis)",
    description: "Regional banks fail. Flight to quality. Securitized credit sells off on fear, not fundamentals. Recovery was fast.",
    category: "replay", icon: "🏦",
    replayStart: "2023-03-01", replayEnd: "2023-06-30", replayLabel: "SVB Banking Crisis",
  },
  {
    id: "q4_2018",
    name: "Q4 2018 (Overtightening Scare)",
    description: "Fed overtightening. Credit spreads blow out. Powell pivots. The market that broke the Fed.",
    category: "replay", icon: "🔨",
    replayStart: "2018-10-01", replayEnd: "2019-03-31", replayLabel: "Q4 2018 Selloff + Recovery",
  },
  {
    id: "taper_tantrum_2013",
    name: "2013 Taper Tantrum",
    description: "Bernanke hints at ending QE. Rates spike. Duration gets hammered. Short duration barely noticed.",
    category: "replay", icon: "📢",
    replayStart: "2013-05-01", replayEnd: "2013-12-31", replayLabel: "Taper Tantrum",
  },
]

function estimateImpact(
  durA: number, durB: number,
  scenario: Scenario,
  fundA: { secYield: number; igPct: number; hyPct: number; secPct: number },
  fundB: { secYield: number; igPct: number; hyPct: number; secPct: number },
): { priceA: number; priceB: number; totalA: number; totalB: number; narrative: string } {
  // Price impact from rate changes (duration × rate change)
  const avgRate = ((scenario.rate2y || 0) + (scenario.rate5y || 0) * 2 + (scenario.rate10y || 0)) / 4
  const priceImpactA = -(durA * avgRate / 100) // duration × rate change in %
  const priceImpactB = -(durB * avgRate / 100)

  // Spread impact (proportional to credit allocation)
  const spreadImpactA =
    -(fundA.igPct * (scenario.igSpread || 0) / 100 * durA * 0.8) +
    -(fundA.hyPct * (scenario.hySpread || 0) / 100 * durA * 1.2) +
    -(fundA.secPct * (scenario.securitizedSpread || 0) / 100 * durA * 0.9)
  const spreadImpactB =
    -(fundB.igPct * (scenario.igSpread || 0) / 100 * durB * 0.8) +
    -(fundB.hyPct * (scenario.hySpread || 0) / 100 * durB * 1.2) +
    -(fundB.secPct * (scenario.securitizedSpread || 0) / 100 * durB * 0.9)

  const totalPriceA = priceImpactA + spreadImpactA
  const totalPriceB = priceImpactB + spreadImpactB

  // Total return = price change + 3 months of carry (quarterly income)
  const carryA = fundA.secYield * 100 / 4
  const carryB = fundB.secYield * 100 / 4
  const totalReturnA = totalPriceA + carryA
  const totalReturnB = totalPriceB + carryB

  // Build narrative
  let narrative = ""
  const diff = totalReturnA - totalReturnB
  const winner = diff > 0.1 ? "A" : diff < -0.1 ? "B" : "tie"

  if (scenario.category === "rate") {
    if (durA < durB) {
      narrative = `Shorter duration (${durA.toFixed(1)} vs ${durB.toFixed(1)} yrs) means less rate sensitivity. `
    } else if (durA > durB) {
      narrative = `Longer duration (${durA.toFixed(1)} vs ${durB.toFixed(1)} yrs) amplifies the rate move. `
    }
    if (avgRate > 0) {
      narrative += `In a rising rate environment, ${winner === "A" ? "our fund" : winner === "B" ? "the competitor" : "both funds"} ${winner === "tie" ? "perform similarly" : "holds up better"} due to ${winner === "A" ? "shorter duration and higher carry" : "lower sensitivity"}.`
    } else {
      narrative += `In a falling rate environment, ${winner === "A" ? "our fund" : winner === "B" ? "the competitor" : "both funds"} ${winner === "tie" ? "perform similarly" : "benefits more"} from the rate decline.`
    }
  } else if (scenario.category === "spread") {
    narrative = `Spread moves hit differently based on credit allocation. `
    if (fundA.secPct > fundB.secPct && (scenario.securitizedSpread || 0) < 0) {
      narrative += `Higher securitized allocation (${(fundA.secPct * 100).toFixed(0)}% vs ${(fundB.secPct * 100).toFixed(0)}%) benefits from securitized spread tightening.`
    } else if (fundA.hyPct > fundB.hyPct && (scenario.hySpread || 0) > 0) {
      narrative += `Higher HY exposure means more pain in a credit widening.`
    } else {
      narrative += `The carry advantage ${fundA.secYield > fundB.secYield ? "cushions" : "partially offsets"} the spread impact.`
    }
  }

  return {
    priceA: totalPriceA,
    priceB: totalPriceB,
    totalA: totalReturnA,
    totalB: totalReturnB,
    narrative,
  }
}

export function ScenarioEngine({ result }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [customRateShift, setCustomRateShift] = useState(0)
  const [customSpreadShift, setCustomSpreadShift] = useState(0)

  // Extract fund characteristics from the comparison result
  const durA = result.keyStats.find(r => r.label === "Duration")?.nA || 0
  const durB = result.keyStats.find(r => r.label === "Duration")?.nB || 0
  const yieldA = result.keyStats.find(r => r.label.includes("SEC Yield"))?.nA || result.keyStats.find(r => r.label.includes("YTW"))?.nA || 0
  const yieldB = result.keyStats.find(r => r.label.includes("SEC Yield"))?.nB || result.keyStats.find(r => r.label.includes("YTW"))?.nB || 0

  // Estimate IG/HY/Securitized allocation from sector data
  const getSecAlloc = (side: "a" | "b") => {
    const corp = result.sectorAllocation.find(r => r.label === "Corporate Credit")
    const sec = result.sectorAllocation.find(r => r.label.includes("RMBS") || r.label.includes("Securitized") || r.label.includes("ABS"))
    const secTotal = result.sectorAllocation
      .filter(r => ["Non-Agency RMBS", "Agency RMBS", "ABS", "CLO", "CMBS"].includes(r.label))
      .reduce((sum, r) => sum + (side === "a" ? (r.nA || 0) : (r.nB || 0)), 0)
    const corpVal = side === "a" ? (corp?.nA || 0) : (corp?.nB || 0)
    return { igPct: Math.min(corpVal, 0.5), hyPct: Math.max(corpVal - 0.5, 0), secPct: secTotal || 0.3 }
  }

  const fundAProfile = { secYield: yieldA, ...getSecAlloc("a") }
  const fundBProfile = { secYield: yieldB, ...getSecAlloc("b") }

  const filteredScenarios = selectedCategory === "all"
    ? SCENARIOS
    : SCENARIOS.filter(s => s.category === selectedCategory)

  const selected = selectedScenario ? SCENARIOS.find(s => s.id === selectedScenario) : null
  const impact = selected && selected.category !== "replay"
    ? estimateImpact(durA, durB, selected, fundAProfile, fundBProfile)
    : null

  // Custom scenario
  const customScenario: Scenario = {
    id: "custom", name: "Custom", description: "", category: "custom", icon: "🎛️",
    rate2y: customRateShift, rate5y: customRateShift, rate10y: customRateShift, rate30y: customRateShift,
    igSpread: customSpreadShift, hySpread: customSpreadShift * 2, securitizedSpread: customSpreadShift * 0.7,
  }
  const customImpact = (customRateShift !== 0 || customSpreadShift !== 0)
    ? estimateImpact(durA, durB, customScenario, fundAProfile, fundBProfile)
    : null

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
            Scenario Engine
          </span>
          <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
            What happens if rates move? Spreads widen? Replay a crisis?
          </span>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: "#94a3b8" }} /> : <ChevronRight size={14} style={{ color: "#94a3b8" }} />}
      </button>

      {expanded && (
        <div className="p-4 sm:p-5">
          {/* Category filter */}
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { id: "all", label: "All Scenarios" },
              { id: "rate", label: "Rate Moves" },
              { id: "spread", label: "Spread Moves" },
              { id: "replay", label: "Historical Replays" },
            ].map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className="rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors"
                style={{
                  borderColor: selectedCategory === cat.id ? "#0f3d6b" : "#d1d5db",
                  backgroundColor: selectedCategory === cat.id ? "#0f3d6b" : "transparent",
                  color: selectedCategory === cat.id ? "#fff" : "#64748b",
                }}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Custom scenario sliders */}
          <div className="mb-4 rounded border p-3" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Custom Scenario</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "#64748b" }}>Rate Shift (parallel)</span>
                  <span className="font-mono text-[11px] font-bold" style={{ color: customRateShift > 0 ? "#dc2626" : customRateShift < 0 ? "#16a34a" : "#94a3b8" }}>
                    {customRateShift > 0 ? "+" : ""}{customRateShift}bps
                  </span>
                </div>
                <input type="range" min={-200} max={200} step={25} value={customRateShift}
                  onChange={e => setCustomRateShift(Number(e.target.value))}
                  className="w-full" style={{ accentColor: "#0f3d6b" }} />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "#64748b" }}>Spread Shift (IG)</span>
                  <span className="font-mono text-[11px] font-bold" style={{ color: customSpreadShift > 0 ? "#dc2626" : customSpreadShift < 0 ? "#16a34a" : "#94a3b8" }}>
                    {customSpreadShift > 0 ? "+" : ""}{customSpreadShift}bps
                  </span>
                </div>
                <input type="range" min={-100} max={300} step={25} value={customSpreadShift}
                  onChange={e => setCustomSpreadShift(Number(e.target.value))}
                  className="w-full" style={{ accentColor: "#0f3d6b" }} />
              </div>
            </div>
            {customImpact && (
              <div className="mt-3 flex items-center gap-6 rounded p-2" style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0" }}>
                <div className="text-center">
                  <div className="text-[9px] font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</div>
                  <div className="font-mono text-sm font-bold" style={{ color: customImpact.totalA >= 0 ? "#16a34a" : "#dc2626" }}>
                    {customImpact.totalA >= 0 ? "+" : ""}{customImpact.totalA.toFixed(2)}%
                  </div>
                </div>
                <div className="text-[10px]" style={{ color: "#94a3b8" }}>vs</div>
                <div className="text-center">
                  <div className="text-[9px] font-bold" style={{ color: "#64748b" }}>{result.tickerB}</div>
                  <div className="font-mono text-sm font-bold" style={{ color: customImpact.totalB >= 0 ? "#16a34a" : "#dc2626" }}>
                    {customImpact.totalB >= 0 ? "+" : ""}{customImpact.totalB.toFixed(2)}%
                  </div>
                </div>
                <div className="flex-1 text-[10px]" style={{ color: "#475569" }}>
                  Estimated 3-month total return (price + carry)
                </div>
              </div>
            )}
          </div>

          {/* Scenario cards */}
          <div className="space-y-2">
            {filteredScenarios.map(scenario => {
              const isSelected = selectedScenario === scenario.id
              const imp = scenario.category !== "replay"
                ? estimateImpact(durA, durB, scenario, fundAProfile, fundBProfile)
                : null

              return (
                <button key={scenario.id}
                  onClick={() => setSelectedScenario(isSelected ? null : scenario.id)}
                  className="w-full rounded border p-3 text-left transition-colors"
                  style={{
                    borderColor: isSelected ? "#0f3d6b" : "#e2e8f0",
                    backgroundColor: isSelected ? "#f0f7ff" : "#fff",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{scenario.icon}</span>
                        <span className="text-[12px] font-bold" style={{ color: "#334155" }}>{scenario.name}</span>
                        <span className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase"
                          style={{
                            backgroundColor: scenario.category === "rate" ? "#dbeafe" : scenario.category === "spread" ? "#fef3c7" : "#f3e8ff",
                            color: scenario.category === "rate" ? "#1d4ed8" : scenario.category === "spread" ? "#92400e" : "#7c3aed",
                          }}>
                          {scenario.category}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed" style={{ color: "#64748b" }}>{scenario.description}</div>
                    </div>

                    {imp && (
                      <div className="flex gap-3 text-right">
                        <div>
                          <div className="text-[9px] font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</div>
                          <div className="font-mono text-[13px] font-bold" style={{ color: imp.totalA >= 0 ? "#16a34a" : "#dc2626" }}>
                            {imp.totalA >= 0 ? "+" : ""}{imp.totalA.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold" style={{ color: "#64748b" }}>{result.tickerB}</div>
                          <div className="font-mono text-[13px] font-bold" style={{ color: imp.totalB >= 0 ? "#16a34a" : "#dc2626" }}>
                            {imp.totalB >= 0 ? "+" : ""}{imp.totalB.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    )}

                    {scenario.category === "replay" && (
                      <div className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>
                        {scenario.replayLabel}
                      </div>
                    )}
                  </div>

                  {isSelected && imp && (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: "#e2e8f0" }}>
                      <div className="grid grid-cols-2 gap-4 text-[11px]">
                        <div>
                          <div className="mb-1 text-[9px] font-bold uppercase" style={{ color: "#0f3d6b" }}>Price Impact</div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold" style={{ color: imp.priceA >= 0 ? "#16a34a" : "#dc2626" }}>
                              {result.tickerA}: {imp.priceA >= 0 ? "+" : ""}{imp.priceA.toFixed(2)}%
                            </span>
                            <span style={{ color: "#94a3b8" }}>vs</span>
                            <span className="font-mono font-bold" style={{ color: imp.priceB >= 0 ? "#16a34a" : "#dc2626" }}>
                              {result.tickerB}: {imp.priceB >= 0 ? "+" : ""}{imp.priceB.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-[9px] font-bold uppercase" style={{ color: "#0f3d6b" }}>3M Carry</div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold" style={{ color: "#16a34a" }}>
                              {result.tickerA}: +{(yieldA * 100 / 4).toFixed(2)}%
                            </span>
                            <span style={{ color: "#94a3b8" }}>vs</span>
                            <span className="font-mono font-bold" style={{ color: "#16a34a" }}>
                              {result.tickerB}: +{(yieldB * 100 / 4).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 rounded p-2 text-[11px] leading-relaxed" style={{ backgroundColor: "#f8fafc", color: "#475569" }}>
                        {imp.narrative}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-3 text-[9px] leading-relaxed" style={{ color: "#b0b8c4" }}>
            Estimates use duration-based approximation for rate sensitivity and spread duration for credit impact.
            Actual results will differ based on convexity, prepayment behavior, and active management decisions.
            Historical replays use actual total return data from Yahoo Finance. Not investment advice.
          </div>
        </div>
      )}
    </div>
  )
}
