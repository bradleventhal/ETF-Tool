"use client"

import { useState, useMemo, useCallback } from "react"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ZAxis, Cell, ReferenceLine, Label,
} from "recharts"
import { Search, X, ChevronDown, ChevronUp } from "lucide-react"
import type { FundData } from "@/lib/fund-types"

/* ── Helpers ── */
function nz(v: number | null | undefined): number { return v ?? 0 }

/** Numeric credit score: AAA=1, AA=2, A=3, BBB=4, BB=5, B=6, CCC=7, <CCC=8 */
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

/* ── Preset views ── */
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

/* ── Colors ── */
const PRIMARY = "#0f3d6b"
const HIGHLIGHT = "#dc2626"
const DOT_DEFAULT = "#3b82f6"

interface Props {
  funds: FundData[]
  highlightTicker?: string
  onSelectFund?: (ticker: string) => void
}

/* ── Custom dot with ticker label on hover ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TickerDot(props: any) {
  const { cx, cy, payload, hoveredTicker, onHover, onLeave, onClick } = props
  if (!cx || !cy || !payload) return null

  const isHighlighted = payload.isHighlighted
  const isHovered = payload.ticker === hoveredTicker
  const isActive = isHighlighted || isHovered
  const color = isHighlighted ? HIGHLIGHT : isHovered ? PRIMARY : DOT_DEFAULT
  const radius = isActive ? 7 : 5

  return (
    <g
      onMouseEnter={() => onHover(payload.ticker)}
      onMouseLeave={() => onLeave()}
      onClick={() => onClick(payload.ticker)}
      style={{ cursor: "pointer" }}
    >
      <circle cx={cx} cy={cy} r={radius + 10} fill="transparent" />
      <circle
        cx={cx} cy={cy} r={radius}
        fill={color}
        fillOpacity={isActive ? 1 : 0.7}
        stroke={isActive ? "#fff" : "transparent"}
        strokeWidth={isActive ? 2 : 0}
        filter={isActive ? "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" : undefined}
      />
      {isActive && (
        <>
          <rect
            x={cx - (payload.ticker.length * 4 + 8)}
            y={cy - radius - 22}
            width={payload.ticker.length * 8 + 16}
            height={18}
            rx={4}
            fill={color}
          />
          <text
            x={cx}
            y={cy - radius - 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            fontWeight={700}
            fontFamily="ui-monospace, monospace"
          >
            {payload.ticker}
          </text>
        </>
      )}
    </g>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border px-3 py-2.5 shadow-lg" style={{ backgroundColor: "#fff", borderColor: "#e2e8f0", maxWidth: 280 }}>
      <div className="flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold" style={{ backgroundColor: d.isHighlighted ? "#fef2f2" : "#eff6ff", color: d.isHighlighted ? HIGHLIGHT : PRIMARY }}>{d.ticker}</span>
        <span className="truncate text-[11px]" style={{ color: "#64748b" }}>{d.name}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
        <p className="text-[11px]" style={{ color: "#334155" }}>{d.xLabel}:</p>
        <p className="text-right font-mono text-[11px] font-semibold" style={{ color: "#334155" }}>{d.xFormatted}</p>
        <p className="text-[11px]" style={{ color: "#334155" }}>{d.yLabel}:</p>
        <p className="text-right font-mono text-[11px] font-semibold" style={{ color: "#334155" }}>{d.yFormatted}</p>
      </div>
      <p className="mt-1.5 text-[10px]" style={{ color: "#94a3b8" }}>Click to view fund details</p>
    </div>
  )
}

export function FundUniverseMap({ funds, highlightTicker, onSelectFund }: Props) {
  const [xKey, setXKey] = useState(PRESETS[0].x)
  const [yKey, setYKey] = useState(PRESETS[0].y)
  const [activeInsight, setActiveInsight] = useState(PRESETS[0].insight)
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)

  // Duration category filter (multiple can be selected)
  const [durationCats, setDurationCats] = useState<Set<string>>(new Set(DURATION_CATEGORIES.map(c => c.label)))

  // Credit quality filter
  const CREDIT_CATS = ["AAA", "AA", "A", "BBB", "BB & Below"] as const
  const [creditCats, setCreditCats] = useState<Set<string>>(new Set(CREDIT_CATS))

  // Range filters
  const [yieldMin, setYieldMin] = useState("")
  const [yieldMax, setYieldMax] = useState("")
  const [expenseMax, setExpenseMax] = useState("")
  const [stdDevMax, setStdDevMax] = useState("")
  const [sharpeMin, setSharpeMin] = useState("")

  const xAxis = AXIS_OPTIONS[findAxis(xKey)] || AXIS_OPTIONS[0]
  const yAxis = AXIS_OPTIONS[findAxis(yKey)] || AXIS_OPTIONS[0]

  const toggleDurationCat = (cat: string) => {
    setDurationCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const toggleCreditCat = (cat: string) => {
    setCreditCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const data = useMemo(() => {
    const searchLower = search.toLowerCase()
    return funds
      .filter(f => {
        if (search && !f.ticker.toLowerCase().includes(searchLower) && !f.name.toLowerCase().includes(searchLower)) return false
        // Duration category filter
        const dur = f.duration ?? 0
        const durCat = DURATION_CATEGORIES.find(c => dur >= c.min && dur < c.max)
        if (durCat && !durationCats.has(durCat.label)) return false
        // Credit quality filter
        const cs = creditScore(f)
        if (cs != null) {
          const cl = creditLabel(cs)
          if (cl === "AAA" && !creditCats.has("AAA")) return false
          if (cl === "AA" && !creditCats.has("AA")) return false
          if (cl === "A" && !creditCats.has("A")) return false
          if (cl === "BBB" && !creditCats.has("BBB")) return false
          if (["BB", "B", "CCC", "<CCC"].includes(cl) && !creditCats.has("BB & Below")) return false
        }
        // Range filters
        const yld = (f.ytwYtm ?? f.secYield ?? 0) * 100
        if (yieldMin && yld < parseFloat(yieldMin)) return false
        if (yieldMax && yld > parseFloat(yieldMax)) return false
        if (expenseMax && f.expense != null && f.expense * 100 > parseFloat(expenseMax)) return false
        if (stdDevMax && f.stdDev != null && f.stdDev > parseFloat(stdDevMax)) return false
        if (sharpeMin && f.sharpe != null && f.sharpe < parseFloat(sharpeMin)) return false
        return true
      })
      .map(f => {
        const xVal = xAxis.getValue(f)
        const yVal = yAxis.getValue(f)
        if (xVal == null || yVal == null) return null
        return {
          x: xVal, y: yVal,
          ticker: f.ticker, name: f.name,
          xLabel: xAxis.label, yLabel: yAxis.label,
          xFormatted: xAxis.format(xVal), yFormatted: yAxis.format(yVal),
          isHighlighted: f.ticker === highlightTicker,
        }
      })
      .filter(Boolean) as {
        x: number; y: number; ticker: string; name: string
        xLabel: string; yLabel: string; xFormatted: string; yFormatted: string; isHighlighted: boolean
      }[]
  }, [funds, xAxis, yAxis, highlightTicker, search, durationCats, creditCats, yieldMin, yieldMax, expenseMax, stdDevMax, sharpeMin])

  const sortedData = useMemo(() => [...data].sort((a, b) => (a.isHighlighted ? 1 : 0) - (b.isHighlighted ? 1 : 0)), [data])

  const avgX = data.length > 0 ? data.reduce((s, d) => s + d.x, 0) / data.length : 0
  const avgY = data.length > 0 ? data.reduce((s, d) => s + d.y, 0) / data.length : 0

  const handleDotClick = useCallback((ticker: string) => { onSelectFund?.(ticker) }, [onSelectFund])

  const allDurSelected = durationCats.size === DURATION_CATEGORIES.length
  const allCreditSelected = creditCats.size === CREDIT_CATS.length
  const hasRangeFilters = !!yieldMin || !!yieldMax || !!expenseMax || !!stdDevMax || !!sharpeMin
  const hasActiveFilters = !!search || !allDurSelected || !allCreditSelected || hasRangeFilters

  const clearFilters = () => {
    setSearch("")
    setDurationCats(new Set(DURATION_CATEGORIES.map(c => c.label)))
    setCreditCats(new Set(CREDIT_CATS))
    setYieldMin(""); setYieldMax(""); setExpenseMax(""); setStdDevMax(""); setSharpeMin("")
  }

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
        <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: PRIMARY }}>Fund Universe Map</h3>
        <span className="text-[11px] font-medium tabular-nums" style={{ color: "#94a3b8" }}>{data.length} of {funds.length} funds plotted</span>
      </div>

      {/* Quick Views */}
      <div className="border-b px-4 py-2.5 sm:px-5" style={{ borderColor: "#f1f5f9" }}>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => {
            const isActive = xKey === p.x && yKey === p.y
            return (
              <button
                key={p.label}
                onClick={() => { setXKey(p.x); setYKey(p.y); setActiveInsight(p.insight) }}
                className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: isActive ? PRIMARY : "transparent",
                  color: isActive ? "#fff" : "#64748b",
                  border: isActive ? "none" : "1px solid #e2e8f0",
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        {activeInsight && (
          <p className="mt-2 text-[11px] leading-relaxed italic" style={{ color: "#64748b" }}>{activeInsight}</p>
        )}
      </div>

      {/* Controls row */}
      <div className="flex flex-col gap-2.5 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-5" style={{ borderColor: "#f1f5f9" }}>
        {/* Axis dropdowns */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold" style={{ backgroundColor: "#eff6ff", color: PRIMARY }}>X</span>
            <select
              value={xKey}
              onChange={e => { setXKey(e.target.value); setActiveInsight("") }}
              className="h-8 rounded-md border px-2 pr-7 text-xs font-medium"
              style={{ borderColor: "#e2e8f0", color: "#334155", backgroundColor: "#fff" }}
            >
              {AXIS_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
            </select>
          </div>
          <span className="text-xs font-medium" style={{ color: "#cbd5e1" }}>vs</span>
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold" style={{ backgroundColor: "#eff6ff", color: PRIMARY }}>Y</span>
            <select
              value={yKey}
              onChange={e => { setYKey(e.target.value); setActiveInsight("") }}
              className="h-8 rounded-md border px-2 pr-7 text-xs font-medium"
              style={{ borderColor: "#e2e8f0", color: "#334155", backgroundColor: "#fff" }}
            >
              {AXIS_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        {/* Search + Filter toggle */}
        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          <div className="relative flex-1 sm:max-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94a3b8" }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="Search ticker or name..."
              className="h-8 w-full rounded-md border pl-8 pr-7 text-xs"
              style={{ borderColor: "#e2e8f0", color: "#334155" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
                <X className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} />
              </button>
            )}
            {searchFocused && search.length > 0 && (
              <div className="absolute left-0 top-full z-30 mt-1 max-h-[180px] w-full overflow-y-auto rounded-lg border shadow-xl" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                {(() => {
                  const sl = search.toLowerCase()
                  const matches = funds.filter(f => f.ticker.toLowerCase().includes(sl) || f.name.toLowerCase().includes(sl))
                  return matches.length === 0 ? (
                    <div className="px-3 py-2 text-[11px]" style={{ color: "#94a3b8" }}>No matches</div>
                  ) : matches.slice(0, 8).map(f => (
                    <button
                      key={f.ticker}
                      onMouseDown={e => {
                        e.preventDefault()
                        setSearch(f.ticker)
                        setSearchFocused(false)
                      }}
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold transition-colors"
            style={{
              borderColor: hasActiveFilters ? PRIMARY : "#e2e8f0",
              backgroundColor: hasActiveFilters ? "#eff6ff" : "#fff",
              color: hasActiveFilters ? PRIMARY : "#64748b",
            }}
          >
            Filters
            {hasActiveFilters && <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold" style={{ backgroundColor: PRIMARY, color: "#fff" }}>!</span>}
            {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="border-b px-4 py-3 sm:px-5" style={{ borderColor: "#f1f5f9", backgroundColor: "#fafbfc" }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
            {/* Duration category */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Duration Category</span>
                <button
                  onClick={() => setDurationCats(allDurSelected ? new Set() : new Set(DURATION_CATEGORIES.map(c => c.label)))}
                  className="text-[10px] font-medium" style={{ color: PRIMARY }}
                >
                  {allDurSelected ? "Clear" : "All"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_CATEGORIES.map(cat => {
                  const active = durationCats.has(cat.label)
                  return (
                    <button
                      key={cat.label}
                      onClick={() => toggleDurationCat(cat.label)}
                      className="rounded-md px-3 py-1.5 text-[11px] font-medium transition-all"
                      style={{
                        backgroundColor: active ? PRIMARY : "#f1f5f9",
                        color: active ? "#fff" : "#64748b",
                      }}
                    >
                      {cat.label}
                      <span className="ml-1 opacity-60">
                        {cat.min === 0 ? "<1y" : cat.max === 100 ? `${cat.min}y+` : `${cat.min}-${cat.max}y`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Credit quality */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Credit Quality</span>
                <button
                  onClick={() => setCreditCats(allCreditSelected ? new Set() : new Set(CREDIT_CATS))}
                  className="text-[10px] font-medium" style={{ color: PRIMARY }}
                >
                  {allCreditSelected ? "Clear" : "All"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CREDIT_CATS.map(cat => {
                  const active = creditCats.has(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCreditCat(cat)}
                      className="rounded-md px-3 py-1.5 text-[11px] font-medium transition-all"
                      style={{
                        backgroundColor: active ? PRIMARY : "#f1f5f9",
                        color: active ? "#fff" : "#64748b",
                      }}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Range filters */}
          <div className="mt-4 border-t pt-3" style={{ borderColor: "#e9edf2" }}>
            <span className="mb-2.5 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Range Filters</span>
            <div className="flex flex-wrap gap-x-5 gap-y-3">
              <div className="flex items-center gap-1.5">
                <span className="w-[58px] text-[11px] font-medium" style={{ color: "#64748b" }}>Yield %</span>
                <input type="number" step="0.1" placeholder="Min" value={yieldMin} onChange={e => setYieldMin(e.target.value)}
                  className="h-7 w-[60px] rounded border px-2 text-[11px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} />
                <span className="text-[10px]" style={{ color: "#94a3b8" }}>to</span>
                <input type="number" step="0.1" placeholder="Max" value={yieldMax} onChange={e => setYieldMax(e.target.value)}
                  className="h-7 w-[60px] rounded border px-2 text-[11px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-[58px] text-[11px] font-medium" style={{ color: "#64748b" }}>Expense</span>
                <span className="text-[10px]" style={{ color: "#94a3b8" }}>max</span>
                <input type="number" step="0.01" placeholder="e.g. 0.5" value={expenseMax} onChange={e => setExpenseMax(e.target.value)}
                  className="h-7 w-[68px] rounded border px-2 text-[11px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} />
                <span className="text-[10px]" style={{ color: "#94a3b8" }}>%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-[58px] text-[11px] font-medium" style={{ color: "#64748b" }}>Std Dev</span>
                <span className="text-[10px]" style={{ color: "#94a3b8" }}>max</span>
                <input type="number" step="0.1" placeholder="e.g. 3" value={stdDevMax} onChange={e => setStdDevMax(e.target.value)}
                  className="h-7 w-[60px] rounded border px-2 text-[11px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-[58px] text-[11px] font-medium" style={{ color: "#64748b" }}>Sharpe</span>
                <span className="text-[10px]" style={{ color: "#94a3b8" }}>min</span>
                <input type="number" step="0.1" placeholder="e.g. 1" value={sharpeMin} onChange={e => setSharpeMin(e.target.value)}
                  className="h-7 w-[60px] rounded border px-2 text-[11px] tabular-nums outline-none focus:border-[#0f3d6b]" style={{ borderColor: "#e2e8f0", color: "#334155" }} />
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-3 text-[11px] font-medium underline" style={{ color: PRIMARY }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="px-2 py-4 sm:px-4">
        {sortedData.length < 1 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search className="h-8 w-8" style={{ color: "#e2e8f0" }} />
            <p className="mt-3 text-sm font-medium" style={{ color: "#94a3b8" }}>
              {hasActiveFilters ? "No funds match your filters" : "Not enough data for these axes"}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs font-medium underline" style={{ color: PRIMARY }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={480}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 35, left: 25 }}>
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
                <Label value={xAxis.label} position="bottom" offset={15} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
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
              <ZAxis range={[60, 60]} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <ReferenceLine x={avgX} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} />
              <ReferenceLine y={avgY} stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} />
              <Scatter
                data={sortedData}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                shape={(props: any) => (
                  <TickerDot
                    {...props}
                    hoveredTicker={hoveredTicker}
                    onHover={setHoveredTicker}
                    onLeave={() => setHoveredTicker(null)}
                    onClick={handleDotClick}
                  />
                )}
              >
                {sortedData.map((entry, i) => (
                  <Cell key={i} fill={entry.isHighlighted ? HIGHLIGHT : DOT_DEFAULT} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 sm:px-5" style={{ borderColor: "#f1f5f9", backgroundColor: "#f8fafc" }}>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOT_DEFAULT }} />
          <span className="text-[11px]" style={{ color: "#64748b" }}>Funds in universe</span>
        </div>
        {highlightTicker && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HIGHLIGHT }} />
            <span className="text-[11px] font-semibold" style={{ color: HIGHLIGHT }}>{highlightTicker}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-px w-5" style={{ borderTop: "2px dashed #cbd5e1" }} />
          <span className="text-[11px]" style={{ color: "#94a3b8" }}>Universe average</span>
        </div>
        <span className="ml-auto text-[10px] italic" style={{ color: "#94a3b8" }}>Click any fund to view details</span>
      </div>
    </div>
  )
}
