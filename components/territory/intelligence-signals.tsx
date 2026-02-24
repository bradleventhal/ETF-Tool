"use client"

import { useState } from "react"
import { Settings, AlertTriangle, TrendingUp, Target, Users, MapPin } from "lucide-react"
import type { TripSummary, SignalThresholds } from "@/lib/territory-types"
import { DEFAULT_THRESHOLDS } from "@/lib/territory-types"

function fmt$(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

interface Signal {
  icon: React.ReactNode
  text: string
  type: "warning" | "positive" | "info" | "neutral"
}

function generateSignals(trip: TripSummary, th: SignalThresholds): Signal[] {
  const signals: Signal[] = []

  // Large ultrashort peer AUM with no AO presence
  if (trip.ultrashortPeerAum > th.ultrashortPeerMin && trip.totalOfficeAum === 0) {
    signals.push({
      icon: <Target className="h-3.5 w-3.5" />,
      text: `No AO presence -- ${fmt$(trip.ultrashortPeerAum)} ultrashort peer opportunity`,
      type: "info",
    })
  }

  // Redemption pressure
  if (trip.monthlyNet < th.redemptionPressure) {
    signals.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      text: `Redemption pressure -- ${fmt$(Math.abs(trip.monthlyNet))} leaving this trip`,
      type: "warning",
    })
  }

  // Strong inflows
  if (trip.monthlyNet > th.strongInflows) {
    signals.push({
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      text: `Strong inflows -- ${fmt$(trip.monthlyNet)} growing book`,
      type: "positive",
    })
  }

  // Large untapped market
  if (trip.penetration < th.penetrationMax && trip.industryAum > th.marketMin) {
    signals.push({
      icon: <Target className="h-3.5 w-3.5" />,
      text: `Large untapped market -- ${fmt$(trip.industryAum)} industry AUM, only ${(trip.penetration * 100).toFixed(2)}% penetration`,
      type: "info",
    })
  }

  // Clients with warm re-engagement opportunity
  if (trip.clients > 0) {
    signals.push({
      icon: <Users className="h-3.5 w-3.5" />,
      text: `${trip.clients} existing client${trip.clients > 1 ? "s" : ""} -- warm re-engagement opportunity`,
      type: "positive",
    })
  }

  // Next time contacts flagged
  if (trip.nextTime > 0) {
    signals.push({
      icon: <MapPin className="h-3.5 w-3.5" />,
      text: `${trip.nextTime} contact${trip.nextTime > 1 ? "s" : ""} flagged for next visit`,
      type: "neutral",
    })
  }

  return signals
}

const SIGNAL_COLORS: Record<Signal["type"], { bg: string; border: string; text: string; icon: string }> = {
  warning:  { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", icon: "#dc2626" },
  positive: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", icon: "#22c55e" },
  info:     { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", icon: "#3b82f6" },
  neutral:  { bg: "#f8fafc", border: "#e2e8f0", text: "#475569", icon: "#64748b" },
}

export function IntelligenceSignals({ trip }: { trip: TripSummary }) {
  const [thresholds, setThresholds] = useState<SignalThresholds>(DEFAULT_THRESHOLDS)
  const [showSettings, setShowSettings] = useState(false)
  const signals = generateSignals(trip, thresholds)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>
          Intelligence Signals
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex h-7 w-7 items-center justify-center rounded transition-colors"
          style={{ color: showSettings ? "#0f3d6b" : "#94a3b8" }}
          title="Configure thresholds"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Threshold editor */}
      {showSettings && (
        <div className="mt-2 rounded-lg border p-3" style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: "#94a3b8" }}>Signal Thresholds</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {([
              { key: "ultrashortPeerMin" as const, label: "Ultrashort Peer Min", prefix: "$" },
              { key: "redemptionPressure" as const, label: "Redemption Alert", prefix: "$" },
              { key: "strongInflows" as const, label: "Strong Inflows", prefix: "$" },
              { key: "marketMin" as const, label: "Market Size Min", prefix: "$" },
              { key: "penetrationMax" as const, label: "Penetration Max %", prefix: "" },
            ]).map(({ key, label, prefix }) => (
              <div key={key} className="flex flex-col gap-0.5">
                <label style={{ color: "#64748b" }}>{label}</label>
                <input
                  type="text"
                  value={key === "penetrationMax" ? (thresholds[key] * 100).toFixed(1) : fmt$(thresholds[key]).replace("$", "")}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.\-]/g, "")
                    const num = parseFloat(raw)
                    if (isNaN(num)) return
                    const val = key === "penetrationMax" ? num / 100
                      : raw.includes("B") ? num * 1_000_000_000
                      : raw.includes("M") ? num * 1_000_000
                      : raw.includes("K") ? num * 1_000
                      : num
                    setThresholds((prev) => ({ ...prev, [key]: val }))
                  }}
                  className="rounded border px-2 py-1 text-[11px]"
                  style={{ borderColor: "#e2e8f0", color: "#0f172a", backgroundColor: "#fff" }}
                />
                {prefix && <span className="text-[9px]" style={{ color: "#94a3b8" }}>Enter in raw dollars</span>}
              </div>
            ))}
          </div>
          <button
            onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
            className="mt-2 text-[10px] font-medium"
            style={{ color: "#0f3d6b" }}
          >
            Reset to defaults
          </button>
        </div>
      )}

      {/* Signal bullets */}
      <div className="mt-2 flex flex-col gap-1.5">
        {signals.length === 0 ? (
          <p className="text-[11px] italic" style={{ color: "#94a3b8" }}>No notable signals for this trip.</p>
        ) : (
          signals.map((s, i) => {
            const c = SIGNAL_COLORS[s.type]
            return (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border px-3 py-2"
                style={{ backgroundColor: c.bg, borderColor: c.border }}
              >
                <span style={{ color: c.icon }} className="mt-0.5 shrink-0">{s.icon}</span>
                <span className="text-[11px] leading-snug" style={{ color: c.text }}>{s.text}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
