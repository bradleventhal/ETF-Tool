"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { FileUpload } from "@/components/file-upload"
import { TickerInput } from "@/components/ticker-input"
import { ComparisonTable } from "@/components/comparison-table"
import { PerformanceChart } from "@/components/performance-chart"
import { SectorPieChart } from "@/components/sector-pie-chart"
import { parseFile } from "@/lib/parse-fund-data"
import { runAnalysis } from "@/lib/analysis-engine"
import { saveFunds, loadFunds } from "@/lib/fund-store"
import type { FundData, AnalysisMode, AnalysisResult } from "@/lib/fund-types"
import { Upload, X, Loader2, ArrowRightLeft } from "lucide-react"

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
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#f8fafc" }}><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#94a3b8" }} /></main>
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
  const otherNarrative = result?.narrative.filter(s => s.title !== "Takeaway") ?? []

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#0f3d6b" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <img src="/images/logo.png" alt="Angel Oak Capital Advisors" style={{ width: 160, height: "auto", filter: "brightness(0) invert(1)" }} />
            <div style={{ width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <span className="text-sm font-semibold tracking-tight" style={{ color: "rgba(255,255,255,0.9)" }}>Fund Discovery</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{funds.length} funds{lastUpdated ? ` \u00b7 ${fmtDate(lastUpdated)}` : ""}</span>
          </div>
          <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors" style={{ color: "rgba(255,255,255,0.7)" }}>
            {showUpload ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            {showUpload ? "Close" : "Update Data"}
          </button>
        </div>
      </header>

      {showUpload && (
        <div className="border-b px-6 py-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <div className="mx-auto max-w-sm"><FileUpload onFileLoaded={handleFileLoaded} compact /></div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6">
        {/* Controls */}
        <div className="flex flex-col gap-3 border-b py-5 sm:flex-row sm:items-end sm:gap-4" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex-1 min-w-0">
            <TickerInput label="Our Fund" value={tickerA} onChange={setTickerA} options={tickers} />
          </div>
          <button onClick={swapTickers} disabled={!tickerA && !tickerB} className="hidden self-end mb-1 rounded p-2 transition-opacity hover:opacity-70 disabled:opacity-20 sm:flex" aria-label="Swap">
            <ArrowRightLeft className="h-4 w-4" style={{ color: "#94a3b8" }} />
          </button>
          <div className="flex-1 min-w-0">
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

        {/* ===== INTERNAL MODE ===== */}
        {result && mode === "internal" && (
          <div className="py-6 space-y-6">
            {/* Key Stats at the top */}
            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} highlight />

            {/* Sector allocation: pie charts + table */}
            <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Sector Allocation</h4>
              </div>
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                <div className="border-b p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
                  <SectorPieChart data={result.pieDataA} ticker={result.tickerA} />
                </div>
                <div className="p-4">
                  <SectorPieChart data={result.pieDataB} ticker={result.tickerB} />
                </div>
              </div>
              {/* Sector table below the pies */}
              <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Sector</th>
                      <th className="px-4 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</th>
                      <th className="px-4 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#64748b" }}>{result.tickerB}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sectorAllocation.map((r, i) => (
                      <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: i < result.sectorAllocation.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                        <td className="px-4 py-1.5 text-[13px]" style={{ color: "#64748b" }}>{r.label}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-[13px]" style={{ color: "#334155" }}>{r.a}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-[13px]" style={{ color: "#334155" }}>{r.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Credit Quality */}
            <ComparisonTable title="Credit Quality" rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} />

            {/* Performance chart + table side by side */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />
              <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} highlight />
            </div>

            {/* Narrative insights: Income + Risk side by side */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {otherNarrative.map((section) => (
                <div key={section.title} className="rounded border p-5" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>{section.title}</h3>
                  <div className="space-y-1.5">
                    {section.lines.map((line, i) => (
                      <p key={i} className="text-[13px] leading-relaxed" style={{ color: "#475569" }}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Takeaway at the bottom */}
            {takeaway && (
              <div className="rounded border-l-4 p-5" style={{ borderColor: "#0f3d6b", backgroundColor: "#f0f7ff" }}>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Takeaway</h3>
                <div className="space-y-2">
                  {takeaway.lines.map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: "#1e293b" }}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== ADVISOR MODE ===== */}
        {result && mode === "advisor" && (
          <div className="py-8 space-y-8">
            {/* Centered branded header like a fact sheet */}
            <div className="text-center">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>Fund Comparison</div>
              <h2 className="text-2xl font-semibold" style={{ color: "#0f3d6b" }}>
                {result.nameA}
                <span className="mx-3 text-base font-normal" style={{ color: "#cbd5e1" }}>vs</span>
                {result.nameB}
              </h2>
              <p className="mt-1 font-mono text-sm" style={{ color: "#64748b" }}>{result.tickerA} / {result.tickerB}</p>
            </div>

            <div style={{ height: 2, backgroundColor: "#0f3d6b", opacity: 0.15 }} />

            {/* Key Stats at top, prominent */}
            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} />

            {/* Sector: pie charts + table */}
            <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
              <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Sector Allocation</h4>
              </div>
              <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
                <div className="border-b p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
                  <SectorPieChart data={result.pieDataA} ticker={result.tickerA} />
                </div>
                <div className="p-4">
                  <SectorPieChart data={result.pieDataB} ticker={result.tickerB} />
                </div>
              </div>
              <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Sector</th>
                      <th className="px-4 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#0f3d6b" }}>{result.tickerA}</th>
                      <th className="px-4 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#64748b" }}>{result.tickerB}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sectorAllocation.map((r, i) => (
                      <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td className="px-4 py-1.5 text-[13px]" style={{ color: "#64748b" }}>{r.label}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-[13px]" style={{ color: "#334155" }}>{r.a}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-[13px]" style={{ color: "#334155" }}>{r.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Credit Quality + Performance table */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ComparisonTable title="Credit Quality" rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} />
              <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} />
            </div>

            {/* Chart full width */}
            <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />

            {/* Summary at bottom -- advisor appropriate */}
            {takeaway && (
              <div className="rounded border p-6 text-center" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="space-y-2">
                  {takeaway.lines.map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: "#475569" }}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
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
