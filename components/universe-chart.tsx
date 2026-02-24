"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
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
type AxisUnit = "pct" | "pct1" | "num" | "credit" | "yrs"
type AxisKey = { key: string; label: string; unit: AxisUnit; format: (v: number) => string; tickFormat: (v: number) => string; getValue: (fund: FundData) => number | null }

const fmtPct = (v: number) => `${v.toFixed(2)}%`
const fmtPct1 = (v: number) => `${v.toFixed(1)}%`
const fmtNum = (v: number) => v.toFixed(2)
const tickPct = (v: number) => `${Number(v.toFixed(1))}%`
const tickNum = (v: number) => String(Number(v.toFixed(1)))

const AXIS_OPTIONS: AxisKey[] = [
  { key: "secYield", label: "30-Day SEC Yield", unit: "pct", format: fmtPct, tickFormat: tickPct, getValue: f => f.secYield != null ? f.secYield * 100 : null },
  { key: "distYield", label: "Distribution Yield", unit: "pct", format: fmtPct, tickFormat: tickPct, getValue: f => f.distributionYield != null ? f.distributionYield * 100 : null },
  { key: "ytwYtm", label: "YTW / YTM", unit: "pct", format: fmtPct, tickFormat: tickPct, getValue: f => f.ytwYtm != null ? f.ytwYtm * 100 : f.secYield != null ? f.secYield * 100 : null },
  { key: "duration", label: "Duration (yrs)", unit: "yrs", format: v => `${v.toFixed(2)} yrs`, tickFormat: v => `${Number(v.toFixed(1))}`, getValue: f => f.duration },
  { key: "stdDev", label: "Standard Deviation", unit: "num", format: fmtNum, tickFormat: tickNum, getValue: f => f.stdDev },
  { key: "sharpe", label: "Sharpe Ratio", unit: "num", format: fmtNum, tickFormat: tickNum, getValue: f => f.sharpe },
  { key: "expense", label: "Expense Ratio", unit: "pct", format: fmtPct, tickFormat: tickPct, getValue: f => f.expense != null ? f.expense * 100 : null },
  { key: "credit", label: "Credit Quality", unit: "credit", format: v => creditLabel(v), tickFormat: v => { const r = Math.round(v); return r >= 1 && r <= 8 ? creditLabel(r) : "" }, getValue: f => creditScore(f) },
  { key: "ytd", label: "YTD Return", unit: "pct", format: fmtPct, tickFormat: tickPct, getValue: f => f.ytd != null ? f.ytd * 100 : null },
  { key: "oneYear", label: "1-Year Return", unit: "pct", format: fmtPct, tickFormat: tickPct, getValue: f => f.oneYear != null ? f.oneYear * 100 : null },
  { key: "threeYear", label: "3-Year Return", unit: "pct", format: fmtPct, tickFormat: tickPct, getValue: f => f.threeYear != null ? f.threeYear * 100 : null },
  { key: "securitized", label: "Securitized %", unit: "pct1", format: fmtPct1, tickFormat: tickPct, getValue: f => f.securitized != null ? f.securitized * 100 : null },
  { key: "corpCredit", label: "Corp Credit %", unit: "pct1", format: fmtPct1, tickFormat: tickPct, getValue: f => f.corporateCredit != null ? f.corporateCredit * 100 : null },
]
const findAxis = (key: string) => AXIS_OPTIONS.findIndex(a => a.key === key)

const PRESETS = [
  { label: "Yield vs Duration", x: "duration", y: "ytwYtm", insight: "Shows yield pickup per unit of interest rate risk -- are you getting paid enough for the duration you're taking?" },
  { label: "Credit vs Yield", x: "credit", y: "ytwYtm", insight: "Reveals whether higher yield comes from credit risk -- funds to the left offer higher quality at comparable yields." },
]

const DURATION_CATEGORIES = [
  { label: "Ultrashort", min: 0, max: 1 },
  { label: "Short", min: 1, max: 3.5 },
  { label: "Intermediate", min: 3.5, max: 6 },
  { label: "Long", min: 6, max: 100 },
] as const

const MSTAR_CATEGORIES = [
  "Ultrashort Bond", "Short-Term Bond", "Intermediate Core Bond",
  "Intermediate Core-Plus Bond", "Intermediate Government", "Long Government",
  "Short Government", "Nontraditional Bond", "Multisector Bond",
  "High Yield Bond", "Bank Loan",
] as const

const PRIMARY = "#0f3d6b"
const HIGHLIGHT = "#dc2626"
const DOT_DEFAULT = "#3b82f6"

interface Props { funds: FundData[]; highlightTicker?: string; onSelectFund?: (ticker: string) => void }

/* ── SVG scatter chart (no Recharts, no ResponsiveContainer, no NaN) ── */
function SvgScatter({ data, xAxis, yAxis, avgY, hoveredTicker, onHover, onLeave, onClick, highlightTicker }: {
  data: { ticker: string; name: string; x: number; y: number; isHighlighted: boolean; ytwYtm: number|null; secYield: number|null; duration: number|null; expense: number|null; stdDev: number|null; sharpe: number|null; creditQuality: string|null; morningstarRating: number|null; morningstarCategory: string|null; ytd: number|null; oneYear: number|null; threeYear: number|null }[]
  xAxis: AxisKey; yAxis: AxisKey; avgY: number
  hoveredTicker: string | null; onHover: (t: string) => void; onLeave: () => void; onClick?: (t: string) => void; highlightTicker?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 400 })
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 0) setDims({ w: r.width, h: 400 }) }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const margin = { top: 15, right: 25, bottom: 45, left: 55 }
  const plotW = dims.w - margin.left - margin.right
  const plotH = dims.h - margin.top - margin.bottom

  // Compute domains from data
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (data.length === 0) return { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const d of data) {
      if (d.x < x0) x0 = d.x; if (d.x > x1) x1 = d.x
      if (d.y < y0) y0 = d.y; if (d.y > y1) y1 = d.y
    }
    if (xAxis.unit === "credit") { x0 = 0.5; x1 = 8.5 }
    else { const pad = (x1 - x0) * 0.1 || 1; x0 = Math.max(0, x0 - pad); x1 = x1 + pad }
    if (yAxis.unit === "credit") { y0 = 0.5; y1 = 8.5 }
    else { const pad = (y1 - y0) * 0.1 || 0.5; y0 = y0 - pad; y1 = y1 + pad }
    return { xMin: x0, xMax: x1, yMin: y0, yMax: y1 }
  }, [data, xAxis.unit, yAxis.unit])

  const scaleX = (v: number) => margin.left + ((v - xMin) / (xMax - xMin)) * plotW
  const scaleY = (v: number) => margin.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH

  // Generate ticks
  const xTicks = useMemo(() => {
    if (xAxis.unit === "credit") return [1,2,3,4,5,6,7,8]
    const count = Math.min(8, Math.max(4, Math.floor(plotW / 80)))
    const step = (xMax - xMin) / count
    return Array.from({ length: count + 1 }, (_, i) => xMin + i * step)
  }, [xMin, xMax, plotW, xAxis.unit])

  const yTicks = useMemo(() => {
    if (yAxis.unit === "credit") return [1,2,3,4,5,6,7,8]
    const count = Math.min(8, Math.max(4, Math.floor(plotH / 50)))
    const step = (yMax - yMin) / count
    return Array.from({ length: count + 1 }, (_, i) => yMin + i * step)
  }, [yMin, yMax, plotH, yAxis.unit])

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: typeof data[0] } | null>(null)

  if (dims.w === 0) return <div ref={wrapRef} style={{ width: "100%", height: 400 }} />

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }}>
      <svg width={dims.w} height={dims.h} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {xTicks.map((t, i) => <line key={`xg${i}`} x1={scaleX(t)} x2={scaleX(t)} y1={margin.top} y2={margin.top + plotH} stroke="#f1f5f9" strokeWidth={1} />)}
        {yTicks.map((t, i) => <line key={`yg${i}`} x1={margin.left} x2={margin.left + plotW} y1={scaleY(t)} y2={scaleY(t)} stroke="#f1f5f9" strokeWidth={1} />)}

        {/* Axes */}
        <line x1={margin.left} x2={margin.left + plotW} y1={margin.top + plotH} y2={margin.top + plotH} stroke="#e2e8f0" />
        <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotH} stroke="#e2e8f0" />

        {/* X tick labels */}
        {xTicks.map((t, i) => (
          <text key={`xt${i}`} x={scaleX(t)} y={margin.top + plotH + 16} textAnchor="middle" fontSize={11} fill="#94a3b8">{xAxis.tickFormat(t)}</text>
        ))}
        {/* Y tick labels */}
        {yTicks.map((t, i) => (
          <text key={`yt${i}`} x={margin.left - 8} y={scaleY(t) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">{yAxis.tickFormat(t)}</text>
        ))}

        {/* Axis labels */}
        <text x={margin.left + plotW / 2} y={dims.h - 4} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight={600}>{xAxis.label}</text>
        <text x={14} y={margin.top + plotH / 2} textAnchor="middle" fontSize={11} fill="#64748b" fontWeight={600} transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}>{yAxis.label}</text>

        {/* Average Y line */}
        {data.length >= 2 && isFinite(avgY) && (
          <line x1={margin.left} x2={margin.left + plotW} y1={scaleY(avgY)} y2={scaleY(avgY)} stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={1} />
        )}

        {/* Dots */}
        {data.map(d => {
          const cx = scaleX(d.x), cy = scaleY(d.y)
          const isH = d.ticker === hoveredTicker
          const isHL = d.isHighlighted
          const r = isHL ? 7 : isH ? 6 : 4.5
          return (
            <g key={d.ticker}
              onMouseEnter={(e) => { onHover(d.ticker); setTooltip({ x: e.clientX, y: e.clientY, d }) }}
              onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, d })}
              onMouseLeave={() => { onLeave(); setTooltip(null) }}
              onClick={() => onClick?.(d.ticker)}
              style={{ cursor: onClick ? "pointer" : "default" }}
            >
              <circle cx={cx} cy={cy} r={r + 5} fill="transparent" />
              <circle cx={cx} cy={cy} r={r} fill={isHL ? HIGHLIGHT : DOT_DEFAULT} stroke={isH ? PRIMARY : "transparent"} strokeWidth={isH ? 2 : 0} fillOpacity={isHL ? 1 : 0.75} style={{ transition: "r 0.15s" }} />
              {(isHL || isH) && (
                <>
                  <rect x={cx - 20} y={cy - 22} width={40} height={16} rx={3} fill={isHL ? HIGHLIGHT : PRIMARY} />
                  <text x={cx} y={cy - 11} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">{d.ticker}</text>
                </>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ position: "fixed", left: tooltip.x + 12, top: tooltip.y - 10, zIndex: 50, pointerEvents: "none" }}>
          <ChartTooltip d={tooltip.d} />
        </div>
      )}
    </div>
  )
}

function ChartTooltip({ d }: { d: { ticker: string; name: string; ytwYtm: number|null; secYield: number|null; duration: number|null; expense: number|null; stdDev: number|null; sharpe: number|null; creditQuality: string|null; morningstarRating: number|null; morningstarCategory: string|null; ytd: number|null; oneYear: number|null; threeYear: number|null } }) {
  const fp = (v: number|null) => v != null ? `${v.toFixed(2)}%` : "\u2014"
  const fn = (v: number|null) => v != null ? v.toFixed(2) : "\u2014"
  const stats = [
    { label: "YTW / YTM", value: fp(d.ytwYtm) }, { label: "SEC Yield", value: fp(d.secYield) },
    { label: "Duration", value: d.duration != null ? `${d.duration.toFixed(2)} yrs` : "\u2014" },
    { label: "Credit", value: d.creditQuality ?? "\u2014" }, { label: "Expense", value: fp(d.expense) },
    { label: "Sharpe", value: fn(d.sharpe) }, { label: "Std Dev", value: fn(d.stdDev) },
  ].filter(s => s.value !== "\u2014")
  const perf = [
    { label: "YTD", value: fp(d.ytd) }, { label: "1Y", value: fp(d.oneYear) }, { label: "3Y", value: fp(d.threeYear) },
  ].filter(s => s.value !== "\u2014")
  return (
    <div className="rounded-lg border px-3 py-2.5 shadow-lg" style={{ backgroundColor: "#fff", borderColor: "#e2e8f0", minWidth: 210 }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color: PRIMARY }}>{d.ticker}</span>
        {d.morningstarRating != null && d.morningstarRating > 0 && <span className="text-[10px]" style={{ color: "#f59e0b" }}>{"\u2605".repeat(d.morningstarRating)}</span>}
      </div>
      <div className="text-[10px] leading-snug" style={{ color: "#64748b" }}>{d.name}</div>
      {d.morningstarCategory && <div className="mt-0.5 text-[9px] font-medium" style={{ color: "#94a3b8" }}>{d.morningstarCategory}</div>}
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t pt-1.5" style={{ borderColor: "#f1f5f9" }}>
        {stats.map(s => (<div key={s.label} className="flex items-baseline justify-between gap-2"><span className="text-[9px]" style={{ color: "#94a3b8" }}>{s.label}</span><span className="text-[10px] font-semibold tabular-nums" style={{ color: "#334155" }}>{s.value}</span></div>))}
      </div>
      {perf.length > 0 && <div className="mt-1 flex gap-3 border-t pt-1" style={{ borderColor: "#f1f5f9" }}>{perf.map(s => (<div key={s.label} className="flex items-baseline gap-1"><span className="text-[9px]" style={{ color: "#94a3b8" }}>{s.label}</span><span className="text-[10px] font-semibold tabular-nums" style={{ color: "#334155" }}>{s.value}</span></div>))}</div>}
    </div>
  )
}

/* ── Filter chip ── */
function Chip({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
      style={{ backgroundColor: active ? PRIMARY : "#f1f5f9", color: active ? "#fff" : "#64748b" }}>
      {label}{count !== undefined && <span className="text-[9px] font-bold tabular-nums" style={{ opacity: 0.7 }}>{count}</span>}
    </button>
  )
}

/* ── Filter popover ── */
function FilterPopover({ label, activeCount, children }: { label: string; activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])
  const hasActive = activeCount > 0
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-7 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-all"
        style={{ borderColor: hasActive ? PRIMARY : "#e2e8f0", color: hasActive ? PRIMARY : "#64748b", backgroundColor: hasActive ? "#f0f7ff" : open ? "#f8fafc" : "#fff" }}>
        {label}
        {hasActive && <span className="flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>{activeCount}</span>}
      </button>
      {open && <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[200px] rounded-lg border bg-white p-3 shadow-xl" style={{ borderColor: "#e2e8f0" }}>{children}</div>}
    </div>
  )
}

/* ═══ MAIN COMPONENT ═══ */
export function UniverseChart({ funds, highlightTicker, onSelectFund }: Props) {
  const [presetIdx, setPresetIdx] = useState(0)
  const [xIdx, setXIdx] = useState(findAxis("duration"))
  const [yIdx, setYIdx] = useState(findAxis("ytwYtm"))
  const xAxis = AXIS_OPTIONS[xIdx]
  const yAxis = AXIS_OPTIONS[yIdx]
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [durationCats, setDurationCats] = useState<Set<string>>(new Set(DURATION_CATEGORIES.map(c => c.label)))
  const CREDIT_CATS = ["AAA", "AA", "A", "BBB", "BB & Below"] as const
  const [creditCats, setCreditCats] = useState<Set<string>>(new Set(CREDIT_CATS))
  const [mstarCats, setMstarCats] = useState<Set<string>>(new Set(MSTAR_CATEGORIES))
  const [starMin, setStarMin] = useState(0)
  const [yieldMinPreset, setYieldMinPreset] = useState<number | null>(null)
  const [expenseMaxPreset, setExpenseMaxPreset] = useState<number | null>(null)
  const [sharpeMinPreset, setSharpeMinPreset] = useState<number | null>(null)
  const [stdDevMaxPreset, setStdDevMaxPreset] = useState<number | null>(null)

  const mstarCatCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    funds.forEach(f => { const cat = f.morningstarCategory; if (cat) counts[cat] = (counts[cat] || 0) + 1 })
    return counts
  }, [funds])

  const { sortedData, avgY } = useMemo(() => {
    const sl = search.toLowerCase()
    let ySum = 0, count = 0
    const points = funds.map(f => {
      if (search && !f.ticker.toLowerCase().includes(sl) && !f.name.toLowerCase().includes(sl)) return null
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
      const xVal = xAxis.getValue(f), yVal = yAxis.getValue(f)
      if (xVal == null || yVal == null || !isFinite(xVal) || !isFinite(yVal)) return null
      ySum += yVal; count++
      return {
        ticker: f.ticker, name: f.name, x: xVal, y: yVal, isHighlighted: f.ticker === highlightTicker,
        ytwYtm: f.ytwYtm != null ? f.ytwYtm * 100 : null, secYield: f.secYield != null ? f.secYield * 100 : null,
        duration: f.duration, expense: f.expense != null ? f.expense * 100 : null,
        stdDev: f.stdDev, sharpe: f.sharpe, creditQuality: cs != null ? creditLabel(cs) : null,
        morningstarRating: f.morningstarRating, morningstarCategory: f.morningstarCategory,
        ytd: f.ytd != null ? f.ytd * 100 : null, oneYear: f.oneYear != null ? f.oneYear * 100 : null, threeYear: f.threeYear != null ? f.threeYear * 100 : null,
      }
    }).filter(Boolean) as NonNullable<typeof points[0]>[]
    return { sortedData: points.sort((a, b) => a!.x - b!.x) as NonNullable<typeof points[0]>[], avgY: count > 0 ? ySum / count : 0 }
  }, [funds, xAxis, yAxis, highlightTicker, search, durationCats, creditCats, mstarCats, starMin, yieldMinPreset, expenseMaxPreset, sharpeMinPreset, stdDevMaxPreset])

  const allDurSelected = durationCats.size === DURATION_CATEGORIES.length
  const allCreditSelected = creditCats.size === 5
  const allMstarSelected = mstarCats.size === MSTAR_CATEGORIES.length
  const hasRangeFilters = yieldMinPreset != null || expenseMaxPreset != null || sharpeMinPreset != null || stdDevMaxPreset != null
  const hasActiveFilters = !!search || !allDurSelected || !allCreditSelected || !allMstarSelected || starMin > 0 || hasRangeFilters
  const activeFilterCount = [!allDurSelected, !allCreditSelected, !allMstarSelected, starMin > 0, hasRangeFilters, !!search].filter(Boolean).length

  const clearFilters = useCallback(() => {
    setSearch(""); setDurationCats(new Set(DURATION_CATEGORIES.map(c => c.label)))
    setCreditCats(new Set(["AAA", "AA", "A", "BBB", "BB & Below"])); setMstarCats(new Set(MSTAR_CATEGORIES))
    setStarMin(0); setYieldMinPreset(null); setExpenseMaxPreset(null); setSharpeMinPreset(null); setStdDevMaxPreset(null)
  }, [])

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: PRIMARY }}>Fund Universe Map</h3>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: DOT_DEFAULT }}>{sortedData.length} of {funds.length} funds plotted</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => { setPresetIdx(i); setXIdx(findAxis(p.x)); setYIdx(findAxis(p.y)) }}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
            style={{ backgroundColor: presetIdx === i ? PRIMARY : "#fff", color: presetIdx === i ? "#fff" : "#64748b", border: `1px solid ${presetIdx === i ? PRIMARY : "#e2e8f0"}` }}
          >{p.label}</button>
        ))}
      </div>
      <p className="mb-4 text-[11px] italic leading-relaxed" style={{ color: "#64748b" }}>{PRESETS[presetIdx]?.insight}</p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>X</span>
          <select value={xIdx} onChange={e => { setXIdx(+e.target.value); setPresetIdx(-1) }} className="h-8 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0", color: "#334155" }}>
            {AXIS_OPTIONS.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
          </select>
        </div>
        <span className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>vs</span>
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>Y</span>
          <select value={yIdx} onChange={e => { setYIdx(+e.target.value); setPresetIdx(-1) }} className="h-8 rounded-md border px-2 text-xs" style={{ borderColor: "#e2e8f0", color: "#334155" }}>
            {AXIS_OPTIONS.map((a, i) => <option key={a.key} value={i}>{a.label}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94a3b8" }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="Search ticker or name..." className="h-8 w-[180px] rounded-md border pl-8 pr-7 text-xs" style={{ borderColor: "#e2e8f0", color: "#334155" }} />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 z-10 -translate-y-1/2"><X className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} /></button>}
            {searchFocused && search.length > 0 && (
              <div className="absolute left-0 top-full z-30 mt-1 max-h-[180px] w-[240px] overflow-y-auto rounded-lg border shadow-xl" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                {(() => { const sl2 = search.toLowerCase(); const m = funds.filter(f => f.ticker.toLowerCase().includes(sl2) || f.name.toLowerCase().includes(sl2)); return m.length === 0 ? <div className="px-3 py-2 text-[11px]" style={{ color: "#94a3b8" }}>No matches</div> : m.slice(0, 8).map(f => (
                  <button key={f.ticker} onMouseDown={e => { e.preventDefault(); setSearch(f.ticker); setSearchFocused(false) }} className="block w-full px-3 py-2 text-left text-[11px] font-medium transition-colors hover:bg-[#f0f7ff]" style={{ color: "#334155" }}>
                    <span className="font-bold">{f.ticker}</span> <span style={{ color: "#94a3b8" }}>{f.name.slice(0, 30)}</span>
                  </button>)) })()}
              </div>
            )}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-all"
            style={{ borderColor: hasActiveFilters ? PRIMARY : "#e2e8f0", color: hasActiveFilters ? PRIMARY : "#64748b", backgroundColor: hasActiveFilters ? "#f0f7ff" : "#fff" }}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
            {activeFilterCount > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: PRIMARY }}>{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterPopover label="Category" activeCount={allMstarSelected ? 0 : MSTAR_CATEGORIES.length - mstarCats.size}>
            <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Morningstar Category</span><button onClick={() => setMstarCats(allMstarSelected ? new Set() : new Set(MSTAR_CATEGORIES))} className="text-[10px] font-semibold" style={{ color: PRIMARY }}>{allMstarSelected ? "Clear" : "Select All"}</button></div>
            <div className="flex max-w-[320px] flex-wrap gap-1.5">{MSTAR_CATEGORIES.map(c => <Chip key={c} label={c} active={mstarCats.has(c)} count={mstarCatCounts[c] || 0} onClick={() => { const s = new Set(mstarCats); s.has(c) ? s.delete(c) : s.add(c); setMstarCats(s) }} />)}</div>
          </FilterPopover>
          <FilterPopover label="Duration" activeCount={allDurSelected ? 0 : DURATION_CATEGORIES.length - durationCats.size}>
            <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Duration Range</span><button onClick={() => setDurationCats(allDurSelected ? new Set() : new Set(DURATION_CATEGORIES.map(c => c.label)))} className="text-[10px] font-semibold" style={{ color: PRIMARY }}>{allDurSelected ? "Clear" : "Select All"}</button></div>
            <div className="flex flex-wrap gap-1.5">{DURATION_CATEGORIES.map(c => <Chip key={c.label} label={`${c.label} (${c.min}-${c.max === 100 ? "6+" : c.max}y)`} active={durationCats.has(c.label)} onClick={() => { const s = new Set(durationCats); s.has(c.label) ? s.delete(c.label) : s.add(c.label); setDurationCats(s) }} />)}</div>
          </FilterPopover>
          <FilterPopover label="Credit" activeCount={allCreditSelected ? 0 : 5 - creditCats.size}>
            <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Credit Quality</span><button onClick={() => setCreditCats(allCreditSelected ? new Set() : new Set(["AAA","AA","A","BBB","BB & Below"]))} className="text-[10px] font-semibold" style={{ color: PRIMARY }}>{allCreditSelected ? "Clear" : "Select All"}</button></div>
            <div className="flex flex-wrap gap-1.5">{(["AAA","AA","A","BBB","BB & Below"] as const).map(c => <Chip key={c} label={c} active={creditCats.has(c)} onClick={() => { const s = new Set(creditCats); s.has(c) ? s.delete(c) : s.add(c); setCreditCats(s) }} />)}</div>
          </FilterPopover>
          <FilterPopover label="Yield" activeCount={yieldMinPreset != null ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Minimum Yield</span></div>
            <div className="flex flex-wrap gap-1.5">{[3,4,5,6,7].map(v => <Chip key={v} label={`${v}%+`} active={yieldMinPreset === v} onClick={() => setYieldMinPreset(yieldMinPreset === v ? null : v)} />)}</div>
          </FilterPopover>
          <FilterPopover label="Expense" activeCount={expenseMaxPreset != null ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Max Expense Ratio</span></div>
            <div className="flex flex-wrap gap-1.5">{[{v:0.25,l:"<0.25%"},{v:0.5,l:"<0.5%"},{v:1,l:"<1%"}].map(({v,l}) => <Chip key={v} label={l} active={expenseMaxPreset === v} onClick={() => setExpenseMaxPreset(expenseMaxPreset === v ? null : v)} />)}</div>
          </FilterPopover>
          <FilterPopover label="Sharpe" activeCount={sharpeMinPreset != null ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Min Sharpe Ratio</span></div>
            <div className="flex flex-wrap gap-1.5">{[0,0.5,1,1.5].map(v => <Chip key={v} label={`>${v}`} active={sharpeMinPreset === v} onClick={() => setSharpeMinPreset(sharpeMinPreset === v ? null : v)} />)}</div>
          </FilterPopover>
          <FilterPopover label="Std Dev" activeCount={stdDevMaxPreset != null ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Max Std Deviation</span></div>
            <div className="flex flex-wrap gap-1.5">{[2,3,5].map(v => <Chip key={v} label={`<${v}`} active={stdDevMaxPreset === v} onClick={() => setStdDevMaxPreset(stdDevMaxPreset === v ? null : v)} />)}</div>
          </FilterPopover>
          <FilterPopover label="Stars" activeCount={starMin > 0 ? 1 : 0}>
            <div className="mb-2"><span className="text-[11px] font-bold" style={{ color: "#334155" }}>Min Morningstar Rating</span></div>
            <div className="flex items-center gap-1">{[1,2,3,4,5].map(s => <button key={s} onClick={() => setStarMin(s === starMin ? 0 : s)} className="text-lg leading-none transition-all" style={{ color: s <= starMin ? "#f59e0b" : "#d1d5db" }} aria-label={`Minimum ${s} stars`}>{"\u2605"}</button>)}</div>
          </FilterPopover>
          {hasActiveFilters && <button onClick={clearFilters} className="ml-1 flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-all" style={{ color: "#dc2626", backgroundColor: "#fef2f2" }}><X className="h-3 w-3" /> Reset</button>}
        </div>
      )}

      {sortedData.length < 1 ? (
        <div className="flex h-[350px] flex-col items-center justify-center gap-2">
          <Search className="h-8 w-8" style={{ color: "#cbd5e1" }} />
          <p className="text-sm font-medium" style={{ color: "#94a3b8" }}>No funds match your filters</p>
          {hasActiveFilters && <button onClick={clearFilters} className="text-xs font-semibold underline" style={{ color: PRIMARY }}>Clear filters</button>}
        </div>
      ) : (
        <SvgScatter data={sortedData} xAxis={xAxis} yAxis={yAxis} avgY={avgY} hoveredTicker={hoveredTicker} onHover={setHoveredTicker} onLeave={() => setHoveredTicker(null)} onClick={onSelectFund} highlightTicker={highlightTicker} />
      )}

      <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "#f1f5f9" }}>
        <div className="flex items-center gap-4 text-[10px]" style={{ color: "#94a3b8" }}>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOT_DEFAULT }} /> Funds in universe</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-[1px] w-5" style={{ backgroundColor: "#94a3b8", borderTop: "2px dashed #94a3b8" }} /> Universe average</span>
          {highlightTicker && <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HIGHLIGHT }} /> {highlightTicker}</span>}
        </div>
        <span className="text-[10px] italic" style={{ color: "#94a3b8" }}>Click any fund to view details</span>
      </div>
    </div>
  )
}
