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
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    )
  }

  // No data
  if (funds.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold text-foreground">Fund Discovery</h1>
            <p className="mt-1 text-sm text-muted-foreground">Upload your fund data to get started</p>
          </div>
          <FileUpload onFileLoaded={handleFileLoaded} />
          {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      {/* Navy header */}
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold tracking-tight">Fund Discovery</h1>
            <span className="text-xs text-primary-foreground/60">{funds.length} funds{lastUpdated ? ` \u00b7 Updated ${fmtDate(lastUpdated)}` : ""}</span>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            {showUpload ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            {showUpload ? "Close" : "Update Data"}
          </button>
        </div>
      </header>

      {/* Upload panel */}
      {showUpload && (
        <div className="border-b border-border bg-muted/50">
          <div className="mx-auto max-w-sm px-6 py-5">
            <FileUpload onFileLoaded={handleFileLoaded} compact />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6">
        {/* Controls strip */}
        <div className="flex flex-col gap-3 border-b border-border py-5 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex-1 min-w-0">
            <TickerInput label="Fund A" value={tickerA} onChange={setTickerA} options={tickers} />
          </div>
          <button onClick={swapTickers} disabled={!tickerA && !tickerB} className="hidden self-end mb-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-20 sm:flex" aria-label="Swap">
            <ArrowRightLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <TickerInput label="Fund B" value={tickerB} onChange={setTickerB} options={tickers} />
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mode</span>
            <div className="flex h-10 overflow-hidden rounded-md border border-border bg-card shadow-sm text-sm font-medium">
              <button onClick={() => setMode("internal")} className={`px-4 transition-colors ${mode === "internal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Internal</button>
              <button onClick={() => setMode("advisor")} className={`px-4 transition-colors ${mode === "advisor" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Advisor</button>
            </div>
          </div>
        </div>

        {error && <p className="pt-3 text-sm text-destructive">{error}</p>}

        {/* Empty state */}
        {!result && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <ArrowRightLeft className="h-8 w-8 text-border" />
            <p className="mt-4 text-sm text-muted-foreground">Select two funds to compare</p>
          </div>
        )}

        {/* ===== INTERNAL MODE ===== */}
        {result && mode === "internal" && (
          <div className="py-6">
            {/* Fund header */}
            <div className="mb-6 flex items-center gap-4 rounded-md border border-border bg-card px-5 py-3.5 shadow-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold text-primary">{result.tickerA}</span>
                <span className="text-xs text-muted-foreground">{result.nameA}</span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">vs</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold text-foreground">{result.tickerB}</span>
                <span className="text-xs text-muted-foreground">{result.nameB}</span>
              </div>
            </div>

            {/* Two column: narrative left, tables right */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* Narrative */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                {result.narrative.map((section) => (
                  <div key={section.title} className="rounded-md border border-border bg-card p-4 shadow-sm">
                    <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-primary">{section.title}</h3>
                    <div className="space-y-1.5">
                      {section.lines.map((line, i) => (
                        <p key={i} className="text-[13px] leading-relaxed text-foreground/85">{line}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Data */}
              <div className="lg:col-span-3 flex flex-col gap-4">
                <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} highlight />
                <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} highlight />
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <ComparisonTable title="Sector Allocation" rows={result.sectorAllocation} tickerA={result.tickerA} tickerB={result.tickerB} />
                  <ComparisonTable title="Credit Quality" rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} />
                </div>
                <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />
              </div>
            </div>
          </div>
        )}

        {/* ===== ADVISOR MODE ===== */}
        {result && mode === "advisor" && (
          <div className="py-8">
            {/* Centered header */}
            <div className="mb-8 text-center">
              <h2 className="text-xl font-semibold text-foreground">
                <span className="text-primary">{result.tickerA}</span>
                <span className="mx-3 text-sm font-normal text-muted-foreground">vs</span>
                <span>{result.tickerB}</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{result.nameA} vs {result.nameB}</p>
            </div>

            {/* Narrative cards in a row */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {result.narrative.filter(s => s.title !== "Takeaway").map((section) => (
                <div key={section.title} className="rounded-md border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-primary">{section.title}</h3>
                  <div className="space-y-1.5">
                    {section.lines.map((line, i) => (
                      <p key={i} className="text-[13px] leading-relaxed text-foreground/80">{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Takeaway card full width */}
            {result.narrative.filter(s => s.title === "Takeaway").map((section) => (
              <div key={section.title} className="mb-6 rounded-md border border-primary/20 bg-primary/[0.03] p-5 shadow-sm">
                <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-primary">{section.title}</h3>
                <div className="space-y-1.5">
                  {section.lines.map((line, i) => (
                    <p key={i} className="text-[13px] leading-relaxed text-foreground/85">{line}</p>
                  ))}
                </div>
              </div>
            ))}

            {/* Data tables */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} />
              <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} />
              <ComparisonTable title="Sector Allocation" rows={result.sectorAllocation} tickerA={result.tickerA} tickerB={result.tickerB} />
              <ComparisonTable title="Credit Quality" rows={result.creditQuality} tickerA={result.tickerA} tickerB={result.tickerB} />
            </div>

            {/* Chart */}
            <div className="mt-4">
              <PerformanceChart data={result.chartData} tickerA={result.tickerA} tickerB={result.tickerB} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
