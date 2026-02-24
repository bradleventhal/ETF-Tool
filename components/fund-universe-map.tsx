"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ZAxis, Cell, ReferenceLine, Label,
} from "recharts"
import { ArrowRightLeft, Search, X, SlidersHorizontal } from "lucide-react"
import type { FundData } from "@/lib/fund-types"

/* ═══ CONSTANTS ═══ */
const PRI = "#0f3d6b"
const DOT = "#3b82f6"
const HL = "#dc2626"

/* ═══ CREDIT HELPERS ═══ */
const CREDIT_LABELS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "Below CCC"]
function creditScore(f: FundData): number | null {
  const w: [keyof FundData, number][] = [["aaa",1],["aa",2],["a",3],["bbb",4],["bb",5],["b",6],["ccc",7],["belowCcc",8]]
  let total = 0, sumW = 0
  for (const [k, s] of w) { const v = f[k] as number | null; if (v != null && v > 0) { total += s * v; sumW += v } }
  return sumW > 0 ? total / sumW : null
}
function creditLabel(score: number): string {
  const i = Math.round(score) - 1
  return CREDIT_LABELS[i] ?? score.toFixed(1)
}

/* ═══ AXIS DEFINITIONS ═══ */
type AxisKey = "duration"|"ytwYtm"|"secYield"|"expense"|"sharpe"|"stdDev"|"credit"|"ytd"|"oneYear"|"threeYear"|"correlation"|"morningstarRating"
interface AxisOption { key: AxisKey; label: string; isCredit: boolean; fmt: (v:number)=>string; tickFmt: (v:number)=>string; getValue: (f:FundData)=>number|null }
const fp = (v:number) => `${v.toFixed(2)}%`
const fn = (v:number) => v.toFixed(2)
const AXES: AxisOption[] = [
  { key:"duration", label:"Duration (yrs)", isCredit:false, fmt:v=>`${v.toFixed(2)} yrs`, tickFmt:fn, getValue:f=>f.duration },
  { key:"ytwYtm", label:"YTW / YTM", isCredit:false, fmt:fp, tickFmt:fp, getValue:f=>f.ytwYtm },
  { key:"secYield", label:"SEC Yield", isCredit:false, fmt:fp, tickFmt:fp, getValue:f=>f.secYield },
  { key:"expense", label:"Expense Ratio", isCredit:false, fmt:fp, tickFmt:fp, getValue:f=>f.expense },
  { key:"sharpe", label:"Sharpe Ratio", isCredit:false, fmt:fn, tickFmt:fn, getValue:f=>f.sharpe },
  { key:"stdDev", label:"Std Dev", isCredit:false, fmt:fn, tickFmt:fn, getValue:f=>f.stdDev },
  { key:"credit", label:"Credit Quality", isCredit:true, fmt:v=>creditLabel(v), tickFmt:v=>{const r=Math.round(v);return r>=1&&r<=8?creditLabel(r):""}, getValue:f=>creditScore(f) },
  { key:"ytd", label:"YTD Return", isCredit:false, fmt:fp, tickFmt:fp, getValue:f=>f.ytd },
  { key:"oneYear", label:"1Y Return", isCredit:false, fmt:fp, tickFmt:fp, getValue:f=>f.oneYear },
  { key:"threeYear", label:"3Y Return", isCredit:false, fmt:fp, tickFmt:fp, getValue:f=>f.threeYear },
  { key:"correlation", label:"Correlation", isCredit:false, fmt:fn, tickFmt:fn, getValue:f=>f.correlation },
  { key:"morningstarRating", label:"Star Rating", isCredit:false, fmt:v=>`${v.toFixed(0)}\u2605`, tickFmt:v=>Number.isInteger(v)?`${v}\u2605`:"", getValue:f=>f.morningstarRating },
]
const axisIdx = (key: AxisKey) => AXES.findIndex(a => a.key === key)

/* ═══ PRESETS ═══ */
const PRESETS = [
  { label:"Yield vs Duration", x:"duration" as AxisKey, y:"ytwYtm" as AxisKey, insight:"Shows yield pickup per unit of interest rate risk -- are you getting paid enough for the duration you're taking?" },
  { label:"Yield vs Credit", x:"credit" as AxisKey, y:"ytwYtm" as AxisKey, insight:"Reveals whether higher yield comes from credit risk -- funds to the left offer higher quality at comparable yields." },
]

/* ═══ FILTER CONSTANTS ═══ */
const DUR_CATS = [{label:"Ultra-Short (0\u20131 yr)",min:0,max:1},{label:"Short (1\u20133.5 yrs)",min:1,max:3.5},{label:"Intermediate (3.5\u20136 yrs)",min:3.5,max:6},{label:"Long (6+ yrs)",min:6,max:100}]
const MSTAR_CATS = ["Nontraditional Bond","Multisector Bond","Short-Term Bond","Ultrashort Bond","High Yield Bond","Intermediate Core Bond","Intermediate Core-Plus Bond","Corporate Bond","Intermediate Government","Bank Loan","Emerging Markets Bond","Preferred Stock","Long-Term Bond"]
const CR_CATS = ["AAA","AA","A","BBB","BB & Below"] as const

/* ═══ CUSTOM DOT ═══ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Dot(props: any) {
  const { cx, cy, payload, hovered, onHover, onLeave, onClick } = props
  if (!payload || cx == null || cy == null || !isFinite(cx) || !isFinite(cy)) return null
  const isH = hovered === payload.ticker
  const r = isH ? 7 : 4.5
  return (
    <g onMouseEnter={() => onHover(payload.ticker)} onMouseLeave={onLeave} onClick={() => onClick?.(payload.ticker)} style={{ cursor: onClick ? "pointer" : "default" }}>
      <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
      <circle cx={cx} cy={cy} r={r} fill={payload.isHighlighted ? HL : DOT} stroke="#fff" strokeWidth={1.5} opacity={isH ? 1 : 0.75} style={{ transition: "r 0.15s, opacity 0.15s" }} />
      {isH && (<><rect x={cx - 20} y={cy - 22} width={40} height={16} rx={3} fill={PRI} opacity={0.9} /><text x={cx} y={cy - 11} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700}>{payload.ticker}</text></>)}
    </g>
  )
}

/* ═══ TOOLTIP ═══ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Tip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null
  const d = payload[0].payload
  const vp = (v: number|null) => v != null ? `${v.toFixed(2)}%` : "\u2014"
  const vn = (v: number|null) => v != null ? v.toFixed(2) : "\u2014"
  const stats = [{label:"YTW / YTM",value:vp(d.ytwYtm)},{label:"SEC Yield",value:vp(d.secYield)},{label:"Duration",value:d.duration!=null?`${d.duration.toFixed(2)} yrs`:"\u2014"},{label:"Credit",value:d.creditQuality??"\u2014"},{label:"Expense",value:vp(d.expense)},{label:"Sharpe",value:vn(d.sharpe)},{label:"Std Dev",value:vn(d.stdDev)}].filter(s=>s.value!=="\u2014")
  const perf = [{label:"YTD",value:vp(d.ytd)},{label:"1Y",value:vp(d.oneYear)},{label:"3Y",value:vp(d.threeYear)}].filter(s=>s.value!=="\u2014")
  return (
    <div className="rounded-lg border px-3 py-2.5 shadow-lg" style={{backgroundColor:"#fff",borderColor:"#e2e8f0",minWidth:210}}>
      <div className="flex items-center gap-2"><span className="text-xs font-bold" style={{color:PRI}}>{d.ticker}</span>{d.morningstarRating!=null&&d.morningstarRating>0&&<span className="text-[10px]" style={{color:"#f59e0b"}}>{"\u2605".repeat(d.morningstarRating)}</span>}</div>
      <div className="text-[10px] leading-snug" style={{color:"#64748b"}}>{d.name}</div>
      {d.morningstarCategory&&<div className="mt-0.5 text-[9px] font-medium" style={{color:"#94a3b8"}}>{d.morningstarCategory}</div>}
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t pt-1.5" style={{borderColor:"#f1f5f9"}}>{stats.map(s=>(<div key={s.label} className="flex items-baseline justify-between gap-2"><span className="text-[9px]" style={{color:"#94a3b8"}}>{s.label}</span><span className="text-[10px] font-semibold tabular-nums" style={{color:"#334155"}}>{s.value}</span></div>))}</div>
      {perf.length>0&&<div className="mt-1 flex gap-3 border-t pt-1" style={{borderColor:"#f1f5f9"}}>{perf.map(s=>(<div key={s.label} className="flex items-baseline gap-1"><span className="text-[9px]" style={{color:"#94a3b8"}}>{s.label}</span><span className="text-[10px] font-semibold tabular-nums" style={{color:"#334155"}}>{s.value}</span></div>))}</div>}
    </div>
  )
}

/* ═══ PROPS ═══ */
interface Props {
  funds: FundData[]
  highlightTicker?: string
  onSelectFund?: (ticker: string) => void
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export function FundUniverseMap({ funds, highlightTicker, onSelectFund }: Props) {
  /* Width measurement -- avoids ResponsiveContainer NaN bug */
  const wrapRef = useRef<HTMLDivElement>(null)
  const [chartW, setChartW] = useState(0)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) { const w = e.contentRect.width; if (w > 0) setChartW(w) }
    })
    ro.observe(el)
    const w = el.getBoundingClientRect().width
    if (w > 0) setChartW(w)
    return () => ro.disconnect()
  }, [])

  /* Axis & preset state */
  const [presetIdx, setPresetIdx] = useState(0)
  const [xI, setXI] = useState(axisIdx("duration"))
  const [yI, setYI] = useState(axisIdx("ytwYtm"))
  const xAxis = AXES[xI], yAxis = AXES[yI]

  const applyPreset = useCallback((i: number) => { setPresetIdx(i); const p = PRESETS[i]; if (p) { setXI(axisIdx(p.x)); setYI(axisIdx(p.y)) } }, [])

  /* Hover */
  const [hovered, setHovered] = useState<string | null>(null)

  /* Search & filters */
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [durCats, setDurCats] = useState<Set<string>>(new Set(DUR_CATS.map(c => c.label)))
  const [crCats, setCrCats] = useState<Set<string>>(new Set(CR_CATS))
  const [mstarCats, setMstarCats] = useState<Set<string>>(new Set(MSTAR_CATS))
  const [starMin, setStarMin] = useState(0)
  const [yieldMin, setYieldMin] = useState<number | null>(null)
  const [expenseMax, setExpenseMax] = useState<number | null>(null)
  const [sharpeMin, setSharpeMin] = useState<number | null>(null)
  const [stdDevMax, setStdDevMax] = useState<number | null>(null)

  const resetFilters = useCallback(() => { setSearch(""); setDurCats(new Set(DUR_CATS.map(c=>c.label))); setCrCats(new Set(CR_CATS)); setMstarCats(new Set(MSTAR_CATS)); setStarMin(0); setYieldMin(null); setExpenseMax(null); setSharpeMin(null); setStdDevMax(null) }, [])
  const hasActive = search || durCats.size < DUR_CATS.length || crCats.size < 5 || mstarCats.size < MSTAR_CATS.length || starMin > 0 || yieldMin != null || expenseMax != null || sharpeMin != null || stdDevMax != null

  /* Build scatter data */
  const { pts, avgY, xDomain, yDomain } = useMemo(() => {
    const out: Array<{x:number;y:number;ticker:string;name:string;isHighlighted:boolean;duration:number|null;ytwYtm:number|null;secYield:number|null;expense:number|null;sharpe:number|null;stdDev:number|null;ytd:number|null;oneYear:number|null;threeYear:number|null;creditQuality:string|null;morningstarRating:number|null;morningstarCategory:string|null}> = []
    let yS = 0, cnt = 0

    for (const f of funds) {
      // Search
      if (search) { const q = search.toLowerCase(); if (!f.ticker.toLowerCase().includes(q) && !f.name.toLowerCase().includes(q)) continue }
      // Duration filter
      if (durCats.size < DUR_CATS.length) { if (f.duration == null) continue; if (!DUR_CATS.some(c => durCats.has(c.label) && f.duration! >= c.min && f.duration! < c.max)) continue }
      // Credit filter
      if (crCats.size < 5) { const cs = creditScore(f); if (cs == null) continue; const r = Math.round(cs); let pass = false; if (crCats.has("AAA") && r === 1) pass = true; if (crCats.has("AA") && r === 2) pass = true; if (crCats.has("A") && r === 3) pass = true; if (crCats.has("BBB") && r === 4) pass = true; if (crCats.has("BB & Below") && r >= 5) pass = true; if (!pass) continue }
      // Morningstar category
      if (mstarCats.size < MSTAR_CATS.length) { if (!f.morningstarCategory || !mstarCats.has(f.morningstarCategory)) continue }
      // Star rating
      if (starMin > 0 && (f.morningstarRating ?? 0) < starMin) continue
      // Range filters
      if (yieldMin != null && (f.ytwYtm ?? -Infinity) < yieldMin) continue
      if (expenseMax != null && (f.expense ?? Infinity) > expenseMax) continue
      if (sharpeMin != null && (f.sharpe ?? -Infinity) < sharpeMin) continue
      if (stdDevMax != null && (f.stdDev ?? Infinity) > stdDevMax) continue

      const xV = xAxis.getValue(f), yV = yAxis.getValue(f)
      if (xV == null || yV == null || !isFinite(xV) || !isFinite(yV)) continue
      const cs = creditScore(f)
      out.push({ x: xV, y: yV, ticker: f.ticker, name: f.name, isHighlighted: f.ticker === highlightTicker, duration: f.duration, ytwYtm: f.ytwYtm, secYield: f.secYield, expense: f.expense, sharpe: f.sharpe, stdDev: f.stdDev, ytd: f.ytd, oneYear: f.oneYear, threeYear: f.threeYear, creditQuality: cs != null ? creditLabel(cs) : null, morningstarRating: f.morningstarRating, morningstarCategory: f.morningstarCategory })
      yS += yV; cnt++
    }

    out.sort((a, b) => a.x - b.x)
    const avg = cnt > 0 ? yS / cnt : 0

    // Compute static domains
    let xd: [number, number] = [0, 10]
    let yd: [number, number] = [0, 10]
    if (xAxis.isCredit) { xd = [0.5, 8.5] }
    else if (out.length > 0) {
      let lo = Infinity, hi = -Infinity
      for (const d of out) { if (d.x < lo) lo = d.x; if (d.x > hi) hi = d.x }
      const pad = (hi - lo) * 0.1 || 1
      xd = [Math.max(0, Math.floor((lo - pad) * 10) / 10), Math.ceil((hi + pad) * 10) / 10]
    }
    if (yAxis.isCredit) { yd = [0.5, 8.5] }
    else if (out.length > 0) {
      let lo = Infinity, hi = -Infinity
      for (const d of out) { if (d.y < lo) lo = d.y; if (d.y > hi) hi = d.y }
      const pad = (hi - lo) * 0.1 || 0.01
      yd = [Math.floor((lo - pad) * 100) / 100, Math.ceil((hi + pad) * 100) / 100]
    }

    return { pts: out, avgY: avg, xDomain: xd, yDomain: yd }
  }, [funds, xAxis, yAxis, highlightTicker, search, durCats, crCats, mstarCats, starMin, yieldMin, expenseMax, sharpeMin, stdDevMax])

  return (
    <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wide" style={{ color: PRI }}>FUND UNIVERSE MAP</h2>
        <span className="text-xs font-medium" style={{ color: PRI }}>{pts.length} of {funds.length} funds plotted</span>
      </div>

      {/* Presets */}
      <div className="mb-2 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => applyPreset(i)} className="rounded-full px-3 py-1 text-xs font-semibold transition-colors" style={presetIdx === i ? { backgroundColor: PRI, color: "#fff" } : { backgroundColor: "#f1f5f9", color: "#475569" }}>{p.label}</button>
        ))}
      </div>
      {PRESETS[presetIdx] && <p className="mb-3 text-xs italic" style={{ color: "#64748b" }}>{PRESETS[presetIdx].insight}</p>}

      {/* Axis selectors */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: PRI }}>X</span>
        <select value={xI} onChange={e => { setXI(Number(e.target.value)); setPresetIdx(-1) }} className="h-7 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0" }}>{AXES.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}</select>
        <button onClick={() => { const p = xI; setXI(yI); setYI(p); setPresetIdx(-1) }} className="flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition-all hover:border-[#0f3d6b] hover:bg-[#f0f7ff]" style={{ borderColor: "#e2e8f0", color: "#64748b" }} title="Swap axes"><ArrowRightLeft className="h-3 w-3" /></button>
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: PRI }}>Y</span>
        <select value={yI} onChange={e => { setYI(Number(e.target.value)); setPresetIdx(-1) }} className="h-7 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0" }}>{AXES.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}</select>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: "#94a3b8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Search ticker or name..." className="h-7 w-40 rounded-md border pl-7 pr-2 text-xs outline-none transition-colors focus:border-[#0f3d6b]" style={{ borderColor: searchFocused ? PRI : "#e2e8f0" }} />
          {search && <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-gray-100"><X className="h-3 w-3" style={{ color: "#94a3b8" }} /></button>}
        </div>
        <button onClick={() => setShowFilters(v => !v)} className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors" style={{ borderColor: showFilters ? PRI : "#e2e8f0", color: showFilters ? PRI : "#64748b", backgroundColor: showFilters ? "#f0f7ff" : "#fff" }}><SlidersHorizontal className="h-3 w-3" /> Filters{hasActive && <span className="ml-0.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />}</button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 rounded-lg border p-3 text-xs" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-1.5 font-semibold" style={{ color: "#334155" }}>Duration</div>
              {DUR_CATS.map(c => (<label key={c.label} className="flex cursor-pointer items-center gap-1.5 py-0.5"><input type="checkbox" checked={durCats.has(c.label)} onChange={() => { const n = new Set(durCats); n.has(c.label) ? n.delete(c.label) : n.add(c.label); setDurCats(n) }} className="rounded" /><span style={{ color: "#475569" }}>{c.label}</span></label>))}
            </div>
            <div>
              <div className="mb-1.5 font-semibold" style={{ color: "#334155" }}>Credit Quality</div>
              {CR_CATS.map(c => (<label key={c} className="flex cursor-pointer items-center gap-1.5 py-0.5"><input type="checkbox" checked={crCats.has(c)} onChange={() => { const n = new Set(crCats); n.has(c) ? n.delete(c) : n.add(c); setCrCats(n) }} className="rounded" /><span style={{ color: "#475569" }}>{c}</span></label>))}
            </div>
            <div>
              <div className="mb-1.5 font-semibold" style={{ color: "#334155" }}>Morningstar Category</div>
              <div className="max-h-36 overflow-y-auto pr-1">{MSTAR_CATS.map(c => (<label key={c} className="flex cursor-pointer items-center gap-1.5 py-0.5"><input type="checkbox" checked={mstarCats.has(c)} onChange={() => { const n = new Set(mstarCats); n.has(c) ? n.delete(c) : n.add(c); setMstarCats(n) }} className="rounded" /><span style={{ color: "#475569" }}>{c}</span></label>))}</div>
            </div>
            <div>
              <div className="mb-1.5 font-semibold" style={{ color: "#334155" }}>Range Filters</div>
              <div className="space-y-2">
                <div><label className="text-[10px]" style={{ color: "#64748b" }}>Min YTW / YTM (%)</label><input type="number" step="0.1" value={yieldMin ?? ""} onChange={e => setYieldMin(e.target.value ? Number(e.target.value) : null)} className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{ borderColor: "#e2e8f0" }} /></div>
                <div><label className="text-[10px]" style={{ color: "#64748b" }}>Max Expense (%)</label><input type="number" step="0.1" value={expenseMax ?? ""} onChange={e => setExpenseMax(e.target.value ? Number(e.target.value) : null)} className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{ borderColor: "#e2e8f0" }} /></div>
                <div><label className="text-[10px]" style={{ color: "#64748b" }}>Min Sharpe</label><input type="number" step="0.1" value={sharpeMin ?? ""} onChange={e => setSharpeMin(e.target.value ? Number(e.target.value) : null)} className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{ borderColor: "#e2e8f0" }} /></div>
                <div><label className="text-[10px]" style={{ color: "#64748b" }}>Max Std Dev</label><input type="number" step="0.1" value={stdDevMax ?? ""} onChange={e => setStdDevMax(e.target.value ? Number(e.target.value) : null)} className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{ borderColor: "#e2e8f0" }} /></div>
              </div>
              <div className="mt-2">
                <div className="text-[10px] font-medium" style={{ color: "#64748b" }}>Min Star Rating</div>
                <div className="mt-1 flex gap-1">{[0,1,2,3,4,5].map(v => (<button key={v} onClick={() => setStarMin(v)} className="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors" style={starMin === v ? { backgroundColor: PRI, color: "#fff" } : { backgroundColor: "#f1f5f9", color: "#64748b" }}>{v === 0 ? "Any" : "\u2605".repeat(v)}</button>))}</div>
              </div>
            </div>
          </div>
          {hasActive && <button onClick={resetFilters} className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: "#ef4444" }}><X className="h-3 w-3" /> Reset all filters</button>}
        </div>
      )}

      {/* Chart area */}
      <div ref={wrapRef} style={{ width: "100%", minHeight: 400 }}>
        {pts.length < 1 ? (
          <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed" style={{ borderColor: "#e2e8f0" }}>
            <p className="text-sm" style={{ color: "#94a3b8" }}>No funds match current filters.</p>
          </div>
        ) : chartW > 0 ? (
          <ScatterChart width={chartW} height={400} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" dataKey="x" name={xAxis.label} domain={xDomain} ticks={xAxis.isCredit ? [1,2,3,4,5,6,7,8] : undefined} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => xAxis.tickFmt(v)} tickLine={{ stroke: "#e2e8f0" }} axisLine={{ stroke: "#e2e8f0" }}>
              <Label value={xAxis.label} position="bottom" offset={12} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
            </XAxis>
            <YAxis type="number" dataKey="y" name={yAxis.label} domain={yDomain} ticks={yAxis.isCredit ? [1,2,3,4,5,6,7,8] : undefined} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => yAxis.tickFmt(v)} tickLine={{ stroke: "#e2e8f0" }} axisLine={{ stroke: "#e2e8f0" }} width={yAxis.isCredit ? 45 : undefined}>
              <Label value={yAxis.label} angle={-90} position="insideLeft" offset={-5} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
            </YAxis>
            <ZAxis range={[50, 50]} />
            <Tooltip content={<Tip />} cursor={false} />
            {pts.length >= 2 && isFinite(avgY) && <ReferenceLine y={avgY} stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={1} />}
            <Scatter data={pts} shape={<Dot hovered={hovered} onHover={setHovered} onLeave={() => setHovered(null)} onClick={onSelectFund} />}>
              {pts.map(d => <Cell key={d.ticker} fill={d.isHighlighted ? HL : DOT} />)}
            </Scatter>
          </ScatterChart>
        ) : null}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-between text-[10px]" style={{ color: "#94a3b8" }}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DOT }} /> Funds in universe</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: "#94a3b8" }} /> Average</span>
        </div>
        <span className="italic">Click any fund to view details</span>
      </div>
    </div>
  )
}
