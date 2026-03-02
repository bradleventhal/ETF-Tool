#!/usr/bin/env node
/**
 * Territory Intelligence v2 — Data Processor
 * Reads all 4 IBD files + AdvizorPro export → generates static JSON for the territory page
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data/ibd');
const ADVIZOR_PATH = path.resolve(__dirname, '../../data/advizorpro_angel_oak_etf_holders.xlsx');
const OUT_PATH = path.resolve(__dirname, '../public/data/territory-v2.json');

// ─── 1. Parse IBD Contacts CSV ───
console.log('Parsing IBD contacts...');
const csvRaw = fs.readFileSync(path.join(DATA_DIR, 'IBD_East_Contacts_Clean.csv'), 'utf-8');

// Proper CSV parsing with quote awareness (lesson learned)
function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i+1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim()); current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i+1] === '\n') i++;
      row.push(current.trim()); current = '';
      if (row.length > 1) rows.push(row);
      row = [];
    } else {
      current += ch;
    }
  }
  if (row.length > 0 || current) { row.push(current.trim()); rows.push(row); }
  return rows;
}

const csvRows = parseCSV(csvRaw);
const csvHeader = csvRows[0];
console.log(`  CSV headers: ${csvHeader.join(', ')}`);
console.log(`  CSV rows: ${csvRows.length - 1}`);

// Map header indices
const H = {};
csvHeader.forEach((h, i) => H[h.toLowerCase().replace(/\s+/g, '_')] = i);

const contacts = [];
for (let i = 1; i < csvRows.length; i++) {
  const r = csvRows[i];
  if (!r[H.first_name] && !r[H.last_name]) continue;
  const status = r[H.pipeline] === 'Y' ? 'pipeline' :
                 r[H.client] === 'Y' ? 'client' :
                 r[H.warm] === 'Y' ? 'warm' :
                 r[H.cold] === 'Y' ? 'cold' :
                 r[H.drip_list] === 'Y' ? 'drip' : 'untagged';
  contacts.push({
    id: i,
    fn: r[H.first_name] || '',
    ln: r[H.last_name] || '',
    firm: r[H.firm_name] || '',
    city: r[H.city] || '',
    state: r[H.state] || '',
    addr: r[H.office_address] || '',
    metro: r[H.metro] || '',
    trip: r[H.trip] || '',
    email: r[H.email] || '',
    status,
  });
}
console.log(`  Contacts parsed: ${contacts.length}`);

// ─── 2. Parse Industry AUM (Firms and Offices Actual AUM) ───
console.log('Parsing industry AUM...');
const wb1 = XLSX.readFile(path.join(DATA_DIR, 'Angel Oak - Firms and Offices Actual AUM (1).xlsx'));
const ws1 = wb1.Sheets[wb1.SheetNames[0]];
const aum1Raw = XLSX.utils.sheet_to_json(ws1, { range: 6, defval: '' });
console.log(`  Industry AUM rows: ${aum1Raw.length}`);

// Key by "Firm|Address|City" for lookup
const industryAUM = {};
for (const row of aum1Raw) {
  const firm = (row['Initiating Firm'] || '').toUpperCase().trim();
  const addr = (row['Office Address'] || '').toUpperCase().trim();
  const city = (row['Office City'] || '').toUpperCase().trim();
  const key = `${firm}|${addr}|${city}`;
  const assets = parseFloat(row['Industry Assets']) || 0;
  industryAUM[key] = (industryAUM[key] || 0) + assets;
}

// ─── 3. Parse Peer Group AUM ───
console.log('Parsing peer group AUM...');
const wb2 = XLSX.readFile(path.join(DATA_DIR, 'Angel Oak - Firms by Office - Peer Group and Channel.xlsx'));
const ws2 = wb2.Sheets[wb2.SheetNames[0]];
// Row 7 has the peer group names, row 8 has "Peer Industry Assets" labels
// We need to manually extract headers from row 7
const peerRaw = XLSX.utils.sheet_to_json(ws2, { range: 7, defval: '' });
console.log(`  Peer group rows: ${peerRaw.length}`);

// Get actual peer group names from row 7 (0-indexed row 6 in the sheet)
const peerGroupNames = [];
const peerRef = ws2;
// Read row 7 (1-indexed) which is the header with peer group names
for (let c = 6; c <= 24; c++) {
  const cellAddr = XLSX.utils.encode_cell({ r: 6, c }); // 0-indexed row 6
  const cell = peerRef[cellAddr];
  peerGroupNames.push(cell ? cell.v : `PeerGroup${c-5}`);
}
console.log(`  Peer groups found: ${peerGroupNames.length}`);

// Build peer group lookup by office
const peerGroupAUM = {};
for (const row of peerRaw) {
  const firm = (row['Initiating Firm'] || '').toUpperCase().trim();
  const addr = (row['Office Address'] || '').toUpperCase().trim();
  const city = (row['Office City'] || '').toUpperCase().trim();
  const key = `${firm}|${addr}|${city}`;
  
  const peerData = {};
  // The columns after the first 6 are peer groups
  const vals = Object.values(row);
  const keys = Object.keys(row);
  for (let j = 6; j < keys.length && j - 6 < peerGroupNames.length; j++) {
    const val = parseFloat(vals[j]) || 0;
    if (val > 0) {
      peerData[peerGroupNames[j - 6]] = val;
    }
  }
  if (Object.keys(peerData).length > 0) {
    peerGroupAUM[key] = peerData;
  }
}

// ─── 4. Parse Angel Oak Actual AUM (Dec IBD AUM) ───
console.log('Parsing Angel Oak AUM...');
const wb3 = XLSX.readFile(path.join(DATA_DIR, 'Dec IBD AUM.xlsx'));
const ws3 = wb3.Sheets[wb3.SheetNames[0]];
const aoAumRaw = XLSX.utils.sheet_to_json(ws3, { defval: '' });
console.log(`  AO AUM rows: ${aoAumRaw.length}`);

// Aggregate AO AUM by office (firm + address + city)
const aoAUM = {};
for (const row of aoAumRaw) {
  const firm = (row['Firm Name'] || '').toUpperCase().trim();
  const addr = (row['Office Address Line 1'] || row['Office Address'] || '').toUpperCase().trim();
  const city = (row['Office City'] || '').toUpperCase().trim();
  const key = `${firm}|${addr}|${city}`;
  const bal = parseFloat(row['Asset Balance']) || 0;
  if (!aoAUM[key]) aoAUM[key] = { total: 0, products: {} };
  aoAUM[key].total += bal;
  const prod = row['Product Portfolio'] || 'Unknown';
  aoAUM[key].products[prod] = (aoAUM[key].products[prod] || 0) + bal;
}

// ─── 5. Parse AdvizorPro (optional enrichment) ───
let advizorData = {};
if (fs.existsSync(ADVIZOR_PATH)) {
  console.log('Parsing AdvizorPro data...');
  const wb4 = XLSX.readFile(ADVIZOR_PATH);
  const ws4 = wb4.Sheets[wb4.SheetNames[0]];
  const advRaw = XLSX.utils.sheet_to_json(ws4, { range: 3, defval: '' });
  console.log(`  AdvizorPro rows: ${advRaw.length}`);
  for (const row of advRaw) {
    const fn = (row['First Name'] || '').trim();
    const ln = (row['Last Name'] || '').trim();
    const key = `${fn}|${ln}`.toUpperCase();
    advizorData[key] = {
      phone: row['Phone'] || row['Mobile Phone'] || row['Landline Phone'] || '',
      title: row['Title'] || '',
      designations: row['Designations'] || '',
      firmAUM: row['Firm AUM'] || '',
      linkedin: row['LinkedIn'] || '',
    };
  }
  console.log(`  AdvizorPro contacts indexed: ${Object.keys(advizorData).length}`);
}

// ─── 6. Enrich contacts with office-level data ───
console.log('Enriching contacts...');

// Build office lookup from contacts
// We need to match contacts to AUM data via firm name + address/city
// Contact has: firm, addr (office address), city, state
// AUM data keyed by: FIRM|ADDRESS|CITY

// For each contact, try to find matching office in AUM data
// Use fuzzy matching on firm name since formats differ
function normFirm(f) {
  return f.toUpperCase().replace(/[,.\-\/\\()&']/g, '').replace(/\s+/g, ' ').trim()
    .replace(/ LLC$/, '').replace(/ INC$/, '').replace(/ CORP$/, '').replace(/ FINANCIAL$/, '')
    .replace(/ SERVICES$/, '').replace(/ ADVISORS$/, '').replace(/ ADVISORY$/, '');
}

// Build secondary indexes for AUM data by normalized firm + city
const industryByFirmCity = {};
for (const [key, val] of Object.entries(industryAUM)) {
  const [firm, , city] = key.split('|');
  const nk = `${normFirm(firm)}|${city}`;
  industryByFirmCity[nk] = (industryByFirmCity[nk] || 0) + val;
}

const peerByFirmCity = {};
for (const [key, val] of Object.entries(peerGroupAUM)) {
  const [firm, , city] = key.split('|');
  const nk = `${normFirm(firm)}|${city}`;
  if (!peerByFirmCity[nk]) peerByFirmCity[nk] = {};
  for (const [pg, amt] of Object.entries(val)) {
    peerByFirmCity[nk][pg] = (peerByFirmCity[nk][pg] || 0) + amt;
  }
}

const aoByFirmCity = {};
for (const [key, val] of Object.entries(aoAUM)) {
  const [firm, , city] = key.split('|');
  const nk = `${normFirm(firm)}|${city}`;
  if (!aoByFirmCity[nk]) aoByFirmCity[nk] = { total: 0, products: {} };
  aoByFirmCity[nk].total += val.total;
  for (const [p, a] of Object.entries(val.products)) {
    aoByFirmCity[nk].products[p] = (aoByFirmCity[nk].products[p] || 0) + a;
  }
}

// Build unique offices from contacts
const officeMap = {}; // "firmNorm|city" → office data
for (const c of contacts) {
  const fk = `${normFirm(c.firm)}|${c.city.toUpperCase().trim()}`;
  if (!officeMap[fk]) {
    officeMap[fk] = {
      firm: c.firm,
      addr: c.addr,
      city: c.city,
      state: c.state,
      industryAUM: industryByFirmCity[fk] || 0,
      aoAUM: aoByFirmCity[fk]?.total || 0,
      aoProducts: aoByFirmCity[fk]?.products || {},
      peerGroups: peerByFirmCity[fk] || {},
    };
  }
}

// Enrich contacts with advizorpro and office key
const enriched = contacts.map(c => {
  const advKey = `${c.fn}|${c.ln}`.toUpperCase();
  const adv = advizorData[advKey];
  const officeKey = `${normFirm(c.firm)}|${c.city.toUpperCase().trim()}`;
  return {
    ...c,
    phone: adv?.phone || '',
    title: adv?.title || '',
    officeKey,
  };
});

// ─── 7. Build output structures ───
console.log('Building output...');

// Metro → contacts
const metroContacts = {};
const tripContacts = {};
const tripMetros = {};

for (const c of enriched) {
  const m = c.metro || 'Unassigned';
  const t = c.trip || 'Unassigned';
  if (!metroContacts[m]) metroContacts[m] = [];
  metroContacts[m].push(c.id);
  if (!tripContacts[t]) tripContacts[t] = [];
  tripContacts[t].push(c.id);
  if (!tripMetros[t]) tripMetros[t] = new Set();
  tripMetros[t].add(m);
}

// Convert sets
for (const t of Object.keys(tripMetros)) {
  tripMetros[t] = [...tripMetros[t]].sort();
}

// Compute "displacement score" for each office: high industry AUM + low AO AUM = high opportunity
// Score = industryAUM * (1 - aoAUM/industryAUM) weighted
for (const key of Object.keys(officeMap)) {
  const o = officeMap[key];
  const penetration = o.industryAUM > 0 ? o.aoAUM / o.industryAUM : 1;
  o.displacementScore = o.industryAUM * (1 - penetration);
}

// Build metro stats
const metroStats = {};
for (const [m, ids] of Object.entries(metroContacts)) {
  const cs = ids.map(id => enriched.find(c => c.id === id)).filter(Boolean);
  const firms = new Set(cs.map(c => c.firm));
  const trips = new Set(cs.map(c => c.trip));
  metroStats[m] = {
    total: cs.length,
    pipeline: cs.filter(c => c.status === 'pipeline').length,
    client: cs.filter(c => c.status === 'client').length,
    warm: cs.filter(c => c.status === 'warm').length,
    cold: cs.filter(c => c.status === 'cold').length,
    drip: cs.filter(c => c.status === 'drip').length,
    untagged: cs.filter(c => c.status === 'untagged').length,
    firmCount: firms.size,
    trip: [...trips][0] || '',
  };
}

// Trip stats
const tripStats = {};
for (const [t, ids] of Object.entries(tripContacts)) {
  const cs = ids.map(id => enriched.find(c => c.id === id)).filter(Boolean);
  const firms = new Set(cs.map(c => c.firm));
  tripStats[t] = {
    total: cs.length,
    pipeline: cs.filter(c => c.status === 'pipeline').length,
    client: cs.filter(c => c.status === 'client').length,
    warm: cs.filter(c => c.status === 'warm').length,
    cold: cs.filter(c => c.status === 'cold').length,
    drip: cs.filter(c => c.status === 'drip').length,
    untagged: cs.filter(c => c.status === 'untagged').length,
    firmCount: firms.size,
    metroCount: (tripMetros[t] || []).length,
    metros: tripMetros[t] || [],
  };
}

// Overview
const overview = {
  totalContacts: enriched.length,
  totalMetros: Object.keys(metroContacts).filter(m => m !== 'Unassigned').length,
  totalTrips: Object.keys(tripContacts).filter(t => t !== 'Unassigned').length,
  pipeline: enriched.filter(c => c.status === 'pipeline').length,
  client: enriched.filter(c => c.status === 'client').length,
  warm: enriched.filter(c => c.status === 'warm').length,
  cold: enriched.filter(c => c.status === 'cold').length,
  drip: enriched.filter(c => c.status === 'drip').length,
  untagged: enriched.filter(c => c.status === 'untagged').length,
};

// Peer group names list
const peerGroupList = peerGroupNames.filter(p => p && !p.startsWith('PeerGroup'));

// ─── 8. Write output ───
// We store contacts as a compact array and offices separately to keep file size reasonable
const output = {
  overview,
  contacts: enriched.map(c => ({
    id: c.id, fn: c.fn, ln: c.ln, firm: c.firm, city: c.city, state: c.state,
    addr: c.addr, metro: c.metro, trip: c.trip, email: c.email, status: c.status,
    phone: c.phone, title: c.title, ok: c.officeKey,
  })),
  offices: officeMap,
  metroStats,
  tripStats,
  tripMetros,
  peerGroupList,
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(output));
const sizeMB = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(1);
console.log(`\n✅ Written to ${OUT_PATH} (${sizeMB} MB)`);
console.log(`   Contacts: ${output.contacts.length}`);
console.log(`   Offices: ${Object.keys(output.offices).length}`);
console.log(`   Metros: ${Object.keys(metroStats).length}`);
console.log(`   Trips: ${Object.keys(tripStats).length}`);
