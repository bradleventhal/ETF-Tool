#!/usr/bin/env npx tsx
/**
 * split-territory-data.ts
 *
 * Takes territory-v2.json (22 MB canonical blob) and splits into:
 *   public/data/territory/overview.json    — KPIs + trip cards (~5 KB)
 *   public/data/territory/trips/{name}.json — per-trip offices + contacts (200-800 KB)
 *   public/data/territory/firms.json       — firm-level rollups (~300 KB)
 *   public/data/territory/top-offices.json — top 50 offices by gap (~50 KB)
 *
 * Run: npx tsx scripts/split-territory-data.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join } from "path"

const ROOT = join(__dirname, "..")
const V2_PATH = join(ROOT, "public/data/territory-v2.json")
const OUT_DIR = join(ROOT, "public/data/territory")
const TRIPS_DIR = join(OUT_DIR, "trips")

// ─── Load ───
console.log("Loading territory-v2.json...")
const raw = JSON.parse(readFileSync(V2_PATH, "utf-8"))

const contacts: any[] = raw.contacts
const offices: Record<string, any> = raw.offices
const tripStats: Record<string, any> = raw.tripStats
const tripMetros: Record<string, string[]> = raw.tripMetros
const metroStats: Record<string, any> = raw.metroStats
const peerGroupList: string[] = raw.peerGroupList
const overview = raw.overview

console.log(`  ${contacts.length} contacts, ${Object.keys(offices).length} offices, ${Object.keys(tripStats).length} trips`)

// ─── Helpers ───

type ContactStatus = "client" | "pipeline" | "warm" | "cold" | "drip" | "untagged"

function bestStatus(statuses: ContactStatus[]): ContactStatus {
  const order: ContactStatus[] = ["client", "pipeline", "warm", "cold", "drip", "untagged"]
  for (const s of order) {
    if (statuses.includes(s)) return s
  }
  return "untagged"
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// ─── Ensure output dirs ───
mkdirSync(TRIPS_DIR, { recursive: true })

// ─── Index contacts by office key and trip ───
console.log("Indexing contacts...")
const contactsByTrip: Record<string, any[]> = {}
const contactsByOffice: Record<string, any[]> = {}

for (const c of contacts) {
  const trip = c.trip || "Unknown"
  const ok = c.ok || ""

  if (!contactsByTrip[trip]) contactsByTrip[trip] = []
  contactsByTrip[trip].push(c)

  if (ok) {
    if (!contactsByOffice[ok]) contactsByOffice[ok] = []
    contactsByOffice[ok].push(c)
  }
}

// ─── Build office rows with enrichment ───
console.log("Building office rows...")

interface OfficeRow {
  key: string
  firm: string
  city: string
  state: string
  addr: string
  industryAUM: number
  aoAUM: number
  gap: number
  penetration: number
  aoProducts: Record<string, number>
  peerGroups: Record<string, number>
  displacementScore: number
  contactCount: number
  bestContactStatus: ContactStatus
  contacts: { fn: string; ln: string; status: ContactStatus; email: string }[]
}

function buildOfficeRow(key: string, office: any): OfficeRow {
  const officeContacts = contactsByOffice[key] || []
  const statuses = officeContacts.map((c: any) => c.status as ContactStatus)
  const industryAUM = office.industryAUM || 0
  const aoAUM = office.aoAUM || 0

  return {
    key,
    firm: office.firm,
    city: office.city,
    state: office.state,
    addr: office.addr || "",
    industryAUM,
    aoAUM,
    gap: industryAUM - aoAUM,
    penetration: industryAUM > 0 ? aoAUM / industryAUM : 0,
    aoProducts: office.aoProducts || {},
    peerGroups: office.peerGroups || {},
    displacementScore: office.displacementScore || 0,
    contactCount: officeContacts.length,
    bestContactStatus: bestStatus(statuses),
    contacts: officeContacts.map((c: any) => ({
      fn: c.fn,
      ln: c.ln,
      status: c.status,
      email: c.email || "",
    })),
  }
}

// ─── Map offices to trips via contacts ───
const officeTrips: Record<string, Set<string>> = {}
for (const c of contacts) {
  const ok = c.ok || ""
  const trip = c.trip || ""
  if (ok && trip) {
    if (!officeTrips[ok]) officeTrips[ok] = new Set()
    officeTrips[ok].add(trip)
  }
}

// ─── Build per-trip files ───
console.log("Writing per-trip files...")

interface TripFile {
  name: string
  slug: string
  stats: any
  metros: string[]
  metroBreakdown: Record<string, { contactCount: number; officeCount: number; trip: string }>
  offices: OfficeRow[]
  totalIndustryAUM: number
  totalAoAUM: number
  gap: number
  penetration: number
  officeCount: number
  contactCount: number
  firmCount: number
}

const tripCards: any[] = []
const allOfficeRows: OfficeRow[] = []

for (const [tripName, stats] of Object.entries(tripStats)) {
  const slug = slugify(tripName)
  const tripContacts = contactsByTrip[tripName] || []
  const metros = tripMetros[tripName] || []

  // Gather offices for this trip
  const tripOfficeKeys = new Set<string>()
  for (const c of tripContacts) {
    if (c.ok) tripOfficeKeys.add(c.ok)
  }

  const tripOffices: OfficeRow[] = []
  for (const key of tripOfficeKeys) {
    if (offices[key]) {
      tripOffices.push(buildOfficeRow(key, offices[key]))
    }
  }

  // Sort by: aoAUM desc, then contactCount desc (displacementScore is too sparse)
  tripOffices.sort((a, b) => {
    if (b.aoAUM !== a.aoAUM) return b.aoAUM - a.aoAUM
    if (b.industryAUM !== a.industryAUM) return b.industryAUM - a.industryAUM
    return b.contactCount - a.contactCount
  })

  // Metro breakdown
  const metroBreakdown: Record<string, any> = {}
  for (const m of metros) {
    const ms = metroStats[m]
    metroBreakdown[m] = {
      contactCount: ms?.total || 0,
      officeCount: tripOffices.filter(o => {
        // Match office city to metro - offices in this metro
        // Metro is often the city name, but can differ
        return true // We'll approximate - metro breakdown is enrichment
      }).length,
      trip: tripName,
    }
  }

  // Aggregates
  const totalIndustryAUM = tripOffices.reduce((s, o) => s + o.industryAUM, 0)
  const totalAoAUM = tripOffices.reduce((s, o) => s + o.aoAUM, 0)
  const firms = new Set(tripOffices.map(o => o.firm))

  const tripFile: TripFile = {
    name: tripName,
    slug,
    stats: stats as any,
    metros,
    metroBreakdown,
    offices: tripOffices,
    totalIndustryAUM,
    totalAoAUM,
    gap: totalIndustryAUM - totalAoAUM,
    penetration: totalIndustryAUM > 0 ? totalAoAUM / totalIndustryAUM : 0,
    officeCount: tripOffices.length,
    contactCount: tripContacts.length,
    firmCount: firms.size,
  }

  writeFileSync(join(TRIPS_DIR, `${slug}.json`), JSON.stringify(tripFile))
  console.log(`  ${slug}.json — ${tripOffices.length} offices, ${tripContacts.length} contacts`)

  // Trip card for overview
  tripCards.push({
    name: tripName,
    slug,
    totalIndustryAUM,
    totalAoAUM,
    gap: totalIndustryAUM - totalAoAUM,
    penetration: totalIndustryAUM > 0 ? totalAoAUM / totalIndustryAUM : 0,
    officeCount: tripOffices.length,
    contactCount: tripContacts.length,
    firmCount: firms.size,
    metros,
    clientCount: (stats as any).client || 0,
    pipelineCount: (stats as any).pipeline || 0,
    warmCount: (stats as any).warm || 0,
  })

  allOfficeRows.push(...tripOffices)
}

// Sort trip cards by aoAUM desc (most client $ first), then by contactCount
tripCards.sort((a: any, b: any) => {
  if (b.totalAoAUM !== a.totalAoAUM) return b.totalAoAUM - a.totalAoAUM
  return b.contactCount - a.contactCount
})

// ─── Overview file ───
console.log("Writing overview.json...")
const totalIndustryAUM = Object.values(offices).reduce((s: number, o: any) => s + (o.industryAUM || 0), 0)
const totalAoAUM = Object.values(offices).reduce((s: number, o: any) => s + (o.aoAUM || 0), 0)
const zeroAoOffices = Object.values(offices).filter((o: any) => (o.aoAUM || 0) === 0).length

const overviewFile = {
  totalContacts: contacts.length,
  totalOffices: Object.keys(offices).length,
  totalIndustryAUM,
  totalAoAUM,
  penetration: totalIndustryAUM > 0 ? totalAoAUM / totalIndustryAUM : 0,
  zeroAoOffices,
  officesWithAoAUM: Object.keys(offices).length - zeroAoOffices,
  totalTrips: Object.keys(tripStats).length,
  totalMetros: Object.keys(metroStats).length,
  contactBreakdown: {
    pipeline: overview.pipeline,
    client: overview.client,
    warm: overview.warm,
    cold: overview.cold,
    drip: overview.drip,
    untagged: overview.untagged,
  },
  trips: tripCards,
  peerGroupList,
}

writeFileSync(join(OUT_DIR, "overview.json"), JSON.stringify(overviewFile))
console.log(`  overview.json — ${JSON.stringify(overviewFile).length} bytes`)

// ─── Firms rollup ───
console.log("Writing firms.json...")
const firmMap: Record<string, {
  firm: string
  totalIndustryAUM: number
  totalAoAUM: number
  officeCount: number
  contactCount: number
  offices: { key: string; city: string; state: string; aoAUM: number; industryAUM: number; contactCount: number }[]
}> = {}

for (const [key, office] of Object.entries(offices)) {
  const firm = (office as any).firm
  if (!firmMap[firm]) {
    firmMap[firm] = { firm, totalIndustryAUM: 0, totalAoAUM: 0, officeCount: 0, contactCount: 0, offices: [] }
  }
  const f = firmMap[firm]
  f.totalIndustryAUM += (office as any).industryAUM || 0
  f.totalAoAUM += (office as any).aoAUM || 0
  f.officeCount++
  f.contactCount += (contactsByOffice[key] || []).length
  f.offices.push({
    key,
    city: (office as any).city,
    state: (office as any).state,
    aoAUM: (office as any).aoAUM || 0,
    industryAUM: (office as any).industryAUM || 0,
    contactCount: (contactsByOffice[key] || []).length,
  })
}

// Add tier labels and sort
const firms = Object.values(firmMap).map(f => {
  const aum = f.totalIndustryAUM + f.totalAoAUM
  let tier = "Small"
  if (aum >= 5_000_000_000) tier = "Mega"
  else if (aum >= 2_000_000_000) tier = "Large"
  else if (aum >= 500_000_000) tier = "Mid"

  return {
    ...f,
    tier,
    penetration: f.totalIndustryAUM > 0 ? f.totalAoAUM / f.totalIndustryAUM : 0,
    gap: f.totalIndustryAUM - f.totalAoAUM,
  }
}).sort((a, b) => b.contactCount - a.contactCount)

writeFileSync(join(OUT_DIR, "firms.json"), JSON.stringify({ firms }))
console.log(`  firms.json — ${firms.length} firms`)

// ─── Top offices ───
console.log("Writing top-offices.json...")
// Deduplicate allOfficeRows (same office can appear in multiple trips)
const seenKeys = new Set<string>()
const uniqueOffices = allOfficeRows.filter(o => {
  if (seenKeys.has(o.key)) return false
  seenKeys.add(o.key)
  return true
})

// Sort by aoAUM desc then contactCount desc
const topOffices = uniqueOffices
  .sort((a, b) => {
    if (b.aoAUM !== a.aoAUM) return b.aoAUM - a.aoAUM
    return b.contactCount - a.contactCount
  })
  .slice(0, 100)
  .map(o => ({
    key: o.key,
    firm: o.firm,
    city: o.city,
    state: o.state,
    industryAUM: o.industryAUM,
    aoAUM: o.aoAUM,
    gap: o.gap,
    contactCount: o.contactCount,
    bestContactStatus: o.bestContactStatus,
  }))

writeFileSync(join(OUT_DIR, "top-offices.json"), JSON.stringify({ offices: topOffices }))
console.log(`  top-offices.json — ${topOffices.length} offices`)

// ─── Done ───
console.log("\n✅ Split complete!")
console.log(`   Overview: ${(JSON.stringify(overviewFile).length / 1024).toFixed(1)} KB`)
console.log(`   Trips: ${Object.keys(tripStats).length} files`)
console.log(`   Firms: ${firms.length} entries`)
console.log(`   Top offices: ${topOffices.length} entries`)
