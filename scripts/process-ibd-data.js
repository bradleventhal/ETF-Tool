#!/usr/bin/env node
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/Users/bradleyleventhal/.openclaw/workspace/data/ibd';
const OUT_DIR = path.join(__dirname, '..', 'lib', 'data');
fs.mkdirSync(OUT_DIR, { recursive: true });

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += line[i]; }
  }
  result.push(current.trim());
  return result;
}

// ─── 1. CONTACTS ───
console.log('Processing contacts...');
const csvRaw = fs.readFileSync(path.join(DATA_DIR, 'IBD_East_Contacts_Clean.csv'), 'utf8');
const csvLines = csvRaw.split('\n').filter(l => l.trim());
const contacts = [];
for (let i = 1; i < csvLines.length; i++) {
  const v = parseCSVLine(csvLines[i]);
  if (v.length < 6) continue;
  contacts.push({
    firstName: v[0], lastName: v[1], firmName: v[2], city: v[3], state: v[4],
    officeAddress: v[5], metro: v[6], trip: v[7], email: v[8],
    pipeline: v[9] === 'Y', client: v[10] === 'Y', warm: v[11] === 'Y',
    cold: v[12] === 'Y', dripList: v[13] === 'Y', notes: v[14] || '',
  });
}
console.log(`  ${contacts.length} contacts`);

// ─── 2. DEC IBD AUM ───
console.log('Processing Dec IBD AUM...');
const aumData = XLSX.utils.sheet_to_json(
  XLSX.readFile(path.join(DATA_DIR, 'Dec IBD AUM.xlsx')).Sheets['Sheet1'] ||
  Object.values(XLSX.readFile(path.join(DATA_DIR, 'Dec IBD AUM.xlsx')).Sheets)[0]
);

// Brad's territory
const bradRows = aumData.filter(r => r['Rep Name'] === 'Brad');
const totalBradAum = bradRows.reduce((s, r) => s + (r['Asset Balance'] || 0), 0);

// Top firms (Brad only)
const bradFirmAum = {};
for (const r of bradRows) {
  const f = r['Firm Name'] || '';
  bradFirmAum[f] = (bradFirmAum[f] || 0) + (r['Asset Balance'] || 0);
}
const topFirms = Object.entries(bradFirmAum)
  .sort((a, b) => b[1] - a[1]).slice(0, 20)
  .map(([name, aum]) => ({ name, aum: Math.round(aum) }));

// All firms (for full view)
const allFirmAum = {};
for (const r of aumData) {
  const f = r['Firm Name'] || '';
  allFirmAum[f] = (allFirmAum[f] || 0) + (r['Asset Balance'] || 0);
}
const allTopFirms = Object.entries(allFirmAum)
  .sort((a, b) => b[1] - a[1]).slice(0, 20)
  .map(([name, aum]) => ({ name, aum: Math.round(aum) }));

// Offices aggregated
const officeMap = {};
for (const r of aumData) {
  const key = r['BR Office ID'] || '';
  if (!officeMap[key]) {
    officeMap[key] = {
      firmName: r['Firm Name'] || '', city: (r['Office City'] || '').trim(),
      state: (r['Office State'] || '').trim(), address: r['Office Address Line 1'] || '',
      rep: r['Rep Name'] || '', assetBalance: 0, monthlyNet: 0,
      monthlyPurchases: 0, monthlyRedemptions: 0, products: {},
    };
  }
  const o = officeMap[key];
  o.assetBalance += r['Asset Balance'] || 0;
  o.monthlyNet += r['Monthly Net Sales'] || 0;
  o.monthlyPurchases += r['Monthly Purchases'] || 0;
  o.monthlyRedemptions += r['Monthly Redemptions'] || 0;
  const prod = r['Product Portfolio'] || '';
  o.products[prod] = (o.products[prod] || 0) + (r['Asset Balance'] || 0);
}
const offices = Object.values(officeMap);

// ─── 3. INDUSTRY AUM ───
console.log('Processing Industry AUM...');
const indWb = XLSX.readFile(path.join(DATA_DIR, 'Angel Oak - Firms and Offices Actual AUM (1).xlsx'));
const indRaw = XLSX.utils.sheet_to_json(Object.values(indWb.Sheets)[0], { range: 6 });
const cityIndustryAum = {};
for (const row of indRaw) {
  const city = (row['Office City'] || '').trim().toUpperCase();
  const assets = parseFloat(row['Industry Assets']) || 0;
  if (!city || !assets) continue;
  cityIndustryAum[city] = (cityIndustryAum[city] || 0) + assets;
}

// ─── 4. PEER GROUP ───
console.log('Processing Peer Group...');
const peerWb = XLSX.readFile(path.join(DATA_DIR, 'Angel Oak - Firms by Office - Peer Group and Channel.xlsx'));
const peerAll = XLSX.utils.sheet_to_json(Object.values(peerWb.Sheets)[0], { range: 7, header: 1 });
// Column indices: 4=Office City, 6=CorePlus, 10=HY ETFs, 11=HY Funds, 14=Ultrashort Funds, 16=Interval Funds, 22=AAA ETF, 23=Ultrashort Active ETF, 24=Ultrashort Passive ETF, 25=Sum
const cityPeer = {};
for (const row of peerAll) {
  const city = (row[4] || '').toString().trim().toUpperCase();
  if (!city || city === 'OFFICE CITY') continue;
  if (!cityPeer[city]) cityPeer[city] = { ultrashort: 0, corePlus: 0, hy: 0, total: 0 };
  const p = cityPeer[city];
  p.ultrashort += (parseFloat(row[23]) || 0) + (parseFloat(row[24]) || 0) + (parseFloat(row[22]) || 0) + (parseFloat(row[14]) || 0);
  p.corePlus += (parseFloat(row[13]) || 0) + (parseFloat(row[6]) || 0);
  p.hy += (parseFloat(row[10]) || 0) + (parseFloat(row[11]) || 0) + (parseFloat(row[16]) || 0);
  p.total += parseFloat(row[25]) || 0;
}

// ─── BUILD TRIP/METRO SUMMARIES FROM CONTACTS ───
console.log('Building summaries...');

// Get unique trips and metros from actual contacts data
const tripMetroMap = {};
for (const c of contacts) {
  const trip = c.trip || ''; const metro = c.metro || '';
  if (!trip) continue;
  if (!tripMetroMap[trip]) tripMetroMap[trip] = {};
  if (metro && !tripMetroMap[trip][metro]) tripMetroMap[trip][metro] = new Set();
  if (metro) tripMetroMap[trip][metro].add(c.city);
}

// Build office AUM lookup by city (uppercase)
const officeByCityU = {};
for (const o of offices) {
  const k = o.city.toUpperCase();
  if (!officeByCityU[k]) officeByCityU[k] = [];
  officeByCityU[k].push(o);
}

// Contact stats by trip
const contactsByTrip = {};
for (const c of contacts) {
  if (!c.trip) continue;
  if (!contactsByTrip[c.trip]) contactsByTrip[c.trip] = [];
  contactsByTrip[c.trip].push(c);
}

// Metro summaries
const metroSummaries = {};
for (const c of contacts) {
  const m = c.metro || 'Unknown';
  if (!metroSummaries[m]) metroSummaries[m] = { name: m, trip: c.trip, contacts: 0, pipeline: 0, client: 0, warm: 0, cold: 0, cities: new Set() };
  const s = metroSummaries[m];
  s.contacts++; s.cities.add(c.city);
  if (c.pipeline) s.pipeline++;
  if (c.client) s.client++;
  if (c.warm) s.warm++;
  if (c.cold) s.cold++;
}

// Compute AUM per metro
for (const [metro, s] of Object.entries(metroSummaries)) {
  let aoAum = 0, indAum = 0, peerUltrashort = 0;
  for (const city of s.cities) {
    const cu = city.toUpperCase();
    const cityOffices = officeByCityU[cu] || [];
    aoAum += cityOffices.reduce((sum, o) => sum + o.assetBalance, 0);
    indAum += cityIndustryAum[cu] || 0;
    const cp = cityPeer[cu];
    if (cp) peerUltrashort += cp.ultrashort;
  }
  s.aoAum = Math.round(aoAum);
  s.industryAum = Math.round(indAum);
  s.peerUltrashort = Math.round(peerUltrashort);
  s.cities = [...s.cities]; // convert Set to array
}

// Trip summaries
const tripSummaries = Object.entries(contactsByTrip).map(([tripName, tContacts]) => {
  const clients = tContacts.filter(c => c.client).length;
  const pipeline = tContacts.filter(c => c.pipeline).length;
  const warm = tContacts.filter(c => c.warm).length;
  const cold = tContacts.filter(c => c.cold).length;
  const metros = [...new Set(tContacts.map(c => c.metro).filter(Boolean))];
  const cities = [...new Set(tContacts.map(c => c.city).filter(Boolean))];

  // AO AUM from offices matching cities
  let aoAum = 0, monthlyNet = 0, indAum = 0, ultrashortPeer = 0, corePlusPeer = 0, hyPeer = 0;
  for (const city of cities) {
    const cu = city.toUpperCase();
    const co = officeByCityU[cu] || [];
    aoAum += co.reduce((s, o) => s + o.assetBalance, 0);
    monthlyNet += co.reduce((s, o) => s + o.monthlyNet, 0);
    indAum += cityIndustryAum[cu] || 0;
    const cp = cityPeer[cu];
    if (cp) { ultrashortPeer += cp.ultrashort; corePlusPeer += cp.corePlus; hyPeer += cp.hy; }
  }
  
  const penetration = indAum > 0 ? aoAum / indAum : 0;
  const opportunityScore = (ultrashortPeer / 1e6) * (1 - Math.min(penetration, 1));

  return {
    tripName, metros, cities,
    totalContacts: tContacts.length, clients, pipeline, warm, cold,
    totalAoAum: Math.round(aoAum), totalOfficeAum: Math.round(aoAum),
    monthlyNet: Math.round(monthlyNet), industryAum: Math.round(indAum),
    ultrashortPeerAum: Math.round(ultrashortPeer),
    incomeCorePeerAum: Math.round(corePlusPeer),
    hyPeerAum: Math.round(hyPeer),
    penetration: Math.round(penetration * 10000) / 10000,
    opportunityScore: Math.round(opportunityScore * 100) / 100,
  };
}).sort((a, b) => b.totalAoAum - a.totalAoAum);

// Pipeline summary
const pipelineSummary = {
  total: contacts.length,
  pipeline: contacts.filter(c => c.pipeline).length,
  client: contacts.filter(c => c.client).length,
  warm: contacts.filter(c => c.warm).length,
  cold: contacts.filter(c => c.cold).length,
  dripList: contacts.filter(c => c.dripList).length,
  untagged: contacts.filter(c => !c.pipeline && !c.client && !c.warm && !c.cold && !c.dripList).length,
};

// Top firms by trip
const topFirmsByTrip = {};
for (const r of aumData) {
  const city = (r['Office City'] || '').trim();
  // Find trip for this city from contacts
  const matchingContact = contacts.find(c => c.city.toUpperCase() === city.toUpperCase() && c.trip);
  if (!matchingContact) continue;
  const trip = matchingContact.trip;
  if (!topFirmsByTrip[trip]) topFirmsByTrip[trip] = {};
  const f = r['Firm Name'] || '';
  topFirmsByTrip[trip][f] = (topFirmsByTrip[trip][f] || 0) + (r['Asset Balance'] || 0);
}
for (const trip of Object.keys(topFirmsByTrip)) {
  topFirmsByTrip[trip] = Object.entries(topFirmsByTrip[trip])
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, aum]) => ({ name, aum: Math.round(aum) }));
}

// ─── Untapped metros: high industry AUM + low AO penetration ───
const untappedMetros = Object.values(metroSummaries)
  .filter(m => m.industryAum > 0)
  .map(m => ({
    name: m.name, trip: m.trip, contacts: m.contacts,
    industryAum: m.industryAum, aoAum: m.aoAum,
    peerUltrashort: m.peerUltrashort,
    penetration: m.industryAum > 0 ? m.aoAum / m.industryAum : 0,
    gap: m.industryAum - m.aoAum,
  }))
  .sort((a, b) => b.gap - a.gap)
  .slice(0, 20);

// ─── WRITE OUTPUT ───
const output = {
  overview: {
    totalContacts: contacts.length,
    totalAoAum: Math.round(totalBradAum),
    totalAoAumFormatted: `$${(totalBradAum / 1e6).toFixed(1)}M`,
    totalAllAum: Math.round(aumData.reduce((s, r) => s + (r['Asset Balance'] || 0), 0)),
    uniqueMetros: Object.keys(metroSummaries).length,
    uniqueTrips: Object.keys(contactsByTrip).length,
  },
  topFirms,       // Brad's territory
  allTopFirms,    // Full book
  tripSummaries,
  metroStats: Object.values(metroSummaries).sort((a, b) => b.contacts - a.contacts),
  pipelineSummary,
  topFirmsByTrip,
  untappedMetros,
};

// Tagged contacts for pipeline view
const taggedContacts = contacts.filter(c => c.pipeline || c.client || c.warm || c.cold || c.dripList)
  .map(c => ({ firstName: c.firstName, lastName: c.lastName, firmName: c.firmName, city: c.city, state: c.state, metro: c.metro, trip: c.trip, pipeline: c.pipeline, client: c.client, warm: c.warm, cold: c.cold, dripList: c.dripList }));

// Contacts by trip (tagged + top 50 untagged)
const contactsByTripOut = {};
for (const [trip, tContacts] of Object.entries(contactsByTrip)) {
  const tagged = tContacts.filter(c => c.pipeline || c.client || c.warm || c.cold);
  const untagged = tContacts.filter(c => !c.pipeline && !c.client && !c.warm && !c.cold).slice(0, 50);
  contactsByTripOut[trip] = [...tagged, ...untagged].map(c => ({
    firstName: c.firstName, lastName: c.lastName, firmName: c.firmName,
    city: c.city, state: c.state, metro: c.metro, trip: c.trip,
    pipeline: c.pipeline, client: c.client, warm: c.warm, cold: c.cold,
    dripList: c.dripList, notes: c.notes,
  }));
}

fs.writeFileSync(path.join(OUT_DIR, 'territory-data.json'), JSON.stringify(output, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'tagged-contacts.json'), JSON.stringify(taggedContacts));
fs.writeFileSync(path.join(OUT_DIR, 'contacts-by-trip.json'), JSON.stringify(contactsByTripOut));
fs.writeFileSync(path.join(OUT_DIR, 'offices.json'), JSON.stringify(offices.map(o => ({
  firmName: o.firmName, city: o.city, state: o.state, address: o.address,
  rep: o.rep, assetBalance: Math.round(o.assetBalance), monthlyNet: Math.round(o.monthlyNet),
}))));

console.log(`\nDone!`);
console.log(`  Brad AUM: $${(totalBradAum/1e6).toFixed(1)}M`);
console.log(`  Top firm: ${topFirms[0].name} $${(topFirms[0].aum/1e6).toFixed(1)}M`);
console.log(`  Tagged contacts: ${taggedContacts.length}`);
console.log(`  Trips: ${tripSummaries.length}, Metros: ${Object.keys(metroSummaries).length}`);
console.log(`  Untapped metros: ${untappedMetros.length}`);
