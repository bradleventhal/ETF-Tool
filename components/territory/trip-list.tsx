"use client"

import type { TripSummary } from "@/lib/territory-types"

function fmt$(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function TripList({
  trips,
  selectedTrip,
  onSelect,
}: {
  trips: TripSummary[]
  selectedTrip: string | null
  onSelect: (tripName: string) => void
}) {
  if (trips.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center px-4">
        <p className="text-sm" style={{ color: "#94a3b8" }}>No trips match your filters.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-2">
      {trips.map((t) => {
        const isSelected = selectedTrip === t.tripName
        const badge = t.hasClients
          ? { label: "Has Clients", bg: "#dcfce7", text: "#15803d" }
          : t.hasPipeline
          ? { label: "Pipeline", bg: "#ede9fe", text: "#7c3aed" }
          : t.hasWarm
          ? { label: "Warm Prospects", bg: "#fef9c3", text: "#a16207" }
          : { label: "Cold", bg: "#f1f5f9", text: "#64748b" }

        return (
          <button
            key={t.tripName}
            onClick={() => onSelect(t.tripName)}
            className="w-full rounded-lg border p-3 text-left transition-all"
            style={{
              backgroundColor: isSelected ? "#f0f7ff" : "#fff",
              borderColor: isSelected ? "#0f3d6b" : "#e2e8f0",
              boxShadow: isSelected ? "0 0 0 1px #0f3d6b" : undefined,
            }}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: t.rep === "Brad" ? "#3b82f6" : "#22c55e" }}
                  title={t.rep === "Brad" ? "Brad (East)" : "Bernie (West)"}
                />
                <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>
                  {t.tripName}
                </span>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: badge.bg, color: badge.text }}
              >
                {badge.label}
              </span>
            </div>

            {/* Metros */}
            <p className="mt-1 text-[11px] leading-snug" style={{ color: "#94a3b8" }}>
              {t.metros.join(" / ")}
            </p>

            {/* Stats row */}
            <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: "#64748b" }}>
              <span>{t.totalContacts} contacts</span>
              <span style={{ color: "#e2e8f0" }}>|</span>
              <span style={{ color: t.totalAoAum > 0 ? "#0f3d6b" : "#94a3b8", fontWeight: t.totalAoAum > 0 ? 600 : 400 }}>
                AO: {t.totalAoAum > 0 ? fmt$(t.totalAoAum * 1_000_000) : "--"}
              </span>
              <span style={{ color: "#e2e8f0" }}>|</span>
              <span>Peer: {fmt$(t.ultrashortPeerAum)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
