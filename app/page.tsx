"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { FileUpload } from "@/components/file-upload"
import { TickerInput } from "@/components/ticker-input"
import { ComparisonTable } from "@/components/comparison-table"
import { PerformanceChart } from "@/components/performance-chart"
import { parseFile } from "@/lib/parse-fund-data"
import { runAnalysis } from "@/lib/analysis-engine"
import { saveFunds, loadFunds } from "@/lib/fund-store"
import type { FundData, AnalysisMode, AnalysisResult } from "@/lib/fund-types"
import { Upload, X, Loader2, ArrowRightLeft, CircleDot, ShieldCheck, AlertTriangle } from "lucide-react"

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

  const tickers = useMemo(
    () => funds.map((f) => ({ ticker: f.ticker, name: f.name })),
    [funds]
  )

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
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080e1a]">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </main>
    )
  }

  // No data uploaded
  if (funds.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080e1a] px-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-base font-semibold text-slate-100">Fund Discovery</h1>
            <p className="mt-1 text-sm text-slate-500">Upload fund data to begin</p>
          </div>
          <FileUpload onFileLoaded={handleFileLoaded} hasExistingData={false} fundCount={0} lastUpdated={null} />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080e1a] text-slate-100">
      {/* Top bar */}
      <header className="border-b border-[#1e3048] bg-[#0b1322]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-slate-100">Fund Discovery</span>
            <span className="hidden text-[10px] text-slate-500 sm:inline">{funds.length} funds{lastUpdated && ` \u00b7 ${fmtDate(lastUpdated)}`}</span>
          </div>
          <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-[#1e3048] hover:text-slate-200">
            {showUpload ? <X className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
            {showUpload ? "Close" : "Update Data"}
          </button>
        </div>
      </header>

      {showUpload && (
        <div className="border-b border-[#1e3048] bg-[#0b1322]">
          <div className="mx-auto max-w-sm px-4 py-5">
            <FileUpload onFileLoaded={handleFileLoaded} hasExistingData fundCount={funds.length} lastUpdated={lastUpdated} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4">
        {/* Controls */}
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end sm:gap-3">
          <div className="flex-1 min-w-0">
            <TickerInput label="Our Fund" value={tickerA} onChange={setTickerA} options={tickers} placeholder="Type ticker..." />
          </div>
          <button onClick={swapTickers} disabled={!tickerA && !tickerB} className="hidden sm:flex self-end mb-0.5 rounded p-1.5 text-slate-500 transition-colors hover:bg-[#1e3048] hover:text-slate-300 disabled:opacity-20" aria-label="Swap">
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <TickerInput label="Competitor" value={tickerB} onChange={setTickerB} options={tickers} placeholder="Type ticker..." />
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Mode</span>
            <div className="flex h-8 overflow-hidden rounded border border-[#1e3048] text-[11px] font-medium">
              <button onClick={() => setMode("internal")} className={`px-3 transition-colors ${mode === "internal" ? "bg-blue-600 text-white" : "bg-[#0b1322] text-slate-400 hover:text-slate-200"}`}>Internal</button>
              <button onClick={() => setMode("advisor")} className={`px-3 transition-colors ${mode === "advisor" ? "bg-blue-600 text-white" : "bg-[#0b1322] text-slate-400 hover:text-slate-200"}`}>Advisor</button>
            </div>
          </div>
        </div>

        {error && <p className="pb-2 text-sm text-red-400">{error}</p>}

        {/* Empty state */}
        {!result && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <ArrowRightLeft className="h-6 w-6 text-slate-700" />
            <p className="mt-3 text-sm text-slate-600">Select two funds to compare</p>
          </div>
        )}

        {/* INTERNAL MODE */}
        {result && mode === "internal" && (
          <div className="pb-12">
            {/* Header strip */}
            <div className="mb-5 flex items-center gap-4 rounded border border-[#1e3048] bg-[#0b1322] px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold text-blue-400">{result.tickerA}</span>
                <span className="text-xs text-slate-500">{result.nameA}</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">vs</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold text-slate-300">{result.tickerB}</span>
                <span className="text-xs text-slate-500">{result.nameB}</span>
              </div>
            </div>

            {/* Quick-scan bullets */}
            <div className="mb-6 rounded border border-[#1e3048] bg-[#0f1c2e]">
              <div className="border-b border-[#1e3048] px-4 py-2.5">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Quick Scan</h3>
              </div>
              <div className="divide-y divide-[#1e3048]">
                {result.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                    {b.type === "edge" && <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                    {b.type === "neutral" && <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />}
                    {b.type === "handle" && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    <span className={`text-sm ${b.type === "edge" ? "text-emerald-300" : b.type === "handle" ? "text-amber-300" : "text-slate-300"}`}>
                      {b.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data grid */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
              <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
              <ComparisonTable title="Sector Allocation" rows={result.sectorAllocation} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
              <ComparisonTable title="Credit Quality" rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
              <div className="lg:col-span-2">
                <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />
              </div>
            </div>
          </div>
        )}

        {/* ADVISOR MODE */}
        {result && mode === "advisor" && (
          <div className="pb-12">
            {/* Clean header */}
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold text-slate-100">
                <span className="text-blue-400">{result.tickerA}</span>
                <span className="mx-3 text-sm font-normal text-slate-600">vs</span>
                <span>{result.tickerB}</span>
              </h2>
              <p className="mt-1 text-xs text-slate-500">{result.nameA} vs {result.nameB}</p>
            </div>

            {/* Summary card */}
            <div className="mb-6 rounded border border-[#1e3048] bg-[#0f1c2e] px-5 py-4">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-400">Overview</h3>
              <p className="text-sm leading-relaxed text-slate-200">{result.advisorSummary}</p>
            </div>

            {/* Two-col data */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
              <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
              <ComparisonTable title="Sector Allocation" rows={result.sectorAllocation} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
              <ComparisonTable title="Credit Quality" rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
            </div>

            {/* Chart at bottom full width */}
            <div className="mt-4">
              <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
