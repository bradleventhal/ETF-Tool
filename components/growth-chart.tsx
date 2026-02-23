"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine
} from "recharts"

interface ChartPoint { date: string; [key: string]: string | number }
const BASE = 10000
function pctToDollar(pct: number): number { return Math.round(BASE * (1 + pct / 100)) }
function fmtDollar(v: number): string {
  if (v >= 100000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

/** Generate nice round Y-axis ticks for dollar values */
function niceYTicks(dataMin: number, dataMax: number, count: number = 5): number[] {
  const range = dataMax - dataMin
  if (range <= 0) return [dataMin]
  // Pick a nice step: 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000
  const rawStep = range / (count - 1)
  const niceSteps = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000]
  const step = niceSteps.find(s => s >= rawStep) || Math.ceil(rawStep / 1000) * 1000
  const start = Math.floor(dataMin / step) * step
  const ticks: number[] = []
  for (let v = start; v <= dataMax + step * 0.5; v += step) {
    ticks.push(v)
  }
  // Ensure we have at least 3 ticks
  if (ticks.length < 3) return [dataMin, Math.round((dataMin + dataMax) / 2), dataMax]
  return ticks
}

interface Props {
  tickerA: string
  tickerB: string
  mode?: "internal" | "advisor"
}

const PRESETS = ["YTD", "1Y", "3Y", "5Y", "Max", "CI"] as const
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
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalA, setTotalA] = useState<number | null>(null)
  const [totalB, setTotalB] = useState<number | null>(null)

  // Recommendation + Common Inception
  const [recDate, setRecDate] = useState<string | null>(null)
  const [recLabel, setRecLabel] = useState<string | null>(null)
  const [recLoading, setRecLoading] = useState(false)
  const [ciDate, setCiDate] = useState<string | null>(null)
  const recFetched = useRef(false)
  const badgeAPixelY = useRef<number>(0) // For overlap detection between badges

  // Map recommend label to a preset if possible
  const labelToPreset = (label: string): Preset | null => {
    if (label === "YTD") return "YTD"
    if (label === "1Y") return "1Y"
    if (label === "3Y") return "3Y"
    if (label === "Common Inception") return "CI"
    return null
  }

  // Fetch recommendation on mount (once) -- also gets common inception date
  useEffect(() => {
    if (recFetched.current) return
    recFetched.current = true
    setRecLoading(true)
    fetch(`/api/growth/recommend?tickerA=${tickerA}&tickerB=${tickerB}`)
      .then(r => r.json())
      .then(json => {
        if (json.commonInceptionDate) setCiDate(json.commonInceptionDate)
        if (json.recommended) setRecDate(json.recommended)
        if (json.label) setRecLabel(json.label)

        if (mode === "advisor" && json.recommended) {
          // Advisor mode: map to a preset if possible, otherwise use custom silently
          const matchedPreset = json.label ? labelToPreset(json.label) : null
          if (matchedPreset) {
            setPreset(matchedPreset)
            setUseCustom(false)
          } else {
            // Can't map to preset -- use custom date but we'll hide the picker in advisor mode
            setCustomStart(json.recommended)
            setCustomEnd(todayStr())
            setUseCustom(true)
          }
        } else if (mode === "internal" && json.commonInceptionDate) {
          // Internal mode: default to common inception
          setPreset("CI")
          setUseCustom(false)
        }
      })
      .catch(() => { /* silently fail, just use default preset */ })
      .finally(() => setRecLoading(false))
  }, [tickerA, tickerB, mode])

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
      case "CI": return { start: ciDate || "2000-01-01", end: today }
    }
  }, [preset, useCustom, customStart, customEnd, ciDate])

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
        const merged: ChartPoint[] = fundA.data.map((p: { date: string; growth: number }, i: number) => {
          const growthA = parseFloat(p.growth.toFixed(2))
          const growthB = fundB.data[i] ? parseFloat(fundB.data[i].growth.toFixed(2)) : 0
          return {
            date: p.date,
            [tickerA]: growthA,
            [tickerB]: growthB,
            [`${tickerA}_dollar`]: pctToDollar(growthA),
            [`${tickerB}_dollar`]: pctToDollar(growthB),
          }
        })
        setData(merged)
        if (fundA.data.length > 0) setTotalA(parseFloat(fundA.data[fundA.data.length - 1].growth.toFixed(2)))
        if (fundB.data.length > 0) setTotalB(parseFloat(fundB.data[fundB.data.length - 1].growth.toFixed(2)))
      })
      .catch(() => { setError("Failed to fetch growth data"); setData([]) })
      .finally(() => setLoading(false))
  }, [tickerA, tickerB, getRange])

  const tickInterval = data.length > 500 ? Math.floor(data.length / 6) : data.length > 200 ? Math.floor(data.length / 5) : Math.floor(data.length / 4)

  // Compute nice Y-axis ticks from data
  const yTicks = (() => {
    if (data.length === 0) return [BASE]
    const allVals: number[] = []
    for (const pt of data) {
      const vA = pt[`${tickerA}_dollar`]
      const vB = pt[`${tickerB}_dollar`]
      if (typeof vA === "number") allVals.push(vA)
      if (typeof vB === "number" && tickerA !== tickerB) allVals.push(vB)
    }
    if (allVals.length === 0) return [BASE]
    return niceYTicks(Math.min(...allVals), Math.max(...allVals), 5)
  })()

  // Is the current view using the recommended date?
  const isUsingRec = useCustom && recDate && customStart === recDate

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Period presets */}
      <div className="flex items-center justify-end border-b px-4 py-2" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
        <div className="flex items-center gap-1">
          {PRESETS.map(p => {
            const isCIDisabled = p === "CI" && !ciDate
            const ciLabel = p === "CI" && ciDate
              ? `CI (${new Date(ciDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" })})`
              : p
            return (
              <button
                key={p}
                onClick={() => { if (!isCIDisabled) { setPreset(p); setUseCustom(false) } }}
                disabled={isCIDisabled}
                className="rounded px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={{
                  backgroundColor: !useCustom && preset === p ? navy : "transparent",
                  color: isCIDisabled ? "#cbd5e1" : !useCustom && preset === p ? "#fff" : "#64748b",
                  cursor: isCIDisabled ? "not-allowed" : "pointer",
                }}
              >
                {ciLabel}
              </button>
            )
          })}
          {/* In advisor mode: if using a custom date, show the label as a clean "preset" button.
              In internal mode: show the full Custom button with date pickers. */}
          {mode === "advisor" && useCustom && recLabel && (
            <button
              className="rounded px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: navy, color: "#fff" }}
            >
              {recLabel}
            </button>
          )}
          {mode === "internal" && (
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
          )}
        </div>
      </div>

      {/* Custom date row -- only shown in internal mode */}
      {useCustom && mode === "internal" && (
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

      {/* Legend -- Morningstar style: line + ticker + percentage */}
      <div className="px-4 pt-2.5 pb-1">
        {totalA != null && totalB != null && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="inline-block h-[2px] w-4" style={{ backgroundColor: navy }} />
              <span className="font-bold" style={{ color: navy }}>{tickerA}</span>
              <span className="font-mono font-semibold" style={{ color: navy }}>{totalA >= 0 ? "+" : ""}{totalA.toFixed(2)}%</span>
            </div>
            {tickerA !== tickerB && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="inline-block h-[2px] w-4" style={{ backgroundColor: red }} />
                <span className="font-bold" style={{ color: red }}>{tickerB}</span>
                <span className="font-mono font-semibold" style={{ color: red }}>{totalB >= 0 ? "+" : ""}{totalB.toFixed(2)}%</span>
              </div>
            )}
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
            <AreaChart data={data} margin={{ top: 5, right: 95, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`fillA_${tickerA}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={navy} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={navy} stopOpacity={0.02} />
                </linearGradient>
                {tickerA !== tickerB && (
                  <linearGradient id={`fillB_${tickerB}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={red} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={red} stopOpacity={0.01} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={formatDateLabel} interval={tickInterval} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtDollar(v)} width={55} ticks={yTicks} domain={[yTicks[0], yTicks[yTicks.length - 1]]} />
              <ReferenceLine y={BASE} stroke="#e2e8f0" strokeDasharray="3 3" />
              <Tooltip
                labelFormatter={(l: string) => { const d = new Date(l + "T00:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}
                formatter={(value: number, name: string, props: { payload?: ChartPoint }) => {
                  const ticker = name.replace("_dollar", "")
                  const pct = props.payload?.[ticker]
                  const pctStr = typeof pct === "number" ? ` (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)` : ""
                  return [`$${value.toLocaleString()}${pctStr}`, ticker]
                }}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12, padding: "8px 14px", color: "#1e293b", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                labelStyle={{ color: "#64748b", fontSize: 11, fontWeight: 600, marginBottom: 4 }}
              />
              <Area type="monotone" dataKey={`${tickerA}_dollar`} name={`${tickerA}_dollar`} stroke={navy} strokeWidth={1.5} fill={`url(#fillA_${tickerA})`}
                isAnimationActive={false}
                activeDot={{ r: 3, fill: navy, stroke: "#fff", strokeWidth: 2 }}
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                dot={(dotProps: any) => {
                  const { cx, cy, index } = dotProps
                  if (index !== data.length - 1) return <circle key={index} r={0} />
                  const pctLabel = `${(totalA ?? 0) >= 0 ? "+" : ""}${(totalA ?? 0).toFixed(2)}%`
                  const badgeY = cy - 14
                  badgeAPixelY.current = cy // store pixel Y for B overlap check
                  return (
                    <g key="endA">
                      <circle cx={cx} cy={cy} r={4} fill={navy} stroke="#fff" strokeWidth={2} />
                      <rect x={cx + 6} y={badgeY} width={80} height={26} rx={5} fill={navy} />
                      <text x={cx + 46} y={badgeY + 17.5} fontSize={13} fontWeight={700} fontFamily="ui-monospace, monospace" fill="#fff" textAnchor="middle">{pctLabel}</text>
                    </g>
                  )
                }}
              />
              {tickerA !== tickerB && (
                <Area type="monotone" dataKey={`${tickerB}_dollar`} name={`${tickerB}_dollar`} stroke={red} strokeWidth={1.5} fill={`url(#fillB_${tickerB})`}
                  isAnimationActive={false}
                  activeDot={{ r: 3, fill: red, stroke: "#fff", strokeWidth: 2 }}
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  dot={(dotProps: any) => {
                    const { cx, cy, index } = dotProps
                    if (index !== data.length - 1) return <circle key={index} r={0} />
                    const pctLabel = `${(totalB ?? 0) >= 0 ? "+" : ""}${(totalB ?? 0).toFixed(2)}%`
                    let badgeY = cy - 12
                    // Prevent overlap: if B badge would overlap A badge vertically, push it below
                    const aCy = badgeAPixelY.current
                    if (Math.abs(cy - aCy) < 30) {
                      // Place below the lower of the two dots
                      badgeY = Math.max(cy, aCy) + 8
                    }
                    return (
                      <g key="endB">
                        <circle cx={cx} cy={cy} r={4} fill={red} stroke="#fff" strokeWidth={2} />
                        <rect x={cx + 6} y={badgeY} width={80} height={26} rx={5} fill={red} />
                        <text x={cx + 46} y={badgeY + 17.5} fontSize={13} fontWeight={700} fontFamily="ui-monospace, monospace" fill="#fff" textAnchor="middle">{pctLabel}</text>
                      </g>
                    )
                  }}
                />
              )}
            </AreaChart>
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
