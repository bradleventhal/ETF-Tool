"use client"

import { useState, useEffect, useCallback } from "react"
import { SectorPieChart } from "@/components/sector-pie-chart"
import { GrowthChart } from "@/components/growth-chart"
import { Loader2, X, Plus } from "lucide-react"
import type { FundData } from "@/lib/fund-types"

function nz(v: number | null): number { return v == null || isNaN(v) ? 0 : v }
function fPct(v: number | null, d = 2): string { return v == null || isNaN(v) || v === 0 ? "\u2014" : (v * 100).toFixed(d) + "%" }
function fNum(v: number | null, d = 2): string { return v == null || isNaN(v) ? "\u2014" : v.toFixed(d) }

function avgCreditQuality(d: FundData): string {
  const buckets = [
    { label: "AAA", v: nz(d.aaa), rank: 1 }, { label: "AA", v: nz(d.aa), rank: 2 },
    { label: "A", v: nz(d.a), rank: 3 }, { label: "BBB", v: nz(d.bbb), rank: 4 },
    { label: "BB", v: nz(d.bb), rank: 5 }, { label: "B", v: nz(d.b), rank: 6 },
    { label: "CCC", v: nz(d.ccc), rank: 7 }, { label: "Below CCC", v: nz(d.belowCcc), rank: 8 },
  ]
  let totalWeight = 0, weightedRank = 0
  buckets.forEach(b => { if (b.v > 0) { totalWeight += b.v; weightedRank += b.v * b.rank } })
  if (totalWeight === 0) return "N/A"
  const avg = weightedRank / totalWeight
  if (avg <= 1.5) return "AAA"; if (avg <= 2.5) return "AA"; if (avg <= 3.5) return "A"
  if (avg <= 4.5) return "BBB"; if (avg <= 5.5) return "BB"; if (avg <= 6.5) return "B"
  if (avg <= 7.5) return "CCC"; return "Below CCC"
}

function fundCategory(name: string, dur: number): string {
  const n = name.toLowerCase()
  // Check name for category keywords first
  if (n.includes("ultra") && (n.includes("short") || n.includes("shrt"))) return "Ultrashort Bond"
  if (n.includes("money market") || n.includes("mm ")) return "Money Market"
  if (n.includes("floating") || n.includes("float") || n.includes("bank loan") || n.includes("leveraged loan") || n.includes("senior loan")) return "Bank Loan"
  if (n.includes("high yield") || n.includes("high-yield") || n.includes("hi yield") || n.includes("hy ")) return "High Yield Bond"
  if (n.includes("multi") && n.includes("sector")) return "Multisector Bond"
  if (n.includes("core plus") || n.includes("core-plus")) return "Core Plus Bond"
  if (n.includes("core bond") || n.includes("core fixed")) return "Core Bond"
  if (n.includes("short") && (n.includes("term") || n.includes("duration") || n.includes("bond"))) return "Short-Term Bond"
  if (n.includes("intermediate") && (n.includes("term") || n.includes("bond") || n.includes("core"))) return "Intermediate-Term Bond"
  if (n.includes("long") && (n.includes("term") || n.includes("duration"))) return "Long-Term Bond"
  if (n.includes("muni") || n.includes("municipal") || n.includes("tax") && n.includes("exempt")) return "Municipal Bond"
  if (n.includes("treasury") || n.includes("govt") || n.includes("government")) return "Government Bond"
  if (n.includes("mortgage") || n.includes("mbs") || n.includes("securitized")) return "Securitized Bond"
  if (n.includes("corporate") || n.includes("investment grade") || n.includes("ig ")) return "Corporate Bond"
  if (n.includes("strategic") && n.includes("credit")) return "Nontraditional Bond"
  if (n.includes("total return") || n.includes("aggregate")) return "Intermediate Core Bond"
  if (n.includes("flexible") || n.includes("unconstrained") || n.includes("absolute")) return "Nontraditional Bond"
  if (n.includes("convertible")) return "Convertible Bond"
  if (n.includes("emerging") || n.includes("em debt") || n.includes("em bond")) return "Emerging Markets Bond"
  if (n.includes("global") || n.includes("world") || n.includes("international")) return "Global Bond"
  if (n.includes("inflation") || n.includes("tips") || n.includes("real return")) return "Inflation-Protected Bond"
  if (n.includes("income") && n.includes("credit")) return "Multisector Bond"
  // Fall back to duration-based
  if (dur < 1) return "Ultrashort Bond"
  if (dur < 2) return "Short-Term Bond"
  if (dur < 5) return "Intermediate-Term Bond"
  if (dur < 7) return "Core Plus Bond"
  return "Long-Term Bond"
}

interface FundInsights {
  performanceDrivers: string[]
  tailwinds: string[]
  headwinds: string[]
  hasCommentary?: boolean
  commentarySource?: string | null
  commentaryPreview?: string | null
  positioning: string
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr style={{ backgroundColor: highlight ? "#f0f7ff" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
      <td className="px-2.5 py-1.5 text-[12px] sm:px-4 sm:text-[13px]" style={{ color: "#64748b" }}>{label}</td>
      <td className="px-2.5 py-1.5 text-right font-mono text-[12px] font-medium sm:px-4 sm:text-[13px]" style={{ color: "#334155" }}>{value}</td>
    </tr>
  )
}

function InsightSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "#1e293b" }}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating || rating < 1 || rating > 5) return null
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5" viewBox="0 0 20 20" fill={i < rating ? "#f59e0b" : "#e2e8f0"}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-[10px] font-medium" style={{ color: "#94a3b8" }}>Morningstar</span>
    </div>
  )
}

export function FundLookup({ fund, allTickers, onCompare }: { fund: FundData; allTickers?: { ticker: string; name: string }[]; onCompare?: (competitorTicker: string) => void }) {
  const [insights, setInsights] = useState<FundInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const mstarRating = fund.morningstarRating ?? null
  const mstarCategory = fund.morningstarCategory ?? null
  const [compareTicker, setCompareTicker] = useState("")
  const [compareSearch, setCompareSearch] = useState("")
  const [compareFocused, setCompareFocused] = useState(false)

  // Compute inception return from growth API if not in fund data
  const [inceptionReturn, setInceptionReturn] = useState<number | null>(fund.commonInception)
  useEffect(() => {
    if (fund.commonInception != null) { setInceptionReturn(fund.commonInception); return }
    // Fetch max-range growth data to compute inception return
    fetch(`/api/growth?tickers=${fund.ticker},${fund.ticker}&start=2000-01-01&end=${new Date().toISOString().slice(0, 10)}`)
      .then(r => r.json())
      .then(json => {
        const fundData = json.funds?.[0]
        if (fundData?.data?.length > 0) {
          const lastGrowth = fundData.data[fundData.data.length - 1].growth
          setInceptionReturn(lastGrowth / 100) // Convert from pct to decimal
        }
      })
      .catch(() => {})
  }, [fund.ticker, fund.commonInception])

  const fetchInsights = useCallback(() => {
    setLoading(true)
    setInsights(null)
    setErrorMsg("")
    fetch("/api/fund-lookup/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fund }),
    })
      .then(async r => {
        const text = await r.text()
        try { return JSON.parse(text) } catch { return { error: "Bad JSON: " + text.slice(0, 200) } }
      })
      .then(data => {
        if (data?.error) {
          setErrorMsg(data.error)
        } else if (data?.performanceDrivers) {
          setInsights(data)
        } else {
          setErrorMsg("Unexpected response format")
        }
      })
      .catch((err) => { setErrorMsg(String(err)) })
      .finally(() => setLoading(false))
  }, [fund])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  // Filter tickers for compare search
  const compareQ = compareSearch.toLowerCase()
  const filteredTickers = (allTickers || []).filter(t =>
    t.ticker !== fund.ticker && (t.ticker.toLowerCase().includes(compareQ) || t.name.toLowerCase().includes(compareQ))
  ).slice(0, 8)

  const sectorData = [
    { name: "Non-Agency RMBS", value: nz(fund.nonAgencyRmbs) },
    { name: "Agency RMBS", value: nz(fund.agencyRmbs) },
    { name: "ABS", value: nz(fund.abs) },
    { name: "CLO", value: nz(fund.clo) },
    { name: "CMBS", value: nz(fund.cmbs) },
    { name: "Corporate Credit", value: nz(fund.corporateCredit) },
    { name: "Government/Cash", value: nz(fund.governmentCash) },
    { name: "Other", value: nz(fund.other) },
  ].filter(d => d.value > 0.005)

  const creditData = [
    { name: "AAA", value: nz(fund.aaa) },
    { name: "AA", value: nz(fund.aa) },
    { name: "A", value: nz(fund.a) },
    { name: "BBB", value: nz(fund.bbb) },
    { name: "BB", value: nz(fund.bb) },
    { name: "B", value: nz(fund.b) },
    { name: "CCC", value: nz(fund.ccc) },
    { name: "Below CCC", value: nz(fund.belowCcc) },
  ].filter(d => d.value > 0.005)

  const dur = nz(fund.duration)
  const avgCredit = avgCreditQuality(fund)
  const securitized = nz(fund.nonAgencyRmbs) + nz(fund.clo) + nz(fund.abs)

  return (
    <div className="space-y-4 py-4 sm:space-y-6 sm:py-6">
      {/* Fund Header */}
      <div className="rounded border-l-4 p-4 sm:p-5" style={{ borderColor: "#0f3d6b", backgroundColor: "#f0f7ff" }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight sm:text-xl" style={{ color: "#0f3d6b" }}>{fund.ticker}</h2>
            <p className="mt-0.5 text-sm" style={{ color: "#64748b" }}>{fund.name}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StarRating rating={mstarRating} />
            <span className="rounded px-2 py-0.5 text-[11px] font-bold uppercase" style={{ backgroundColor: "#0f3d6b", color: "#fff" }}>
              {mstarCategory || fundCategory(fund.name, dur)}
            </span>
            {onCompare && (
              <button
                onClick={() => onCompare(fund.ticker)}
                className="mt-1 flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-white"
                style={{ borderColor: "#0f3d6b", color: "#0f3d6b" }}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M4 4l17 17" /></svg>
                Compare
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Key Statistics</h4>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <StatRow label="30-Day SEC Yield" value={fPct(fund.secYield)} highlight />
            <StatRow label="Distribution Yield" value={fPct(fund.distributionYield)} />
            <StatRow label="YTW / YTM" value={fPct(fund.ytwYtm)} highlight />
            <StatRow label="Duration" value={fNum(fund.duration) + " yrs"} />
            <StatRow label="Avg Credit Quality" value={avgCredit} highlight />
            <StatRow label="Std Deviation" value={fNum(fund.stdDev)} />
            <StatRow label="Sharpe Ratio" value={fNum(fund.sharpe)} highlight />
            <StatRow label="Expense Ratio" value={fPct(fund.expense)} />
          </tbody>
        </table>
      </div>

      {/* Performance */}
      <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Performance</h4>
        </div>
        <div className="px-3 py-3 sm:px-4">
          {(() => {
            const periods = [
              { label: "YTD", value: fund.ytd },
              { label: "1Y", value: fund.oneYear },
              { label: "3Y", value: fund.threeYear },
              { label: "Inception", value: inceptionReturn },
            ].filter(p => p.value != null && !isNaN(p.value as number))
            return (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {periods.map(p => {
                  const pct = (p.value ?? 0) * 100
                  const isPos = pct >= 0
                  return (
                    <div key={p.label} className="text-center">
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: "#94a3b8" }}>{p.label}</div>
                      <div className="font-mono text-lg font-bold" style={{ color: isPos ? "#0f3d6b" : "#dc2626" }}>
                        {isPos ? "+" : ""}{pct.toFixed(2)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Interactive Growth Chart */}
      <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="flex items-center justify-between border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Growth of $10,000</h4>
          {!compareTicker && (
            <div className="relative">
              <div className="flex items-center gap-1.5">
                <Plus className="h-3 w-3" style={{ color: "#94a3b8" }} />
                <input
                  type="text"
                  value={compareSearch}
                  onChange={e => setCompareSearch(e.target.value)}
                  onFocus={() => setCompareFocused(true)}
                  onBlur={() => setTimeout(() => setCompareFocused(false), 200)}
                  placeholder="Add fund to compare..."
                  className="w-[140px] border-b bg-transparent py-0.5 text-[11px] font-medium outline-none placeholder:text-[11px] sm:w-[180px]"
                  style={{ borderColor: "#e2e8f0", color: "#334155" }}
                />
              </div>
              {compareFocused && filteredTickers.length > 0 && (
                <div className="absolute right-0 top-full z-10 mt-1 max-h-[200px] w-[260px] overflow-y-auto rounded-lg border shadow-xl" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                  {filteredTickers.map(t => (
                    <button
                      key={t.ticker}
                      onMouseDown={e => { e.preventDefault(); setCompareTicker(t.ticker); setCompareSearch(""); setCompareFocused(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium transition-colors hover:bg-[#f0f7ff]"
                      style={{ color: "#334155" }}
                    >
                      <span className="w-[48px] shrink-0 font-bold">{t.ticker}</span>
                      <span className="truncate text-[11px]" style={{ color: "#64748b" }}>{t.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {compareTicker && (
            <button
              onClick={() => setCompareTicker("")}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}
            >
              {compareTicker} <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
        <div className="p-0">
          {compareTicker ? (
            <GrowthChart tickerA={fund.ticker} tickerB={compareTicker} mode="internal" />
          ) : (
            <GrowthChart tickerA={fund.ticker} tickerB={fund.ticker} mode="internal" />
          )}
        </div>
      </div>

      {/* Sector & Credit Side by Side */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
          <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
            <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Sector Allocation</h4>
          </div>
          <div className="p-3 sm:p-4">
            <SectorPieChart data={sectorData} ticker={fund.ticker} mode="internal" />
          </div>
          <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
            <table className="w-full text-sm">
              <tbody>
                {sectorData.map((s, i) => (
                  <tr key={s.name} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                    <td className="px-2.5 py-1.5 text-[12px] sm:px-4 sm:text-[13px]" style={{ color: "#64748b" }}>{s.name}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]" style={{ color: "#334155" }}>{(s.value * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
          <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
            <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Credit Quality</h4>
          </div>
          <div className="p-3 sm:p-4">
            <SectorPieChart data={creditData} ticker={fund.ticker} subtitle={"Avg Credit Quality: " + avgCredit} mode="internal" />
          </div>
          <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
            <table className="w-full text-sm">
              <tbody>
                {creditData.map((c, i) => (
                  <tr key={c.name} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                    <td className="px-2.5 py-1.5 text-[12px] sm:px-4 sm:text-[13px]" style={{ color: "#64748b" }}>{c.name}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]" style={{ color: "#334155" }}>{(c.value * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* GPT Insights */}
      <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="flex items-center justify-between border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
            Fund Analysis
            {loading && <Loader2 className="ml-2 inline-block h-3 w-3 animate-spin" style={{ color: "#94a3b8" }} />}
          </h4>
          {insights?.hasCommentary && insights.commentarySource ? (
            <a
              href={insights.commentarySource}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider transition-colors hover:opacity-80"
              style={{ backgroundColor: "#dcfce7", color: "#16a34a" }}
            >
              View Quarterly Commentary
            </a>
          ) : !insights?.hasCommentary && insights ? (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>
              Data-only analysis
            </span>
          ) : null}
        </div>
        {insights?.hasCommentary && insights.commentaryPreview && (
          <div className="border-b px-3 py-2 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f0fdf4" }}>
            <p className="text-[10px] italic leading-relaxed" style={{ color: "#64748b" }}>
              <span className="font-semibold not-italic" style={{ color: "#16a34a" }}>PDF excerpt: </span>
              {'"'}{insights.commentaryPreview.slice(0, 200)}{'..."'}
            </p>
          </div>
        )}
        <div className="p-4 sm:p-5">
        {loading && !insights && (
        <div className="flex items-center gap-2 py-6 text-sm" style={{ color: "#94a3b8" }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Analyzing {fund.ticker}...
            </div>
          )}
          {insights && (
            <div className="space-y-5">
              <InsightSection title="Performance Drivers" items={insights.performanceDrivers} color="#0f3d6b" />
              <InsightSection title="Tailwinds" items={insights.tailwinds} color="#16a34a" />
              <InsightSection title="Headwinds" items={insights.headwinds} color="#dc2626" />
              {insights.positioning && (
                <div>
                  <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Positioning Summary</h4>
                  <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{insights.positioning}</p>
                </div>
              )}
            </div>
          )}
          {!loading && !insights && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm" style={{ color: "#94a3b8" }}>{errorMsg || "Analysis unavailable"}</p>
              <button
                onClick={fetchInsights}
                className="rounded px-4 py-2 text-[12px] font-semibold transition-colors"
                style={{ backgroundColor: "#0f3d6b", color: "#fff" }}
              >
                Retry Analysis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
