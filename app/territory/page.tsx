"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import territoryData from "../../public/data/territory.json"
import { ArrowLeft, Search, Users, MapPin, Building, Compass, Mail } from "lucide-react"

const { overview, tripMetroMap, tripStats, metroStats, topFirms, topFirmsByAUM, taggedContacts } = territoryData as any

export default function TerritoryPage() {
  const [search, setSearch] = useState("")
  const [filterTrip, setFilterTrip] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [tab, setTab] = useState<"advisors" | "firms" | "trips">("advisors")

  const trips = Object.keys(tripStats || {}).sort()

  const filtered = useMemo(() => {
    if (!taggedContacts) return []
    return (taggedContacts as any[]).filter((a) => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        (a.firmName || "").toLowerCase().includes(q) ||
        (a.city || "").toLowerCase().includes(q) ||
        (a.metro || "").toLowerCase().includes(q)
      const matchTrip = !filterTrip || a.trip === filterTrip
      const matchStatus = !filterStatus ||
        (filterStatus === "pipeline" && a.pipeline) ||
        (filterStatus === "client" && a.client) ||
        (filterStatus === "warm" && a.warm) ||
        (filterStatus === "cold" && a.cold)
      return matchSearch && matchTrip && matchStatus
    })
  }, [search, filterTrip, filterStatus])

  const statusBadge = (label: string, color: string, bg: string) => (
    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color, backgroundColor: bg }}>
      {label}
    </span>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      {/* Header — matches main ETF Tool */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: "#0f3d6b", borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-white/70 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-white sm:text-lg">Territory Intelligence</h1>
              <p className="text-[11px] text-white/50">East Coast IBD — {overview?.totalContacts?.toLocaleString() || 0} contacts</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:text-white">
            <Compass className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fund Tools</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        {/* Stats Row */}
        <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {[
            { label: "Contacts", value: overview?.totalContacts?.toLocaleString(), icon: Users, color: "#0f3d6b" },
            { label: "Metros", value: overview?.totalMetros, icon: MapPin, color: "#6366f1" },
            { label: "Trips", value: overview?.totalTrips, icon: Compass, color: "#0891b2" },
            { label: "Pipeline", value: overview?.totalPipeline?.toLocaleString(), icon: Building, color: "#16a34a" },
            { label: "Clients", value: overview?.totalClient?.toLocaleString(), icon: Building, color: "#d97706" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-white p-3 shadow-sm" style={{ borderColor: "#e2e8f0" }}>
              <div className="flex items-center gap-1.5">
                <s.icon className="h-3 w-3" style={{ color: s.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>{s.label}</span>
              </div>
              <div className="mt-1 text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border bg-white p-1 shadow-sm" style={{ borderColor: "#e2e8f0" }}>
          {(["advisors", "firms", "trips"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: tab === t ? "#0f3d6b" : "transparent",
                color: tab === t ? "#fff" : "#64748b",
              }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Advisors Tab */}
        {tab === "advisors" && (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#94a3b8" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, firm, city, metro..."
                  className="w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: "#e2e8f0", color: "#334155" }} />
              </div>
              <select value={filterTrip} onChange={(e) => setFilterTrip(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm"
                style={{ borderColor: "#e2e8f0", color: "#334155" }}>
                <option value="">All Trips</option>
                {trips.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm"
                style={{ borderColor: "#e2e8f0", color: "#334155" }}>
                <option value="">All Status</option>
                <option value="pipeline">Pipeline</option>
                <option value="client">Client</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            </div>

            <p className="mb-2 text-xs font-medium" style={{ color: "#94a3b8" }}>{filtered.length} advisors</p>

            <div className="space-y-2">
              {filtered.slice(0, 100).map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors hover:border-blue-200"
                  style={{ borderColor: "#e2e8f0" }}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: "#0f172a" }}>{a.firstName} {a.lastName}</div>
                    <div className="truncate text-xs" style={{ color: "#64748b" }}>{a.firmName}</div>
                    <div className="text-[11px]" style={{ color: "#94a3b8" }}>{a.city}, {a.state} · {a.metro}</div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {a.pipeline && statusBadge("Pipeline", "#16a34a", "#dcfce7")}
                    {a.client && statusBadge("Client", "#0f3d6b", "#dbeafe")}
                    {a.warm && statusBadge("Warm", "#d97706", "#fef3c7")}
                    {a.cold && statusBadge("Cold", "#64748b", "#f1f5f9")}
                    {a.email && (
                      <a href={`mailto:${a.email}`} className="ml-1 rounded-full p-1.5 transition-colors hover:bg-blue-50" title={a.email}>
                        <Mail className="h-3.5 w-3.5" style={{ color: "#0f3d6b" }} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length > 100 && (
                <p className="py-3 text-center text-xs" style={{ color: "#94a3b8" }}>Showing 100 of {filtered.length} — narrow your search</p>
              )}
            </div>
          </>
        )}

        {/* Firms Tab */}
        {tab === "firms" && (
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Top 30 Firms by Contacts</h2>
              <div className="space-y-1.5">
                {(topFirms || []).map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm" style={{ borderColor: "#e2e8f0" }}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-right text-xs font-bold" style={{ color: "#94a3b8" }}>{i + 1}</span>
                      <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>{f.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span style={{ color: "#64748b" }}>{f.total} contacts</span>
                      {f.pipeline > 0 && <span style={{ color: "#16a34a" }}>{f.pipeline} pipeline</span>}
                      {f.client > 0 && <span style={{ color: "#0f3d6b" }}>{f.client} clients</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Top 20 Firms by AUM</h2>
              <div className="space-y-1.5">
                {(topFirmsByAUM || []).map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm" style={{ borderColor: "#e2e8f0" }}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-right text-xs font-bold" style={{ color: "#94a3b8" }}>{i + 1}</span>
                      <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>{f.name}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: "#d97706" }}>${(f.aum / 1e6).toFixed(1)}M</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Trips Tab */}
        {tab === "trips" && (
          <div className="space-y-2">
            {trips.map((trip) => {
              const s = (tripStats as any)[trip] || {}
              const metros = (tripMetroMap as any)?.[trip] || []
              return (
                <div key={trip} className="rounded-lg border bg-white px-4 py-3 shadow-sm" style={{ borderColor: "#e2e8f0" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: "#0f172a" }}>{trip}</span>
                    <span className="text-sm font-bold" style={{ color: "#0f3d6b" }}>{s.total || 0}</span>
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "#94a3b8" }}>
                    {metros.join(", ") || "N/A"}
                  </div>
                  <div className="mt-1.5 flex gap-3 text-[11px]">
                    {s.pipeline > 0 && <span style={{ color: "#16a34a" }}>{s.pipeline} pipeline</span>}
                    {s.client > 0 && <span style={{ color: "#0f3d6b" }}>{s.client} clients</span>}
                    {s.warm > 0 && <span style={{ color: "#d97706" }}>{s.warm} warm</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
