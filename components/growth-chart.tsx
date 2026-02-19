"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine
} from "recharts"

interface GrowthPoint { date: string; [ticker: string]: string | number }

interface Props {
  tickerA: string
  tickerB: string
  mode?: "internal" | "advisor"
}

const PRESETS = ["YTD", "1Y", "3Y", "5Y", "Max"] as const
type Preset = typeof PRESETS[number]

function ytdStart(): string { return `${new Date().getFullYear()}-01-01` }
function dateMinusYears(y: number): string { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().slice(0, 10) }
function todayStr(): string { return new Date().toISOString().slice(0, 10) }
function formatDateLabel(date: string): string {
  const d = new Date(date + "T00:00:00")
  return `${d.toLocaleString("en-US", { month: "short" })} '${d.getFullYear().toString().slice(2)}`
}

// --------------- Segmented Date Input (MM / DD / YYYY) ---------------
function SegmentedDateInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [parts, setParts] = useState<{ mm: string; dd: string; yyyy: string }>(() => split(value))
  const mmRef = useRef<HTMLInputElement>(null)
  const ddRef = useRef<HTMLInputElement>(null)
  const yyRef = useRef<HTMLInputElement>(null)
  const prev = useRef(value)

  function split(iso: string): { mm: string; dd: string; yyyy: string } {
    if (!iso) return { mm: "", dd: "", yyyy: "" }
    const [y, m, d] = iso.split("-")
    return { mm: m || "", dd: d || "", yyyy: y || "" }
  }

  function emit(mm: string, dd: string, yyyy: string) {
    if (mm.length === 2 && dd.length === 2 && yyyy.length === 4) {
      const iso = `${yyyy}-${mm}-${dd}`
      prev.current = iso
      onChange(iso)
    }
  }

  // Sync external value changes
  if (value !== prev.current) {
    prev.current = value
    const p = split(value)
    setParts(p)
  }

  function handleMM(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 2)
    setParts(p => { const n = { ...p, mm: v }; emit(n.mm, n.dd, n.yyyy); return n })
    if (v.length === 2) ddRef.current?.focus()
  }
  function handleDD(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 2)
    setParts(p => { const n = { ...p, dd: v }; emit(n.mm, n.dd, n.yyyy); return n })
    if (v.length === 2) yyRef.current?.focus()
  }
  function handleYYYY(raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 4)
    setParts(p => { const n = { ...p, yyyy: v }; emit(n.mm, n.dd, n.yyyy); return n })
  }

  // Backspace on empty field goes to previous
  function handleKeyDown(e: React.KeyboardEvent, field: "dd" | "yyyy") {
    if (e.key === "Backspace") {
      const target = e.target as HTMLInputElement
      if (target.value === "") {
        if (field === "dd") mmRef.current?.focus()
        if (field === "yyyy") ddRef.current?.focus()
      }
    }
  }

  const inputCls = "text-center font-mono text-xs outline-none"
  const inputStyle = { color: "#334155", background: "transparent", border: "none" }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>{label}</span>
      <div
        className="flex items-center rounded border px-2 py-1 transition-colors focus-within:border-[#0f3d6b] hover:border-[#94a3b8]"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#fff", gap: 2 }}
      >
        <input ref={mmRef} value={parts.mm} onChange={e => handleMM(e.target.value)} placeholder="MM" className={inputCls} style={{ ...inputStyle, width: 24 }} maxLength={2} />
        <span className="text-[10px]" style={{ color: "#cbd5e1" }}>/</span>
        <input ref={ddRef} value={parts.dd} onChange={e => handleDD(e.target.value)} onKeyDown={e => handleKeyDown(e, "dd")} placeholder="DD" className={inputCls} style={{ ...inputStyle, width: 22 }} maxLength={2} />
        <span className="text-[10px]" style={{ color: "#cbd5e1" }}>/</span>
        <input ref={yyRef} value={parts.yyyy} onChange={e => handleYYYY(e.target.value)} onKeyDown={e => handleKeyDown(e, "yyyy")} placeholder="YYYY" className={inputCls} style={{ ...inputStyle, width: 38 }} maxLength={4} />
      </div>
    </div>
  )
}

// --------------- Main Component ---------------
export function GrowthChart({ tickerA, tickerB, mode = "internal" }: Props) {
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

  // Recommendation
  const [recDate, setRecDate] = useState<string | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const recFetched = useRef(false)

  // Fetch recommendation on mount (once)
  useEffect(() => {
    if (recFetched.current) return
    recFetched.current = true
    setRecLoading(true)
    fetch(`/api/growth/recommend?tickerA=${tickerA}&tickerB=${tickerB}`)
      .then(r => r.json())
      .then(json => {
        if (json.recommended) {
          setRecDate(json.recommended)
          // Auto-apply: set custom start to recommended date
          setCustomStart(json.recommended)
          setCustomEnd(todayStr())
          setUseCustom(true)
        }
      })
      .catch(() => { /* silently fail, just use default preset */ })
      .finally(() => setRecLoading(false))
  }, [tickerA, tickerB])

  const getRange = useCallback((): { start: string; end: string } => {
    const today = todayStr()
    if (useCustom) {
      return { start: customStart || "2000-01-01", end: customEnd || today }
    }
    switch (preset) {
      case "YTD": return { start: ytdStart(), end: today }
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

  // Is the current view using the recommended date?
  const isUsingRec = useCustom && recDate && customStart === recDate

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header */}
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
        <div className="flex flex-wrap items-center gap-5 border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#fafbfc" }}>
          <SegmentedDateInput label="Start" value={customStart} onChange={setCustomStart} />
          <div className="h-px w-3" style={{ backgroundColor: "#cbd5e1" }} />
          <SegmentedDateInput label="End" value={customEnd} onChange={setCustomEnd} />
          {mode === "internal" && isUsingRec && (
            <span className="ml-auto text-[10px] italic" style={{ color: "#16a34a" }}>
              Recommended timeframe
            </span>
          )}
        </div>
      )}

      {/* Legend */}
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
        {(loading || recLoading) && (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm" style={{ color: "#94a3b8" }}>{recLoading ? "Finding optimal timeframe..." : "Loading growth data..."}</p>
          </div>
        )}
        {error && !loading && !recLoading && (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm" style={{ color: "#dc2626" }}>{error}</p>
          </div>
        )}
        {!loading && !recLoading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={formatDateLabel} interval={tickInterval} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={50} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
              <Tooltip
                labelFormatter={(l: string) => { const d = new Date(l + "T00:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
                formatter={(value: number, name: string) => [`${value >= 0 ? "+" : ""}${value.toFixed(2)}%`, name]}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12, padding: "8px 14px", color: "#1e293b", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                labelStyle={{ color: "#64748b", fontSize: 11, fontWeight: 600, marginBottom: 4 }}
              />
              <Line type="monotone" dataKey={tickerA} stroke={navy} dot={false} strokeWidth={2} activeDot={{ r: 4, fill: navy, stroke: "#fff", strokeWidth: 2 }} />
              <Line type="monotone" dataKey={tickerB} stroke={red} dot={false} strokeWidth={2} activeDot={{ r: 4, fill: red, stroke: "#fff", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && !recLoading && !error && data.length === 0 && (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm" style={{ color: "#94a3b8" }}>No data available for selected range</p>
          </div>
        )}
      </div>

      {/* Source */}
      <div className="border-t px-4 py-1.5" style={{ borderColor: "#f1f5f9" }}>
        <p className="text-[9px]" style={{ color: "#94a3b8" }}>Source: Yahoo Finance. Growth w/ dividends reinvested. May differ slightly from other providers due to reinvestment timing.</p>
      </div>
    </div>
  )
}
