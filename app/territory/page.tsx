"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { Search, ArrowLeft, SortAsc } from "lucide-react"
import type { TripSummary } from "@/lib/territory-types"
import { TRIP_METRO_MAP, MOCK_CONTACTS, MOCK_OFFICES, MOCK_PEER_DATA, MOCK_INDUSTRY_AUM } from "@/lib/territory-mock-data"
import { TripList } from "@/components/territory/trip-list"
import { TripDetail } from "@/components/territory/trip-detail"

/* ═══════════════════════ EAST / WEST TRIP LISTS ═══════════════════════ */

const EAST_TRIPS = new Set(["NYC", "Boston", "Philly", "DC", "Pitt-Cle", "Indi/Cincy/Columbus", "Charlotte", "Atlanta", "Miami", "Tampa", "Nashville", "Raleigh-Durham", "Detroit-Midwest"])

type Rep = "all" | "Brad" | "Bernie"
type StatusFilter = "all" | "clients" | "warm" | "pipeline" | "cold" | "nextTime"
type SortMode = "aum" | "opportunity" | "market" | "contacts"

/* ═══════════════════════ BUILD TRIP SUMMARIES ═══════════════════════ */

function buildTripSummaries(): TripSummary[] {
  return Object.entries(TRIP_METRO_MAP).map(([tripName, metros]) => {
    const metroNames = Object.keys(metros)
    const allCities = Object.values(metros).flat()
    const rep = EAST_TRIPS.has(tripName) ? "Brad" as const : "Bernie" as const

    // Contacts for this trip
    const tripContacts = MOCK_CONTACTS.filter((c) => c.trip === tripName)
    const clients = tripContacts.filter((c) => c.client).length
    const pipeline = tripContacts.filter((c) => c.pipeline).length
    const warm = tripContacts.filter((c) => c.warm).length
    const cold = tripContacts.filter((c) => c.cold).length
    const nextTime = tripContacts.filter((c) => c.nextTime).length
    const totalAoAum = tripContacts.reduce((sum, c) => sum + (c.aoAum || 0), 0)

    // Offices for this trip (match by city+state)
    const tripOffices = MOCK_OFFICES.filter((o) =>
      allCities.some((city) => city.toLowerCase() === o.city.toLowerCase()) || (o.isFidelityClearing && o.rep === rep)
    )
    const totalOfficeAum = tripOffices.reduce((sum, o) => sum + o.assetBalance, 0)
    const monthlyNet = tripOffices.reduce((sum, o) => sum + o.monthlyNet, 0)

    // Peer data for this trip (match by city)
    const tripPeer = MOCK_PEER_DATA.filter((p) => allCities.some((city) => city.toLowerCase() === p.city.toLowerCase()))
    const ultrashortPeerAum = tripPeer.reduce((sum, p) => sum + p.ultrashortActiveETF + p.ultrashortPassiveETF + p.aaaETF + p.ultrashortFunds, 0)
    const incomeCorePeerAum = tripPeer.reduce((sum, p) => sum + p.shortTermBondFunds + p.corePlusFunds, 0)
    const hyPeerAum = tripPeer.reduce((sum, p) => sum + p.hyETFs + p.hyFunds + p.intervalFunds, 0)

    // Industry AUM
    const tripIndustry = MOCK_INDUSTRY_AUM.filter((ia) => allCities.some((city) => city.toLowerCase() === ia.city.toLowerCase()))
    const industryAum = tripIndustry.reduce((sum, ia) => sum + ia.industryAssets, 0)

    const penetration = industryAum > 0 ? totalOfficeAum / industryAum : 0
    const opportunityScore = (ultrashortPeerAum / 1_000_000) * (1 - totalOfficeAum / (industryAum + 1))

    return {
      tripName,
      rep,
      metros: metroNames,
      cities: allCities,
      totalContacts: tripContacts.length,
      clients,
      pipeline,
      warm,
      cold,
      nextTime,
      totalAoAum,
      totalOfficeAum,
      monthlyNet,
      industryAum,
      ultrashortPeerAum,
      incomeCorePeerAum,
      hyPeerAum,
      hasClients: clients > 0,
      hasWarm: warm > 0,
      hasPipeline: pipeline > 0,
      opportunityScore,
      penetration,
    }
  })
}

const ALL_TRIP_SUMMARIES = buildTripSummaries()

/* ═══════════════════════ SEARCH LOGIC ═══════════════════════ */

function matchesSearch(trip: TripSummary, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()

  // Match trip name
  if (trip.tripName.toLowerCase().includes(q)) return true

  // Match metro name
  if (trip.metros.some((m) => m.toLowerCase().includes(q))) return true

  // Match city name
  if (trip.cities.some((c) => c.toLowerCase().includes(q))) return true

  // Match state
  const contactStates = MOCK_CONTACTS.filter((c) => c.trip === trip.tripName).map((c) => c.state.toLowerCase())
  if (contactStates.some((s) => s === q || s.includes(q))) return true

  return false
}

/* ═══════════════════════ PAGE ═══════════════════════ */

export default function TerritoryPage() {
  const [search, setSearch] = useState("")
  const [repFilter, setRepFilter] = useState<Rep>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortMode, setSortMode] = useState<SortMode>("opportunity")
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null)

  // Filter and sort trips
  const filteredTrips = useMemo(() => {
    let trips = ALL_TRIP_SUMMARIES

    // Rep filter
    if (repFilter === "Brad") trips = trips.filter((t) => t.rep === "Brad")
    else if (repFilter === "Bernie") trips = trips.filter((t) => t.rep === "Bernie")

    // Status filter
    if (statusFilter === "clients") trips = trips.filter((t) => t.hasClients)
    else if (statusFilter === "pipeline") trips = trips.filter((t) => t.hasPipeline)
    else if (statusFilter === "warm") trips = trips.filter((t) => t.hasWarm)
    else if (statusFilter === "cold") trips = trips.filter((t) => t.cold > 0)
    else if (statusFilter === "nextTime") trips = trips.filter((t) => t.nextTime > 0)

    // Search
    if (search) trips = trips.filter((t) => matchesSearch(t, search))

    // Sort
    switch (sortMode) {
      case "aum": trips = [...trips].sort((a, b) => b.totalAoAum - a.totalAoAum); break
      case "opportunity": trips = [...trips].sort((a, b) => b.opportunityScore - a.opportunityScore); break
      case "market": trips = [...trips].sort((a, b) => b.industryAum - a.industryAum); break
      case "contacts": trips = [...trips].sort((a, b) => b.totalContacts - a.totalContacts); break
    }

    return trips
  }, [repFilter, statusFilter, search, sortMode])

  // Selected trip data
  const tripData = useMemo(() => {
    if (!selectedTrip) return null
    const summary = ALL_TRIP_SUMMARIES.find((t) => t.tripName === selectedTrip)
    if (!summary) return null
    const contacts = MOCK_CONTACTS.filter((c) => c.trip === selectedTrip)
    const allCities = summary.cities
    const offices = MOCK_OFFICES.filter((o) =>
      allCities.some((city) => city.toLowerCase() === o.city.toLowerCase()) || (o.isFidelityClearing && o.rep === summary.rep)
    )
    return { summary, contacts, offices }
  }, [selectedTrip])

  const handleSelectTrip = useCallback((tripName: string) => {
    setSelectedTrip(tripName)
  }, [])

  // Auto-select first trip when filtered list changes
  const effectiveSelected = selectedTrip && filteredTrips.some((t) => t.tripName === selectedTrip) ? selectedTrip : (filteredTrips[0]?.tripName || null)
  if (effectiveSelected !== selectedTrip && effectiveSelected) {
    // Will update on next render
  }

  const activeTripData = useMemo(() => {
    const active = effectiveSelected
    if (!active) return null
    const summary = ALL_TRIP_SUMMARIES.find((t) => t.tripName === active)
    if (!summary) return null
    const contacts = MOCK_CONTACTS.filter((c) => c.trip === active)
    const allCities = summary.cities
    const offices = MOCK_OFFICES.filter((o) =>
      allCities.some((city) => city.toLowerCase() === o.city.toLowerCase()) || (o.isFidelityClearing && o.rep === summary.rep)
    )
    return { summary, contacts, offices }
  }, [effectiveSelected])

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <header className="px-3 py-3 sm:px-6 sm:py-4" style={{ backgroundColor: "#0f3d6b" }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white sm:text-lg">Territory Intelligence</h1>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>Internal trip planning & prospect tracker</p>
          </div>
          <Link
            href="/"
            className="flex min-h-[44px] items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fund Discovery</span>
          </Link>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="border-b px-3 py-3 sm:px-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2.5">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "#94a3b8" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by trip, metro, or city..."
              className="w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm outline-none transition-colors"
              style={{
                borderColor: search ? "#0f3d6b" : "#e2e8f0",
                color: "#0f172a",
                backgroundColor: "#fff",
              }}
            />
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Rep filter */}
            <div className="flex gap-1">
              {([["all", "All Reps"], ["Brad", "Brad (East)"], ["Bernie", "Bernie (West)"]] as [Rep, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setRepFilter(val)}
                  className="min-h-[36px] rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: repFilter === val ? "#0f3d6b" : "#f1f5f9",
                    color: repFilter === val ? "#fff" : "#64748b",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />

            {/* Status filter */}
            <div className="flex flex-wrap gap-1">
              {([["all", "All"], ["clients", "Clients"], ["pipeline", "Pipeline"], ["warm", "Warm"], ["cold", "Cold"], ["nextTime", "Next Time"]] as [StatusFilter, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStatusFilter(val)}
                  className="min-h-[36px] rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: statusFilter === val ? "#0f3d6b" : "#f1f5f9",
                    color: statusFilter === val ? "#fff" : "#64748b",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <SortAsc className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded border py-1 pl-2 pr-6 text-[11px]"
                style={{ borderColor: "#e2e8f0", color: "#64748b", backgroundColor: "#fff" }}
              >
                <option value="opportunity">By Opportunity</option>
                <option value="aum">By AO AUM</option>
                <option value="market">By Market Size</option>
                <option value="contacts">By # Contacts</option>
              </select>
            </div>

            {/* Count */}
            <span className="ml-auto text-[10px]" style={{ color: "#94a3b8" }}>
              {filteredTrips.length} trip{filteredTrips.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Split Panel */}
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col lg:flex-row">
        {/* Left panel — Trip List */}
        <div
          className="w-full shrink-0 overflow-y-auto border-b lg:w-[380px] lg:border-b-0 lg:border-r"
          style={{ borderColor: "#e2e8f0", maxHeight: "calc(100vh - 180px)" }}
        >
          <TripList
            trips={filteredTrips}
            selectedTrip={effectiveSelected}
            onSelect={handleSelectTrip}
          />
        </div>

        {/* Right panel — Trip Detail */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 180px)" }}
        >
          {activeTripData ? (
            <TripDetail
              trip={activeTripData.summary}
              contacts={activeTripData.contacts}
              offices={activeTripData.offices}
            />
          ) : (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm" style={{ color: "#94a3b8" }}>Select a trip to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
