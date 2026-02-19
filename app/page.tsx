"use client"

import { useState, useMemo, useCallback } from "react"
import { FileUpload } from "@/components/file-upload"
import { NarrativeSection } from "@/components/narrative-section"
import { ComparisonTable } from "@/components/comparison-table"
import { PerformanceChart } from "@/components/performance-chart"
import { parseFile } from "@/lib/parse-fund-data"
import { runAnalysis } from "@/lib/analysis-engine"
import type { FundData, AnalysisMode, AnalysisResult } from "@/lib/fund-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { BarChart3, ArrowRight, RefreshCw } from "lucide-react"

export default function Page() {
  const [funds, setFunds] = useState<FundData[]>([])
  const [tickerA, setTickerA] = useState("")
  const [tickerB, setTickerB] = useState("")
  const [mode, setMode] = useState<AnalysisMode>("advisor")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tickers = useMemo(() => funds.map((f) => ({ ticker: f.ticker, name: f.name })), [funds])

  const handleFileLoaded = useCallback((buffer: ArrayBuffer, fileName: string) => {
    try {
      const parsed = parseFile(buffer, fileName)
      if (parsed.length === 0) {
        setError("No fund data found in the file. Make sure the file has a header row with 'Ticker' as the first column.")
        return
      }
      setFunds(parsed)
      setTickerA("")
      setTickerB("")
      setResult(null)
      setError(null)
    } catch (err) {
      setError(`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }, [])

  const handleCompare = useCallback(() => {
    if (!tickerA || !tickerB) {
      setError("Please select two funds to compare.")
      return
    }
    if (tickerA === tickerB) {
      setError("Please select two different funds.")
      return
    }
    const fundA = funds.find((f) => f.ticker === tickerA)
    const fundB = funds.find((f) => f.ticker === tickerB)
    if (!fundA || !fundB) {
      setError("Selected ticker not found in data.")
      return
    }
    setError(null)
    setResult(runAnalysis(fundA, fundB, mode))
  }, [tickerA, tickerB, mode, funds])

  const handleReset = useCallback(() => {
    setResult(null)
    setTickerA("")
    setTickerB("")
    setError(null)
  }, [])

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Fund Discovery
            </h1>
            <p className="text-xs text-muted-foreground">
              Fixed-income ETF comparison tool
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Controls */}
        {!result && (
          <div className="mx-auto max-w-2xl">
            <div className="flex flex-col gap-6">
              {/* Step 1: Upload */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    1
                  </span>
                  <h2 className="text-sm font-semibold text-foreground">
                    Upload Raw Data
                  </h2>
                </div>
                <FileUpload onFileLoaded={handleFileLoaded} />
                {funds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {funds.length} fund{funds.length !== 1 ? "s" : ""} loaded
                  </p>
                )}
              </section>

              {/* Step 2: Select funds */}
              {funds.length > 0 && (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      2
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">
                      Select Funds to Compare
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Fund A
                      </label>
                      <Select value={tickerA} onValueChange={setTickerA}>
                        <SelectTrigger className="bg-card">
                          <SelectValue placeholder="Select fund..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tickers.map((t) => (
                            <SelectItem key={t.ticker} value={t.ticker}>
                              <span className="font-mono font-semibold">{t.ticker}</span>
                              <span className="ml-2 text-muted-foreground">{t.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Fund B
                      </label>
                      <Select value={tickerB} onValueChange={setTickerB}>
                        <SelectTrigger className="bg-card">
                          <SelectValue placeholder="Select fund..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tickers.map((t) => (
                            <SelectItem key={t.ticker} value={t.ticker}>
                              <span className="font-mono font-semibold">{t.ticker}</span>
                              <span className="ml-2 text-muted-foreground">{t.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>
              )}

              {/* Step 3: Mode + Compare */}
              {tickerA && tickerB && (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      3
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">
                      Analysis Mode
                    </h2>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Mode
                      </label>
                      <Select
                        value={mode}
                        onValueChange={(v) => setMode(v as AnalysisMode)}
                      >
                        <SelectTrigger className="w-48 bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="advisor">Advisor</SelectItem>
                          <SelectItem value="internal">Internal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleCompare} className="gap-2 sm:ml-auto">
                      Compare Funds
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </section>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="flex flex-col gap-6">
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {mode === "advisor" ? "Advisor Mode" : "Internal Mode"}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                New Comparison
              </Button>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Left: Narrative */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <NarrativeSection result={result} />
              </div>

              {/* Right: Side-by-side comparison */}
              <div className="flex flex-col gap-5">
                <div className="rounded-lg bg-primary px-4 py-3 text-center">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary-foreground">
                    Side-by-Side Comparison
                  </h3>
                </div>

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
