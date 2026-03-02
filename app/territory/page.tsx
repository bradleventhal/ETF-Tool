"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Users, MapPin, Plane, Target, Building2, TrendingUp, ChevronDown, ChevronUp, Search } from "lucide-react"

/* ═══════════════════════ TYPES ═══════════════════════ */

interface TerritoryData {
  overview: {
    totalContacts: number
    totalMetros: number
    totalTrips: number
    totalPipeline: number
    totalClient: number
    totalWarm: number
    totalCold: number
    totalDrip: number
    totalUntagged: number
  }
  tripMetroMap: Record<string, Record<string, string[]>>
  tripStats: Record<string, { total: number; pipeline: number; client: number; warm: number; cold: number; drip: number; untagged: number; firmCount: number; metroCount: number }>
  metroStats: Record<string, { total: number; pipeline: number; client: number; warm: number; cold: number; trip: string; firmCount: number }>
  topFirms: { name: string; total: number; pipeline: number; client: number; warm: number; cold: number }[]
  topFirmsByAUM: { name: string; aum: number }[]
  taggedContacts: { id: string; firstName: string; lastName: string; firmName: string; city: string; state: string; metro: string; trip: string; email: string; pipeline: boolean; client: boolean; warm: boolean; cold: boolean }[]
}

/* ═══════════════════════ HELPERS ═══════════════════════ */

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function num(n: number): string {
  return n.toLocaleString()
}

type MetroSort = "total" | "pipeline" | "client" | "warm" | "cold" | "firmCount"
type TripSort = "total" | "pipeline" | "client" | "cold" | "firmCount"

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function TerritoryPage() {
  const [data, setData] = useState<TerritoryData | null>(null)
  const [metroSort, setMetroSort] = useState<MetroSort>("total")
  const [metroDir, setMetroDir] = useState<"desc" | "asc">("desc")
  const [tripSort, setTripSort] = useState<TripSort>("total")
  const [tripDir, setTripDir] = useState<"desc" | "asc">("desc")
  const [metroSearch, setMetroSearch] = useState("")
  const [tripSearch, setTripSearch] = useState("")
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "metros" | "trips" | "firms" | "pipeline">("overview")

  useEffect(() => {
    fetch("/data/territory.json")
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
  }, [])

  const sortedMetros = useMemo(() => {
    if (!data) return []
    return Object.entries(data.metroStats)
      .filter(([name]) => !metroSearch || name.toLowerCase().includes(metroSearch.toLowerCase()))
      .sort((a, b) => {
        const va = a[1][metroSort] as number
        const vb = b[1][metroSort] as number
        return metroDir === "desc" ? vb - va : va - vb
      })
  }, [data, metroSort, metroDir, metroSearch])

  const sortedTrips = useMemo(() => {
    if (!data) return []
    return Object.entries(data.tripStats)
      .filter(([name]) => name !== 'Unassigned' && (!tripSearch || name.toLowerCase().includes(tripSearch.toLowerCase())))
      .sort((a, b) => {
        const va = a[1][tripSort] as number
        const vb = b[1][tripSort] as number
        return tripDir === "desc" ? vb - va : va - vb
      })
  }, [data, tripSort, tripDir, tripSearch])

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
        <div className="text-sm" style={{ color: "#64748b" }}>Loading territory data...</div>
      </div>
    )
  }

  const o = data.overview

  function toggleMetroSort(col: MetroSort) {
    if (metroSort === col) setMetroDir(d => d === "desc" ? "asc" : "desc")
    else { setMetroSort(col); setMetroDir("desc") }
  }

  function toggleTripSort(col: TripSort) {
    if (tripSort === col) setTripDir(d => d === "desc" ? "asc" : "desc")
    else { setTripSort(col); setTripDir("desc") }
  }

  function SortIcon({ col, current, dir }: { col: string; current: string; dir: string }) {
    if (col !== current) return null
    return dir === "desc" ? <ChevronDown className="inline h-3 w-3" /> : <ChevronUp className="inline h-3 w-3" />
  }

  const statusBadge = (label: string, count: number, bg: string, text: string) => (
    <span key={label} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: bg, color: text }}>
      {label}: {num(count)}
    </span>
  )

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <header className="px-3 py-3 sm:px-6 sm:py-4" style={{ backgroundColor: "#0f3d6b" }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white sm:text-lg">Territory Intelligence</h1>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>East Coast IBD — {num(o.totalContacts)} contacts across {o.totalTrips} trips</p>
          </div>
          <Link href="/" className="flex min-h-[44px] items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors" style={{ color: "rgba(255,255,255,0.7)" }}>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fund Discovery</span>
          </Link>
        </div>
      </header>

      {/* Tab Nav */}
      <div className="border-b px-3 sm:px-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="mx-auto flex max-w-[1400px] gap-0 overflow-x-auto">
          {([["overview", "Overview"], ["metros", "Metros"], ["trips", "Trip Planner"], ["firms", "Firms & AUM"], ["pipeline", "Pipeline"]] as [typeof activeTab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="whitespace-nowrap border-b-2 px-4 py-3 text-xs font-medium transition-colors"
              style={{ borderColor: activeTab === key ? "#0f3d6b" : "transparent", color: activeTab === key ? "#0f3d6b" : "#64748b" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-[1400px] p-3 sm:p-6">

        {/* ════════ OVERVIEW TAB ════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {[
                { icon: Users, label: "Total Contacts", value: num(o.totalContacts), color: "#0f3d6b" },
                { icon: MapPin, label: "Metros", value: num(o.totalMetros), color: "#7c3aed" },
                { icon: Plane, label: "Trips", value: num(o.totalTrips), color: "#0891b2" },
                { icon: Target, label: "Pipeline", value: num(o.totalPipeline), color: "#dc2626" },
                { icon: Building2, label: "Clients", value: num(o.totalClient), color: "#15803d" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="rounded-xl border p-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg p-2" style={{ backgroundColor: `${color}10` }}>
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold" style={{ color: "#0f172a" }}>{value}</div>
                  <div className="text-[11px]" style={{ color: "#64748b" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Status Breakdown */}
            <div className="rounded-xl border p-4 sm:p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <h2 className="mb-4 text-sm font-semibold" style={{ color: "#0f172a" }}>Contact Status Breakdown</h2>
              <div className="flex flex-wrap gap-2">
                {statusBadge("Pipeline", o.totalPipeline, "#ede9fe", "#7c3aed")}
                {statusBadge("Client", o.totalClient, "#dcfce7", "#15803d")}
                {statusBadge("Warm", o.totalWarm, "#fef9c3", "#a16207")}
                {statusBadge("Cold", o.totalCold, "#dbeafe", "#1d4ed8")}
                {statusBadge("Drip", o.totalDrip, "#ffedd5", "#c2410c")}
                {statusBadge("Untagged", o.totalUntagged, "#f1f5f9", "#94a3b8")}
              </div>
              {/* Bar */}
              <div className="mt-4 flex h-6 w-full overflow-hidden rounded-full">
                {[
                  { count: o.totalPipeline, color: "#7c3aed" },
                  { count: o.totalClient, color: "#15803d" },
                  { count: o.totalWarm, color: "#eab308" },
                  { count: o.totalCold, color: "#3b82f6" },
                  { count: o.totalDrip, color: "#ea580c" },
                  { count: o.totalUntagged, color: "#cbd5e1" },
                ].map(({ count, color }, i) => (
                  <div key={i} style={{ width: `${(count / o.totalContacts) * 100}%`, backgroundColor: color, minWidth: count > 0 ? "2px" : 0 }} />
                ))}
              </div>
              <p className="mt-2 text-[11px]" style={{ color: "#94a3b8" }}>
                {((1 - o.totalUntagged / o.totalContacts) * 100).toFixed(1)}% of contacts have been tagged
              </p>
            </div>

            {/* Top Firms by AUM (quick preview) */}
            <div className="rounded-xl border p-4 sm:p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <h2 className="mb-4 text-sm font-semibold" style={{ color: "#0f172a" }}>Top 5 Firms by Angel Oak AUM (IBD East)</h2>
              <div className="space-y-2">
                {data.topFirmsByAUM.slice(0, 5).map((f, i) => (
                  <div key={f.name} className="flex items-center gap-3">
                    <span className="w-5 text-right text-[11px] font-medium" style={{ color: "#94a3b8" }}>{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: "#0f172a" }}>{f.name}</span>
                        <span className="text-xs font-bold" style={{ color: "#0f3d6b" }}>{fmt(f.aum)}</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                        <div className="h-2 rounded-full" style={{ backgroundColor: "#0f3d6b", width: `${(f.aum / data.topFirmsByAUM[0].aum) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setActiveTab("firms")} className="mt-3 text-[11px] font-medium" style={{ color: "#0f3d6b" }}>
                View all firms →
              </button>
            </div>
          </div>
        )}

        {/* ════════ METROS TAB ════════ */}
        {activeTab === "metros" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#94a3b8" }} />
              <input type="text" value={metroSearch} onChange={e => setMetroSearch(e.target.value)} placeholder="Search metros..."
                className="w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm" style={{ borderColor: "#e2e8f0" }} />
            </div>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "#0f172a" }}>Metro</th>
                    <th className="cursor-pointer px-3 py-3 text-right font-semibold" style={{ color: "#0f172a" }} onClick={() => toggleMetroSort("total")}>Contacts <SortIcon col="total" current={metroSort} dir={metroDir} /></th>
                    <th className="cursor-pointer px-3 py-3 text-right font-semibold" style={{ color: "#0f172a" }} onClick={() => toggleMetroSort("firmCount")}>Firms <SortIcon col="firmCount" current={metroSort} dir={metroDir} /></th>
                    <th className="cursor-pointer px-3 py-3 text-right font-semibold" style={{ color: "#7c3aed" }} onClick={() => toggleMetroSort("pipeline")}>Pipeline <SortIcon col="pipeline" current={metroSort} dir={metroDir} /></th>
                    <th className="cursor-pointer px-3 py-3 text-right font-semibold" style={{ color: "#15803d" }} onClick={() => toggleMetroSort("client")}>Client <SortIcon col="client" current={metroSort} dir={metroDir} /></th>
                    <th className="cursor-pointer px-3 py-3 text-right font-semibold" style={{ color: "#a16207" }} onClick={() => toggleMetroSort("warm")}>Warm <SortIcon col="warm" current={metroSort} dir={metroDir} /></th>
                    <th className="cursor-pointer px-3 py-3 text-right font-semibold" style={{ color: "#1d4ed8" }} onClick={() => toggleMetroSort("cold")}>Cold <SortIcon col="cold" current={metroSort} dir={metroDir} /></th>
                    <th className="px-3 py-3 text-left font-semibold" style={{ color: "#64748b" }}>Trip</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMetros.map(([name, s], i) => (
                    <tr key={name} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "#0f172a" }}>{name}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: "#0f172a" }}>{num(s.total)}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: "#64748b" }}>{s.firmCount}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: s.pipeline > 0 ? "#7c3aed" : "#cbd5e1" }}>{s.pipeline || "—"}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: s.client > 0 ? "#15803d" : "#cbd5e1" }}>{s.client || "—"}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: s.warm > 0 ? "#a16207" : "#cbd5e1" }}>{s.warm || "—"}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: s.cold > 0 ? "#1d4ed8" : "#cbd5e1" }}>{s.cold || "—"}</td>
                      <td className="px-3 py-2.5 text-[11px]" style={{ color: "#64748b" }}>{s.trip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px]" style={{ color: "#94a3b8" }}>Showing {sortedMetros.length} of {Object.keys(data.metroStats).length} metros</p>
          </div>
        )}

        {/* ════════ TRIPS TAB ════════ */}
        {activeTab === "trips" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#94a3b8" }} />
              <input type="text" value={tripSearch} onChange={e => setTripSearch(e.target.value)} placeholder="Search trips..."
                className="w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm" style={{ borderColor: "#e2e8f0" }} />
            </div>
            <div className="space-y-3">
              {sortedTrips.map(([name, s]) => {
                const isExpanded = expandedTrip === name
                const metros = data.tripMetroMap[name] || {}
                return (
                  <div key={name} className="overflow-hidden rounded-xl border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                    <button onClick={() => setExpandedTrip(isExpanded ? null : name)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                      <div>
                        <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>{name}</span>
                        <span className="ml-2 text-[11px]" style={{ color: "#64748b" }}>{s.metroCount} metros · {s.firmCount} firms</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold" style={{ color: "#0f3d6b" }}>{num(s.total)}</span>
                        <div className="flex gap-1">
                          {s.pipeline > 0 && statusBadge("P", s.pipeline, "#ede9fe", "#7c3aed")}
                          {s.client > 0 && statusBadge("C", s.client, "#dcfce7", "#15803d")}
                          {s.warm > 0 && statusBadge("W", s.warm, "#fef9c3", "#a16207")}
                          {s.cold > 0 && statusBadge("❄", s.cold, "#dbeafe", "#1d4ed8")}
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" style={{ color: "#94a3b8" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "#94a3b8" }} />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t px-4 py-3" style={{ borderColor: "#f1f5f9", backgroundColor: "#f8fafc" }}>
                        <div className="text-[11px] font-semibold mb-2" style={{ color: "#64748b" }}>METROS IN THIS TRIP</div>
                        <div className="space-y-1.5">
                          {Object.entries(metros).map(([metro, cities]) => {
                            const ms = data.metroStats[metro]
                            return (
                              <div key={metro} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#fff" }}>
                                <div>
                                  <span className="text-xs font-medium" style={{ color: "#0f172a" }}>{metro}</span>
                                  <span className="ml-2 text-[10px]" style={{ color: "#94a3b8" }}>{(cities as string[]).length} cities</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium" style={{ color: "#0f3d6b" }}>{ms ? num(ms.total) : "—"}</span>
                                  {ms && ms.client > 0 && <span className="text-[10px]" style={{ color: "#15803d" }}>{ms.client}C</span>}
                                  {ms && ms.pipeline > 0 && <span className="text-[10px]" style={{ color: "#7c3aed" }}>{ms.pipeline}P</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {/* Tagged contacts in this trip */}
                        {data.taggedContacts.filter(c => c.trip === name).length > 0 && (
                          <div className="mt-3">
                            <div className="text-[11px] font-semibold mb-1.5" style={{ color: "#64748b" }}>TAGGED CONTACTS</div>
                            <div className="space-y-1">
                              {data.taggedContacts.filter(c => c.trip === name).slice(0, 20).map(c => (
                                <div key={c.id} className="flex items-center justify-between rounded px-3 py-1.5 text-[11px]" style={{ backgroundColor: "#fff" }}>
                                  <span style={{ color: "#0f172a" }}>{c.firstName} {c.lastName} — <span style={{ color: "#64748b" }}>{c.firmName}</span></span>
                                  <div className="flex gap-1">
                                    {c.pipeline && <span className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: "#ede9fe", color: "#7c3aed" }}>Pipeline</span>}
                                    {c.client && <span className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: "#dcfce7", color: "#15803d" }}>Client</span>}
                                    {c.warm && <span className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: "#fef9c3", color: "#a16207" }}>Warm</span>}
                                    {c.cold && <span className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>Cold</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════════ FIRMS TAB ════════ */}
        {activeTab === "firms" && (
          <div className="space-y-6">
            {/* AUM Table */}
            <div className="rounded-xl border p-4 sm:p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: "#0f3d6b" }} />
                <h2 className="text-sm font-semibold" style={{ color: "#0f172a" }}>Angel Oak AUM by Firm (IBD East — ~$214M Total)</h2>
              </div>
              <p className="mb-4 text-[11px]" style={{ color: "#94a3b8" }}>Source: Dec IBD AUM report</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>#</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#0f172a" }}>Firm</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: "#0f172a" }}>AUM</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: "#64748b" }}>% of Total</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topFirmsByAUM.map((f, i) => {
                      const totalAUM = 214000000
                      const pct = (f.aum / totalAUM) * 100
                      return (
                        <tr key={f.name} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                          <td className="px-3 py-2.5" style={{ color: "#94a3b8" }}>{i + 1}</td>
                          <td className="px-3 py-2.5 font-medium" style={{ color: "#0f172a" }}>{f.name}</td>
                          <td className="px-3 py-2.5 text-right font-bold" style={{ color: "#0f3d6b" }}>{fmt(f.aum)}</td>
                          <td className="px-3 py-2.5 text-right" style={{ color: "#64748b" }}>{pct.toFixed(1)}%</td>
                          <td className="px-3 py-2.5 w-32">
                            <div className="h-2 w-full rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                              <div className="h-2 rounded-full" style={{ backgroundColor: i < 3 ? "#0f3d6b" : i < 6 ? "#3b82f6" : "#93c5fd", width: `${(f.aum / data.topFirmsByAUM[0].aum) * 100}%` }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Firms by Contact Count */}
            <div className="rounded-xl border p-4 sm:p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <h2 className="mb-4 text-sm font-semibold" style={{ color: "#0f172a" }}>Top Firms by Contact Count</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#0f172a" }}>Firm</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: "#0f172a" }}>Contacts</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: "#7c3aed" }}>Pipeline</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: "#15803d" }}>Client</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: "#a16207" }}>Warm</th>
                      <th className="px-3 py-2 text-right font-semibold" style={{ color: "#1d4ed8" }}>Cold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topFirms.map((f, i) => (
                      <tr key={f.name} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                        <td className="px-3 py-2.5 font-medium" style={{ color: "#0f172a" }}>{f.name}</td>
                        <td className="px-3 py-2.5 text-right font-bold" style={{ color: "#0f3d6b" }}>{num(f.total)}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color: f.pipeline > 0 ? "#7c3aed" : "#cbd5e1" }}>{f.pipeline || "—"}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color: f.client > 0 ? "#15803d" : "#cbd5e1" }}>{f.client || "—"}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color: f.warm > 0 ? "#a16207" : "#cbd5e1" }}>{f.warm || "—"}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color: f.cold > 0 ? "#1d4ed8" : "#cbd5e1" }}>{f.cold || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════ PIPELINE TAB ════════ */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "Pipeline", count: o.totalPipeline, bg: "#ede9fe", color: "#7c3aed" },
                { label: "Client", count: o.totalClient, bg: "#dcfce7", color: "#15803d" },
                { label: "Warm", count: o.totalWarm, bg: "#fef9c3", color: "#a16207" },
                { label: "Cold", count: o.totalCold, bg: "#dbeafe", color: "#1d4ed8" },
                { label: "Untagged", count: o.totalUntagged, bg: "#f1f5f9", color: "#94a3b8" },
              ].map(({ label, count, bg, color }) => (
                <div key={label} className="rounded-xl border p-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                  <div className="text-2xl font-bold" style={{ color }}>{num(count)}</div>
                  <div className="text-[11px]" style={{ color: "#64748b" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Tagged contacts list */}
            <div className="rounded-xl border p-4 sm:p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <h2 className="mb-4 text-sm font-semibold" style={{ color: "#0f172a" }}>All Tagged Contacts ({data.taggedContacts.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#0f172a" }}>Name</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#0f172a" }}>Firm</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>Metro</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>Trip</th>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: "#64748b" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.taggedContacts.map((c, i) => (
                      <tr key={c.id} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                        <td className="px-3 py-2 font-medium" style={{ color: "#0f172a" }}>{c.firstName} {c.lastName}</td>
                        <td className="px-3 py-2" style={{ color: "#64748b" }}>{c.firmName}</td>
                        <td className="px-3 py-2" style={{ color: "#64748b" }}>{c.metro}</td>
                        <td className="px-3 py-2" style={{ color: "#64748b" }}>{c.trip}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {c.pipeline && <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "#ede9fe", color: "#7c3aed" }}>Pipeline</span>}
                            {c.client && <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "#dcfce7", color: "#15803d" }}>Client</span>}
                            {c.warm && <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "#fef9c3", color: "#a16207" }}>Warm</span>}
                            {c.cold && <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>Cold</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
