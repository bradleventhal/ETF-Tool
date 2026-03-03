import React, { useState, useMemo } from 'react';
import territoryData from '../public/data/territory.json';

const { overview, tripMetroMap, tripStats, metroStats, topFirms, topFirmsByAUM, taggedContacts } = territoryData;

export default function TerritoryPage() {
  const [search, setSearch] = useState('');
  const [filterTrip, setFilterTrip] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [tab, setTab] = useState('advisors');

  const trips = Object.keys(tripStats || {}).sort();

  const filtered = useMemo(() => {
    if (!taggedContacts) return [];
    return taggedContacts.filter((a) => {
      const q = search.toLowerCase();
      const matchSearch = !q || 
        (a.firstName + ' ' + a.lastName).toLowerCase().includes(q) ||
        (a.firmName || '').toLowerCase().includes(q) ||
        (a.city || '').toLowerCase().includes(q) ||
        (a.metro || '').toLowerCase().includes(q);
      const matchTrip = !filterTrip || a.trip === filterTrip;
      const matchStatus = !filterStatus || 
        (filterStatus === 'pipeline' && a.pipeline) ||
        (filterStatus === 'client' && a.client) ||
        (filterStatus === 'warm' && a.warm) ||
        (filterStatus === 'cold' && a.cold);
      return matchSearch && matchTrip && matchStatus;
    });
  }, [search, filterTrip, filterStatus]);

  return (
    <div style={{ background: '#0a0f1c', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a1f3a 0%, #0d1226 100%)', padding: '24px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#f8fafc' }}>Territory Intelligence</h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 14 }}>East Coast IBD — {overview?.totalContacts?.toLocaleString() || 0} contacts</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Contacts', value: overview?.totalContacts?.toLocaleString() || 0, color: '#3b82f6' },
            { label: 'Metros', value: overview?.totalMetros || 0, color: '#8b5cf6' },
            { label: 'Trips', value: overview?.totalTrips || 0, color: '#06b6d4' },
            { label: 'Pipeline', value: overview?.totalPipeline?.toLocaleString() || 0, color: '#22c55e' },
            { label: 'Clients', value: overview?.totalClient?.toLocaleString() || 0, color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#111827', borderRadius: 12, padding: '16px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['advisors', 'firms', 'trips'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: tab === t ? '#3b82f6' : '#1e293b', color: tab === t ? '#fff' : '#94a3b8' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Advisors Tab */}
        {tab === 'advisors' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, firm, city, metro..."
                style={{ flex: 1, minWidth: 200, padding: '10px 16px', borderRadius: 8, border: '1px solid #1e293b', background: '#111827', color: '#e2e8f0', fontSize: 14 }} />
              <select value={filterTrip} onChange={(e) => setFilterTrip(e.target.value)}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #1e293b', background: '#111827', color: '#e2e8f0', fontSize: 14 }}>
                <option value="">All Trips</option>
                {trips.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #1e293b', background: '#111827', color: '#e2e8f0', fontSize: 14 }}>
                <option value="">All Status</option>
                <option value="pipeline">Pipeline</option>
                <option value="client">Client</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
            </div>

            <div style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>{filtered.length} advisors</div>

            {/* Advisor Cards */}
            <div style={{ display: 'grid', gap: 8 }}>
              {filtered.slice(0, 100).map((a, i) => (
                <div key={i} style={{ background: '#111827', borderRadius: 10, padding: '14px 18px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#f1f5f9' }}>{a.firstName} {a.lastName}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{a.firmName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{a.city}, {a.state} · {a.metro}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {a.pipeline && <span style={{ background: '#22c55e22', color: '#22c55e', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>PIPELINE</span>}
                    {a.client && <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>CLIENT</span>}
                    {a.warm && <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>WARM</span>}
                    {a.cold && <span style={{ background: '#64748b22', color: '#64748b', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>COLD</span>}
                    {a.email && <a href={`mailto:${a.email}`} style={{ color: '#3b82f6', fontSize: 12, textDecoration: 'none' }}>✉️</a>}
                  </div>
                </div>
              ))}
              {filtered.length > 100 && <div style={{ textAlign: 'center', color: '#64748b', padding: 12 }}>Showing 100 of {filtered.length} — refine your search</div>}
            </div>
          </>
        )}

        {/* Firms Tab */}
        {tab === 'firms' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <h2 style={{ fontSize: 18, color: '#f1f5f9', marginBottom: 8 }}>Top 30 Firms by Contact Volume</h2>
            {(topFirms || []).map((f, i) => (
              <div key={i} style={{ background: '#111827', borderRadius: 10, padding: '14px 18px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12, marginRight: 8 }}>#{i + 1}</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{f.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ color: '#94a3b8' }}>{f.total} contacts</span>
                  {f.pipeline > 0 && <span style={{ color: '#22c55e' }}>{f.pipeline} pipeline</span>}
                  {f.client > 0 && <span style={{ color: '#3b82f6' }}>{f.client} clients</span>}
                </div>
              </div>
            ))}

            <h2 style={{ fontSize: 18, color: '#f1f5f9', marginTop: 24, marginBottom: 8 }}>Top 20 Firms by AUM</h2>
            {(topFirmsByAUM || []).map((f, i) => (
              <div key={i} style={{ background: '#111827', borderRadius: 10, padding: '14px 18px', border: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: 12, marginRight: 8 }}>#{i + 1}</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{f.name}</span>
                </div>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>${(f.aum / 1e6).toFixed(1)}M</span>
              </div>
            ))}
          </div>
        )}

        {/* Trips Tab */}
        {tab === 'trips' && (
          <div style={{ display: 'grid', gap: 8 }}>
            {trips.map((trip) => {
              const s = tripStats[trip] || {};
              const metros = tripMetroMap?.[trip] || [];
              return (
                <div key={trip} style={{ background: '#111827', borderRadius: 10, padding: '16px 18px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#f1f5f9' }}>{trip}</div>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>{s.total || 0} contacts</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Metros: {metros.join(', ') || 'N/A'}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, marginTop: 6 }}>
                    {s.pipeline > 0 && <span style={{ color: '#22c55e' }}>{s.pipeline} pipeline</span>}
                    {s.client > 0 && <span style={{ color: '#3b82f6' }}>{s.client} clients</span>}
                    {s.warm > 0 && <span style={{ color: '#f59e0b' }}>{s.warm} warm</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
