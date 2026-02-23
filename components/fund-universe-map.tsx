"use client"

import { useState, useMemo } from "react"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ZAxis, Cell, ReferenceLine,
} from "recharts"
import type { FundData } from "@/lib/fund-types"

type AxisKey = {
  key: keyof FundData
  label: string
  format: (v: number) => string
  multiply?: number // multiply raw value for display (e.g. 0.0466 -> 4.66%)
}

const AXIS_OPTIONS: AxisKey[] = [
  { key: "secYield", label: "30-Day SEC Yield", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "distributionYield", label: "Distribution Yield", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "duration", label: "Duration (yrs)", format: v => v.toFixed(2) },
  { key: "stdDev", label: "Std Deviation", format: v => v.toFixed(2) },
  { key: "sharpe", label: "Sharpe Ratio", format: v => v.toFixed(2) },
  { key: "expense", label: "Expense Ratio", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "ytwYtm", label: "YTW / YTM", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "ytd", label: "YTD Return", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "oneYear", label: "1-Year Return", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "threeYear", label: "3-Year Return", format: v => `${v.toFixed(2)}%`, multiply: 100 },
  { key: "securitized", label: "Securitized %", format: v => `${v.toFixed(1)}%`, multiply: 100 },
  { key: "corporateCredit", label: "Corp Credit %", format: v => `${v.toFixed(1)}%`, multiply: 100 },
]

const PRIMARY_COLOR = "#0f3d6b"
const HIGHLIGHT_COLOR = "#dc2626"
const DOT_COLOR = "#94a3b8"

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null
  const d = payload[0].payload
  return (
    <div className="rounded border px-3 py-2 shadow-lg" style={{ backgroundColor: "#fff", borderColor: "#e2e8f0" }}>
      <p className="text-xs font-bold" style={{ color: PRIMARY_COLOR }}>{d.ticker}</p>
      <p className="max-w-[200px] truncate text-[11px]" style={{ color: "#64748b" }}>{d.name}</p>
      <div className="mt-1 space-y-0.5">
        <p className="text-[11px]" style={{ color: "#334155" }}>{d.xLabel}: <span className="font-mono font-semibold">{d.xFormatted}</span></p>
        <p className="text-[11px]" style={{ color: "#334155" }}>{d.yLabel}: <span className="font-mono font-semibold">{d.yFormatted}</span></p>
      </div>
    </div>
  )
}

export function FundUniverseMap({ funds, highlightTicker, onSelectFund }: Props) {
  const [xAxisIdx, setXAxisIdx] = useState(2) // Duration
  const [yAxisIdx, setYAxisIdx] = useState(0) // SEC Yield

  const xAxis = AXIS_OPTIONS[xAxisIdx]
  const yAxis = AXIS_OPTIONS[yAxisIdx]

  const data = useMemo(() => {
    return funds
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
  }, [funds, xAxis, yAxis, highlightTicker])

  // Compute averages for reference lines
  const avgX = data.length > 0 ? data.reduce((s, d) => s + d.x, 0) / data.length : 0
  const avgY = data.length > 0 ? data.reduce((s, d) => s + d.y, 0) / data.length : 0

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5 sm:px-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
        <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
          Fund Universe Map
        </h3>
        <span className="text-[11px]" style={{ color: "#94a3b8" }}>
          {data.length} of {funds.length} funds plotted
        </span>
      </div>

      {/* Axis selectors */}
      <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-5" style={{ borderColor: "#f1f5f9" }}>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>X-Axis</label>
          <select
            value={xAxisIdx}
            onChange={e => setXAxisIdx(Number(e.target.value))}
            className="h-8 rounded border px-2 text-xs"
            style={{ borderColor: "#e2e8f0", color: "#334155", backgroundColor: "#fff" }}
          >
            {AXIS_OPTIONS.map((opt, i) => (
              <option key={opt.key} value={i}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Y-Axis</label>
          <select
            value={yAxisIdx}
            onChange={e => setYAxisIdx(Number(e.target.value))}
            className="h-8 rounded border px-2 text-xs"
            style={{ borderColor: "#e2e8f0", color: "#334155", backgroundColor: "#fff" }}
          >
            {AXIS_OPTIONS.map((opt, i) => (
              <option key={opt.key} value={i}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 py-4 sm:px-4">
        {data.length < 2 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm" style={{ color: "#94a3b8" }}>Not enough funds with data for these axes</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                type="number"
                dataKey="x"
                name={xAxis.label}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => xAxis.format(v)}
                label={{ value: xAxis.label, position: "bottom", offset: 0, style: { fontSize: 11, fill: "#64748b", fontWeight: 600 } }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={yAxis.label}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => yAxis.format(v)}
                label={{ value: yAxis.label, angle: -90, position: "insideLeft", offset: 5, style: { fontSize: 11, fill: "#64748b", fontWeight: 600 } }}
              />
              <ZAxis range={[40, 40]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#e2e8f0" }} />
              <ReferenceLine x={avgX} stroke="#e2e8f0" strokeDasharray="4 4" />
              <ReferenceLine y={avgY} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Scatter
                data={data}
                onClick={(d) => onSelectFund?.(d.ticker)}
                cursor="pointer"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isHighlighted ? HIGHLIGHT_COLOR : DOT_COLOR}
                    fillOpacity={entry.isHighlighted ? 1 : 0.7}
                    stroke={entry.isHighlighted ? HIGHLIGHT_COLOR : "transparent"}
                    strokeWidth={entry.isHighlighted ? 2 : 0}
                    r={entry.isHighlighted ? 7 : 4}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend / quadrant labels */}
      <div className="flex flex-wrap items-center gap-4 border-t px-3 py-2 sm:px-5" style={{ borderColor: "#f1f5f9" }}>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DOT_COLOR }} />
          <span className="text-[11px]" style={{ color: "#64748b" }}>Funds in universe</span>
        </div>
        {highlightTicker && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HIGHLIGHT_COLOR }} />
            <span className="text-[11px]" style={{ color: "#64748b" }}>{highlightTicker}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-px w-4" style={{ backgroundColor: "#e2e8f0", borderTop: "2px dashed #e2e8f0" }} />
          <span className="text-[11px]" style={{ color: "#94a3b8" }}>Universe average</span>
        </div>
      </div>
    </div>
  )
}
