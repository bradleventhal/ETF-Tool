"use client"

import { useState } from "react"
import type { AnalysisResult, WarRoom } from "@/lib/fund-types"
import { Users, ChevronDown, ChevronRight, Target, Shield, Zap, DollarSign } from "lucide-react"

interface Props {
  result: AnalysisResult
  warRoom: WarRoom | null
}

interface Persona {
  id: string
  label: string
  icon: React.ReactNode
  description: string
  priorities: string[]
  metrics: string[] // which metrics matter most
  pitchAngle: string
  objections: string[]
  closingQuestion: string
}

export function AdvisorPersona({ result, warRoom }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selectedPersona, setSelectedPersona] = useState<string>("conservative")

  const ticker = result.tickerA
  const competitor = result.tickerB

  // Extract key stats for narrative generation
  const getStat = (label: string, side: "a" | "b") => {
    const row = result.keyStats.find(r => r.label.includes(label))
    return side === "a" ? (row?.nA || 0) : (row?.nB || 0)
  }

  const durA = getStat("Duration", "a")
  const durB = getStat("Duration", "b")
  const yieldA = getStat("SEC Yield", "a") || getStat("YTW", "a")
  const yieldB = getStat("SEC Yield", "b") || getStat("YTW", "b")
  const expA = getStat("Expense", "a")
  const expB = getStat("Expense", "b")
  const sharpeA = getStat("Sharpe", "a")
  const sharpeB = getStat("Sharpe", "b")

  const yieldAdvantage = yieldA > yieldB
  const durationAdvantage = durA < durB
  const expenseAdvantage = expA < expB
  const sharpeAdvantage = sharpeA > sharpeB

  const personas: Persona[] = [
    {
      id: "conservative",
      label: "Conservative / Retiree Focus",
      icon: <Shield size={14} />,
      description: "Advisor manages portfolios for 65+ retirees. Income is king. Capital preservation matters. They hate volatility and want to sleep at night.",
      priorities: ["Income stability", "Capital preservation", "Low volatility", "Monthly distributions"],
      metrics: ["SEC Yield", "Duration (shorter = better)", "Credit Quality (higher = better)", "Std Deviation"],
      pitchAngle: yieldAdvantage && durationAdvantage
        ? `Lead with income: ${ticker} delivers ${((yieldA - yieldB) * 10000).toFixed(0)}bps more yield with ${(durB - durA).toFixed(1)} years less duration. That's more income with less risk — exactly what retiree portfolios need.`
        : yieldAdvantage
        ? `Lead with income: ${ticker} yields ${((yieldA - yieldB) * 10000).toFixed(0)}bps more. For a retiree drawing $4,000/month, that's real money. The duration tradeoff is manageable with active management.`
        : durationAdvantage
        ? `Lead with safety: ${ticker} has ${(durB - durA).toFixed(1)} years less duration — less rate sensitivity means less NAV surprise for clients who check their statements every month.`
        : `Focus on risk-adjusted returns: ${ticker}'s approach is designed for capital preservation while still generating competitive income.`,
      objections: [
        yieldAdvantage ? "" : `"Their yield is higher — why wouldn't I just use ${competitor}?"`,
        durationAdvantage ? "" : `"That's a lot of duration for my conservative clients."`,
        `"My clients call me when NAV drops 1%. How does this hold up in a selloff?"`,
        expenseAdvantage ? "" : `"The fee is higher. Can you justify it?"`,
      ].filter(Boolean),
      closingQuestion: "If your client's #1 concern is 'will my income check show up reliably every month' — which fund gives you more confidence?",
    },
    {
      id: "yield_hunter",
      label: "Aggressive Yield Hunter",
      icon: <DollarSign size={14} />,
      description: "Advisor runs HNW accounts that want maximum yield. They'll take risk for income. Duration doesn't scare them — they're looking at the carry.",
      priorities: ["Maximum yield", "Total return", "Carry advantage", "Spread pickup"],
      metrics: ["SEC Yield", "Distribution Yield", "YTW/YTM", "Total Return"],
      pitchAngle: yieldAdvantage
        ? `This is your meeting: ${ticker} yields ${((yieldA - yieldB) * 10000).toFixed(0)}bps more. On a $5M allocation, that's ${(((yieldA - yieldB) * 5000000)).toFixed(0)} more per year in income. The higher yield comes from ${durA > 2 ? "accessing securitized credit" : "efficient structuring"}, not from reaching down the credit spectrum.`
        : `Reframe the conversation: yes, ${competitor} has a yield edge right now. But look at where that yield comes from — ${ticker} generates income from ${durA < 3 ? "short-duration, high-quality securitized" : "a diversified multi-sector"} approach that's more sustainable through a full cycle.`,
      objections: [
        !yieldAdvantage ? `"${competitor} yields more. I need the highest yield possible."` : "",
        `"What's the spread pickup over Treasuries? Where's the alpha coming from?"`,
        `"I need 6%+ distribution to meet my clients' income targets."`,
        `"Show me the total return — I care about what actually hits the account."`,
      ].filter(Boolean),
      closingQuestion: `If you could get ${yieldAdvantage ? "higher" : "competitive"} income with better risk-adjusted returns, would your clients care about the ${((Math.abs(yieldA - yieldB)) * 10000).toFixed(0)}bps yield difference?`,
    },
    {
      id: "fee_sensitive",
      label: "Fee-Sensitive / Vanguard Shop",
      icon: <Target size={14} />,
      description: "Fee-first advisor. Uses Vanguard/Schwab index funds. Every basis point matters. They'll grill you on expense ratios before looking at anything else.",
      priorities: ["Lowest cost", "Net-of-fee performance", "Passive vs active justification", "Tax efficiency"],
      metrics: ["Expense Ratio", "Net-of-fee returns", "Tracking error", "Tax efficiency"],
      pitchAngle: expenseAdvantage
        ? `You're in great shape on fees: ${ticker} at ${(expA * 100).toFixed(2)}% vs ${competitor} at ${(expB * 100).toFixed(2)}%. Lower cost AND ${yieldAdvantage ? "higher yield" : "competitive performance"}.`
        : `Acknowledge the fee upfront: yes, ${ticker} costs ${((expA - expB) * 10000).toFixed(0)}bps more. But net-of-fee, ${sharpeAdvantage ? `the Sharpe ratio (${sharpeA.toFixed(2)} vs ${sharpeB.toFixed(2)}) proves the fee is more than earned` : "the active management has generated alpha over the passive alternative"}. The question isn't what the fund costs — it's what the client keeps.`,
      objections: [
        !expenseAdvantage ? `"Your fund costs ${((expA - expB) * 10000).toFixed(0)}bps more. Why wouldn't I use ${competitor}?"` : "",
        `"I can get similar exposure with an index fund at 3bps."`,
        `"My compliance team flags anything over 50bps."`,
        `"What's the net-of-fee alpha over the benchmark?"`,
      ].filter(Boolean),
      closingQuestion: `If ${ticker} delivers ${yieldAdvantage ? `${((yieldA - yieldB) * 10000).toFixed(0)}bps more yield` : "better risk-adjusted returns"} net of fees, does the ${((Math.abs(expA - expB)) * 10000).toFixed(0)}bps fee difference matter to your clients?`,
    },
    {
      id: "risk_manager",
      label: "Risk-First / CIO Mindset",
      icon: <Zap size={14} />,
      description: "Sophisticated advisor who thinks in terms of portfolio construction. Cares about correlation, drawdown, and how the allocation fits the overall book.",
      priorities: ["Drawdown protection", "Correlation to equities", "Sharpe ratio", "Portfolio fit"],
      metrics: ["Sharpe Ratio", "Std Deviation", "Max Drawdown", "Duration as rate hedge"],
      pitchAngle: sharpeAdvantage
        ? `Lead with risk-adjusted: ${ticker} Sharpe of ${sharpeA.toFixed(2)} vs ${sharpeB.toFixed(2)} means more return per unit of risk. In portfolio construction terms, ${ticker} is a more efficient use of the fixed income allocation.`
        : `Frame it as portfolio construction: ${ticker} at ${durA.toFixed(1)} years duration offers ${durA < durB ? "less rate sensitivity" : "higher carry"} — the question is what role this plays in the overall book. If they need income with ${durA < 3 ? "minimal rate risk" : "some duration exposure for rate hedge"}, this is purpose-built for that.`,
      objections: [
        `"What's the correlation to equities? Does this actually diversify?"`,
        `"Show me the max drawdown. What's the worst 3-month period?"`,
        !sharpeAdvantage ? `"Their Sharpe is better. Why take less efficient risk?"` : "",
        `"How does this fit with my existing AGG + HYG allocation?"`,
      ].filter(Boolean),
      closingQuestion: "If you're building a fixed income sleeve that maximizes risk-adjusted income while minimizing correlation to your equity book — which fund is the better building block?",
    },
  ]

  const selected = personas.find(p => p.id === selectedPersona) || personas[0]

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 border-b px-3.5 py-3 text-left sm:gap-3 sm:px-5 sm:py-3.5"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
      >
        <Users size={16} style={{ color: "#0f3d6b", flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>
            Advisor Playbook
          </span>
          <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
            Adapt your pitch to the advisor{"'"}s style
          </span>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: "#94a3b8" }} /> : <ChevronRight size={14} style={{ color: "#94a3b8" }} />}
      </button>

      {expanded && (
        <div className="p-4 sm:p-5">
          {/* Persona selector */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {personas.map(p => (
              <button key={p.id} onClick={() => setSelectedPersona(p.id)}
                className="flex items-center gap-1.5 rounded border p-2 text-left text-[11px] font-semibold transition-colors"
                style={{
                  borderColor: selectedPersona === p.id ? "#0f3d6b" : "#e2e8f0",
                  backgroundColor: selectedPersona === p.id ? "#f0f7ff" : "#fff",
                  color: selectedPersona === p.id ? "#0f3d6b" : "#64748b",
                }}>
                {p.icon}
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>

          {/* Selected persona details */}
          <div className="space-y-4">
            <div className="rounded border p-3" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
              <div className="text-[11px] leading-relaxed" style={{ color: "#475569" }}>{selected.description}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.priorities.map(p => (
                  <span key={p} className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: "#ecfdf5", color: "#16a34a" }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Pitch angle */}
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Your Pitch Angle</div>
              <div className="rounded border-l-3 p-3 text-[12px] leading-relaxed" style={{ borderLeft: "3px solid #0f3d6b", backgroundColor: "#f0f7ff", color: "#334155" }}>
                {selected.pitchAngle}
              </div>
            </div>

            {/* Anticipated objections */}
            {selected.objections.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>They{"'"}ll Push Back On</div>
                {selected.objections.map((obj, i) => (
                  <div key={i} className="mb-1.5 rounded border-l-2 py-1.5 pl-2.5 text-[11px]" style={{ borderColor: "#f59e0b", backgroundColor: "#fffbeb", color: "#92400e" }}>
                    {obj}
                  </div>
                ))}
              </div>
            )}

            {/* Metrics that matter */}
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Metrics They Care About</div>
              <div className="flex flex-wrap gap-1.5">
                {selected.metrics.map(m => (
                  <span key={m} className="rounded border px-2 py-0.5 text-[10px] font-medium" style={{ borderColor: "#d1d5db", color: "#475569" }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Closing question */}
            <div className="rounded p-3" style={{ backgroundColor: "#0f3d6b" }}>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>Close With This Question</div>
              <div className="text-[12px] font-medium italic leading-relaxed" style={{ color: "#fff" }}>
                {"\u201C"}{selected.closingQuestion}{"\u201D"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
