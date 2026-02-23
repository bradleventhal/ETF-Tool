"use client"

import { useState, useMemo, useCallback } from "react"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ZAxis, Cell, ReferenceLine, Label,
} from "recharts"
import { Search, X, SlidersHorizontal } from "lucide-react"
import type { FundData } from "@/lib/fund-types"

/* ── Helpers ── */
function nz(v: number | null | undefined): number { return v ?? 0 }

function creditScore(fund: FundData): number | null {
  const buckets = [
    { w: 1, v: nz(fund.aaa) }, { w: 2, v: nz(fund.aa) }, { w: 3, v: nz(fund.a) },
    { w: 4, v: nz(fund.bbb) }, { w: 5, v: nz(fund.bb) }, { w: 6, v: nz(fund.b) },
    { w: 7, v: nz(fund.ccc) }, { w: 8, v: nz(fund.belowCcc) },
  ]
  const total = buckets.reduce((s, b) => s + b.v, 0)
  if (total < 0.01) return null
  return buckets.reduce((s, b) => s + b.w * b.v, 0) / total
}

const CREDIT_LABELS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "<CCC"]
function creditLabel(score: number): string {
  return CREDIT_LABELS[Math.max(0, Math.min(7, Math.round(score) - 1))]
}

/* ── Axis definitions ── */
type AxisKey = {
  key: string; label: string
  format: (v: number) => string
  getValue: (fund: FundData) => number | null
}

const AXIS_OPTIONS: AxisKey[] = [
  { key: "secYield", label: "30-Day SEC Yield", format: v => `${v.toFixed(2)}%`, getValue: f => f.secYield != null ? f.secYield * 100 : null },
  { key: "distYield", label: "Distribution Yield", format: v => `${v.toFixed(2)}%`, getValue: f => f.distributionYield != null ? f.distributionYield * 100 : null },
  { key: "ytwYtm", label: "YTW / YTM", format: v => `${v.toFixed(2)}%`, getValue: f => f.ytwYtm != null ? f.ytwYtm * 100 : f.secYield != null ? f.secYield * 100 : null },
  { key: "duration", label: "Duration (yrs)", format: v => v.toFixed(2), getValue: f => f.duration },
  { key: "stdDev", label: "Standard Deviation", format: v => v.toFixed(2), getValue: f => f.stdDev },
  { key: "sharpe", label: "Sharpe Ratio", format: v => v.toFixed(2), getValue: f => f.sharpe },
  { key: "expense", label: "Expense Ratio", format: v => `${v.toFixed(2)}%`, getValue: f => f.expense != null ? f.expense * 100 : null },
  { key: "credit", label: "Credit Quality", format: v => creditLabel(v), getValue: f => creditScore(f) },
  { key: "ytd", label: "YTD Return", format: v => `${v.toFixed(2)}%`, getValue: f => f.ytd != null ? f.ytd * 100 : null },
  { key: "oneYear", label: "1-Year Return", format: v => `${v.toFixed(2)}%`, getValue: f => f.oneYear != null ? f.oneYear * 100 : null },
  { key: "threeYear", label: "3-Year Return", format: v => `${v.toFixed(2)}%`, getValue: f => f.threeYear != null ? f.threeYear * 100 : null },
  { key: "securitized", label: "Securitized %", format: v => `${v.toFixed(1)}%`, getValue: f => f.securitized != null ? f.securitized * 100 : null },
  { key: "corpCredit", label: "Corp Credit %", format: v => `${v.toFixed(1)}%`, getValue: f => f.corporateCredit != null ? f.corporateCredit * 100 : null },
]

const findAxis = (key: string) => AXIS_OPTIONS.findIndex(a => a.key === key)

/* ── Presets ── */
const PRESETS = [
  { label: "Yield vs Duration", x: "duration", y: "ytwYtm", insight: "Shows yield pickup per unit of interest rate risk -- are you getting paid enough for the duration you're taking?" },
  { label: "Yield vs Risk", x: "stdDev", y: "ytwYtm", insight: "Maps yield against volatility -- funds in the upper-left quadrant deliver the most yield per unit of risk." },
  { label: "Credit vs Yield", x: "credit", y: "ytwYtm", insight: "Reveals whether higher yield comes from credit risk -- funds to the left offer higher quality at comparable yields." },
]

/* ── Duration categories ── */
const DURATION_CATEGORIES = [
  { label: "Ultrashort", min: 0, max: 1 },
  { label: "Short", min: 1, max: 3.5 },
  { label: "Intermediate", min: 3.5, max: 6 },
  { label: "Long", min: 6, max: 100 },
] as const

/* ── Morningstar categories ── */
const MSTAR_CATEGORIES = [
  "Ultrashort Bond", "Short-Term Bond", "Intermediate Core Bond",
  "Intermediate Core-Plus Bond", "Intermediate Government", "Long Government",
  "Short Government", "Nontraditional Bond", "Multisector Bond",
  "High Yield Bond", "Bank Loan",
] as const

/* ── Colors ── */
const PRIMARY = "#0f3d6b"
const HIGHLIGHT = "#dc2626"
const DOT_DEFAULT = "#3b82f6"

interface Props {
  funds: FundData[]
  highlightTicker?: string
  onSelectFund?: (ticker: string) => void
}

/* ── Custom dot ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TickerDot(props: any) {
  const { cx, cy, payload, hoveredTicker, onHover, onLeave, onClick } = props
  if (!cx || !cy || !payload) return null
  const isHighlighted = payload.isHighlighted
  const isHovered = payload.ticker === hoveredTicker
  const r = isHighlighted ? 7 : isHovered ? 6 : 4.5
  const fill = isHighlighted ? HIGHLIGHT : DOT_DEFAULT

  return (
    <g>
      <circle
        cx={cx} cy={cy} r={r} fill={fill}
        stroke={isHovered ? PRIMARY : "transparent"} strokeWidth={isHovered ? 2 : 0}
        fillOpacity={isHighlighted ? 1 : 0.75}
        style={{ cursor: "pointer", transition: "r 0.15s" }}
        onMouseEnter={() => onHover?.(payload.ticker)}
        onMouseLeave={() => onLeave?.()}
        onClick={() => onClick?.(payload.ticker)}
      />
      {(isHighlighted || isHovered) && (
        <g>
          <rect x={cx - 20} y={cy - 22} width={40} height={16} rx={3} fill={isHighlighted ? HIGHLIGHT : PRIMARY} />
          <text x={cx} y={cy - 11} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
            {payload.ticker}
          </text>
        </g>
      )}
    </g>
  )
}

/* ── Toggle chip ── */
function Chip({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all"
      style={{
        backgroundColor: active ? PRIMARY : "#f1f5f9",
        color: active ? "#fff" : "#94a3b8",
      }}
    >
      {label}
      {count !== undefined && (
        <span className="text-[9px] font-bold tabular-nums" style={{ opacity: 0.7 }}>{count}</span>
      )}
    </button>
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
  const [starMin, setStarMin] = useState(0) // 0 = no filter

  /* ── Range filters -- null means "no filter" ── */
  const [yieldMin, setYieldMin] = useState<string>("")
  const [yieldMax, setYieldMax] = useState<string>("")
  const [durationMin, setDurationMin] = useState<string>("")
  const [durationMax, setDurationMax] = useState<string>("")
  const [expenseMax, setExpenseMax] = useState<string>("")
  const [sharpeMin, setSharpeMin] = useState<string>("")
  const [stdDevMax, setStdDevMax] = useState<string>("")

  /* ── Compute fund counts per Morningstar category ── */
  const mstarCatCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    funds.forEach(f => {
      const cat = f.morningstarCategory
      if (cat) counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [funds])

  /* ── Data pipeline ── */
  const { sortedData, avgX, avgY } = useMemo(() => {
    const searchLower = search.toLowerCase()
    let xSum = 0, ySum = 0, count = 0
    const points = funds.map(f => {
      // Search filter (just filter the chart, don't highlight by default)
      if (search && !f.ticker.toLowerCase().includes(searchLower) && !f.name.toLowerCase().includes(searchLower)) return null

      // Duration category filter
      const dur = f.duration ?? 0
      const durCat = DURATION_CATEGORIES.find(c => dur >= c.min && dur < c.max)
      if (durCat && !durationCats.has(durCat.label)) return null

      // Credit quality filter
      const cs = creditScore(f)
      if (cs != null) {
        const cl = creditLabel(cs)
        if (cl === "AAA" && !creditCats.has("AAA")) return null
        if (cl === "AA" && !creditCats.has("AA")) return null
        if (cl === "A" && !creditCats.has("A")) return null
        if (cl === "BBB" && !creditCats.has("BBB")) return null
        if (["BB", "B", "CCC", "<CCC"].includes(cl) && !creditCats.has("BB & Below")) return null
      }

      // Morningstar category filter
      if (f.morningstarCategory && !mstarCats.has(f.morningstarCategory)) return null

      // Star rating filter
      if (starMin > 0 && f.morningstarRating != null && f.morningstarRating < starMin) return null

      // Range filters (only applied if user entered a value)
      const yld = (f.ytwYtm ?? f.secYield ?? 0) * 100
      if (yieldMin && yld < parseFloat(yieldMin)) return null
      if (yieldMax && yld > parseFloat(yieldMax)) return null
      if (durationMin && f.duration != null && f.duration < parseFloat(durationMin)) return null
      if (durationMax && f.duration != null && f.duration > parseFloat(durationMax)) return null
      if (expenseMax && f.expense != null && f.expense * 100 > parseFloat(expenseMax)) return null
      if (sharpeMin && f.sharpe != null && f.sharpe < parseFloat(sharpeMin)) return null
      if (stdDevMax && f.stdDev != null && f.stdDev > parseFloat(stdDevMax)) return null

      const xVal = xAxis.getValue(f)
      const yVal = yAxis.getValue(f)
      if (xVal == null || yVal == null) return null

      xSum += xVal; ySum += yVal; count++
      return {
        ticker: f.ticker, name: f.name, x: xVal, y: yVal,
        isHighlighted: f.ticker === highlightTicker,
      }
    }).filter(Boolean) as { ticker: string; name: string; x: number; y: number; isHighlighted: boolean }[]

    return {
      sortedData: points.sort((a, b) => a.x - b.x),
      avgX: count > 0 ? xSum / count : 0,
      avgY: count > 0 ? ySum / count : 0,
    }
  }, [funds, xAxis, yAxis, highlightTicker, search, durationCats, creditCats, mstarCats, starMin, yieldMin, yieldMax, durationMin, durationMax, expenseMax, sharpeMin, stdDevMax])

  /* ── Filter state checks ── */
  const allDurSelected = durationCats.size === DURATION_CATEGORIES.length
  const allCreditSelected = creditCats.size === CREDIT_CATS.length
  const allMstarSelected = mstarCats.size === MSTAR_CATEGORIES.length
  const hasRangeFilters = !!(yieldMin || yieldMax || durationMin || durationMax || expenseMax || sharpeMin || stdDevMax)
  const hasActiveFilters = !!search || !allDurSelected || !allCreditSelected || !allMstarSelected || starMin > 0 || hasRangeFilters
  const activeFilterCount = [!allDurSelected, !allCreditSelected, !allMstarSelected, starMin > 0, hasRangeFilters, !!search].filter(Boolean).length

  const clearFilters = useCallback(() => {
    setSearch("")
    setDurationCats(new Set(DURATION_CATEGORIES.map(c => c.label)))
    setCreditCats(new Set(CREDIT_CATS))
    setMstarCats(new Set(MSTAR_CATEGORIES))
    setStarMin(0)
    setYieldMin(""); setYieldMax(""); setDurationMin(""); setDurationMax("")
    setExpenseMax(""); setSharpeMin(""); setStdDevMax("")
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]?.payload) return null
    const d = payload[0].payload
    return (
      <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ backgroundColor: "#fff", borderColor: "#e2e8f0" }}>
        <div className="text-xs font-bold" style={{ color: PRIMARY }}>{d.ticker}</div>
        <div className="text-[10px]" style={{ color: "#64748b" }}>{d.name}</div>
        <div className="mt-1 flex gap-3 text-[10px] font-semibold" style={{ color: "#334155" }}>
          <span>{xAxis.label}: {xAxis.format(d.x)}</span>
          <span>{yAxis.label}: {yAxis.format(d.y)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: PRIMARY }}>Fund Universe Map</h3>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: DOT_DEFAULT }}>
          {sortedData.length} of {funds.length} funds plotted
        </span>
      </div>

      {/* Presets */}
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => { setPresetIdx(i); setXIdx(findAxis(p.x)); setYIdx(findAxis(p.y)) }}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
            style={{ backgroundColor: presetIdx === i ? PRIMARY : "#fff", color: presetIdx === i ? "#fff" : "#64748b", border: `1px solid ${presetIdx === i ? PRIMARY : "#e2e8f0"}` }}
          >{p.label}</button>
        ))}
      </div>
      <p className="mb-4 text-[11px] italic leading-relaxed" style={{ color: "#64748b" }}>{PRESETS[presetIdx]?.insight}</p>

      {/* Axis selectors + search + filter toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>X</span>
          <select value={xIdx} onChange={e => { setXIdx(+e.target.value); setPresetIdx(-1) }}
            className="h-8 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0", color: "#334155" }}>
            {AXIS_OPTIONS.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
          </select>
        </div>
        <span className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>vs</span>
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>Y</span>
          <select value={yIdx} onChange={e => { setYIdx(+e.target.value); setPresetIdx(-1) }}
            className="h-8 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0", color: "#334155" }}>
            {AXIS_OPTIONS.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Search with autocomplete */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94a3b8" }} />
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="Search ticker or name..."
              className="h-8 w-[180px] rounded-md border pl-8 pr-7 text-xs"
              style={{ borderColor: "#e2e8f0", color: "#334155" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
                <X className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} />
              </button>
            )}
            {searchFocused && search.length > 0 && (
              <div className="absolute left-0 top-full z-30 mt-1 max-h-[180px] w-[240px] overflow-y-auto rounded-lg border shadow-xl" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                {(() => {
                  const sl = search.toLowerCase()
                  const matches = funds.filter(f => f.ticker.toLowerCase().includes(sl) || f.name.toLowerCase().includes(sl))
                  return matches.length === 0 ? (
                    <div className="px-3 py-2 text-[11px]" style={{ color: "#94a3b8" }}>No matches</div>
                  ) : matches.slice(0, 8).map(f => (
                    <button key={f.ticker}
                      onMouseDown={e => { e.preventDefault(); setSearch(f.ticker); setSearchFocused(false) }}
                      className="block w-full px-3 py-2 text-left text-[11px] font-medium transition-colors hover:bg-[#f0f7ff]"
                      style={{ color: "#334155" }}
                    >
                      <span className="font-bold">{f.ticker}</span>{" "}
                      <span style={{ color: "#94a3b8" }}>{f.name.slice(0, 30)}</span>
                    </button>
                  ))
                })()}
              </div>
            )}
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(!showFilters)}
            className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-all"
            style={{
              borderColor: hasActiveFilters ? PRIMARY : "#e2e8f0",
              color: hasActiveFilters ? PRIMARY : "#64748b",
              backgroundColor: hasActiveFilters ? "#f0f7ff" : "#fff",
            }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ═══ FILTER PANEL ═══ */}
      {showFilters && (
        <div className="mb-4 overflow-hidden rounded-lg border" style={{ borderColor: "#e2e8f0" }}>
          {/* Filter header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e9edf2" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#475569" }}>Filters</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[10px] font-semibold" style={{ color: "#dc2626" }}>Reset all</button>
            )}
          </div>

          {/* Row 1: Category */}
          <div className="flex items-start gap-3 border-b px-3 py-2" style={{ borderColor: "#f1f5f9" }}>
            <div className="flex w-[70px] shrink-0 items-center gap-1 pt-0.5">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Category</span>
              <button onClick={() => setMstarCats(allMstarSelected ? new Set() : new Set(MSTAR_CATEGORIES))}
                className="text-[9px]" style={{ color: PRIMARY }}>{allMstarSelected ? "clear" : "all"}</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {MSTAR_CATEGORIES.map(c => (
                <Chip key={c} label={c} active={mstarCats.has(c)} count={mstarCatCounts[c] || 0}
                  onClick={() => { const s = new Set(mstarCats); s.has(c) ? s.delete(c) : s.add(c); setMstarCats(s) }} />
              ))}
            </div>
          </div>

          {/* Row 2: Duration */}
          <div className="flex items-center gap-3 border-b px-3 py-2" style={{ borderColor: "#f1f5f9" }}>
            <div className="flex w-[70px] shrink-0 items-center gap-1">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Duration</span>
              <button onClick={() => setDurationCats(allDurSelected ? new Set() : new Set(DURATION_CATEGORIES.map(c => c.label)))}
                className="text-[9px]" style={{ color: PRIMARY }}>{allDurSelected ? "clear" : "all"}</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {DURATION_CATEGORIES.map(c => (
                <Chip key={c.label} label={`${c.label} ${c.max === 100 ? "6y+" : `<${c.max}y`}`} active={durationCats.has(c.label)}
                  onClick={() => { const s = new Set(durationCats); s.has(c.label) ? s.delete(c.label) : s.add(c.label); setDurationCats(s) }} />
              ))}
            </div>
          </div>

          {/* Row 3: Credit */}
          <div className="flex items-center gap-3 border-b px-3 py-2" style={{ borderColor: "#f1f5f9" }}>
            <div className="flex w-[70px] shrink-0 items-center gap-1">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Credit</span>
              <button onClick={() => setCreditCats(allCreditSelected ? new Set() : new Set(CREDIT_CATS))}
                className="text-[9px]" style={{ color: PRIMARY }}>{allCreditSelected ? "clear" : "all"}</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {CREDIT_CATS.map(c => (
                <Chip key={c} label={c} active={creditCats.has(c)}
                  onClick={() => { const s = new Set(creditCats); s.has(c) ? s.delete(c) : s.add(c); setCreditCats(s) }} />
              ))}
            </div>
          </div>

          {/* Row 4: Numeric ranges + stars (all inline) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2" style={{ backgroundColor: "#fafbfc" }}>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Yield</span>
              <input type="number" value={yieldMin} onChange={e => setYieldMin(e.target.value)} placeholder="min"
                className="h-6 w-[48px] rounded border px-1 text-center text-[10px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} step="0.5" />
              <span className="text-[9px]" style={{ color: "#cbd5e1" }}>-</span>
              <input type="number" value={yieldMax} onChange={e => setYieldMax(e.target.value)} placeholder="max"
                className="h-6 w-[48px] rounded border px-1 text-center text-[10px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} step="0.5" />
              <span className="text-[9px]" style={{ color: "#94a3b8" }}>%</span>
            </div>
            <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Dur</span>
              <input type="number" value={durationMin} onChange={e => setDurationMin(e.target.value)} placeholder="min"
                className="h-6 w-[48px] rounded border px-1 text-center text-[10px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} step="0.5" />
              <span className="text-[9px]" style={{ color: "#cbd5e1" }}>-</span>
              <input type="number" value={durationMax} onChange={e => setDurationMax(e.target.value)} placeholder="max"
                className="h-6 w-[48px] rounded border px-1 text-center text-[10px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} step="0.5" />
              <span className="text-[9px]" style={{ color: "#94a3b8" }}>yrs</span>
            </div>
            <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Exp</span>
              <span className="text-[9px]" style={{ color: "#94a3b8" }}>{"<"}</span>
              <input type="number" value={expenseMax} onChange={e => setExpenseMax(e.target.value)} placeholder="max"
                className="h-6 w-[48px] rounded border px-1 text-center text-[10px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} step="0.1" />
              <span className="text-[9px]" style={{ color: "#94a3b8" }}>%</span>
            </div>
            <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Sharpe</span>
              <span className="text-[9px]" style={{ color: "#94a3b8" }}>{">"}</span>
              <input type="number" value={sharpeMin} onChange={e => setSharpeMin(e.target.value)} placeholder="min"
                className="h-6 w-[48px] rounded border px-1 text-center text-[10px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} step="0.1" />
            </div>
            <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>StdDev</span>
              <span className="text-[9px]" style={{ color: "#94a3b8" }}>{"<"}</span>
              <input type="number" value={stdDevMax} onChange={e => setStdDevMax(e.target.value)} placeholder="max"
                className="h-6 w-[48px] rounded border px-1 text-center text-[10px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} step="0.25" />
            </div>
            <div className="h-4 w-px" style={{ backgroundColor: "#e2e8f0" }} />
            <div className="flex items-center gap-0.5">
              <span className="mr-0.5 text-[10px] font-semibold" style={{ color: "#64748b" }}>Stars</span>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setStarMin(s === starMin ? 0 : s)}
                  className="text-sm leading-none transition-all" style={{ color: s <= starMin ? "#f59e0b" : "#d1d5db" }}
                  aria-label={`${s} stars minimum`}
                >{"★"}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CHART ═══ */}
      {sortedData.length < 1 ? (
        <div className="flex h-[350px] flex-col items-center justify-center gap-2">
          <Search className="h-8 w-8" style={{ color: "#cbd5e1" }} />
          <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>No funds match your filters</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs font-semibold underline" style={{ color: PRIMARY }}>Clear filters</button>
          )}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number" dataKey="x" name={xAxis.label}
              domain={[
                (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9 * 10) / 10),
                (dataMax: number) => Math.ceil(dataMax * 1.1 * 10) / 10,
              ]}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={v => xAxis.format(v)}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
            >
              <Label value={xAxis.label} position="bottom" offset={12} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
            </XAxis>
            <YAxis
              type="number" dataKey="y" name={yAxis.label}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={v => yAxis.format(v)}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
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
      <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "#f1f5f9" }}>
        <div className="flex items-center gap-4 text-[10px]" style={{ color: "#94a3b8" }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOT_DEFAULT }} /> Funds in universe
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[1px] w-5" style={{ backgroundColor: "#94a3b8", borderTop: "2px dashed #94a3b8" }} /> Universe average
          </span>
          {highlightTicker && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HIGHLIGHT }} /> {highlightTicker}
            </span>
          )}
        </div>
        <span className="text-[10px] italic" style={{ color: "#94a3b8" }}>Click any fund to view details</span>
      </div>
    </div>
  )
}
