/* ═══════════════════════ TERRITORY INTELLIGENCE TYPES ═══════════════════════ */

export interface TerritoryContact {
  id: string
  firstName: string
  lastName: string
  combinedName: string
  firmName: string
  city: string
  state: string
  officeAddress: string
  metro: string
  trip: string
  email: string
  title: string
  pipeline: boolean
  client: boolean
  warm: boolean
  cold: boolean
  nextTime: boolean
  dripList: boolean
  blastContact: boolean
  removeFromBlast: boolean
  unsubscribe: boolean
  aoAum: number | null // dollar amount in millions
  relevantStrategies: string[]
  notes: string
  forbes: boolean
  barrons: boolean
  rep: "Brad" | "Bernie"
}

export interface BroadridgeOffice {
  id: string
  firmName: string
  city: string
  state: string
  address: string
  rep: "Brad" | "Bernie"
  product: string
  assetBalance: number
  monthlyNet: number
  monthlyPurchases: number
  monthlyRedemptions: number
  isFidelityClearing: boolean
}

export interface PeerGroupData {
  city: string
  state: string
  ultrashortActiveETF: number
  ultrashortPassiveETF: number
  aaaETF: number
  ultrashortFunds: number
  shortTermBondFunds: number
  corePlusFunds: number
  hyETFs: number
  hyFunds: number
  intervalFunds: number
}

export interface IndustryAUM {
  city: string
  state: string
  industryAssets: number
}

export type ContactStatus = "client" | "pipeline" | "warm" | "cold" | "nextTime" | "drip" | "untagged"

export function getContactStatus(c: TerritoryContact): ContactStatus {
  if (c.pipeline) return "pipeline"
  if (c.client) return "client"
  if (c.warm) return "warm"
  if (c.cold) return "cold"
  if (c.nextTime) return "nextTime"
  if (c.dripList) return "drip"
  return "untagged"
}

export const STATUS_ORDER: Record<ContactStatus, number> = {
  client: 0,
  pipeline: 1,
  warm: 2,
  nextTime: 3,
  drip: 4,
  cold: 5,
  untagged: 6,
}

export const STATUS_CONFIG: Record<ContactStatus, { label: string; bg: string; text: string }> = {
  client:   { label: "Client",    bg: "#dcfce7", text: "#15803d" },
  pipeline: { label: "Pipeline",  bg: "#ede9fe", text: "#7c3aed" },
  warm:     { label: "Warm",      bg: "#fef9c3", text: "#a16207" },
  nextTime: { label: "Next Time", bg: "#dbeafe", text: "#1d4ed8" },
  drip:     { label: "Drip",      bg: "#ffedd5", text: "#c2410c" },
  cold:     { label: "Cold",      bg: "#f1f5f9", text: "#64748b" },
  untagged: { label: "Untagged",  bg: "#f1f5f9", text: "#94a3b8" },
}

export interface TripSummary {
  tripName: string
  rep: "Brad" | "Bernie"
  metros: string[]
  cities: string[]
  totalContacts: number
  clients: number
  pipeline: number
  warm: number
  cold: number
  nextTime: number
  totalAoAum: number
  totalOfficeAum: number
  monthlyNet: number
  industryAum: number
  ultrashortPeerAum: number
  incomeCorePeerAum: number
  hyPeerAum: number
  hasClients: boolean
  hasWarm: boolean
  hasPipeline: boolean
  opportunityScore: number
  penetration: number
}

export interface SignalThresholds {
  ultrashortPeerMin: number
  redemptionPressure: number
  strongInflows: number
  penetrationMax: number
  marketMin: number
}

export const DEFAULT_THRESHOLDS: SignalThresholds = {
  ultrashortPeerMin: 50_000_000,
  redemptionPressure: -500_000,
  strongInflows: 500_000,
  penetrationMax: 0.001,
  marketMin: 1_000_000_000,
}

/* ═══════════════════════ FOLLOW UP GENERATOR TYPES ═══════════════════════ */

export interface Contact {
  firstName: string
  lastName: string
  firm: string
  city: string
  state: string
  status: ContactStatus | string
  relevantStrategies: string
}
