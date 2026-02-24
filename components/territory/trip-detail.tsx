"use client"

import { useMemo } from "react"
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Percent } from "lucide-react"
import type { TerritoryContact, BroadridgeOffice, TripSummary } from "@/lib/territory-types"
import { getContactStatus, STATUS_ORDER } from "@/lib/territory-types"
import { ContactRow } from "./contact-row"
import { IntelligenceSignals } from "./intelligence-signals"

function fmt$(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function StatCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ backgroundColor: "#fff", borderColor: "#e2e8f0" }}>
      <div className="flex items-center gap-2">
        <span style={{ color }} className="shrink-0">{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#94a3b8" }}>{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold" style={{ color: "#0f172a" }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: "#94a3b8" }}>{sub}</p>}
    </div>
  )
}

export function TripDetail({
  trip,
  contacts,
  offices,
  onSelectContact,
}: {
  trip: TripSummary
  contacts: TerritoryContact[]
  offices: BroadridgeOffice[]
  onSelectContact?: (id: string) => void
}) {
  const sortedContacts = useMemo(() =>
    [...contacts].sort((a, b) => STATUS_ORDER[getContactStatus(a)] - STATUS_ORDER[getContactStatus(b)]),
    [contacts]
  )

  const regularOffices = useMemo(() => offices.filter((o) => !o.isFidelityClearing), [offices])
  const fidelityOffices = useMemo(() => offices.filter((o) => o.isFidelityClearing), [offices])

  // Aggregate offices by firm+address for display
  const officeGroups = useMemo(() => {
    const map = new Map<string, { firmName: string; address: string; city: string; state: string; totalAum: number; monthlyNet: number; products: string[]; isFidelity: boolean }>()
    for (const o of offices) {
      const key = `${o.firmName}|${o.address}|${o.city}`
      const existing = map.get(key)
      if (existing) {
        existing.totalAum += o.assetBalance
        existing.monthlyNet += o.monthlyNet
        if (!existing.products.includes(o.product)) existing.products.push(o.product)
      } else {
        map.set(key, {
          firmName: o.firmName,
          address: o.address,
          city: o.city || `${o.state} -- Fidelity Clearing`,
          state: o.state,
          totalAum: o.assetBalance,
          monthlyNet: o.monthlyNet,
          products: [o.product],
          isFidelity: o.isFidelityClearing,
        })
      }
    }
    const groups = Array.from(map.values())
    return {
      regular: groups.filter((g) => !g.isFidelity).sort((a, b) => b.totalAum - a.totalAum),
      fidelity: groups.filter((g) => g.isFidelity).sort((a, b) => b.totalAum - a.totalAum),
    }
  }, [offices])

  const netFlowColor = trip.monthlyNet > 0 ? "#22c55e" : trip.monthlyNet < 0 ? "#ef4444" : "#94a3b8"

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: trip.rep === "Brad" ? "#3b82f6" : "#22c55e" }}
          />
          <h2 className="text-lg font-bold" style={{ color: "#0f172a" }}>{trip.tripName}</h2>
          <span className="text-xs" style={{ color: "#94a3b8" }}>{trip.rep === "Brad" ? "East" : "West"}</span>
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "#64748b" }}>{trip.metros.join(" / ")}</p>
      </div>

      {/* Section 1: Trip Overview */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="AO AUM"
          value={trip.totalOfficeAum > 0 ? fmt$(trip.totalOfficeAum) : "--"}
          sub="Broadridge total"
          icon={<DollarSign className="h-4 w-4" />}
          color="#0f3d6b"
        />
        <StatCard
          label="Monthly Net"
          value={trip.monthlyNet !== 0 ? `${trip.monthlyNet > 0 ? "+" : ""}${fmt$(trip.monthlyNet)}` : "--"}
          sub={trip.monthlyNet > 0 ? "Net inflows" : trip.monthlyNet < 0 ? "Net redemptions" : "No flow data"}
          icon={trip.monthlyNet >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          color={netFlowColor}
        />
        <StatCard
          label="Market Size"
          value={trip.industryAum > 0 ? fmt$(trip.industryAum) : "--"}
          sub="Industry assets"
          icon={<BarChart3 className="h-4 w-4" />}
          color="#64748b"
        />
        <StatCard
          label="Penetration"
          value={trip.penetration > 0 ? `${(trip.penetration * 100).toFixed(2)}%` : "--"}
          sub="AO / Industry"
          icon={<Percent className="h-4 w-4" />}
          color={trip.penetration > 0.001 ? "#22c55e" : "#eab308"}
        />
      </div>

      {/* Section 2: Peer Group Opportunity */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>
          Peer Group Opportunity
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-3" style={{ backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }}>
            <p className="text-[10px] font-medium" style={{ color: "#3b82f6" }}>Ultrashort Peer</p>
            <p className="text-sm font-bold" style={{ color: "#1e40af" }}>{fmt$(trip.ultrashortPeerAum)}</p>
            <p className="text-[9px]" style={{ color: "#60a5fa" }}>UYLD + AOUIX space</p>
          </div>
          <div className="rounded-lg border p-3" style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <p className="text-[10px] font-medium" style={{ color: "#22c55e" }}>Income / Core</p>
            <p className="text-sm font-bold" style={{ color: "#166534" }}>{fmt$(trip.incomeCorePeerAum)}</p>
            <p className="text-[9px]" style={{ color: "#4ade80" }}>ANGIX, CARY, MBS</p>
          </div>
          <div className="rounded-lg border p-3" style={{ backgroundColor: "#fef2f2", borderColor: "#fecaca" }}>
            <p className="text-[10px] font-medium" style={{ color: "#ef4444" }}>High Yield</p>
            <p className="text-sm font-bold" style={{ color: "#991b1b" }}>{fmt$(trip.hyPeerAum)}</p>
            <p className="text-[9px]" style={{ color: "#f87171" }}>AOHY, ASCIX space</p>
          </div>
        </div>
      </div>

      {/* Section 3: Intelligence Signals */}
      <IntelligenceSignals trip={trip} />

      {/* Section 4: Contacts Table */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>
            Contacts ({sortedContacts.length})
          </h3>
          <span className="text-[10px]" style={{ color: "#94a3b8" }}>
            {contacts.filter((c) => c.client).length} clients, {contacts.filter((c) => c.pipeline).length} pipeline, {contacts.filter((c) => c.warm).length} warm
          </span>
        </div>

        {/* Table header */}
        <div className="flex items-center gap-2 border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider sm:gap-3 sm:px-4"
          style={{ color: "#94a3b8", borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
        >
          <span className="w-3" />
          <span className="min-w-[120px] sm:min-w-[160px]">Name</span>
          <span className="hidden sm:block sm:min-w-[140px]">Firm</span>
          <span className="hidden md:block md:min-w-[90px]">City</span>
          <span className="hidden lg:block lg:min-w-[120px]">Title</span>
          <span className="min-w-[60px]">Status</span>
          <span className="ml-auto min-w-[60px] text-right">AO AUM</span>
          <span className="hidden min-w-[80px] sm:block">Strategies</span>
          <span className="w-7" />
        </div>

        {/* Rows */}
        <div className="rounded-b-lg border" style={{ borderColor: "#e2e8f0" }}>
          {sortedContacts.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <p className="text-xs" style={{ color: "#94a3b8" }}>No contacts for this trip.</p>
            </div>
          ) : (
            sortedContacts.map((c) => <ContactRow key={c.id} contact={c} />)
          )}
        </div>
      </div>

      {/* Section 5: AO Offices in Trip */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#475569" }}>
          Angel Oak Offices ({officeGroups.regular.length + officeGroups.fidelity.length})
        </h3>

        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "#e2e8f0" }}>
          {/* Header */}
          <div className="flex items-center gap-3 border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider sm:px-4"
            style={{ color: "#94a3b8", borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
          >
            <span className="min-w-[140px]">Firm</span>
            <span className="hidden min-w-[160px] sm:block">Address</span>
            <span className="min-w-[80px]">City</span>
            <span className="min-w-[70px] text-right">AO AUM</span>
            <span className="min-w-[80px] text-right">Monthly Net</span>
            <span className="hidden min-w-[90px] md:block">Products</span>
            <span className="min-w-[60px] text-right">Status</span>
          </div>

          {/* Regular offices */}
          {officeGroups.regular.map((o, i) => {
            const flowStatus = o.monthlyNet > 50_000 ? "Growing" : o.monthlyNet < -50_000 ? "Declining" : "Flat"
            const flowColor = flowStatus === "Growing" ? "#22c55e" : flowStatus === "Declining" ? "#ef4444" : "#94a3b8"
            return (
              <div key={i} className="flex items-center gap-3 border-b px-3 py-2 text-[11px] sm:px-4" style={{ borderColor: "#f1f5f9" }}>
                <span className="min-w-[140px] truncate font-medium" style={{ color: "#0f172a" }}>{o.firmName}</span>
                <span className="hidden min-w-[160px] truncate sm:block" style={{ color: "#94a3b8" }}>{o.address}</span>
                <span className="min-w-[80px] truncate" style={{ color: "#64748b" }}>{o.city}</span>
                <span className="min-w-[70px] text-right font-mono" style={{ color: "#0f3d6b" }}>{fmt$(o.totalAum)}</span>
                <span className="min-w-[80px] text-right font-mono" style={{ color: o.monthlyNet > 0 ? "#22c55e" : o.monthlyNet < 0 ? "#ef4444" : "#94a3b8" }}>
                  {o.monthlyNet > 0 ? "+" : ""}{fmt$(o.monthlyNet)}
                </span>
                <span className="hidden min-w-[90px] truncate text-[10px] md:block" style={{ color: "#94a3b8" }}>{o.products.join(", ")}</span>
                <span className="min-w-[60px] text-right text-[10px] font-medium" style={{ color: flowColor }}>{flowStatus}</span>
              </div>
            )
          })}

          {/* Fidelity Clearing offices */}
          {officeGroups.fidelity.length > 0 && (
            <>
              <div className="border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider sm:px-4"
                style={{ backgroundColor: "#fef9c3", borderColor: "#fde68a", color: "#a16207" }}
              >
                Fidelity Clearing (State-Level Only)
              </div>
              {officeGroups.fidelity.map((o, i) => {
                const flowStatus = o.monthlyNet > 50_000 ? "Growing" : o.monthlyNet < -50_000 ? "Declining" : "Flat"
                const flowColor = flowStatus === "Growing" ? "#22c55e" : flowStatus === "Declining" ? "#ef4444" : "#94a3b8"
                return (
                  <div key={`fid-${i}`} className="flex items-center gap-3 border-b px-3 py-2 text-[11px] sm:px-4" style={{ borderColor: "#f1f5f9" }}>
                    <span className="min-w-[140px] truncate font-medium" style={{ color: "#0f172a" }}>{o.firmName}</span>
                    <span className="hidden min-w-[160px] truncate sm:block" style={{ color: "#94a3b8" }}>{o.address}</span>
                    <span className="min-w-[80px] truncate" style={{ color: "#a16207" }}>{o.city}</span>
                    <span className="min-w-[70px] text-right font-mono" style={{ color: "#0f3d6b" }}>{fmt$(o.totalAum)}</span>
                    <span className="min-w-[80px] text-right font-mono" style={{ color: o.monthlyNet > 0 ? "#22c55e" : o.monthlyNet < 0 ? "#ef4444" : "#94a3b8" }}>
                      {o.monthlyNet > 0 ? "+" : ""}{fmt$(o.monthlyNet)}
                    </span>
                    <span className="hidden min-w-[90px] truncate text-[10px] md:block" style={{ color: "#94a3b8" }}>{o.products.join(", ")}</span>
                    <span className="min-w-[60px] text-right text-[10px] font-medium" style={{ color: flowColor }}>{flowStatus}</span>
                  </div>
                )
              })}
            </>
          )}

          {officeGroups.regular.length === 0 && officeGroups.fidelity.length === 0 && (
            <div className="flex h-16 items-center justify-center">
              <p className="text-xs" style={{ color: "#94a3b8" }}>No AO offices in this trip.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
