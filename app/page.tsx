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
import { Upload, X, Loader2, ArrowRightLeft } from "lucide-react"

type Tab = "analysis" | "data"

export default function Page() {
  const [funds, setFunds] = useState<FundData[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tickerA, setTickerA] = useState("")
  const [tickerB, setTickerB] = useState("")
  const [mode, setMode] = useState<AnalysisMode>("advisor")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [tab, setTab] = useState<Tab>("analysis")

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

  // Auto-compare
  useEffect(() => {
    if (tickerA && tickerB && tickerA !== tickerB) {
      const fA = funds.find((f) => f.ticker === tickerA)
      const fB = funds.find((f) => f.ticker === tickerB)
      if (fA && fB) { setError(null); setResult(runAnalysis(fA, fB, mode)) }
    } else {
      setResult(null)
    }
  }, [tickerA, tickerB, mode, funds])

  const swapTickers = () => { setTickerA(tickerB); setTickerB(tickerA) }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    )
  }

  // No data
  if (funds.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">Fund Discovery</h1>
            <p className="mt-1 text-sm text-muted-foreground">Upload fund data to begin</p>
          </div>
          <FileUpload onFileLoaded={handleFileLoaded} hasExistingData={false} fundCount={0} lastUpdated={null} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <span className="text-sm font-semibold tracking-tight text-foreground">Fund Discovery</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              {funds.length} funds{lastUpdated && ` \u00b7 ${fmtDate(lastUpdated)}`}
            </span>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {showUpload ? <X className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
              {showUpload ? "Close" : "Update Data"}
            </button>
          </div>
        </div>
      </header>

      {showUpload && (
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-sm px-4 py-5 sm:px-6">
            <FileUpload onFileLoaded={handleFileLoaded} hasExistingData fundCount={funds.length} lastUpdated={lastUpdated} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Controls strip */}
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end sm:gap-2">
          <div className="flex-1 min-w-0">
            <TickerInput label="Fund A" value={tickerA} onChange={setTickerA} options={tickers} />
          </div>

          <button
            onClick={swapTickers}
            disabled={!tickerA && !tickerB}
            className="hidden sm:flex self-end mb-0.5 rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
            aria-label="Swap tickers"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1 min-w-0">
            <TickerInput label="Fund B" value={tickerB} onChange={setTickerB} options={tickers} />
          </div>

          <div className="flex shrink-0 flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mode</label>
            <div className="flex h-9 overflow-hidden rounded border border-border text-[11px] font-medium">
              <button
                onClick={() => setMode("advisor")}
                className={`px-3 transition-colors ${mode === "advisor" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
              >Advisor</button>
              <button
                onClick={() => setMode("internal")}
                className={`px-3 transition-colors ${mode === "internal" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
              >Internal</button>
            </div>
          </div>
        </div>

        {error && <p className="pb-2 text-sm text-destructive">{error}</p>}

        {/* Empty */}
        {!result && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <ArrowRightLeft className="h-8 w-8 text-border" />
            <p className="mt-3 text-sm text-muted-foreground">Select two funds to compare</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="pb-12">
            {/* Ticker badge header */}
            <div className="flex items-center justify-center gap-3 pb-5">
              <div className="rounded border border-border bg-card px-3 py-1.5">
                <span className="font-mono text-sm font-bold text-foreground">{result.tickerA}</span>
                <span className="ml-2 text-xs text-muted-foreground">{result.nameA}</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">vs</span>
              <div className="rounded border border-border bg-card px-3 py-1.5">
                <span className="font-mono text-sm font-bold text-foreground">{result.tickerB}</span>
                <span className="ml-2 text-xs text-muted-foreground">{result.nameB}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-border">
              <button
                onClick={() => setTab("analysis")}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${tab === "analysis" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >Analysis</button>
              <button
                onClick={() => setTab("data")}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${tab === "data" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >Data</button>
            </div>

            {/* Analysis Tab */}
            {tab === "analysis" && (
              <div className="pt-6">
                <div className="flex flex-col gap-5">
                  {result.sections.map((sec) => (
                    <div key={sec.heading}>
                      {sec.type === "callout" ? (
                        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-5">
                          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary">{sec.heading}</h3>
                          <p className="text-sm leading-relaxed text-foreground">{sec.body}</p>
                        </div>
                      ) : (
                        <div>
                          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{sec.heading}</h3>
                          <p className="text-[13px] leading-relaxed text-foreground">{sec.body}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Tab */}
            {tab === "data" && (
              <div className="grid grid-cols-1 gap-4 pt-6 lg:grid-cols-2">
                <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
                <ComparisonTable title="Performance" rows={result.performanceComp} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
                <ComparisonTable title="Credit Quality" rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
                {result.sectorAllocation.length > 0 && (
                  <ComparisonTable title="Sector Allocation" rows={result.sectorAllocation} tickerA={result.tickerA} tickerB={result.tickerB} mode={mode} />
                )}
                <div className="lg:col-span-2">
                  <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
