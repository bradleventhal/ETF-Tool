"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { FileUpload } from "@/components/file-upload"
import { TickerInput } from "@/components/ticker-input"
import { ComparisonTable } from "@/components/comparison-table"
import { PerformanceChart } from "@/components/performance-chart"
import { SectorPieChart } from "@/components/sector-pie-chart"
import { IncomeBars, RiskTable } from "@/components/income-risk-bars"
import { parseFile } from "@/lib/parse-fund-data"
import { runAnalysis } from "@/lib/analysis-engine"
import { saveFunds, loadFunds } from "@/lib/fund-store"
import type { FundData, AnalysisMode, AnalysisResult } from "@/lib/fund-types"
import { Upload, X, Loader2, ArrowRightLeft } from "lucide-react"

function SectorCreditTable({ rows, tickerA, tickerB, label }: { rows: { label: string; a: string; b: string; nA: number | null; nB: number | null }[]; tickerA: string; tickerB: string; label: string }) {
  return (
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
          const valA = r.nA != null ? r.nA : 0
          const valB = r.nB != null ? r.nB : 0
          const isNegA = valA < -0.001
          const isNegB = valB < -0.001
          return (
            <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : undefined }}>
              <td className="px-4 py-1.5 text-[13px]" style={{ color: "#64748b" }}>{r.label}</td>
              <td className="px-4 py-1.5 text-right font-mono text-[13px]" style={{ color: isNegA ? "#dc2626" : "#334155", fontWeight: isNegA ? 700 : 400 }}>{r.a}</td>
              <td className="px-4 py-1.5 text-right font-mono text-[13px]" style={{ color: isNegB ? "#dc2626" : "#334155", fontWeight: isNegB ? 700 : 400 }}>{r.b}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
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
      setError(`Parse error: ${err instanceof Error ? err.message : "Unknown"}`)
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
              {funds.length} funds{lastUpdated ? ` \u00b7 Updated ${fmtDate(lastUpdated)}` : ""}
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

            <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Sector Allocation</h4>
              </div>
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                <div className="border-b p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
                  <SectorPieChart data={result.pieDataA} ticker={result.tickerA} mode="internal" />
                </div>
                <div className="p-4">
                  <SectorPieChart data={result.pieDataB} ticker={result.tickerB} mode="internal" />
                </div>
              </div>
              <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
                <SectorCreditTable rows={result.sectorAllocation} tickerA={result.tickerA} tickerB={result.tickerB} label="Sector" />
              </div>
            </div>

            <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Credit Quality</h4>
              </div>
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                <div className="border-b p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
                  <SectorPieChart data={result.creditPieA} ticker={result.tickerA} subtitle={`Avg Credit Quality: ${result.avgCreditA}`} mode="internal" />
                </div>
                <div className="p-4">
                  <SectorPieChart data={result.creditPieB} ticker={result.tickerB} subtitle={`Avg Credit Quality: ${result.avgCreditB}`} mode="internal" />
                </div>
              </div>
              <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
                <SectorCreditTable rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} label="Rating" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />
              <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} highlight />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Income</h4>
                </div>
                <div className="p-4">
                  <IncomeBars
                    items={[
                      { label: "SEC Yield", a: result.keyStats.find(r => r.label === "30-Day SEC Yield")?.nA ?? 0, b: result.keyStats.find(r => r.label === "30-Day SEC Yield")?.nB ?? 0 },
                      { label: "Distribution", a: result.keyStats.find(r => r.label === "Distribution Yield")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Distribution Yield")?.nB ?? 0 },
                      { label: "YTW/YTM", a: result.keyStats.find(r => r.label === "YTW / YTM")?.nA ?? 0, b: result.keyStats.find(r => r.label === "YTW / YTM")?.nB ?? 0 },
                    ].filter(x => (x.a ?? 0) > 0 || (x.b ?? 0) > 0)}
                    tickerA={result.tickerA} tickerB={result.tickerB}
                  />
                </div>
              </div>
              <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{"Risk & Structure"}</h4>
                </div>
                <div className="p-4">
                  <RiskTable
                    items={[
                      { label: "Duration", a: result.keyStats.find(r => r.label === "Duration")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Duration")?.nB ?? 0, unit: " yrs", better: "low" as const },
                      { label: "Std Deviation", a: result.keyStats.find(r => r.label === "Std Deviation")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Std Deviation")?.nB ?? 0, unit: "", better: "low" as const },
                      { label: "Sharpe Ratio", a: result.keyStats.find(r => r.label === "Sharpe Ratio")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Sharpe Ratio")?.nB ?? 0, unit: "", better: "high" as const },
                      { label: "Expense Ratio", a: (result.keyStats.find(r => r.label === "Expense Ratio")?.nA ?? 0) * 100, b: (result.keyStats.find(r => r.label === "Expense Ratio")?.nB ?? 0) * 100, unit: "%", better: "low" as const },
                    ].filter(x => x.a > 0 || x.b > 0)}
                    tickerA={result.tickerA} tickerB={result.tickerB}
                  />
                </div>
              </div>
            </div>

            {takeaway && (
              <div className="rounded border-l-4 p-5" style={{ borderColor: "#0f3d6b", backgroundColor: "#f0f7ff" }}>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Key Takeaway</h3>
                <div className="space-y-2">
                  {takeaway.lines.map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: "#1e293b" }}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {result && mode === "advisor" && (
          <div className="space-y-8 py-8">
            <div className="text-center">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>Fund Comparison</div>
              <div className="inline-grid items-center gap-x-5 gap-y-0" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                <p className="text-right text-lg font-semibold leading-tight" style={{ color: "#0f3d6b" }}>{result.tickerA}</p>
                <span className="row-span-2 text-2xl font-light italic" style={{ color: "#cbd5e1" }}>vs.</span>
                <p className="text-left text-lg font-semibold leading-tight" style={{ color: "#0f3d6b" }}>{result.tickerB}</p>
                <p className="text-right text-xs leading-snug" style={{ color: "#94a3b8" }}>{result.nameA}</p>
                <p className="text-left text-xs leading-snug" style={{ color: "#94a3b8" }}>{result.nameB}</p>
              </div>
            </div>

            <div style={{ height: 2, backgroundColor: "#0f3d6b", opacity: 0.15 }} />

            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} />

            <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Sector Allocation</h4>
              </div>
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                <div className="border-b p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
                  <SectorPieChart data={result.pieDataA} ticker={result.tickerA} mode="advisor" />
                </div>
                <div className="p-4">
                  <SectorPieChart data={result.pieDataB} ticker={result.tickerB} mode="advisor" />
                </div>
              </div>
              <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
                <SectorCreditTable rows={result.sectorAllocation} tickerA={result.tickerA} tickerB={result.tickerB} label="Sector" />
              </div>
            </div>

            <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Credit Quality</h4>
              </div>
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                <div className="border-b p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
                  <SectorPieChart data={result.creditPieA} ticker={result.tickerA} subtitle={`Avg Credit Quality: ${result.avgCreditA}`} mode="advisor" />
                </div>
                <div className="p-4">
                  <SectorPieChart data={result.creditPieB} ticker={result.tickerB} subtitle={`Avg Credit Quality: ${result.avgCreditB}`} mode="advisor" />
                </div>
              </div>
              <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
                <SectorCreditTable rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} label="Rating" />
              </div>
            </div>

            <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} />

            <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />

            {takeaway && (
              <div className="rounded border p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Investment Considerations</h3>
                <div className="space-y-2">
                  {takeaway.lines.map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: "#475569" }}>{line}</p>
                  ))}
                </div>
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
