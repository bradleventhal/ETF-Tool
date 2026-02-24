"use client"

import { useState, useMemo, useCallback } from "react"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ZAxis, Cell, ReferenceLine, Label,
} from "recharts"
import { Search, X, SlidersHorizontal, ArrowRightLeft } from "lucide-react"
import type { FundData } from "@/lib/fund-types"

/* ── Credit helpers ── */
const CREDIT_LABELS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "Below CCC"]

function creditScore(f: FundData): number | null {
  const w: [keyof FundData, number][] = [
    ["aaa", 1], ["aa", 2], ["a", 3], ["bbb", 4], ["bb", 5], ["b", 6], ["ccc", 7], ["belowCcc", 8],
  ]
  let total = 0, sumW = 0
  for (const [k, s] of w) { const v = f[k] as number | null; if (v != null && v > 0) { total += s * v; sumW += v } }
  return sumW > 0 ? total / sumW : null
}

function creditLabel(score: number): string {
  const idx = Math.round(score) - 1
  return CREDIT_LABELS[idx] ?? score.toFixed(1)
}

/* ── Axis system ── */
type AxisKey = "duration" | "ytwYtm" | "secYield" | "expense" | "sharpe" | "stdDev" | "credit" |
  "ytd" | "oneYear" | "threeYear" | "correlation" | "morningstarRating"

interface AxisOption {
  key: AxisKey; label: string; isCredit: boolean
  format: (v: number) => string
  tickFormat: (v: number) => string
  getValue: (f: FundData) => number | null
}

const fmtPct = (v: number) => `${v.toFixed(2)}%`
const fmtNum = (v: number) => v.toFixed(2)
const fmtYrs = (v: number) => `${v.toFixed(2)} yrs`

const AXIS_OPTIONS: AxisOption[] = [
  { key: "duration", label: "Duration (yrs)", isCredit: false, format: fmtYrs, tickFormat: fmtNum, getValue: f => f.duration },
  { key: "ytwYtm", label: "YTW / YTM", isCredit: false, format: fmtPct, tickFormat: fmtPct, getValue: f => f.ytwYtm },
  { key: "secYield", label: "SEC Yield", isCredit: false, format: fmtPct, tickFormat: fmtPct, getValue: f => f.secYield },
  { key: "expense", label: "Expense Ratio", isCredit: false, format: fmtPct, tickFormat: fmtPct, getValue: f => f.expense },
  { key: "sharpe", label: "Sharpe Ratio", isCredit: false, format: fmtNum, tickFormat: fmtNum, getValue: f => f.sharpe },
  { key: "stdDev", label: "Std Dev", isCredit: false, format: fmtNum, tickFormat: fmtNum, getValue: f => f.stdDev },
  { key: "credit", label: "Credit Quality", isCredit: true, format: v => creditLabel(v), tickFormat: v => { const r = Math.round(v); return r >= 1 && r <= 8 ? creditLabel(r) : "" }, getValue: f => creditScore(f) },
  { key: "ytd", label: "YTD Return", isCredit: false, format: fmtPct, tickFormat: fmtPct, getValue: f => f.ytd },
  { key: "oneYear", label: "1Y Return", isCredit: false, format: fmtPct, tickFormat: fmtPct, getValue: f => f.oneYear },
  { key: "threeYear", label: "3Y Return", isCredit: false, format: fmtPct, tickFormat: fmtPct, getValue: f => f.threeYear },
  { key: "correlation", label: "Correlation", isCredit: false, format: fmtNum, tickFormat: fmtNum, getValue: f => f.correlation },
  { key: "morningstarRating", label: "Star Rating", isCredit: false, format: v => `${v.toFixed(0)}★`, tickFormat: v => Number.isInteger(v) ? `${v}★` : "", getValue: f => f.morningstarRating },
]

const findAxis = (key: AxisKey) => AXIS_OPTIONS.findIndex(a => a.key === key)

/* ── Presets ── */
const PRESETS = [
  { label: "Yield vs Duration", x: "duration", y: "ytwYtm", insight: "Shows yield pickup per unit of interest rate risk -- are you getting paid enough for the duration you're taking?" },
  { label: "Yield vs Credit", x: "credit", y: "ytwYtm", insight: "Reveals whether higher yield comes from credit risk -- funds to the left offer higher quality at comparable yields." },
]

/* ── Duration categories ── */
const DURATION_CATEGORIES = [
  { label: "Ultra-Short (0–1 yr)", min: 0, max: 1 },
  { label: "Short (1–3.5 yrs)", min: 1, max: 3.5 },
  { label: "Intermediate (3.5–6 yrs)", min: 3.5, max: 6 },
  { label: "Long (6+ yrs)", min: 6, max: 100 },
]

/* ── Morningstar categories ── */
const MSTAR_CATEGORIES = [
  "Nontraditional Bond", "Multisector Bond", "Short-Term Bond", "Ultrashort Bond",
  "High Yield Bond", "Intermediate Core Bond", "Intermediate Core-Plus Bond",
  "Corporate Bond", "Intermediate Government", "Bank Loan", "Emerging Markets Bond",
  "Preferred Stock", "Long-Term Bond",
]

/* ── Colors ── */
const PRIMARY = "#0f3d6b"
const HIGHLIGHT = "#dc2626"
const DOT_DEFAULT = "#3b82f6"

interface Props {
  funds: FundData[]
  highlightTicker?: string
  onSelectFund?: (ticker: string) => void
}

/* ── TickerDot ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TickerDot(props: any) {
  const { cx, cy, payload, hoveredTicker, onHover, onLeave, onClick } = props
  if (cx == null || cy == null || !payload || isNaN(cx) || isNaN(cy)) return null
  const isHovered = hoveredTicker === payload.ticker
  const r = isHovered ? 7 : 4.5
  return (
    <g
      onMouseEnter={() => onHover(payload.ticker)}
      onMouseLeave={onLeave}
      onClick={() => onClick?.(payload.ticker)}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
      <circle cx={cx} cy={cy} r={r} fill={payload.isHighlighted ? HIGHLIGHT : DOT_DEFAULT}
        stroke="#fff" strokeWidth={1.5} opacity={isHovered ? 1 : 0.75}
        style={{ transition: "r 0.15s, opacity 0.15s" }} />
      {isHovered && (
        <>
          <rect x={cx - 20} y={cy - 22} width={40} height={16} rx={3}
            fill={PRIMARY} opacity={0.9} />
          <text x={cx} y={cy - 11} textAnchor="middle" fill="#fff"
            fontSize={9} fontWeight={700}>{payload.ticker}</text>
        </>
      )}
    </g>
  )
}

/* ── Tooltip ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null
  const d = payload[0].payload
  const fp = (v: number | null) => v != null ? `${v.toFixed(2)}%` : "\u2014"
  const fn = (v: number | null) => v != null ? v.toFixed(2) : "\u2014"
  const fundStats = [
    { label: "YTW / YTM", value: fp(d.ytwYtm) },
    { label: "SEC Yield", value: fp(d.secYield) },
    { label: "Duration", value: d.duration != null ? `${d.duration.toFixed(2)} yrs` : "\u2014" },
    { label: "Credit", value: d.creditQuality ?? "\u2014" },
    { label: "Expense", value: fp(d.expense) },
    { label: "Sharpe", value: fn(d.sharpe) },
    { label: "Std Dev", value: fn(d.stdDev) },
  ].filter(s => s.value !== "\u2014")
  const perfStats = [
    { label: "YTD", value: fp(d.ytd) },
    { label: "1Y", value: fp(d.oneYear) },
    { label: "3Y", value: fp(d.threeYear) },
  ].filter(s => s.value !== "\u2014")
  return (
    <div className="rounded-lg border px-3 py-2.5 shadow-lg" style={{ backgroundColor: "#fff", borderColor: "#e2e8f0", minWidth: 210 }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color: PRIMARY }}>{d.ticker}</span>
        {d.morningstarRating != null && d.morningstarRating > 0 && (
          <span className="text-[10px]" style={{ color: "#f59e0b" }}>{"★".repeat(d.morningstarRating)}</span>
        )}
      </div>
      <div className="text-[10px] leading-snug" style={{ color: "#64748b" }}>{d.name}</div>
      {d.morningstarCategory && (
        <div className="mt-0.5 text-[9px] font-medium" style={{ color: "#94a3b8" }}>{d.morningstarCategory}</div>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t pt-1.5" style={{ borderColor: "#f1f5f9" }}>
        {fundStats.map(s => (
          <div key={s.label} className="flex items-baseline justify-between gap-2">
            <span className="text-[9px]" style={{ color: "#94a3b8" }}>{s.label}</span>
            <span className="text-[10px] font-semibold tabular-nums" style={{ color: "#334155" }}>{s.value}</span>
          </div>
        ))}
      </div>
      {perfStats.length > 0 && (
        <div className="mt-1 flex gap-3 border-t pt-1" style={{ borderColor: "#f1f5f9" }}>
          {perfStats.map(s => (
            <div key={s.label} className="flex items-baseline gap-1">
              <span className="text-[9px]" style={{ color: "#94a3b8" }}>{s.label}</span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: "#334155" }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════ MAIN COMPONENT ═══════════════════════════════════════ */
export function FundUniverseMap({ funds, highlightTicker, onSelectFund }: Props) {
  const [presetIdx, setPresetIdx] = useState(0)
  const [xIdx, setXIdx] = useState(findAxis("duration"))
  const [yIdx, setYIdx] = useState(findAxis("ytwYtm"))
  const xAxis = AXIS_OPTIONS[xIdx]
  const yAxis = AXIS_OPTIONS[yIdx]
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)

  /* ── Search ── */
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)

  /* ── Filter panel ── */
  const [showFilters, setShowFilters] = useState(false)

  /* ── Duration category filter ── */
  const [durationCats, setDurationCats] = useState<Set<string>>(new Set(DURATION_CATEGORIES.map(c => c.label)))

  /* ── Credit quality filter ── */
  const CREDIT_CATS = ["AAA", "AA", "A", "BBB", "BB & Below"] as const
  const [creditCats, setCreditCats] = useState<Set<string>>(new Set(CREDIT_CATS))

  /* ── Morningstar category filter ── */
  const [mstarCats, setMstarCats] = useState<Set<string>>(new Set(MSTAR_CATEGORIES))

  /* ── Star rating filter ── */
  const [starMin, setStarMin] = useState(0)

  /* ── Range filters ── */
  const [yieldMinPreset, setYieldMinPreset] = useState<number | null>(null)
  const [expenseMaxPreset, setExpenseMaxPreset] = useState<number | null>(null)
  const [sharpeMinPreset, setSharpeMinPreset] = useState<number | null>(null)
  const [stdDevMaxPreset, setStdDevMaxPreset] = useState<number | null>(null)

  /* ── Preset handler ── */
  const applyPreset = useCallback((idx: number) => {
    setPresetIdx(idx)
    const p = PRESETS[idx]
    if (p) { setXIdx(findAxis(p.x as AxisKey)); setYIdx(findAxis(p.y as AxisKey)) }
  }, [])

  /* ── Data computation ── */
  const { sortedData, avgY } = useMemo(() => {
    const matchesSearch = (f: FundData) => {
      if (!search) return true
      const q = search.toLowerCase()
      return f.ticker.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
    }

    const matchesDuration = (f: FundData) => {
      if (durationCats.size === DURATION_CATEGORIES.length) return true
      if (f.duration == null) return false
      return DURATION_CATEGORIES.some(c => durationCats.has(c.label) && f.duration! >= c.min && f.duration! < c.max)
    }

    const matchesCredit = (f: FundData) => {
      if (creditCats.size === 5) return true
      const cs = creditScore(f)
      if (cs == null) return false
      const rounded = Math.round(cs)
      if (creditCats.has("AAA") && rounded === 1) return true
      if (creditCats.has("AA") && rounded === 2) return true
      if (creditCats.has("A") && rounded === 3) return true
      if (creditCats.has("BBB") && rounded === 4) return true
      if (creditCats.has("BB & Below") && rounded >= 5) return true
      return false
    }

    const matchesMstar = (f: FundData) => {
      if (mstarCats.size === MSTAR_CATEGORIES.length) return true
      return f.morningstarCategory ? mstarCats.has(f.morningstarCategory) : false
    }

    const matchesStar = (f: FundData) => {
      if (starMin <= 0) return true
      return (f.morningstarRating ?? 0) >= starMin
    }

    const matchesRange = (f: FundData) => {
      if (yieldMinPreset != null && (f.ytwYtm ?? -Infinity) < yieldMinPreset) return false
      if (expenseMaxPreset != null && (f.expense ?? Infinity) > expenseMaxPreset) return false
      if (sharpeMinPreset != null && (f.sharpe ?? -Infinity) < sharpeMinPreset) return false
      if (stdDevMaxPreset != null && (f.stdDev ?? Infinity) > stdDevMaxPreset) return false
      return true
    }

    const points: { x: number; y: number; ticker: string; name: string; isHighlighted: boolean;
      duration: number | null; ytwYtm: number | null; secYield: number | null; expense: number | null;
      sharpe: number | null; stdDev: number | null; ytd: number | null; oneYear: number | null; threeYear: number | null;
      creditQuality: string | null; morningstarRating: number | null; morningstarCategory: string | null }[] = []
    let ySum = 0, count = 0
    for (const f of funds) {
      if (!matchesSearch(f) || !matchesDuration(f) || !matchesCredit(f) || !matchesMstar(f) || !matchesStar(f) || !matchesRange(f)) continue
      const xVal = xAxis.getValue(f)
      const yVal = yAxis.getValue(f)
      if (xVal == null || yVal == null) continue
      const cs = creditScore(f)
      points.push({
        x: xVal, y: yVal, ticker: f.ticker, name: f.name,
        isHighlighted: highlightTicker === f.ticker,
        duration: f.duration, ytwYtm: f.ytwYtm, secYield: f.secYield, expense: f.expense,
        sharpe: f.sharpe, stdDev: f.stdDev, ytd: f.ytd, oneYear: f.oneYear, threeYear: f.threeYear,
        creditQuality: cs != null ? creditLabel(cs) : null,
        morningstarRating: f.morningstarRating, morningstarCategory: f.morningstarCategory,
      })
      ySum += yVal; count++
    }
    const sorted = points.sort((a, b) => a.x - b.x)
    const aY = count > 0 ? ySum / count : 0
    return { sortedData: sorted, avgY: aY }
  }, [funds, xAxis, yAxis, search, highlightTicker, durationCats, creditCats, mstarCats, starMin, yieldMinPreset, expenseMaxPreset, sharpeMinPreset, stdDevMaxPreset])

  /* ── Reset ── */
  const resetFilters = useCallback(() => {
    setSearch(""); setDurationCats(new Set(DURATION_CATEGORIES.map(c => c.label)))
    setCreditCats(new Set(["AAA", "AA", "A", "BBB", "BB & Below"]))
    setMstarCats(new Set(MSTAR_CATEGORIES)); setStarMin(0)
    setYieldMinPreset(null); setExpenseMaxPreset(null); setSharpeMinPreset(null); setStdDevMaxPreset(null)
  }, [])

  const hasActiveFilters = search || durationCats.size < DURATION_CATEGORIES.length || creditCats.size < 5 ||
    mstarCats.size < MSTAR_CATEGORIES.length || starMin > 0 ||
    yieldMinPreset != null || expenseMaxPreset != null || sharpeMinPreset != null || stdDevMaxPreset != null

  /* ═══ RENDER ═══ */
  return (
    <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wide" style={{ color: PRIMARY }}>FUND UNIVERSE MAP</h2>
        <span className="text-xs font-medium" style={{ color: "#0f3d6b" }}>{sortedData.length} of {funds.length} funds plotted</span>
      </div>

      {/* Presets */}
      <div className="mb-2 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => applyPreset(i)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
            style={presetIdx === i
              ? { backgroundColor: PRIMARY, color: "#fff" }
              : { backgroundColor: "#f1f5f9", color: "#475569" }}>
            {p.label}
          </button>
        ))}
      </div>
      {PRESETS[presetIdx] && (
        <p className="mb-3 text-xs italic" style={{ color: "#64748b" }}>{PRESETS[presetIdx].insight}</p>
      )}

      {/* Controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* X axis */}
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>X</span>
        <select value={xIdx} onChange={e => { setXIdx(Number(e.target.value)); setPresetIdx(-1) }}
          className="h-7 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0" }}>
          {AXIS_OPTIONS.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
        </select>

        {/* Swap button */}
        <button
          onClick={() => { const prev = xIdx; setXIdx(yIdx); setYIdx(prev); setPresetIdx(-1) }}
          className="flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition-all hover:border-[#0f3d6b] hover:bg-[#f0f7ff]"
          style={{ borderColor: "#e2e8f0", color: "#64748b" }}
          title="Swap X and Y axes"
        >
          <ArrowRightLeft className="h-3 w-3" />
        </button>

        {/* Y axis */}
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>Y</span>
        <select value={yIdx} onChange={e => { setYIdx(Number(e.target.value)); setPresetIdx(-1) }}
          className="h-7 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0" }}>
          {AXIS_OPTIONS.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
        </select>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: "#94a3b8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search ticker or nam\u2026"
            className="h-7 w-40 rounded-md border pl-7 pr-2 text-xs outline-none transition-colors focus:border-[#0f3d6b]"
            style={{ borderColor: searchFocused ? PRIMARY : "#e2e8f0" }} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-gray-100">
              <X className="h-3 w-3" style={{ color: "#94a3b8" }} />
            </button>
          )}
        </div>

        {/* Filters */}
        <button onClick={() => setShowFilters(v => !v)}
          className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors"
          style={{ borderColor: showFilters ? PRIMARY : "#e2e8f0", color: showFilters ? PRIMARY : "#64748b", backgroundColor: showFilters ? "#f0f7ff" : "#fff" }}>
          <SlidersHorizontal className="h-3 w-3" /> Filters
          {hasActiveFilters && <span className="ml-0.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 rounded-lg border p-3 text-xs" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Duration */}
            <div>
              <div className="mb-1.5 font-semibold" style={{ color: "#334155" }}>Duration</div>
              {DURATION_CATEGORIES.map(c => (
                <label key={c.label} className="flex cursor-pointer items-center gap-1.5 py-0.5">
                  <input type="checkbox" checked={durationCats.has(c.label)}
                    onChange={() => { const n = new Set(durationCats); n.has(c.label) ? n.delete(c.label) : n.add(c.label); setDurationCats(n) }}
                    className="rounded" />
                  <span style={{ color: "#475569" }}>{c.label}</span>
                </label>
              ))}
            </div>
            {/* Credit */}
            <div>
              <div className="mb-1.5 font-semibold" style={{ color: "#334155" }}>Credit Quality</div>
              {(["AAA", "AA", "A", "BBB", "BB & Below"] as const).map(c => (
                <label key={c} className="flex cursor-pointer items-center gap-1.5 py-0.5">
                  <input type="checkbox" checked={creditCats.has(c)}
                    onChange={() => { const n = new Set(creditCats); n.has(c) ? n.delete(c) : n.add(c); setCreditCats(n) }}
                    className="rounded" />
                  <span style={{ color: "#475569" }}>{c}</span>
                </label>
              ))}
            </div>
            {/* Category */}
            <div>
              <div className="mb-1.5 font-semibold" style={{ color: "#334155" }}>Morningstar Category</div>
              <div className="max-h-36 overflow-y-auto pr-1">
                {MSTAR_CATEGORIES.map(c => (
                  <label key={c} className="flex cursor-pointer items-center gap-1.5 py-0.5">
                    <input type="checkbox" checked={mstarCats.has(c)}
                      onChange={() => { const n = new Set(mstarCats); n.has(c) ? n.delete(c) : n.add(c); setMstarCats(n) }}
                      className="rounded" />
                    <span style={{ color: "#475569" }}>{c}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Range filters */}
            <div>
              <div className="mb-1.5 font-semibold" style={{ color: "#334155" }}>Range Filters</div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px]" style={{ color: "#64748b" }}>Min YTW / YTM (%)</label>
                  <input type="number" step="0.1" value={yieldMinPreset ?? ""} onChange={e => setYieldMinPreset(e.target.value ? Number(e.target.value) : null)}
                    className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{ borderColor: "#e2e8f0" }} />
                </div>
                <div>
                  <label className="text-[10px]" style={{ color: "#64748b" }}>Max Expense (%)</label>
                  <input type="number" step="0.1" value={expenseMaxPreset ?? ""} onChange={e => setExpenseMaxPreset(e.target.value ? Number(e.target.value) : null)}
                    className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{ borderColor: "#e2e8f0" }} />
                </div>
                <div>
                  <label className="text-[10px]" style={{ color: "#64748b" }}>Min Sharpe</label>
                  <input type="number" step="0.1" value={sharpeMinPreset ?? ""} onChange={e => setSharpeMinPreset(e.target.value ? Number(e.target.value) : null)}
                    className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{ borderColor: "#e2e8f0" }} />
                </div>
                <div>
                  <label className="text-[10px]" style={{ color: "#64748b" }}>Max Std Dev</label>
                  <input type="number" step="0.1" value={stdDevMaxPreset ?? ""} onChange={e => setStdDevMaxPreset(e.target.value ? Number(e.target.value) : null)}
                    className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{ borderColor: "#e2e8f0" }} />
                </div>
              </div>
              {/* Star rating */}
              <div className="mt-2">
                <div className="text-[10px] font-medium" style={{ color: "#64748b" }}>Min Star Rating</div>
                <div className="mt-1 flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => setStarMin(v)}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                      style={starMin === v ? { backgroundColor: PRIMARY, color: "#fff" } : { backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      {v === 0 ? "Any" : "★".repeat(v)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: "#ef4444" }}>
              <X className="h-3 w-3" /> Reset all filters
            </button>
          )}
        </div>
      )}

      {/* ═══ CHART ═══ */}
      {sortedData.length < 1 ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed" style={{ borderColor: "#e2e8f0" }}>
          <p className="text-sm" style={{ color: "#94a3b8" }}>No funds match current filters. Try broadening your criteria.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number" dataKey="x" name={xAxis.label}
              domain={
                xAxis.isCredit
                  ? [0.5, 8.5]
                  : [(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9 * 10) / 10), (dataMax: number) => Math.ceil(dataMax * 1.1 * 10) / 10]
              }
              ticks={xAxis.isCredit ? [1, 2, 3, 4, 5, 6, 7, 8] : undefined}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={v => xAxis.tickFormat(v)}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
            >
              <Label value={xAxis.label} position="bottom" offset={12} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
            </XAxis>
            <YAxis
              type="number" dataKey="y" name={yAxis.label}
              domain={
                yAxis.isCredit
                  ? [0.5, 8.5]
                  : undefined
              }
              ticks={yAxis.isCredit ? [1, 2, 3, 4, 5, 6, 7, 8] : undefined}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={v => yAxis.tickFormat(v)}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
              width={yAxis.isCredit ? 45 : undefined}
            >
              <Label value={yAxis.label} angle={-90} position="insideLeft" offset={-5} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
            </YAxis>
            <ZAxis range={[50, 50]} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            {sortedData.length >= 2 && <ReferenceLine y={avgY} stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={1} />}
            <Scatter data={sortedData}
              shape={<TickerDot hoveredTicker={hoveredTicker} onHover={setHoveredTicker} onLeave={() => setHoveredTicker(null)} onClick={onSelectFund} />}
            >
              {sortedData.map((d) => (
                <Cell key={d.ticker} fill={d.isHighlighted ? HIGHLIGHT : DOT_DEFAULT} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-between text-[10px]" style={{ color: "#94a3b8" }}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DOT_DEFAULT }} /> Funds in universe
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[1px] w-5" style={{ backgroundColor: "#94a3b8", borderTop: "2px dashed #94a3b8" }} /> Average
          </span>
        </div>
        <span className="italic">Click any fund to view details</span>
      </div>
    </div>
  )
}
