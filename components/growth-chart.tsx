"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine
} from "recharts"

interface GrowthPoint { date: string; [ticker: string]: string | number }

interface Props {
  tickerA: string
  tickerB: string
}

const PRESETS = ["1Y", "3Y", "5Y", "Max"] as const
type Preset = typeof PRESETS[number]

function dateMinusYears(years: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDateLabel(date: string): string {
  const d = new Date(date + "T00:00:00")
  const m = d.toLocaleString("en-US", { month: "short" })
  const y = d.getFullYear().toString().slice(2)
  return `${m} '${y}`
}

function formatInputDate(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
}

export function GrowthChart({ tickerA, tickerB }: Props) {
  const navy = "#0f3d6b"
  const red = "#dc2626"

  const [preset, setPreset] = useState<Preset>("3Y")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState(todayStr())
  const [useCustom, setUseCustom] = useState(false)
  const [data, setData] = useState<GrowthPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalA, setTotalA] = useState<number | null>(null)
  const [totalB, setTotalB] = useState<number | null>(null)

  const getRange = useCallback((): { start: string; end: string } => {
    const today = todayStr()
    if (useCustom) {
      return { start: customStart || "2000-01-01", end: customEnd || today }
    }
    switch (preset) {
      case "1Y": return { start: dateMinusYears(1), end: today }
      case "3Y": return { start: dateMinusYears(3), end: today }
      case "5Y": return { start: dateMinusYears(5), end: today }
      case "Max": return { start: "2000-01-01", end: today }
    }
  }, [preset, useCustom, customStart, customEnd])

  useEffect(() => {
    const { start, end } = getRange()
    if (!start) return
    setLoading(true)
    setError(null)
    fetch(`/api/growth?tickers=${tickerA},${tickerB}&start=${start}&end=${end}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); setData([]); return }
        const fundA = json.funds?.[0]
        const fundB = json.funds?.[1]
        if (!fundA || !fundB) { setError("Missing fund data"); setData([]); return }
        const merged: GrowthPoint[] = fundA.data.map((p: { date: string; growth: number }, i: number) => ({
          date: p.date,
          [tickerA]: parseFloat(p.growth.toFixed(2)),
          [tickerB]: fundB.data[i] ? parseFloat(fundB.data[i].growth.toFixed(2)) : 0,
        }))
        setData(merged)
        if (fundA.data.length > 0) setTotalA(parseFloat(fundA.data[fundA.data.length - 1].growth.toFixed(2)))
        if (fundB.data.length > 0) setTotalB(parseFloat(fundB.data[fundB.data.length - 1].growth.toFixed(2)))
      })
      .catch(() => { setError("Failed to fetch growth data"); setData([]) })
      .finally(() => setLoading(false))
  }, [tickerA, tickerB, getRange])

  const tickInterval = data.length > 500 ? Math.floor(data.length / 6) : data.length > 200 ? Math.floor(data.length / 5) : Math.floor(data.length / 4)

  // Editable date display component
  function DateInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>{label}</span>
        <div className="relative flex items-center gap-1 rounded border px-2.5 py-1 transition-colors hover:border-[#94a3b8]" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
          <input
            type="date"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="font-mono text-xs"
            style={{ color: "#334155", border: "none", outline: "none", background: "transparent", width: "110px" }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header with title + presets */}
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
        <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Growth Comparison</h4>
        <div className="flex items-center gap-1">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => { setPreset(p); setUseCustom(false) }}
              className="rounded px-2.5 py-1 text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: !useCustom && preset === p ? navy : "transparent",
                color: !useCustom && preset === p ? "#fff" : "#64748b",
              }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => { setUseCustom(true); if (!customStart) setCustomStart(dateMinusYears(1)) }}
            className="rounded px-2.5 py-1 text-[11px] font-semibold transition-colors"
            style={{
              backgroundColor: useCustom ? navy : "transparent",
              color: useCustom ? "#fff" : "#64748b",
            }}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom date row */}
      {useCustom && (
        <div className="flex items-center gap-5 border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#fafbfc" }}>
          <DateInput label="Start" value={customStart} onChange={setCustomStart} />
          <div className="h-px w-3" style={{ backgroundColor: "#cbd5e1" }} />
          <DateInput label="End" value={customEnd} onChange={setCustomEnd} />
        </div>
      )}

      {/* Legend with totals */}
      <div className="px-4 pt-3 pb-1">
        {totalA != null && totalB != null && (
          <div className="mb-2 flex items-center gap-5 text-xs">
            <span style={{ color: navy }}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: navy }} />
              <span className="font-bold">{tickerA}</span>
              <span className="ml-1.5 font-mono font-semibold">{totalA >= 0 ? "+" : ""}{totalA.toFixed(2)}%</span>
            </span>
            <span style={{ color: red }}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: red }} />
              <span className="font-bold">{tickerB}</span>
              <span className="ml-1.5 font-mono font-semibold">{totalB >= 0 ? "+" : ""}{totalB.toFixed(2)}%</span>
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 pb-3">
        {loading && (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm" style={{ color: "#94a3b8" }}>Loading growth data...</p>
          </div>
        )}
        {error && (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={formatDateLabel}
                interval={tickInterval}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                width={50}
              />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
              <Tooltip
                labelFormatter={(label: string) => {
                  const d = new Date(label + "T00:00:00")
                  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                }}
                formatter={(value: number, name: string) => [`${value >= 0 ? "+" : ""}${value.toFixed(2)}%`, name]}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: 12,
                  padding: "8px 14px",
                  color: "#1e293b",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                labelStyle={{ color: "#64748b", fontSize: 11, fontWeight: 600, marginBottom: 4 }}
              />
              <Line type="monotone" dataKey={tickerA} stroke={navy} dot={false} strokeWidth={2} activeDot={{ r: 4, fill: navy, stroke: "#fff", strokeWidth: 2 }} />
              <Line type="monotone" dataKey={tickerB} stroke={red} dot={false} strokeWidth={2} activeDot={{ r: 4, fill: red, stroke: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm" style={{ color: "#94a3b8" }}>No data available for selected range</p>
          </div>
        )}
      </div>

      {/* Source note */}
      <div className="border-t px-4 py-1.5" style={{ borderColor: "#f1f5f9" }}>
        <p className="text-[9px]" style={{ color: "#94a3b8" }}>Source: Yahoo Finance. Growth w/ dividends reinvested. May differ slightly from other providers due to reinvestment timing methodology.</p>
      </div>
    </div>
  )
}
