import territoryData from "./data/territory-data.json"
import taggedContacts from "./data/tagged-contacts.json"
import contactsByTripData from "./data/contacts-by-trip.json"
import officesData from "./data/offices.json"
import type { TerritoryContact, BroadridgeOffice, IndustryAUM } from "./territory-types"

export const TERRITORY_DATA = territoryData

// Convert tagged contacts to TerritoryContact format
export const TAGGED_CONTACTS: TerritoryContact[] = taggedContacts.map((c: any, i: number) => ({
  id: `tc-${i}`,
  firstName: c.firstName,
  lastName: c.lastName,
  combinedName: `${c.firstName} ${c.lastName}`,
  firmName: c.firmName,
  city: c.city,
  state: c.state,
  officeAddress: "",
  metro: c.metro,
  trip: c.trip,
  email: "",
  title: "",
  pipeline: c.pipeline,
  client: c.client,
  warm: c.warm,
  cold: c.cold,
  nextTime: false,
  dripList: c.dripList || false,
  blastContact: false,
  removeFromBlast: false,
  unsubscribe: false,
  aoAum: null,
  relevantStrategies: [],
  notes: "",
  forbes: false,
  barrons: false,
  rep: "Brad" as const,
}))

// Contacts by trip
export const CONTACTS_BY_TRIP: Record<string, TerritoryContact[]> = {}
for (const [trip, contacts] of Object.entries(contactsByTripData as Record<string, any[]>)) {
  CONTACTS_BY_TRIP[trip] = contacts.map((c: any, i: number) => ({
    id: `${trip}-${i}`,
    firstName: c.firstName,
    lastName: c.lastName,
    combinedName: `${c.firstName} ${c.lastName}`,
    firmName: c.firmName,
    city: c.city,
    state: c.state,
    officeAddress: "",
    metro: c.metro,
    trip: c.trip,
    email: "",
    title: "",
    pipeline: c.pipeline,
    client: c.client,
    warm: c.warm,
    cold: c.cold,
    nextTime: false,
    dripList: c.dripList || false,
    blastContact: false,
    removeFromBlast: false,
    unsubscribe: false,
    aoAum: null,
    relevantStrategies: [],
    notes: c.notes || "",
    forbes: false,
    barrons: false,
    rep: "Brad" as const,
  }))
}

// Offices
export const OFFICES: BroadridgeOffice[] = (officesData as any[]).map((o: any, i: number) => ({
  id: `off-${i}`,
  firmName: o.firmName,
  city: o.city,
  state: o.state,
  address: o.address,
  rep: o.rep as "Brad" | "Bernie",
  product: "",
  assetBalance: o.assetBalance,
  monthlyNet: o.monthlyNet,
  monthlyPurchases: 0,
  monthlyRedemptions: 0,
  isFidelityClearing: false,
}))
