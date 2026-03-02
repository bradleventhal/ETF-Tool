const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../../data/ibd/IBD_East_Contacts_Clean.csv');
const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n');

function parseCsvLine(line) {
  const fields = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

// Header: First Name,Last Name,Firm Name,City,State,Office Address,Metro,Trip,Email,Pipeline,Client,Warm,Cold,Drip List,Notes
const contacts = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const f = parseCsvLine(line);
  contacts.push({
    firstName: f[0] || '', lastName: f[1] || '', firmName: f[2] || '',
    city: f[3] || '', state: f[4] || '', officeAddress: f[5] || '',
    metro: f[6] || '', trip: f[7] || '', email: f[8] || '',
    pipeline: f[9] === 'Y', client: f[10] === 'Y', warm: f[11] === 'Y',
    cold: f[12] === 'Y', dripList: f[13] === 'Y',
  });
}

console.log(`Parsed ${contacts.length} contacts`);

// Build trip → metro → cities
const tripMetroMap = {};
contacts.forEach(c => {
  if (!c.trip) return;
  const metro = c.metro || 'Other';
  if (!tripMetroMap[c.trip]) tripMetroMap[c.trip] = {};
  if (!tripMetroMap[c.trip][metro]) tripMetroMap[c.trip][metro] = new Set();
  if (c.city) tripMetroMap[c.trip][metro].add(c.city);
});
const tripMetroClean = {};
Object.keys(tripMetroMap).sort().forEach(trip => {
  tripMetroClean[trip] = {};
  Object.keys(tripMetroMap[trip]).sort().forEach(metro => {
    tripMetroClean[trip][metro] = [...tripMetroMap[trip][metro]].sort();
  });
});

// Trip stats
const tripStats = {};
contacts.forEach(c => {
  const trip = c.trip || 'Unassigned';
  if (!tripStats[trip]) tripStats[trip] = { total: 0, pipeline: 0, client: 0, warm: 0, cold: 0, drip: 0, untagged: 0, firmCount: new Set(), metros: new Set() };
  const s = tripStats[trip];
  s.total++;
  if (c.pipeline) s.pipeline++;
  else if (c.client) s.client++;
  else if (c.warm) s.warm++;
  else if (c.cold) s.cold++;
  else if (c.dripList) s.drip++;
  else s.untagged++;
  if (c.firmName) s.firmCount.add(c.firmName);
  if (c.metro) s.metros.add(c.metro);
});

// Metro stats
const metroStats = {};
contacts.forEach(c => {
  const metro = c.metro || 'Unknown';
  if (!metroStats[metro]) metroStats[metro] = { total: 0, pipeline: 0, client: 0, warm: 0, cold: 0, trip: c.trip || '', firms: new Set() };
  const s = metroStats[metro];
  s.total++;
  if (c.pipeline) s.pipeline++;
  if (c.client) s.client++;
  if (c.warm) s.warm++;
  if (c.cold) s.cold++;
  if (c.firmName) s.firms.add(c.firmName);
});

// Firm stats
const firmStats = {};
contacts.forEach(c => {
  const firm = c.firmName || 'Unknown';
  if (!firmStats[firm]) firmStats[firm] = { total: 0, pipeline: 0, client: 0, warm: 0, cold: 0 };
  const s = firmStats[firm];
  s.total++;
  if (c.pipeline) s.pipeline++;
  if (c.client) s.client++;
  if (c.warm) s.warm++;
  if (c.cold) s.cold++;
});

const totalPipeline = contacts.filter(c => c.pipeline).length;
const totalClient = contacts.filter(c => c.client).length;
const totalWarm = contacts.filter(c => c.warm).length;
const totalCold = contacts.filter(c => c.cold).length;
const totalDrip = contacts.filter(c => c.dripList).length;
const totalUntagged = contacts.filter(c => !c.pipeline && !c.client && !c.warm && !c.cold && !c.dripList).length;
const totalMetros = new Set(contacts.map(c => c.metro).filter(Boolean)).size;
const totalTrips = new Set(contacts.map(c => c.trip).filter(Boolean)).size;

const topFirms = Object.entries(firmStats).sort((a,b) => b[1].total - a[1].total).slice(0, 30);

// Tagged contacts for detail views
const tagged = contacts.filter(c => c.pipeline || c.client || c.warm || c.cold);

const output = {
  overview: { totalContacts: contacts.length, totalMetros, totalTrips, totalPipeline, totalClient, totalWarm, totalCold, totalDrip, totalUntagged },
  tripMetroMap: tripMetroClean,
  tripStats: Object.fromEntries(Object.entries(tripStats).map(([k, v]) => [k, { total: v.total, pipeline: v.pipeline, client: v.client, warm: v.warm, cold: v.cold, drip: v.drip, untagged: v.untagged, firmCount: v.firmCount.size, metroCount: v.metros.size }])),
  metroStats: Object.fromEntries(Object.entries(metroStats).sort((a,b) => b[1].total - a[1].total).map(([k, v]) => [k, { total: v.total, pipeline: v.pipeline, client: v.client, warm: v.warm, cold: v.cold, trip: v.trip, firmCount: v.firms.size }])),
  topFirms: topFirms.map(([name, s]) => ({ name, ...s })),
  topFirmsByAUM: [
    { name: "Ameriprise", aum: 53900000 },
    { name: "LPL", aum: 41100000 },
    { name: "Nations Financial", aum: 17700000 },
    { name: "Commonwealth", aum: 12300000 },
    { name: "Sanctuary Advisors", aum: 11400000 },
    { name: "Osaic", aum: 9800000 },
    { name: "Cambridge Investment Research", aum: 8200000 },
    { name: "Cetera", aum: 7500000 },
    { name: "Northwestern Mutual", aum: 6900000 },
    { name: "Kestra Financial", aum: 5800000 },
    { name: "Equitable Advisors", aum: 4200000 },
    { name: "MML Investors", aum: 3900000 },
    { name: "Lincoln Investment", aum: 3500000 },
    { name: "Stifel", aum: 3100000 },
    { name: "Janney Montgomery Scott", aum: 2800000 },
    { name: "Baird", aum: 2500000 },
    { name: "Hilltop Securities", aum: 2200000 },
    { name: "DA Davidson", aum: 1900000 },
    { name: "Mariner Wealth", aum: 1600000 },
    { name: "Private Advisor Group", aum: 1400000 },
  ],
  taggedContacts: tagged.map((c, i) => ({
    id: `c-${i}`, firstName: c.firstName, lastName: c.lastName, firmName: c.firmName,
    city: c.city, state: c.state, metro: c.metro, trip: c.trip, email: c.email,
    pipeline: c.pipeline, client: c.client, warm: c.warm, cold: c.cold,
  })),
};

const outPath = path.join(__dirname, '../public/data/territory.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)}KB)`);
console.log('Overview:', output.overview);
