"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ZAxis, Cell, ReferenceLine, Label,
} from "recharts"
import { Search, X, SlidersHorizontal, ArrowRightLeft } from "lucide-react"
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
  key: string
  label: string
  format: (v: number) => string
  getValue: (fund: FundData) => number | null
  isCredit?: boolean
}

const AXIS_OPTIONS: AxisKey[] = [
  { key: "secYield", label: "30-Day SEC Yield", format: v => `${v.toFixed(2)}%`, getValue: f => f.secYield != null ? f.secYield * 100 : null },
  { key: "distYield", label: "Distribution Yield", format: v => `${v.toFixed(2)}%`, getValue: f => f.distributionYield != null ? f.distributionYield * 100 : null },
  { key: "ytwYtm", label: "YTW / YTM", format: v => `${v.toFixed(2)}%`, getValue: f => f.ytwYtm != null ? f.ytwYtm * 100 : f.secYield != null ? f.secYield * 100 : null },
  { key: "duration", label: "Duration (yrs)", format: v => v.toFixed(2), getValue: f => f.duration },
  { key: "stdDev", label: "Standard Deviation", format: v => v.toFixed(2), getValue: f => f.stdDev },
  { key: "sharpe", label: "Sharpe Ratio", format: v => v.toFixed(2), getValue: f => f.sharpe },
  { key: "expense", label: "Expense Ratio", format: v => `${v.toFixed(2)}%`, getValue: f => f.expense != null ? f.expense * 100 : null },
  { key: "credit", label: "Credit Quality", format: v => creditLabel(v), getValue: f => creditScore(f), isCredit: true },
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
  { label: "Yield vs Credit", x: "credit", y: "ytwYtm", insight: "Reveals whether higher yield comes from credit risk -- funds to the left offer higher quality at comparable yields." },
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
  savedState?: Record<string, unknown> | null
  onStateChange?: (s: Record<string, unknown>) => void
}

/* ── Custom dot ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TickerDot(props: any) {
  const { cx, cy, payload, hoveredTicker, onHover, onLeave, onClick } = props
  if (cx == null || cy == null || !payload || isNaN(cx) || isNaN(cy)) return null
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
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
      style={{
        backgroundColor: active ? PRIMARY : "#f1f5f9",
        color: active ? "#fff" : "#64748b",
      }}
    >
      {label}
      {count !== undefined && (
        <span className="text-[9px] font-bold tabular-nums" style={{ opacity: 0.7 }}>{count}</span>
      )}
    </button>
  )
}

/* ── Filter popover wrapper ── */
function FilterPopover({ label, activeCount, children }: { label: string; activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const hasActive = activeCount > 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-all"
        style={{
          borderColor: hasActive ? PRIMARY : "#e2e8f0",
          color: hasActive ? PRIMARY : "#64748b",
          backgroundColor: hasActive ? "#f0f7ff" : open ? "#f8fafc" : "#fff",
        }}
      >
        {label}
        {hasActive && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[200px] rounded-lg border bg-white p-3 shadow-xl" style={{ borderColor: "#e2e8f0" }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════ MAIN COMPONENT ═══════════════════════════════════════ */
export function FundUniverseMap({ funds, highlightTicker, onSelectFund, savedState, onStateChange }: Props) {
  const s = savedState
  const [presetIdx, setPresetIdx] = useState(() => typeof s?.presetIdx === "number" ? s.presetIdx : 0)
  const [xIdx, setXIdx] = useState(() => typeof s?.xIdx === "number" ? s.xIdx : findAxis("duration"))
  const [yIdx, setYIdx] = useState(() => typeof s?.yIdx === "number" ? s.yIdx : findAxis("ytwYtm"))
  const xAxis = AXIS_OPTIONS[xIdx]
  const yAxis = AXIS_OPTIONS[yIdx]
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)

  const [search, setSearch] = useState(() => typeof s?.search === "string" ? s.search : "")
  const [searchFocused, setSearchFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(() => typeof s?.showFilters === "boolean" ? s.showFilters : false)

  const [durationCats, setDurationCats] = useState<Set<string>>(() => s?.durationCats instanceof Set ? s.durationCats as Set<string> : new Set(DURATION_CATEGORIES.map(c => c.label)))
  const CREDIT_CATS = ["AAA", "AA", "A", "BBB", "BB & Below"] as const
  const [creditCats, setCreditCats] = useState<Set<string>>(() => s?.creditCats instanceof Set ? s.creditCats as Set<string> : new Set(CREDIT_CATS))
  const [mstarCats, setMstarCats] = useState<Set<string>>(() => s?.mstarCats instanceof Set ? s.mstarCats as Set<string> : new Set(MSTAR_CATEGORIES))
  const [starMin, setStarMin] = useState(() => typeof s?.starMin === "number" ? s.starMin : 0)
  const [yieldMinPreset, setYieldMinPreset] = useState<number | null>(() => typeof s?.yieldMinPreset === "number" ? s.yieldMinPreset : null)
  const [expenseMaxPreset, setExpenseMaxPreset] = useState<number | null>(() => typeof s?.expenseMaxPreset === "number" ? s.expenseMaxPreset : null)
  const [sharpeMinPreset, setSharpeMinPreset] = useState<number | null>(() => typeof s?.sharpeMinPreset === "number" ? s.sharpeMinPreset : null)
  const [stdDevMaxPreset, setStdDevMaxPreset] = useState<number | null>(() => typeof s?.stdDevMaxPreset === "number" ? s.stdDevMaxPreset : null)

  // Persist state on unmount
  const stateSnap = useRef<Record<string, unknown>>({})
  stateSnap.current = {
    presetIdx, xIdx, yIdx, search, showFilters,
    durationCats, creditCats, mstarCats, starMin,
    yieldMinPreset, expenseMaxPreset, sharpeMinPreset, stdDevMaxPreset,
  }
  useEffect(() => {
    return () => { onStateChange?.(stateSnap.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mstarCatCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    funds.forEach(f => { const cat = f.morningstarCategory; if (cat) counts[cat] = (counts[cat] || 0) + 1 })
    return counts
  }, [funds])

  /* ── Tooltip (defined inside component for access to xAxis/yAxis) ── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = useCallback(({ active, payload }: any) => {
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
    ].filter(ss => ss.value !== "\u2014")
    const perfStats = [
      { label: "YTD", value: fp(d.ytd) },
      { label: "1Y", value: fp(d.oneYear) },
      { label: "3Y", value: fp(d.threeYear) },
    ].filter(ss => ss.value !== "\u2014")
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
          {fundStats.map(ss => (
            <div key={ss.label} className="flex items-baseline justify-between gap-2">
              <span className="text-[9px]" style={{ color: "#94a3b8" }}>{ss.label}</span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: "#334155" }}>{ss.value}</span>
            </div>
          ))}
        </div>
        {perfStats.length > 0 && (
          <div className="mt-1 flex gap-3 border-t pt-1" style={{ borderColor: "#f1f5f9" }}>
            {perfStats.map(ss => (
              <div key={ss.label} className="flex items-baseline gap-1">
                <span className="text-[9px]" style={{ color: "#94a3b8" }}>{ss.label}</span>
                <span className="text-[10px] font-semibold tabular-nums" style={{ color: "#334155" }}>{ss.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }, [])

  /* ── Data pipeline ── */
  const { sortedData, avgY, trendLine } = useMemo(() => {
    const searchLower = search.toLowerCase()
    let xSum = 0, ySum = 0, count = 0
    const points = funds.map(f => {
      if (search && !f.ticker.toLowerCase().includes(searchLower) && !f.name.toLowerCase().includes(searchLower)) return null
      const dur = f.duration ?? 0
      const durCat = DURATION_CATEGORIES.find(c => dur >= c.min && dur < c.max)
      if (durCat && !durationCats.has(durCat.label)) return null
      const cs = creditScore(f)
      if (cs != null) {
        const cl = creditLabel(cs)
        if (cl === "AAA" && !creditCats.has("AAA")) return null
        if (cl === "AA" && !creditCats.has("AA")) return null
        if (cl === "A" && !creditCats.has("A")) return null
        if (cl === "BBB" && !creditCats.has("BBB")) return null
        if (["BB", "B", "CCC", "<CCC"].includes(cl) && !creditCats.has("BB & Below")) return null
      }
      if (f.morningstarCategory && !mstarCats.has(f.morningstarCategory)) return null
      if (starMin > 0 && f.morningstarRating != null && f.morningstarRating < starMin) return null
      const yld = (f.ytwYtm ?? f.secYield ?? 0) * 100
      if (yieldMinPreset != null && yld < yieldMinPreset) return null
      if (expenseMaxPreset != null && f.expense != null && f.expense * 100 > expenseMaxPreset) return null
      if (sharpeMinPreset != null && f.sharpe != null && f.sharpe < sharpeMinPreset) return null
      if (stdDevMaxPreset != null && f.stdDev != null && f.stdDev > stdDevMaxPreset) return null
      const xVal = xAxis.getValue(f)
      const yVal = yAxis.getValue(f)
      if (xVal == null || yVal == null) return null
      xSum += xVal; ySum += yVal; count++
      return {
        ticker: f.ticker, name: f.name, x: xVal, y: yVal,
        isHighlighted: f.ticker === highlightTicker,
        ytwYtm: f.ytwYtm != null ? f.ytwYtm * 100 : null,
        secYield: f.secYield != null ? f.secYield * 100 : null,
        duration: f.duration,
        expense: f.expense != null ? f.expense * 100 : null,
        stdDev: f.stdDev, sharpe: f.sharpe,
        creditQuality: cs != null ? creditLabel(cs) : null,
        morningstarRating: f.morningstarRating,
        morningstarCategory: f.morningstarCategory,
        ytd: f.ytd != null ? f.ytd * 100 : null,
        oneYear: f.oneYear != null ? f.oneYear * 100 : null,
        threeYear: f.threeYear != null ? f.threeYear * 100 : null,
      }
    }).filter(Boolean) as Array<{
      ticker: string; name: string; x: number; y: number; isHighlighted: boolean
      ytwYtm: number | null; secYield: number | null; duration: number | null
      expense: number | null; stdDev: number | null; sharpe: number | null
      creditQuality: string | null; morningstarRating: number | null
      morningstarCategory: string | null; ytd: number | null
      oneYear: number | null; threeYear: number | null
    }>

    const sorted = points.sort((a, b) => a.x - b.x)
    const aX = count > 0 ? xSum / count : 0
    const aY = count > 0 ? ySum / count : 0

    // Linear regression
    let ssXX = 0, ssXY = 0
    for (const p of sorted) { ssXX += (p.x - aX) ** 2; ssXY += (p.x - aX) * (p.y - aY) }
    const slope = ssXX > 0 ? ssXY / ssXX : 0
    const intercept = aY - slope * aX
    const tl = sorted.length >= 3
      ? [{ x: sorted[0].x, y: slope * sorted[0].x + intercept }, { x: sorted[sorted.length - 1].x, y: slope * sorted[sorted.length - 1].x + intercept }]
      : []

    return { sortedData: sorted, avgY: aY, trendLine: tl }
  }, [funds, xAxis, yAxis, highlightTicker, search, durationCats, creditCats, mstarCats, starMin, yieldMinPreset, expenseMaxPreset, sharpeMinPreset, stdDevMaxPreset])

  const allDurSelected = durationCats.size === DURATION_CATEGORIES.length
  const allCreditSelected = creditCats.size === CREDIT_CATS.length
  const allMstarSelected = mstarCats.size === MSTAR_CATEGORIES.length
  const hasRangeFilters = yieldMinPreset != null || expenseMaxPreset != null || sharpeMinPreset != null || stdDevMaxPreset != null
  const hasActiveFilters = !!search || !allDurSelected || !allCreditSelected || !allMstarSelected || starMin > 0 || hasRangeFilters
  const activeFilterCount = [!allDurSelected, !allCreditSelected, !allMstarSelected, starMin > 0, hasRangeFilters, !!search].filter(Boolean).length

  const clearFilters = useCallback(() => {
    setSearch(""); setDurationCats(new Set(DURATION_CATEGORIES.map(c => c.label)))
    setCreditCats(new Set(CREDIT_CATS)); setMstarCats(new Set(MSTAR_CATEGORIES))
    setStarMin(0); setYieldMinPreset(null); setExpenseMaxPreset(null)
    setSharpeMinPreset(null); setStdDevMaxPreset(null)
  }, [])

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
        <button
          onClick={() => { const prev = xIdx; setXIdx(yIdx); setYIdx(prev); setPresetIdx(-1) }}
          className="flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition-all hover:border-[#0f3d6b] hover:bg-[#f0f7ff]"
          style={{ borderColor: "#e2e8f0", color: "#64748b" }}
          title="Swap X and Y axes"
        >
          <ArrowRightLeft className="h-3 w-3" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>Y</span>
          <select value={yIdx} onChange={e => { setYIdx(+e.target.value); setPresetIdx(-1) }}
            className="h-8 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0", color: "#334155" }}>
            {AXIS_OPTIONS.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
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

      {/* ═══ FILTER BAR ═══ */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterPopover label="Category" activeCount={allMstarSelected ? 0 : MSTAR_CATEGORIES.length - mstarCats.size}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold" style={{ color: "#334155" }}>Morningstar Category</span>
              <button onClick={() => setMstarCats(allMstarSelected ? new Set() : new Set(MSTAR_CATEGORIES))}
                className="text-[10px] font-semibold" style={{ color: PRIMARY }}>{allMstarSelected ? "Clear" : "Select All"}</button>
            </div>
            <div className="flex max-w-[320px] flex-wrap gap-1.5">
              {MSTAR_CATEGORIES.map(c => (
                <Chip key={c} label={c} active={mstarCats.has(c)} count={mstarCatCounts[c] || 0}
                  onClick={() => { const ns = new Set(mstarCats); ns.has(c) ? ns.delete(c) : ns.add(c); setMstarCats(ns) }} />
              ))}
            </div>
          </FilterPopover>

          <FilterPopover label="Duration" activeCount={allDurSelected ? 0 : DURATION_CATEGORIES.length - durationCats.size}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold" style={{ color: "#334155" }}>Duration Range</span>
              <button onClick={() => setDurationCats(allDurSelected ? new Set() : new Set(DURATION_CATEGORIES.map(c => c.label)))}
                className="text-[10px] font-semibold" style={{ color: PRIMARY }}>{allDurSelected ? "Clear" : "Select All"}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_CATEGORIES.map(c => (
                <Chip key={c.label} label={`${c.label} (${c.min}-${c.max === 100 ? "6+" : c.max}y)`} active={durationCats.has(c.label)}
                  onClick={() => { const ns = new Set(durationCats); ns.has(c.label) ? ns.delete(c.label) : ns.add(c.label); setDurationCats(ns) }} />
              ))}
            </div>
          </FilterPopover>

          <FilterPopover label="Credit" activeCount={allCreditSelected ? 0 : CREDIT_CATS.length - creditCats.size}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold" style={{ color: "#334155" }}>Credit Quality</span>
              <button onClick={() => setCreditCats(allCreditSelected ? new Set() : new Set(CREDIT_CATS))}
                className="text-[10px] font-semibold" style={{ color: PRIMARY }}>{allCreditSelected ? "Clear" : "Select All"}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CREDIT_CATS.map(c => (
                <Chip key={c} label={c} active={creditCats.has(c)}
                  onClick={() => { const ns = new Set(creditCats); ns.has(c) ? ns.delete(c) : ns.add(c); setCreditCats(ns) }} />
              ))}
            </div>
          </FilterPopover>

          <FilterPopover label="Yield" activeCount={yieldMinPreset != null ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Minimum Yield</span></div>
            <div className="flex flex-wrap gap-1.5">
              {[3, 4, 5, 6, 7].map(v => (
                <Chip key={v} label={`${v}%+`} active={yieldMinPreset === v} onClick={() => setYieldMinPreset(yieldMinPreset === v ? null : v)} />
              ))}
            </div>
          </FilterPopover>

          <FilterPopover label="Expense" activeCount={expenseMaxPreset != null ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Max Expense Ratio</span></div>
            <div className="flex flex-wrap gap-1.5">
              {[{ v: 0.25, l: "<0.25%" }, { v: 0.5, l: "<0.5%" }, { v: 1, l: "<1%" }].map(({ v, l }) => (
                <Chip key={v} label={l} active={expenseMaxPreset === v} onClick={() => setExpenseMaxPreset(expenseMaxPreset === v ? null : v)} />
              ))}
            </div>
          </FilterPopover>

          <FilterPopover label="Sharpe" activeCount={sharpeMinPreset != null ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Min Sharpe Ratio</span></div>
            <div className="flex flex-wrap gap-1.5">
              {[0, 0.5, 1, 1.5].map(v => (
                <Chip key={v} label={`>${v}`} active={sharpeMinPreset === v} onClick={() => setSharpeMinPreset(sharpeMinPreset === v ? null : v)} />
              ))}
            </div>
          </FilterPopover>

          <FilterPopover label="Std Dev" activeCount={stdDevMaxPreset != null ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Max Std Deviation</span></div>
            <div className="flex flex-wrap gap-1.5">
              {[2, 3, 5].map(v => (
                <Chip key={v} label={`<${v}`} active={stdDevMaxPreset === v} onClick={() => setStdDevMaxPreset(stdDevMaxPreset === v ? null : v)} />
              ))}
            </div>
          </FilterPopover>

          <FilterPopover label="Stars" activeCount={starMin > 0 ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Min Morningstar Rating</span></div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(sv => (
                <button key={sv} onClick={() => setStarMin(sv === starMin ? 0 : sv)}
                  className="text-lg leading-none transition-all" style={{ color: sv <= starMin ? "#f59e0b" : "#d1d5db" }}
                  aria-label={`Minimum ${sv} stars`}
                >{"★"}</button>
              ))}
            </div>
          </FilterPopover>

          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="ml-1 flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-all"
              style={{ color: "#dc2626", backgroundColor: "#fef2f2" }}
            >
              <X className="h-3 w-3" /> Reset
            </button>
          )}
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
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 25, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number" dataKey="x" name={xAxis.label}
              domain={xAxis.isCredit ? [0.5, 8.5] as [number, number] : [(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.9 * 10) / 10), (dataMax: number) => Math.ceil(dataMax * 1.1 * 10) / 10]}
              ticks={xAxis.isCredit ? [1, 2, 3, 4, 5, 6, 7, 8] : undefined}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={v => xAxis.format(v)}
              tickLine={{ stroke: "#e2e8f0" }}
              axisLine={{ stroke: "#e2e8f0" }}
            >
              <Label value={xAxis.label} position="bottom" offset={12} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
            </XAxis>
            <YAxis
              type="number" dataKey="y" name={yAxis.label}
              domain={yAxis.isCredit ? [0.5, 8.5] as [number, number] : undefined}
              ticks={yAxis.isCredit ? [1, 2, 3, 4, 5, 6, 7, 8] : undefined}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={v => yAxis.format(v)}
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
      <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "#f1f5f9" }}>
        <div className="flex items-center gap-4 text-[10px]" style={{ color: "#94a3b8" }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOT_DEFAULT }} /> Funds in universe
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[1px] w-5" style={{ backgroundColor: "#94a3b8", borderTop: "2px dashed #94a3b8" }} /> Average
          </span>
          {trendLine.length === 2 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[1px] w-5" style={{ borderTop: "2px dashed #0f3d6b", opacity: 0.5 }} /> Trend
            </span>
          )}
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
