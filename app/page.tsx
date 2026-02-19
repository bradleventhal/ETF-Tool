"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { FileUpload } from "@/components/file-upload"
import { TickerInput } from "@/components/ticker-input"
import { NarrativeSection } from "@/components/narrative-section"
import { ComparisonTable } from "@/components/comparison-table"
import { PerformanceChart } from "@/components/performance-chart"
import { parseFile } from "@/lib/parse-fund-data"
import { runAnalysis } from "@/lib/analysis-engine"
import { saveFunds, loadFunds } from "@/lib/fund-store"
import type { FundData, AnalysisMode, AnalysisResult } from "@/lib/fund-types"
import { Button } from "@/components/ui/button"
import { Database, Upload, X, Loader2 } from "lucide-react"

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

  useEffect(() => {
    loadFunds()
      .then(({ funds: stored, lastUpdated: lu }) => {
        if (stored.length > 0) {
          setFunds(stored)
          setLastUpdated(lu)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const tickers = useMemo(
    () => funds.map((f) => ({ ticker: f.ticker, name: f.name })),
    [funds]
  )

  const handleFileLoaded = useCallback(
    async (buffer: ArrayBuffer, fileName: string) => {
      try {
        const parsed = parseFile(buffer, fileName)
        if (parsed.length === 0) {
          setError("No fund data found. Check that the file has a header row with Ticker.")
          return
        }
        setFunds(parsed)
        setTickerA("")
        setTickerB("")
        setResult(null)
        setError(null)
        setShowUpload(false)
        await saveFunds(parsed)
        setLastUpdated(new Date().toISOString())
      } catch (err) {
        setError(`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
    },
    []
  )

  const handleCompare = useCallback(() => {
    if (!tickerA || !tickerB) {
      setError("Select two funds to compare.")
      return
    }
    if (tickerA === tickerB) {
      setError("Select two different funds.")
      return
    }
    const fundA = funds.find((f) => f.ticker === tickerA)
    const fundB = funds.find((f) => f.ticker === tickerB)
    if (!fundA || !fundB) {
      setError("Ticker not found in data.")
      return
    }
    setError(null)
    setResult(runAnalysis(fundA, fundB, mode))
  }, [tickerA, tickerB, mode, funds])

  // Auto-compare when both tickers are selected
  useEffect(() => {
    if (tickerA && tickerB && tickerA !== tickerB) {
      const fundA = funds.find((f) => f.ticker === tickerA)
      const fundB = funds.find((f) => f.ticker === tickerB)
      if (fundA && fundB) {
        setError(null)
        setResult(runAnalysis(fundA, fundB, mode))
      }
    }
  }, [tickerA, tickerB, mode, funds])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    )
  }

  // No data loaded yet - show upload
  if (funds.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Fund Discovery
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your fund data to get started
            </p>
          </div>
          <FileUpload
            onFileLoaded={handleFileLoaded}
            hasExistingData={false}
            fundCount={0}
            lastUpdated={null}
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar - minimal */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="text-base font-bold tracking-tight text-foreground">
            Fund Discovery
          </h1>
          <div className="flex items-center gap-3">
            {/* Data status */}
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {funds.length} funds
              {lastUpdated && ` \u00b7 ${formatDate(lastUpdated)}`}
            </span>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {showUpload ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {showUpload ? "Cancel" : "Update Data"}
            </button>
          </div>
        </div>
      </header>

      {/* Upload panel - slides down when requested */}
      {showUpload && (
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-md px-4 py-6 sm:px-6">
            <FileUpload
              onFileLoaded={handleFileLoaded}
              hasExistingData={true}
              fundCount={funds.length}
              lastUpdated={lastUpdated}
            />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Selector bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
          <div className="flex-1">
            <TickerInput
              label="Fund A"
              value={tickerA}
              onChange={setTickerA}
              options={tickers}
              placeholder="Type ticker or fund name..."
            />
          </div>

          <span className="hidden pb-2 text-sm font-medium text-muted-foreground sm:block">
            vs
          </span>

          <div className="flex-1">
            <TickerInput
              label="Fund B"
              value={tickerB}
              onChange={setTickerB}
              options={tickers}
              placeholder="Type ticker or fund name..."
            />
          </div>

          {/* Mode toggle */}
          <div className="flex shrink-0 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mode</label>
            <div className="flex h-10 overflow-hidden rounded-md border border-border">
              <button
                onClick={() => setMode("advisor")}
                className={`px-3 text-xs font-medium transition-colors ${
                  mode === "advisor"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                Advisor
              </button>
              <button
                onClick={() => setMode("internal")}
                className={`px-3 text-xs font-medium transition-colors ${
                  mode === "internal"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                Internal
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}

        {/* Empty state */}
        {!result && !error && (
          <div className="flex flex-col items-center justify-center py-24">
            <Database className="h-10 w-10 text-border" />
            <p className="mt-3 text-sm text-muted-foreground">
              Select two funds above to compare
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-8 flex flex-col gap-8">
            {/* Title */}
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {result.tickerA} vs {result.tickerB}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {mode === "advisor" ? "Advisor" : "Internal"} analysis
              </p>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              {/* Left: Narrative (wider) */}
              <div className="lg:col-span-3">
                <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
                  <NarrativeSection result={result} />
                </div>
              </div>

              {/* Right: Tables + Chart */}
              <div className="flex flex-col gap-4 lg:col-span-2">
                <ComparisonTable
                  title="Key Statistics"
                  rows={result.keyStats}
                  tickerA={result.tickerA}
                  tickerB={result.tickerB}
                  mode={mode}
                />
                <ComparisonTable
                  title="Performance"
                  rows={result.performanceComp}
                  tickerA={result.tickerA}
                  tickerB={result.tickerB}
                  mode={mode}
                />
                <ComparisonTable
                  title="Credit Quality"
                  rows={result.creditQuality}
                  tickerA={result.tickerA}
                  tickerB={result.tickerB}
                  mode={mode}
                />
                {result.sectorAllocation.length > 0 && (
                  <ComparisonTable
                    title="Sector Allocation"
                    rows={result.sectorAllocation}
                    tickerA={result.tickerA}
                    tickerB={result.tickerB}
                    mode={mode}
                  />
                )}
                <PerformanceChart
                  data={result.chartData}
                  tickerA={result.tickerA}
                  tickerB={result.tickerB}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
