import type { TerritoryContact, BroadridgeOffice, PeerGroupData, IndustryAUM } from "./territory-types"

/* ═══════════════════════ TRIP → METRO → CITY MAPPING ═══════════════════════ */

export const TRIP_METRO_MAP: Record<string, Record<string, string[]>> = {
  "NYC": {
    "New York City": ["New York", "Brooklyn", "Jersey City", "Hoboken", "Stamford", "White Plains"],
    "Long Island": ["Garden City", "Great Neck", "Melville", "Hauppauge"],
  },
  "Boston": {
    "Boston": ["Boston", "Cambridge", "Wellesley", "Newton", "Burlington"],
    "Hartford": ["Hartford", "New Haven", "Westport"],
    "Providence": ["Providence", "Warwick"],
  },
  "Philly": {
    "Philadelphia": ["Philadelphia", "King of Prussia", "Conshohocken", "Radnor", "Wayne"],
    "South Jersey": ["Cherry Hill", "Marlton", "Princeton"],
  },
  "DC": {
    "Washington DC": ["Washington", "Bethesda", "McLean", "Arlington", "Tysons Corner"],
    "Baltimore": ["Baltimore", "Towson", "Columbia"],
  },
  "Pitt-Cle": {
    "Pittsburgh": ["Pittsburgh", "Cranberry Township", "Sewickley"],
    "Cleveland": ["Cleveland", "Beachwood", "Westlake"],
    "Akron": ["Akron", "Canton"],
  },
  "Indi/Cincy/Columbus": {
    "Indianapolis": ["Indianapolis", "Carmel", "Fishers"],
    "Cincinnati": ["Cincinnati", "Mason", "West Chester"],
    "Columbus": ["Columbus", "Dublin", "Westerville"],
  },
  "Charlotte": {
    "Charlotte": ["Charlotte", "Ballantyne", "Huntersville"],
    "Greensboro": ["Greensboro", "Winston-Salem", "High Point"],
  },
  "Atlanta": {
    "Atlanta": ["Atlanta", "Buckhead", "Alpharetta", "Marietta", "Roswell"],
    "Savannah": ["Savannah", "Hilton Head"],
  },
  "Miami": {
    "Miami": ["Miami", "Coral Gables", "Aventura", "Boca Raton", "Fort Lauderdale"],
    "West Palm": ["West Palm Beach", "Palm Beach Gardens", "Jupiter"],
  },
  "Tampa": {
    "Tampa": ["Tampa", "St. Petersburg", "Clearwater"],
    "Sarasota": ["Sarasota", "Naples", "Fort Myers"],
  },
  "Nashville": {
    "Nashville": ["Nashville", "Franklin", "Brentwood"],
    "Memphis": ["Memphis", "Germantown"],
  },
  "Raleigh-Durham": {
    "Raleigh": ["Raleigh", "Cary", "Durham"],
    "Wilmington": ["Wilmington"],
  },
  "Detroit-Midwest": {
    "Detroit": ["Detroit", "Troy", "Southfield", "Ann Arbor"],
    "Grand Rapids": ["Grand Rapids", "Kalamazoo"],
  },
  "Chicago": {
    "Chicago": ["Chicago", "Naperville", "Schaumburg", "Deerfield", "Lake Forest"],
    "Milwaukee": ["Milwaukee", "Brookfield"],
  },
  "Minneapolis": {
    "Minneapolis": ["Minneapolis", "Edina", "Wayzata", "St. Paul"],
  },
  "St. Louis": {
    "St. Louis": ["St. Louis", "Clayton", "Chesterfield"],
    "Kansas City": ["Kansas City", "Overland Park", "Leawood"],
  },
  "Dallas-Houston": {
    "Dallas": ["Dallas", "Plano", "Frisco", "Fort Worth"],
    "Houston": ["Houston", "The Woodlands", "Sugar Land"],
  },
  "Denver": {
    "Denver": ["Denver", "Greenwood Village", "Boulder", "Colorado Springs"],
  },
  "SF-Bay": {
    "San Francisco": ["San Francisco", "Palo Alto", "San Jose", "Walnut Creek"],
  },
  "LA-SoCal": {
    "Los Angeles": ["Los Angeles", "Century City", "Pasadena", "Irvine", "Newport Beach"],
    "San Diego": ["San Diego", "La Jolla", "Del Mar"],
  },
}

/* ═══════════════════════ FIRMS ═══════════════════════ */

const FIRMS = [
  "Edward Jones", "Raymond James", "LPL Financial", "Merrill Lynch", "Morgan Stanley",
  "Wells Fargo Advisors", "Ameriprise Financial", "Stifel", "RBC Wealth Management",
  "Janney Montgomery Scott", "Baird", "DA Davidson", "Oppenheimer", "Cetera",
  "Commonwealth Financial", "Cambridge Investment Research", "Kestra Financial",
  "Advisor Group", "Waddell & Reed", "Hilltop Securities", "UBS Financial Services",
  "Truist Investment Services", "Key Investment Services", "PNC Investments",
]

const TITLES = [
  "Financial Advisor", "Senior Vice President", "Vice President", "Wealth Advisor",
  "Managing Director", "First Vice President", "Portfolio Manager", "Investment Consultant",
  "Senior Financial Advisor", "Branch Manager", "Wealth Management Advisor",
]

const AO_PRODUCTS = ["UYLD", "ANGIX", "AOUIX", "AOHY", "CARY", "MBS", "ASCIX"]

const FIRST_NAMES = [
  "Michael", "James", "Robert", "David", "William", "Richard", "Thomas", "John",
  "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Steven", "Paul",
  "Andrew", "Joshua", "Kenneth", "Kevin", "Brian", "George", "Timothy",
  "Jennifer", "Sarah", "Elizabeth", "Lauren", "Michelle", "Jessica", "Amanda",
  "Stephanie", "Nicole", "Christina", "Katherine", "Rebecca", "Rachel", "Megan",
]

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Anderson", "Taylor", "Thomas", "Moore", "Jackson",
  "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Hill",
  "Sullivan", "Murphy", "Kelly", "O'Brien", "Romano", "Petrov", "Cohen", "Shapiro",
]

/* ═══════════════════════ STATE LOOKUP ═══════════════════════ */

const CITY_STATE: Record<string, string> = {
  "New York": "NY", "Brooklyn": "NY", "Jersey City": "NJ", "Hoboken": "NJ", "Stamford": "CT",
  "White Plains": "NY", "Garden City": "NY", "Great Neck": "NY", "Melville": "NY", "Hauppauge": "NY",
  "Boston": "MA", "Cambridge": "MA", "Wellesley": "MA", "Newton": "MA", "Burlington": "MA",
  "Hartford": "CT", "New Haven": "CT", "Westport": "CT", "Providence": "RI", "Warwick": "RI",
  "Philadelphia": "PA", "King of Prussia": "PA", "Conshohocken": "PA", "Radnor": "PA", "Wayne": "PA",
  "Cherry Hill": "NJ", "Marlton": "NJ", "Princeton": "NJ",
  "Washington": "DC", "Bethesda": "MD", "McLean": "VA", "Arlington": "VA", "Tysons Corner": "VA",
  "Baltimore": "MD", "Towson": "MD", "Columbia": "MD",
  "Pittsburgh": "PA", "Cranberry Township": "PA", "Sewickley": "PA",
  "Cleveland": "OH", "Beachwood": "OH", "Westlake": "OH", "Akron": "OH", "Canton": "OH",
  "Indianapolis": "IN", "Carmel": "IN", "Fishers": "IN",
  "Cincinnati": "OH", "Mason": "OH", "West Chester": "OH",
  "Columbus": "OH", "Dublin": "OH", "Westerville": "OH",
  "Charlotte": "NC", "Ballantyne": "NC", "Huntersville": "NC",
  "Greensboro": "NC", "Winston-Salem": "NC", "High Point": "NC",
  "Atlanta": "GA", "Buckhead": "GA", "Alpharetta": "GA", "Marietta": "GA", "Roswell": "GA",
  "Savannah": "GA", "Hilton Head": "SC",
  "Miami": "FL", "Coral Gables": "FL", "Aventura": "FL", "Boca Raton": "FL", "Fort Lauderdale": "FL",
  "West Palm Beach": "FL", "Palm Beach Gardens": "FL", "Jupiter": "FL",
  "Tampa": "FL", "St. Petersburg": "FL", "Clearwater": "FL",
  "Sarasota": "FL", "Naples": "FL", "Fort Myers": "FL",
  "Nashville": "TN", "Franklin": "TN", "Brentwood": "TN", "Memphis": "TN", "Germantown": "TN",
  "Raleigh": "NC", "Cary": "NC", "Durham": "NC", "Wilmington": "NC",
  "Detroit": "MI", "Troy": "MI", "Southfield": "MI", "Ann Arbor": "MI",
  "Grand Rapids": "MI", "Kalamazoo": "MI",
  "Chicago": "IL", "Naperville": "IL", "Schaumburg": "IL", "Deerfield": "IL", "Lake Forest": "IL",
  "Milwaukee": "WI", "Brookfield": "WI",
  "Minneapolis": "MN", "Edina": "MN", "Wayzata": "MN", "St. Paul": "MN",
  "St. Louis": "MO", "Clayton": "MO", "Chesterfield": "MO",
  "Kansas City": "MO", "Overland Park": "KS", "Leawood": "KS",
  "Dallas": "TX", "Plano": "TX", "Frisco": "TX", "Fort Worth": "TX",
  "Houston": "TX", "The Woodlands": "TX", "Sugar Land": "TX",
  "Denver": "CO", "Greenwood Village": "CO", "Boulder": "CO", "Colorado Springs": "CO",
  "San Francisco": "CA", "Palo Alto": "CA", "San Jose": "CA", "Walnut Creek": "CA",
  "Los Angeles": "CA", "Century City": "CA", "Pasadena": "CA", "Irvine": "CA", "Newport Beach": "CA",
  "San Diego": "CA", "La Jolla": "CA", "Del Mar": "CA",
}

/* East trips (Brad) vs West trips (Bernie) */
const EAST_TRIPS = ["NYC", "Boston", "Philly", "DC", "Pitt-Cle", "Indi/Cincy/Columbus", "Charlotte", "Atlanta", "Miami", "Tampa", "Nashville", "Raleigh-Durham", "Detroit-Midwest"]
const WEST_TRIPS = ["Chicago", "Minneapolis", "St. Louis", "Dallas-Houston", "Denver", "SF-Bay", "LA-SoCal"]

/* ═══════════════════════ SEEDED RANDOM ═══════════════════════ */

let _seed = 42
function rand() { _seed = (_seed * 16807 + 0) % 2147483647; return (_seed - 1) / 2147483646 }
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)] }
function randBetween(lo: number, hi: number) { return lo + rand() * (hi - lo) }

/* ═══════════════════════ GENERATE CONTACTS ═══════════════════════ */

function generateContacts(): TerritoryContact[] {
  const contacts: TerritoryContact[] = []
  let id = 0

  for (const [tripName, metros] of Object.entries(TRIP_METRO_MAP)) {
    const rep = EAST_TRIPS.includes(tripName) ? "Brad" as const : "Bernie" as const
    const contactsPerTrip = Math.floor(randBetween(6, 18))

    for (let i = 0; i < contactsPerTrip; i++) {
      const metroNames = Object.keys(metros)
      const metro = pick(metroNames)
      const city = pick(metros[metro])
      const firstName = pick(FIRST_NAMES)
      const lastName = pick(LAST_NAMES)
      const isClient = rand() < 0.15
      const isPipeline = !isClient && rand() < 0.1
      const isWarm = !isClient && !isPipeline && rand() < 0.25
      const isCold = !isClient && !isPipeline && !isWarm && rand() < 0.5
      const isNextTime = rand() < 0.2
      const isDrip = rand() < 0.3
      const isBlast = rand() < 0.6
      const hasAum = isClient ? rand() < 0.85 : (isWarm ? rand() < 0.3 : rand() < 0.05)
      const numStrategies = isClient ? Math.ceil(rand() * 4) : (isWarm ? Math.ceil(rand() * 2) : (rand() < 0.3 ? 1 : 0))

      contacts.push({
        id: `c-${++id}`,
        firstName,
        lastName,
        combinedName: `${firstName} ${lastName}`,
        firmName: pick(FIRMS),
        city,
        state: CITY_STATE[city] || "NY",
        officeAddress: `${Math.floor(rand() * 9000 + 100)} ${pick(["Main St", "Broadway", "Market St", "Park Ave", "Oak Blvd", "Elm Dr", "Commerce Way", "Financial Plaza"])}`,
        metro,
        trip: tripName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${pick(["firm", "advisory", "wealth", "capital", "invest"])}.com`,
        title: pick(TITLES),
        pipeline: isPipeline,
        client: isClient,
        warm: isWarm,
        cold: isCold,
        nextTime: isNextTime,
        dripList: isDrip,
        blastContact: isBlast,
        removeFromBlast: rand() < 0.05,
        unsubscribe: rand() < 0.03,
        aoAum: hasAum ? Math.round(randBetween(0.5, 45) * 100) / 100 : null,
        relevantStrategies: numStrategies > 0 ? Array.from({ length: numStrategies }, () => pick(AO_PRODUCTS)).filter((v, i, a) => a.indexOf(v) === i) : [],
        notes: isClient
          ? pick(["Strong relationship, quarterly calls", "Large book, interested in UYLD allocation", "Met at conference, wants follow-up on MBS", "Long-term client, expanding into HY", "Key account, board member relationship"])
          : isWarm
          ? pick(["Responded to webinar invite", "Had good call last quarter", "Interested in ultrashort space", "Referred by existing client", "Met at industry dinner"])
          : isPipeline
          ? pick(["Proposal sent, awaiting response", "Due diligence in progress", "Committee review next month", "Finals presentation scheduled", "Verbal commitment pending paperwork"])
          : "",
        forbes: rand() < 0.05,
        barrons: rand() < 0.08,
        rep,
      })
    }
  }

  return contacts
}

/* ═══════════════════════ GENERATE OFFICES ═══════════════════════ */

function generateOffices(): BroadridgeOffice[] {
  const offices: BroadridgeOffice[] = []
  let id = 0

  for (const [tripName, metros] of Object.entries(TRIP_METRO_MAP)) {
    const rep = EAST_TRIPS.includes(tripName) ? "Brad" as const : "Bernie" as const
    const officesPerTrip = Math.floor(randBetween(2, 6))

    for (let i = 0; i < officesPerTrip; i++) {
      const metroNames = Object.keys(metros)
      const metro = pick(metroNames)
      const city = pick(metros[metro])
      const isFidelity = rand() < 0.1

      const numProducts = Math.ceil(rand() * 3)
      for (let p = 0; p < numProducts; p++) {
        const balance = randBetween(500_000, 25_000_000)
        const net = randBetween(-800_000, 1_200_000)
        offices.push({
          id: `o-${++id}`,
          firmName: pick(FIRMS),
          city: isFidelity ? "" : city,
          state: CITY_STATE[city] || "NY",
          address: isFidelity ? "Fidelity Clearing & Custody" : `${Math.floor(rand() * 9000 + 100)} ${pick(["Financial Dr", "Commerce Blvd", "Market St", "Corporate Way"])}`,
          rep,
          product: pick(AO_PRODUCTS),
          assetBalance: Math.round(balance),
          monthlyNet: Math.round(net),
          monthlyPurchases: net > 0 ? Math.round(net + randBetween(50_000, 300_000)) : Math.round(randBetween(50_000, 300_000)),
          monthlyRedemptions: net < 0 ? Math.round(Math.abs(net) + randBetween(50_000, 200_000)) : Math.round(randBetween(50_000, 200_000)),
          isFidelityClearing: isFidelity,
        })
      }
    }
  }

  return offices
}

/* ═══════════════════════ GENERATE PEER + INDUSTRY DATA ═══════════════════════ */

function generatePeerData(): PeerGroupData[] {
  const data: PeerGroupData[] = []
  for (const metros of Object.values(TRIP_METRO_MAP)) {
    for (const [, cities] of Object.entries(metros)) {
      const city = cities[0]
      const st = CITY_STATE[city] || "NY"
      data.push({
        city,
        state: st,
        ultrashortActiveETF: Math.round(randBetween(5_000_000, 120_000_000)),
        ultrashortPassiveETF: Math.round(randBetween(2_000_000, 80_000_000)),
        aaaETF: Math.round(randBetween(1_000_000, 40_000_000)),
        ultrashortFunds: Math.round(randBetween(10_000_000, 150_000_000)),
        shortTermBondFunds: Math.round(randBetween(5_000_000, 100_000_000)),
        corePlusFunds: Math.round(randBetween(20_000_000, 200_000_000)),
        hyETFs: Math.round(randBetween(5_000_000, 60_000_000)),
        hyFunds: Math.round(randBetween(10_000_000, 80_000_000)),
        intervalFunds: Math.round(randBetween(2_000_000, 30_000_000)),
      })
    }
  }
  return data
}

function generateIndustryAUM(): IndustryAUM[] {
  const data: IndustryAUM[] = []
  for (const metros of Object.values(TRIP_METRO_MAP)) {
    for (const [, cities] of Object.entries(metros)) {
      const city = cities[0]
      const st = CITY_STATE[city] || "NY"
      data.push({
        city,
        state: st,
        industryAssets: Math.round(randBetween(200_000_000, 8_000_000_000)),
      })
    }
  }
  return data
}

/* ═══════════════════════ EXPORTS ═══════════════════════ */

export const MOCK_CONTACTS = generateContacts()
export const MOCK_OFFICES = generateOffices()
export const MOCK_PEER_DATA = generatePeerData()
export const MOCK_INDUSTRY_AUM = generateIndustryAUM()
