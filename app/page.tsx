"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { FileUpload } from "@/components/file-upload"
import { TickerInput } from "@/components/ticker-input"
import { ComparisonTable } from "@/components/comparison-table"
import { PerformanceChart } from "@/components/performance-chart"
import { GrowthChart } from "@/components/growth-chart"
import { SectorPieChart } from "@/components/sector-pie-chart"
import { IncomeBars, RiskTable } from "@/components/income-risk-bars"
import { parseFile } from "@/lib/parse-fund-data"
import { runAnalysis } from "@/lib/analysis-engine"
import { saveFunds, loadFunds } from "@/lib/fund-store"
import type { FundData, AnalysisMode, AnalysisResult } from "@/lib/fund-types"
import { Upload, X, Loader2, ArrowRightLeft, ChevronDown, ChevronRight, Shield } from "lucide-react"
import type { NarrativeSection } from "@/lib/fund-types"

function ReversePitchSection({ section, competitorTicker }: { section: NarrativeSection; competitorTicker: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded border" style={{ borderColor: open ? "#fca5a5" : "#e2e8f0", backgroundColor: open ? "#fef2f2" : "#fafafa", transition: "all 0.2s" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-red-50/50"
      >
        <Shield size={16} style={{ color: "#dc2626", flexShrink: 0 }} />
        <div className="flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#dc2626" }}>
            How {competitorTicker} Would Pitch Against You
          </span>
          <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
            {open ? "" : "Click to expand"}
          </span>
        </div>
        {open
          ? <ChevronDown size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
        }
      </button>
      {open && (
        <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: "#fca5a5" }}>
          <p className="mb-3 text-[11px] italic" style={{ color: "#94a3b8" }}>
            This is the analysis flipped -- as if {competitorTicker}&apos;s sales team is pitching their fund against yours. Use this to anticipate their arguments.
          </p>
          <ul className="space-y-2">
            {section.lines.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "#991b1b" }}>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#dc2626" }} />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function NegTable({ rows, tickerA, tickerB, label, viewMode }: {
  rows: { label: string; a: string; b: string; nA: number | null; nB: number | null }[]
  tickerA: string; tickerB: string; label: string; viewMode: "internal" | "advisor"
}) {
  const hasAnyNeg = rows.some(r => (r.nA != null && r.nA < -0.001) || (r.nB != null && r.nB < -0.001))
  const hasLargeNeg = rows.some(r => (r.nA != null && r.nA < -0.099) || (r.nB != null && r.nB < -0.099))
  const showNote = viewMode === "internal" ? hasAnyNeg : hasLargeNeg
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#f8fafc" }}>
            <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>{label}</th>
            <th className="px-4 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#0f3d6b" }}>{tickerA}</th>
            <th className="px-4 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#64748b" }}>{tickerB}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const nA = r.nA != null ? r.nA : 0
            const nB = r.nB != null ? r.nB : 0
            return (
              <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                <td className="px-4 py-1.5 text-[13px]" style={{ color: "#64748b" }}>{r.label}</td>
                <td className="px-4 py-1.5 text-right font-mono text-[13px]" style={{ color: nA < -0.001 ? "#dc2626" : "#334155", fontWeight: nA < -0.001 ? 700 : 400 }}>{r.a}</td>
                <td className="px-4 py-1.5 text-right font-mono text-[13px]" style={{ color: nB < -0.001 ? "#dc2626" : "#334155", fontWeight: nB < -0.001 ? 700 : 400 }}>{r.b}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {showNote && (
        <div className="px-4 py-2 text-right">
          <span className="text-[11px] italic" style={{ color: "#dc2626" }}>
            * Negative allocation implies utilization of leverage
          </span>
        </div>
      )}
    </div>
  )
}

function PieWithTable({ title, dataA, dataB, tickerA, tickerB, subtitleA, subtitleB, rows, rowLabel, viewMode }: {
  title: string
  dataA: { name: string; value: number }[]
  dataB: { name: string; value: number }[]
  tickerA: string; tickerB: string
  subtitleA?: string; subtitleB?: string
  rows: { label: string; a: string; b: string; nA: number | null; nB: number | null }[]
  rowLabel: string
  viewMode: "internal" | "advisor"
}) {
  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
        <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{title}</h4>
      </div>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
        <div className="border-b p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
          <SectorPieChart data={dataA} ticker={tickerA} subtitle={subtitleA} mode={viewMode} />
        </div>
        <div className="p-4">
          <SectorPieChart data={dataB} ticker={tickerB} subtitle={subtitleB} mode={viewMode} />
        </div>
      </div>
      <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
        <NegTable rows={rows} tickerA={tickerA} tickerB={tickerB} label={rowLabel} viewMode={viewMode} />
      </div>
    </div>
  )
}

export default function Page() {
  const [funds, setFunds] = useState<FundData[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tickerA, setTickerA] = useState("")
  const [tickerB, setTickerB] = useState("")
  const [mode, setMode] = useState<AnalysisMode>("internal")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    loadFunds()
      .then(({ funds: stored, lastUpdated: lu }) => {
        if (stored.length > 0) { setFunds(stored); setLastUpdated(lu) }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const tickers = useMemo(() => funds.map((f) => ({ ticker: f.ticker, name: f.name })), [funds])

  const handleFileLoaded = useCallback(async (buffer: ArrayBuffer, fileName: string) => {
    try {
      const parsed = parseFile(buffer, fileName)
      if (parsed.length === 0) { setError("No fund data found."); return }
      setFunds(parsed); setTickerA(""); setTickerB(""); setResult(null); setError(null); setShowUpload(false)
      await saveFunds(parsed); setLastUpdated(new Date().toISOString())
    } catch (err) {
      setError("Parse error: " + (err instanceof Error ? err.message : "Unknown"))
    }
  }, [])

  useEffect(() => {
    if (tickerA && tickerB && tickerA !== tickerB) {
      const fA = funds.find((f) => f.ticker === tickerA)
      const fB = funds.find((f) => f.ticker === tickerB)
      if (fA && fB) { setError(null); setResult(runAnalysis(fA, fB, mode)) }
    } else { setResult(null) }
  }, [tickerA, tickerB, mode, funds])

  const swapTickers = () => { setTickerA(tickerB); setTickerB(tickerA) }
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#94a3b8" }} />
      </main>
    )
  }

  if (funds.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: "#f8fafc" }}>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center">
            <img src="/images/logo.png" alt="Angel Oak Capital Advisors" className="mb-4" style={{ width: 200, height: "auto" }} />
            <p className="text-sm" style={{ color: "#64748b" }}>Upload your fund data to get started</p>
          </div>
          <FileUpload onFileLoaded={handleFileLoaded} />
          {error && <p className="mt-3 text-center text-sm" style={{ color: "#dc2626" }}>{error}</p>}
        </div>
      </main>
    )
  }

  const takeaway = result?.narrative.find(s => s.title === "Takeaway")

  const incomeItems = result ? [
    { label: "SEC Yield", a: result.keyStats.find(r => r.label === "30-Day SEC Yield")?.nA ?? 0, b: result.keyStats.find(r => r.label === "30-Day SEC Yield")?.nB ?? 0 },
    { label: "Distribution", a: result.keyStats.find(r => r.label === "Distribution Yield")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Distribution Yield")?.nB ?? 0 },
    { label: "YTW/YTM", a: result.keyStats.find(r => r.label === "YTW / YTM")?.nA ?? 0, b: result.keyStats.find(r => r.label === "YTW / YTM")?.nB ?? 0 },
  ].filter(x => (x.a ?? 0) > 0 || (x.b ?? 0) > 0) : []

  const riskItems = result ? [
    { label: "Duration", a: result.keyStats.find(r => r.label === "Duration")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Duration")?.nB ?? 0, unit: " yrs", better: "none" as const },
    { label: "Std Deviation", a: result.keyStats.find(r => r.label === "Std Deviation")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Std Deviation")?.nB ?? 0, unit: "", better: "low" as const },
    { label: "Sharpe Ratio", a: result.keyStats.find(r => r.label === "Sharpe Ratio")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Sharpe Ratio")?.nB ?? 0, unit: "", better: "high" as const },
    { label: "Expense Ratio", a: (result.keyStats.find(r => r.label === "Expense Ratio")?.nA ?? 0) * 100, b: (result.keyStats.find(r => r.label === "Expense Ratio")?.nB ?? 0) * 100, unit: "%", better: "low" as const },
  ].filter(x => x.a > 0 || x.b > 0) : []

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      <header style={{ backgroundColor: "#0f3d6b" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <img src="/images/logo.png" alt="Angel Oak Capital Advisors" style={{ width: 160, height: "auto" }} />
            <div style={{ width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <span className="text-sm font-semibold tracking-tight" style={{ color: "rgba(255,255,255,0.9)" }}>Fund Discovery</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors" style={{ color: "rgba(255,255,255,0.7)" }}>
              {showUpload ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {showUpload ? "Close" : "Update Data"}
            </button>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {funds.length} funds{lastUpdated ? " \u00b7 Updated " + fmtDate(lastUpdated) : ""}
            </span>
          </div>
        </div>
      </header>

      {showUpload && (
        <div className="border-b px-6 py-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <div className="mx-auto max-w-sm">
            <FileUpload onFileLoaded={handleFileLoaded} compact />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-3 border-b py-5 sm:flex-row sm:items-end sm:gap-4" style={{ borderColor: "#e2e8f0" }}>
          <div className="min-w-0 flex-1">
            <TickerInput label="Our Fund" value={tickerA} onChange={setTickerA} options={tickers} />
          </div>
          <button onClick={swapTickers} disabled={!tickerA && !tickerB} className="mb-1 hidden self-end rounded p-2 transition-opacity hover:opacity-70 disabled:opacity-20 sm:flex" aria-label="Swap">
            <ArrowRightLeft className="h-4 w-4" style={{ color: "#94a3b8" }} />
          </button>
          <div className="min-w-0 flex-1">
            <TickerInput label="Competitor" value={tickerB} onChange={setTickerB} options={tickers} />
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Mode</span>
            <div className="flex h-10 overflow-hidden rounded border text-sm font-medium" style={{ borderColor: "#e2e8f0" }}>
              <button onClick={() => setMode("internal")} className="px-4 transition-colors" style={{ backgroundColor: mode === "internal" ? "#0f3d6b" : "#fff", color: mode === "internal" ? "#fff" : "#64748b" }}>Internal</button>
              <button onClick={() => setMode("advisor")} className="px-4 transition-colors" style={{ backgroundColor: mode === "advisor" ? "#0f3d6b" : "#fff", color: mode === "advisor" ? "#fff" : "#64748b" }}>Advisor</button>
            </div>
          </div>
        </div>

        {error && <p className="pt-3 text-sm" style={{ color: "#dc2626" }}>{error}</p>}

        {!result && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <ArrowRightLeft className="h-8 w-8" style={{ color: "#e2e8f0" }} />
            <p className="mt-4 text-sm" style={{ color: "#94a3b8" }}>Select two funds to compare</p>
          </div>
        )}

        {result && mode === "internal" && (
          <div className="space-y-6 py-6">
            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} highlight />

            <PieWithTable title="Sector Allocation" dataA={result.pieDataA} dataB={result.pieDataB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              rows={result.sectorAllocation} rowLabel="Sector" viewMode="internal" />

            <PieWithTable title="Credit Quality" dataA={result.creditPieA} dataB={result.creditPieB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              subtitleA={"Avg Credit Quality: " + result.avgCreditA} subtitleB={"Avg Credit Quality: " + result.avgCreditB}
              rows={result.creditQuality} rowLabel="Rating" viewMode="internal" />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PerformanceChart tickerA={result.tickerA} tickerB={result.tickerB} />
              <GrowthChart tickerA={result.tickerA} tickerB={result.tickerB} mode="internal" />
            </div>
            <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} highlight />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Income</h4>
                </div>
                <div className="p-4">
                  <IncomeBars items={incomeItems} tickerA={result.tickerA} tickerB={result.tickerB} />
                </div>
              </div>
              <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{"Risk & Structure"}</h4>
                </div>
                <div className="p-4">
                  <RiskTable items={riskItems} tickerA={result.tickerA} tickerB={result.tickerB} />
                </div>
              </div>
            </div>

            {takeaway && (
              <div className="rounded border-l-4 p-5" style={{ borderColor: "#0f3d6b", backgroundColor: "#f0f7ff" }}>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Key Takeaway</h3>
                <ul className="space-y-2">
                  {takeaway.lines.map((line, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "#1e293b" }}>
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#0f3d6b" }} />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.reversePitch && <ReversePitchSection section={result.reversePitch} competitorTicker={result.tickerB} />}
          </div>
        )}

        {result && mode === "advisor" && (
          <div className="space-y-8 py-8">
            <div className="text-center">
              <div className="mb-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>Fund Comparison</div>
              <div className="flex items-center justify-center gap-10">
                <div className="flex flex-col items-center">
                  <p className="text-xl font-bold tracking-wide" style={{ color: "#0f3d6b" }}>{result.tickerA}</p>
                  <p className="mt-0.5 max-w-[180px] text-center text-[11px] leading-tight" style={{ color: "#94a3b8" }}>{result.nameA}</p>
                </div>
                <span className="text-2xl font-light italic" style={{ color: "#cbd5e1" }}>vs.</span>
                <div className="flex flex-col items-center">
                  <p className="text-xl font-bold tracking-wide" style={{ color: "#0f3d6b" }}>{result.tickerB}</p>
                  <p className="mt-0.5 max-w-[180px] text-center text-[11px] leading-tight" style={{ color: "#94a3b8" }}>{result.nameB}</p>
                </div>
              </div>
            </div>

            <div style={{ height: 2, backgroundColor: "#0f3d6b", opacity: 0.15 }} />

            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} />

            <PieWithTable title="Sector Allocation" dataA={result.pieDataA} dataB={result.pieDataB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              rows={result.sectorAllocation} rowLabel="Sector" viewMode="advisor" />

            <PieWithTable title="Credit Quality" dataA={result.creditPieA} dataB={result.creditPieB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              subtitleA={"Avg Credit Quality: " + result.avgCreditA} subtitleB={"Avg Credit Quality: " + result.avgCreditB}
              rows={result.creditQuality} rowLabel="Rating" viewMode="advisor" />

            <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} />

            <GrowthChart tickerA={result.tickerA} tickerB={result.tickerB} mode="advisor" />

            {takeaway && (
              <div className="rounded border p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Investment Considerations</h3>
                <ul className="space-y-2">
                  {takeaway.lines.map((line, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "#475569" }}>
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 text-center" style={{ borderTop: "1px solid #e2e8f0" }}>
              <img src="/images/logo.png" alt="Angel Oak Capital Advisors" className="mx-auto opacity-40" style={{ width: 120, height: "auto" }} />
              <p className="mt-2 text-[10px]" style={{ color: "#94a3b8" }}>For informational purposes only. Past performance is not indicative of future results.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
