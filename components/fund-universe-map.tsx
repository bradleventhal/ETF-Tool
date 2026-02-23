"use client"

import { useState, useMemo, useCallback } from "react"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ZAxis, Cell, ReferenceLine, Label,
} from "recharts"
import { Search, X, Filter } from "lucide-react"
import type { FundData } from "@/lib/fund-types"

/* ── Axis definitions ── */
type AxisKey = {
  key: keyof FundData
  label: string
  shortLabel: string
  format: (v: number) => string
  multiply?: number
}

const AXIS_OPTIONS: AxisKey[] = [
  { key: "secYield", label: "30-Day SEC Yield", shortLabel: "SEC Yield", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "distributionYield", label: "Distribution Yield", shortLabel: "Dist Yield", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "duration", label: "Duration (yrs)", shortLabel: "Duration", format: v => v.toFixed(2) },
  { key: "stdDev", label: "Standard Deviation", shortLabel: "Std Dev", format: v => v.toFixed(2) },
  { key: "sharpe", label: "Sharpe Ratio", shortLabel: "Sharpe", format: v => v.toFixed(2) },
  { key: "expense", label: "Expense Ratio", shortLabel: "Expense", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "ytwYtm", label: "YTW / YTM", shortLabel: "YTW", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "ytd", label: "YTD Return", shortLabel: "YTD", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "oneYear", label: "1-Year Return", shortLabel: "1Y", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "threeYear", label: "3-Year Return", shortLabel: "3Y", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "securitized", label: "Securitized %", shortLabel: "Securitized", format: v => `${v.toFixed(1)}%`, multiply: 100 },
  { key: "corporateCredit", label: "Corp Credit %", shortLabel: "Corp Credit", format: v => `${v.toFixed(1)}%`, multiply: 100 },
]

/* ── Preset views ── */
const PRESETS = [
  { label: "Yield vs Duration", x: 2, y: 0 },
  { label: "Yield vs Risk", x: 3, y: 0 },
  { label: "Sharpe vs Expense", x: 5, y: 4 },
  { label: "Return vs Risk", x: 3, y: 9 },
]

/* ── Colors ── */
const PRIMARY = "#0f3d6b"
const HIGHLIGHT = "#dc2626"
const DOT_DEFAULT = "#3b82f6"
const DOT_MUTED = "#94a3b8"

interface Props {
  funds: FundData[]
  highlightTicker?: string
  onSelectFund?: (ticker: string) => void
}

function getValue(fund: FundData, axis: AxisKey): number | null {
  const raw = fund[axis.key] as number | null
  if (raw == null || isNaN(raw)) return null
  return axis.multiply ? raw * axis.multiply : raw
}

/* ── Custom dot that renders a ticker label ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TickerDot(props: any) {
  const { cx, cy, payload, hoveredTicker, onHover, onLeave, onClick } = props
  if (!cx || !cy || !payload) return null

  const isHighlighted = payload.isHighlighted
  const isHovered = payload.ticker === hoveredTicker
  const isActive = isHighlighted || isHovered
  const color = isHighlighted ? HIGHLIGHT : isHovered ? PRIMARY : DOT_DEFAULT
  const radius = isActive ? 6 : 4

  return (
    <g
      onMouseEnter={() => onHover(payload.ticker)}
      onMouseLeave={() => onLeave()}
      onClick={() => onClick(payload.ticker)}
      style={{ cursor: "pointer" }}
    >
      <circle cx={cx} cy={cy} r={radius + 8} fill="transparent" />
      <circle
        cx={cx} cy={cy} r={radius}
        fill={color}
        fillOpacity={isActive ? 1 : 0.75}
        stroke={isActive ? color : "transparent"}
        strokeWidth={isActive ? 2 : 0}
      />
      {isActive && (
        <text
          x={cx} y={cy - radius - 5}
          textAnchor="middle"
          fill={color}
          fontSize={11}
          fontWeight={700}
          fontFamily="ui-monospace, monospace"
        >
          {payload.ticker}
        </text>
      )}
    </g>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border px-3 py-2.5 shadow-lg" style={{ backgroundColor: "#fff", borderColor: "#e2e8f0" }}>
      <div className="flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold" style={{ backgroundColor: d.isHighlighted ? "#fef2f2" : "#eff6ff", color: d.isHighlighted ? HIGHLIGHT : PRIMARY }}>{d.ticker}</span>
        <span className="max-w-[180px] truncate text-[11px]" style={{ color: "#64748b" }}>{d.name}</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        <p className="text-[11px]" style={{ color: "#334155" }}>{d.xLabel}: <span className="font-mono font-semibold">{d.xFormatted}</span></p>
        <p className="text-[11px]" style={{ color: "#334155" }}>{d.yLabel}: <span className="font-mono font-semibold">{d.yFormatted}</span></p>
      </div>
      <p className="mt-1.5 text-[10px]" style={{ color: "#94a3b8" }}>Click to view fund details</p>
    </div>
  )
}

export function FundUniverseMap({ funds, highlightTicker, onSelectFund }: Props) {
  const [xAxisIdx, setXAxisIdx] = useState(2) // Duration
  const [yAxisIdx, setYAxisIdx] = useState(0) // SEC Yield
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)
  const [durationRange, setDurationRange] = useState<[number, number]>([0, 30])
  const [yieldRange, setYieldRange] = useState<[number, number]>([0, 20])

  const xAxis = AXIS_OPTIONS[xAxisIdx]
  const yAxis = AXIS_OPTIONS[yAxisIdx]

  const data = useMemo(() => {
    const searchLower = search.toLowerCase()
    return funds
      .filter(f => {
        if (search && !f.ticker.toLowerCase().includes(searchLower) && !f.name.toLowerCase().includes(searchLower)) return false
        // Apply range filters
        const dur = f.duration ?? 0
        if (dur < durationRange[0] || dur > durationRange[1]) return false
        const yld = (f.secYield ?? 0) * 100
        if (yld < yieldRange[0] || yld > yieldRange[1]) return false
        return true
      })
      .map(f => {
        const xVal = getValue(f, xAxis)
        const yVal = getValue(f, yAxis)
        if (xVal == null || yVal == null) return null
        return {
          x: xVal,
          y: yVal,
          ticker: f.ticker,
          name: f.name,
          xLabel: xAxis.label,
          yLabel: yAxis.label,
          xFormatted: xAxis.format(xVal),
          yFormatted: yAxis.format(yVal),
          isHighlighted: f.ticker === highlightTicker,
        }
      })
      .filter(Boolean) as {
        x: number; y: number; ticker: string; name: string
        xLabel: string; yLabel: string; xFormatted: string; yFormatted: string
        isHighlighted: boolean
      }[]
  }, [funds, xAxis, yAxis, highlightTicker, search, durationRange, yieldRange])

  // Sort so highlighted dot renders on top
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => (a.isHighlighted ? 1 : 0) - (b.isHighlighted ? 1 : 0))
  }, [data])

  const avgX = data.length > 0 ? data.reduce((s, d) => s + d.x, 0) / data.length : 0
  const avgY = data.length > 0 ? data.reduce((s, d) => s + d.y, 0) / data.length : 0

  const handleDotClick = useCallback((ticker: string) => {
    onSelectFund?.(ticker)
  }, [onSelectFund])

  const hasActiveFilters = search || durationRange[0] > 0 || durationRange[1] < 30 || yieldRange[0] > 0 || yieldRange[1] < 20

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5 sm:px-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
        <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: PRIMARY }}>
          Fund Universe Map
        </h3>
        <span className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>
          {data.length} of {funds.length} funds plotted
        </span>
      </div>

      {/* Controls bar */}
      <div className="border-b px-3 py-3 sm:px-5" style={{ borderColor: "#f1f5f9" }}>
        {/* Presets */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Quick Views:</span>
          {PRESETS.map((p, i) => {
            const isActive = xAxisIdx === p.x && yAxisIdx === p.y
            return (
              <button
                key={i}
                onClick={() => { setXAxisIdx(p.x); setYAxisIdx(p.y) }}
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  borderColor: isActive ? PRIMARY : "#e2e8f0",
                  backgroundColor: isActive ? PRIMARY : "#fff",
                  color: isActive ? "#fff" : "#475569",
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {/* Axis selectors */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>X</label>
            <select
              value={xAxisIdx}
              onChange={e => setXAxisIdx(Number(e.target.value))}
              className="h-8 rounded border px-2 text-xs"
              style={{ borderColor: "#e2e8f0", color: "#334155", backgroundColor: "#fff" }}
            >
              {AXIS_OPTIONS.map((opt, i) => <option key={opt.key} value={i}>{opt.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Y</label>
            <select
              value={yAxisIdx}
              onChange={e => setYAxisIdx(Number(e.target.value))}
              className="h-8 rounded border px-2 text-xs"
              style={{ borderColor: "#e2e8f0", color: "#334155", backgroundColor: "#fff" }}
            >
              {AXIS_OPTIONS.map((opt, i) => <option key={opt.key} value={i}>{opt.label}</option>)}
            </select>
          </div>

          <div className="flex flex-1 items-center gap-2 sm:justify-end">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "#94a3b8" }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ticker or name..."
                className="h-8 w-full rounded border pl-8 pr-7 text-xs"
                style={{ borderColor: "#e2e8f0", color: "#334155", backgroundColor: "#fff" }}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex h-8 items-center gap-1.5 rounded border px-2.5 text-[11px] font-medium transition-colors"
              style={{
                borderColor: hasActiveFilters ? PRIMARY : "#e2e8f0",
                backgroundColor: hasActiveFilters ? "#eff6ff" : "#fff",
                color: hasActiveFilters ? PRIMARY : "#64748b",
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold" style={{ backgroundColor: PRIMARY, color: "#fff" }}>!</span>}
            </button>
          </div>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-1 gap-4 rounded border p-3 sm:grid-cols-2" style={{ borderColor: "#f1f5f9", backgroundColor: "#f8fafc" }}>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                Duration Range: <span style={{ color: "#334155" }}>{durationRange[0]} - {durationRange[1]} yrs</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={0} max={30} step={0.5}
                  value={durationRange[0]}
                  onChange={e => setDurationRange([Math.min(Number(e.target.value), durationRange[1]), durationRange[1]])}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded bg-slate-200 accent-[#0f3d6b]"
                />
                <input
                  type="range" min={0} max={30} step={0.5}
                  value={durationRange[1]}
                  onChange={e => setDurationRange([durationRange[0], Math.max(Number(e.target.value), durationRange[0])])}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded bg-slate-200 accent-[#0f3d6b]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                SEC Yield Range: <span style={{ color: "#334155" }}>{yieldRange[0]}% - {yieldRange[1]}%</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={0} max={20} step={0.25}
                  value={yieldRange[0]}
                  onChange={e => setYieldRange([Math.min(Number(e.target.value), yieldRange[1]), yieldRange[1]])}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded bg-slate-200 accent-[#0f3d6b]"
                />
                <input
                  type="range" min={0} max={20} step={0.25}
                  value={yieldRange[1]}
                  onChange={e => setYieldRange([yieldRange[0], Math.max(Number(e.target.value), yieldRange[0])])}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded bg-slate-200 accent-[#0f3d6b]"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <button
                onClick={() => { setDurationRange([0, 30]); setYieldRange([0, 20]); setSearch("") }}
                className="text-[11px] font-medium underline" style={{ color: PRIMARY }}
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 py-4 sm:px-4">
        {sortedData.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Search className="h-6 w-6" style={{ color: "#e2e8f0" }} />
            <p className="mt-3 text-sm" style={{ color: "#94a3b8" }}>
              {hasActiveFilters ? "No funds match your filters" : "Not enough funds with data for these axes"}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => { setDurationRange([0, 30]); setYieldRange([0, 20]); setSearch("") }}
                className="mt-2 text-xs font-medium underline" style={{ color: PRIMARY }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={460}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                type="number"
                dataKey="x"
                name={xAxis.label}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => xAxis.format(v)}
              >
                <Label value={xAxis.label} position="bottom" offset={10} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
              </XAxis>
              <YAxis
                type="number"
                dataKey="y"
                name={yAxis.label}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => yAxis.format(v)}
              >
                <Label value={yAxis.label} angle={-90} position="insideLeft" offset={0} style={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
              </YAxis>
              <ZAxis range={[50, 50]} />
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
                  <Cell
                    key={i}
                    fill={entry.isHighlighted ? HIGHLIGHT : DOT_DEFAULT}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 border-t px-3 py-2.5 sm:px-5" style={{ borderColor: "#f1f5f9", backgroundColor: "#f8fafc" }}>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOT_DEFAULT }} />
          <span className="text-[11px]" style={{ color: "#64748b" }}>Funds in universe</span>
        </div>
        {highlightTicker && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HIGHLIGHT }} />
            <span className="text-[11px] font-medium" style={{ color: HIGHLIGHT }}>{highlightTicker}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-px w-5" style={{ borderTop: "2px dashed #cbd5e1" }} />
          <span className="text-[11px]" style={{ color: "#94a3b8" }}>Universe average</span>
        </div>
        <span className="ml-auto text-[10px]" style={{ color: "#94a3b8" }}>Click any fund to view details</span>
      </div>
    </div>
  )
}
