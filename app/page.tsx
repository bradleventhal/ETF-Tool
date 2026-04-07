"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { TickerInput } from "@/components/ticker-input"
import { ComparisonTable } from "@/components/comparison-table"
import { PerformanceChart } from "@/components/performance-chart"
import { GrowthChart } from "@/components/growth-chart"
import { SectorPieChart } from "@/components/sector-pie-chart"
import { IncomeBars, RiskTable } from "@/components/income-risk-bars"
import { FileUpload } from "@/components/file-upload"
import { parseFile } from "@/lib/parse-fund-data"
import { saveFunds } from "@/lib/fund-store"
import { runAnalysis } from "@/lib/analysis-engine"
import { buildWarRoom } from "@/lib/competitor-pitch"
import { CompetitorWarRoom } from "@/components/competitor-war-room"
import { FundChat } from "@/components/fund-chat"
import { ElevatorPitch } from "@/components/elevator-pitch"
import { PortfolioImpact } from "@/components/portfolio-impact"
import { BattleCard } from "@/components/battle-card"
import { StressTest } from "@/components/stress-test"
import { WhatIfScenarios } from "@/components/what-if-scenarios"
import { ScenarioEngine } from "@/components/scenario-engine"
import { FundLookup } from "@/components/fund-lookup"
import { UniverseChart } from "@/components/universe-chart"
import type { FundData, AnalysisMode, AnalysisResult, WarRoom, YahooAnalytics } from "@/lib/fund-types"
import Link from "next/link"
import { Upload, X, Loader2, ArrowRightLeft, Search, BarChart3, Crosshair, Star, Compass } from "lucide-react"

function NegTable({ rows, tickerA, tickerB, label, viewMode }: {
  rows: { label: string; a: string; b: string; nA: number | null; nB: number | null }[]
  tickerA: string; tickerB: string; label: string; viewMode: "internal" | "advisor"
}) {
  const hasAnyNeg = rows.some(r => (r.nA != null && r.nA < -0.001) || (r.nB != null && r.nB < -0.001))
  const hasLargeNeg = rows.some(r => (r.nA != null && r.nA < -0.099) || (r.nB != null && r.nB < -0.099))
  const showNote = viewMode === "internal" ? hasAnyNeg : hasLargeNeg
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#f8fafc" }}>
            <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wider sm:px-4" style={{ color: "#94a3b8" }}>{label}</th>
            <th className="px-2.5 py-2 text-right font-mono text-[11px] font-bold sm:px-4" style={{ color: "#0f3d6b" }}>{tickerA}</th>
            <th className="px-2.5 py-2 text-right font-mono text-[11px] font-bold sm:px-4" style={{ color: "#64748b" }}>{tickerB}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const nA = r.nA != null ? r.nA : 0
            const nB = r.nB != null ? r.nB : 0
            return (
              <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                <td className="px-2.5 py-1.5 text-[12px] sm:px-4 sm:text-[13px]" style={{ color: "#64748b" }}>{r.label}</td>
                <td className="px-2.5 py-1.5 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]" style={{ color: nA < -0.001 ? "#dc2626" : "#334155", fontWeight: nA < -0.001 ? 700 : 400 }}>{r.a}</td>
                <td className="px-2.5 py-1.5 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]" style={{ color: nB < -0.001 ? "#dc2626" : "#334155", fontWeight: nB < -0.001 ? 700 : 400 }}>{r.b}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {showNote && (
        <div className="px-2.5 py-2 text-right sm:px-4">
          <span className="text-[11px] italic" style={{ color: "#dc2626" }}>
            {"* Negative allocation implies utilization of leverage"}
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
      <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
        <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{title}</h4>
      </div>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
        <div className="border-b p-3 sm:p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
          <SectorPieChart data={dataA} ticker={tickerA} subtitle={subtitleA} mode={viewMode} />
        </div>
        <div className="p-3 sm:p-4">
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
  const [competitors, setCompetitors] = useState<string[]>([])
  // competitor add state removed -- now using TickerInput for competitor selection
  const [mode, setMode] = useState<AnalysisMode>("internal")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [warRoom, setWarRoom] = useState<WarRoom | null>(null)
  const [polishing, setPolishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [fundSources, setFundSources] = useState<Record<string, Record<string, string>>>({})
  const [refreshingRatings, setRefreshingRatings] = useState(false)
  const [section, setSection] = useState<"comparison" | "lookup" | "map">("lookup")
  const [lookupTicker, setLookupTicker] = useState("")
  const [cameFromMap, setCameFromMap] = useState(false)

  useEffect(() => {
    fetch("/data/fund_sources.json").then(r => r.json()).then(setFundSources).catch(() => {})
    fetch("/api/funds")
      .then(r => r.json())
      .then(json => {
        if (json.funds && json.funds.length > 0) {
          setFunds(json.funds)
          setLastUpdated(new Date().toISOString())
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const tickers = useMemo(() => funds.map((f) => ({ ticker: f.ticker, name: f.name })), [funds])

  const refreshRatings = useCallback(async () => {
    setRefreshingRatings(true)
    try {
      const res = await fetch("/api/refresh-ratings", { method: "POST" })
      if (res.ok) {
        // Reload funds with updated ratings
        const r = await fetch("/api/funds")
        const json = await r.json()
        if (json.funds?.length) setFunds(json.funds)
      }
    } catch { /* ignore */ }
    setRefreshingRatings(false)
  }, [])

  const handleFileLoaded = useCallback(async (buffer: ArrayBuffer, fileName: string) => {
    try {
      const parsed = parseFile(buffer, fileName)
      if (parsed.length === 0) { setError("No fund data found."); return }
      setFunds(parsed); setTickerA(""); setTickerB(""); setResult(null); setError(null); setShowUpload(false)
      setLastUpdated(new Date().toISOString())
      await saveFunds(parsed)
      await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funds: parsed }),
      }).catch(() => {})
    } catch (err) {
      setError("Parse error: " + (err instanceof Error ? err.message : "Unknown"))
    }
  }, [])

  useEffect(() => {
    if (tickerA && tickerB && tickerA !== tickerB) {
      const fA = funds.find((f) => f.ticker === tickerA)
      const fB = funds.find((f) => f.ticker === tickerB)
      if (fA && fB) {
        // Always ensure tickerB is in the competitors list
        setCompetitors(prev => prev.includes(tickerB) ? prev : [...prev.slice(0, 4), tickerB])
        setError(null)
        setResult(runAnalysis(fA, fB, mode))
        if (mode === "internal") {
          setPolishing(true)
          const baseline = buildWarRoom(fA, fB)
          setWarRoom(baseline)

          const yahooPromise = fetch(`/api/growth/analytics?tickerA=${tickerA}&tickerB=${tickerB}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)

          yahooPromise.then((yahoo: YahooAnalytics | null) => {
            // Update baseline with Yahoo data if available
            if (yahoo) {
              const updatedBaseline = buildWarRoom(fA, fB, yahoo)
              setWarRoom(updatedBaseline)
            }
            const currentBaseline = yahoo ? buildWarRoom(fA, fB, yahoo) : baseline
            return fetch("/api/warroom/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fundA: fA, fundB: fB, yahoo, baseline: currentBaseline }),
            })
              .then(r => r.ok ? r.json() : null)
              .then(gptWarRoom => {
                if (
                  gptWarRoom &&
                  !gptWarRoom.error &&
                  Array.isArray(gptWarRoom.competitorArguments) &&
                  Array.isArray(gptWarRoom.rebuttals) &&
                  gptWarRoom.overallDifficulty &&
                  gptWarRoom.competitorArguments.every((a: Record<string, unknown>) => a.id && a.metric && a.argument)
                ) {
                  setWarRoom(gptWarRoom)
                }
              })
              .catch(() => {})
              .finally(() => setPolishing(false))
          })
        } else {
          setWarRoom(null)
          setPolishing(false)
        }
      }
    } else { setResult(null); setWarRoom(null) }
  }, [tickerA, tickerB, mode, funds])

  const currentFundA = useMemo(() => funds.find(f => f.ticker === tickerA) || null, [funds, tickerA])
  const currentFundB = useMemo(() => funds.find(f => f.ticker === tickerB) || null, [funds, tickerB])

  const swapTickers = useCallback(() => {
    const prevA = tickerA
    const prevB = tickerB
    setTickerA(prevB)
    setTickerB(prevA)
    // Ensure the swapped tickers are in the competitor list
    if (prevA && !competitors.includes(prevA)) {
      setCompetitors(prev => [...prev.slice(0, 4), prevA])
    }
  }, [tickerA, tickerB, competitors])

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
            <img src="/images/angel-oak-logo.svg" alt="Angel Oak Capital Advisors" className="mb-4 h-auto w-[140px] sm:w-[180px] brightness-0 opacity-20" />
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <img src="/images/angel-oak-logo.svg" alt="Angel Oak Capital Advisors" className="h-[28px] w-auto sm:h-[34px]" />
            <div className="hidden sm:block" style={{ width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline" style={{ color: "rgba(255,255,255,0.9)" }}>
              {section === "lookup" ? "Fund Lookup" : section === "comparison" ? "Fund Comparison" : "Fund Map"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Admin buttons hidden — accessible via /admin page */}
            <div className="hidden sm:block" style={{ width: 1, height: 16, backgroundColor: "rgba(255,255,255,0.15)" }} />
            <Link
              href="/territory"
              className="flex min-h-[44px] items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Territory Intel</span>
            </Link>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {funds.length} funds
            </span>
          </div>
        </div>
      </header>

      {/* Section Nav */}
      <div className="border-b" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="mx-auto flex max-w-6xl px-3 sm:px-6">
          <button
            onClick={() => { setSection("lookup"); setCameFromMap(false) }}
            className="flex min-h-[44px] items-center gap-1.5 border-b-2 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors sm:text-[13px]"
            style={{
              borderColor: section === "lookup" ? "#0f3d6b" : "transparent",
              color: section === "lookup" ? "#0f3d6b" : "#94a3b8",
            }}
          >
            <Search className="h-3.5 w-3.5" />
            Fund Lookup
          </button>
          <button
            onClick={() => setSection("comparison")}
            className="flex min-h-[44px] items-center gap-1.5 border-b-2 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors sm:text-[13px]"
            style={{
              borderColor: section === "comparison" ? "#0f3d6b" : "transparent",
              color: section === "comparison" ? "#0f3d6b" : "#94a3b8",
            }}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Fund Comparison
          </button>
          <button
            onClick={() => setSection("map")}
            className="flex min-h-[44px] items-center gap-1.5 border-b-2 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors sm:text-[13px]"
            style={{
              borderColor: section === "map" ? "#0f3d6b" : "transparent",
              color: section === "map" ? "#0f3d6b" : "#94a3b8",
            }}
          >
            <Crosshair className="h-3.5 w-3.5" />
            Fund Map
          </button>
        </div>
      </div>

      {/* Angel Oak Quick Access */}
      {section === "lookup" && (
        <div className="border-b" style={{ borderColor: "#f1f5f9", backgroundColor: "#fafbfc" }}>
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-6">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Our Funds</span>
            {["UYLD", "CARY", "ANGIX", "AOHY", "AOUIX", "MBS"].map(t => (
              <button key={t} onClick={() => setLookupTicker(t)}
                className="rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide transition-colors hover:border-[#0f3d6b] hover:bg-[#0f3d6b] hover:text-white"
                style={{ borderColor: lookupTicker === t ? "#0f3d6b" : "#d1d5db", color: lookupTicker === t ? "#fff" : "#0f3d6b", backgroundColor: lookupTicker === t ? "#0f3d6b" : "transparent" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {showUpload && (
        <div className="border-b px-3 py-5 sm:px-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <div className="mx-auto max-w-sm">
            <FileUpload onFileLoaded={handleFileLoaded} compact />
          </div>
        </div>
      )}

      {/* ===== FUND COMPARISON SECTION ===== */}
      {section === "comparison" && (
      <div className="mx-auto max-w-6xl px-3 sm:px-6">
        <div className="border-b py-4 sm:py-5" style={{ borderColor: "#e2e8f0" }}>
          {/* Compact grid: Our Fund | vs | Competitors | Mode */}
          <div className="flex flex-col gap-3 sm:grid sm:gap-4" style={{ gridTemplateColumns: "minmax(160px, 1fr) auto minmax(240px, 2fr) auto" }}>
            {/* Our Fund -- compact */}
            <div>
              <TickerInput label="Our Fund" value={tickerA} onChange={(v) => { setTickerA(v); if (v && competitors.length > 0 && !tickerB) setTickerB(competitors[0]) }} options={tickers} placeholder="Select fund..." />
            </div>

            {/* Swap / VS button */}
            <div className="flex items-end pb-2">
              <button
                onClick={swapTickers}
                disabled={!tickerA || !tickerB}
                className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-all hover:border-[#0f3d6b] hover:bg-[#f0f7ff] disabled:cursor-not-allowed disabled:opacity-30"
                style={{ borderColor: "#e2e8f0", color: "#64748b" }}
                title="Swap our fund and competitor"
              >
                <ArrowRightLeft className="h-3 w-3" />
                <span className="hidden sm:inline">Swap</span>
              </button>
            </div>

            {/* Competitors section */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                  Competitors {competitors.length > 0 ? `(${competitors.length}/5)` : ""}
                </span>
                {competitors.length > 1 && (
                  <button onClick={() => { setCompetitors([]); setTickerB("") }} className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>Clear all</button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Competitor tabs */}
                {competitors.map((comp) => {
                  const isActive = tickerB === comp
                  return (
                    <div key={comp} className="group relative">
                      <button
                        onClick={() => setTickerB(comp)}
                        className="flex h-10 items-center gap-1 rounded-lg border px-3 text-[12px] font-bold transition-all"
                        style={{
                          borderColor: isActive ? "#0f3d6b" : "#e2e8f0",
                          backgroundColor: isActive ? "#0f3d6b" : "#fff",
                          color: isActive ? "#fff" : "#334155",
                          boxShadow: isActive ? "0 1px 3px rgba(15,61,107,0.2)" : "none",
                        }}
                      >
                        {comp}
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); const next = competitors.filter(c => c !== comp); setCompetitors(next); if (tickerB === comp) setTickerB(next[0] || "") }}
                          className="ml-0.5 rounded-full p-0.5 transition-colors"
                          style={{ color: isActive ? "rgba(255,255,255,0.5)" : "#94a3b8" }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </span>
                      </button>
                    </div>
                  )
                })}
                {/* Add competitor button/input */}
                {competitors.length < 5 && (
                  <div className="min-w-[160px] flex-1">
                    <TickerInput
                      label=""
                      value=""
                      onChange={(v) => {
                        if (v && !competitors.includes(v)) {
                          setCompetitors(prev => [...prev.slice(0, 4), v])
                          setTickerB(v)
                        }
                      }}
                      options={tickers.filter(t => t.ticker !== tickerA && !competitors.includes(t.ticker))}
                      placeholder={competitors.length === 0 ? "Search to add competitor..." : "+ Add"}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Mode</span>
              <div className="flex h-10 overflow-hidden rounded-lg border text-[12px] font-semibold" style={{ borderColor: "#e2e8f0" }}>
                <button onClick={() => setMode("internal")} className="px-3.5 transition-colors" style={{ backgroundColor: mode === "internal" ? "#0f3d6b" : "#fff", color: mode === "internal" ? "#fff" : "#64748b" }}>Internal</button>
                <button onClick={() => setMode("advisor")} className="px-3.5 transition-colors" style={{ backgroundColor: mode === "advisor" ? "#0f3d6b" : "#fff", color: mode === "advisor" ? "#fff" : "#64748b" }}>Advisor</button>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="pt-3 text-sm" style={{ color: "#dc2626" }}>{error}</p>}

        {!result && (
          <div className="flex flex-col items-center justify-center py-20 text-center sm:py-28">
            <ArrowRightLeft className="h-8 w-8" style={{ color: "#e2e8f0" }} />
            <p className="mt-4 text-sm" style={{ color: "#94a3b8" }}>Select a fund and add competitors above, or try a common matchup:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {[
                { a: "UYLD", b: "VNLA", label: "UYLD vs VNLA" },
                { a: "CARY", b: "PIMIX", label: "CARY vs PIMIX" },
                { a: "AOHY", b: "HYG", label: "AOHY vs HYG" },
                { a: "ANGIX", b: "BINC", label: "ANGIX vs BINC" },
                { a: "UYLD", b: "MINT", label: "UYLD vs MINT" },
                { a: "CARY", b: "BINC", label: "CARY vs BINC" },
                { a: "AOHY", b: "JNK", label: "AOHY vs JNK" },
                { a: "UYLD", b: "JPST", label: "UYLD vs JPST" },
              ].map(preset => (
                <button key={preset.label}
                  onClick={() => { setTickerA(preset.a); setTickerB(preset.b); if (!competitors.includes(preset.b)) setCompetitors(prev => [...prev.slice(0, 4), preset.b]) }}
                  className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:border-[#0f3d6b] hover:bg-[#0f3d6b] hover:text-white"
                  style={{ borderColor: "#d1d5db", color: "#0f3d6b" }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && mode === "internal" && (
          <div className="space-y-4 py-4 sm:space-y-6 sm:py-6">
            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} highlight fundA={currentFundA} fundB={currentFundB} sourcesA={fundSources[tickerA]} sourcesB={fundSources[tickerB]} />

            <PieWithTable title="Sector Allocation" dataA={result.pieDataA} dataB={result.pieDataB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              rows={result.sectorAllocation} rowLabel="Sector" viewMode="internal" />

            <PieWithTable title="Credit Quality" dataA={result.creditPieA} dataB={result.creditPieB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              subtitleA={"Avg Credit Quality: " + result.avgCreditA} subtitleB={"Avg Credit Quality: " + result.avgCreditB}
              rows={result.creditQuality} rowLabel="Rating" viewMode="internal" />

            <PerformanceChart tickerA={result.tickerA} tickerB={result.tickerB} />
            <GrowthChart tickerA={result.tickerA} tickerB={result.tickerB} mode="internal" />

            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Income</h4>
                </div>
                <div className="p-3 sm:p-4">
                  <IncomeBars items={incomeItems} tickerA={result.tickerA} tickerB={result.tickerB} />
                </div>
              </div>
              <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{"Risk & Structure"}</h4>
                </div>
                <div className="p-3 sm:p-4">
                  <RiskTable items={riskItems} tickerA={result.tickerA} tickerB={result.tickerB} />
                </div>
              </div>
            </div>

            {takeaway && (
              <div className="rounded border-l-4 p-4 sm:p-5" style={{ borderColor: "#0f3d6b", backgroundColor: "#f0f7ff" }}>
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

            {warRoom && <CompetitorWarRoom warRoom={warRoom} competitorTicker={result.tickerB} ourTicker={result.tickerA} polishing={polishing} />}

            <WhatIfScenarios
              result={result}
              fundACategory={currentFundA?.morningstarCategory || undefined}
              fundBCategory={currentFundB?.morningstarCategory || undefined}
              fundADuration={currentFundA?.duration || undefined}
              fundBDuration={currentFundB?.duration || undefined}
              fundAYield={currentFundA?.secYield || undefined}
              fundBYield={currentFundB?.secYield || undefined}
            />

            <StressTest result={result} />

            {warRoom && <BattleCard result={result} warRoom={warRoom} />}

            <PortfolioImpact funds={funds} />

            <ElevatorPitch result={result} />

            <FundChat result={result} warRoom={warRoom} />

          </div>
        )}

        {result && mode === "advisor" && (
          <div className="space-y-6 py-6 sm:space-y-8 sm:py-8">
            <div className="text-center">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-widest sm:mb-5" style={{ color: "#94a3b8" }}>Fund Comparison</div>
              <div className="flex items-center justify-center gap-4 sm:gap-10">
                <div className="flex flex-col items-center">
                  <p className="text-lg font-bold tracking-wide sm:text-xl" style={{ color: "#0f3d6b" }}>{result.tickerA}</p>
                  <p className="mt-0.5 max-w-[140px] text-center text-[10px] leading-tight sm:max-w-[180px] sm:text-[11px]" style={{ color: "#94a3b8" }}>{result.nameA}</p>
                </div>
                <span className="text-xl font-light italic sm:text-2xl" style={{ color: "#cbd5e1" }}>vs.</span>
                <div className="flex flex-col items-center">
                  <p className="text-lg font-bold tracking-wide sm:text-xl" style={{ color: "#0f3d6b" }}>{result.tickerB}</p>
                  <p className="mt-0.5 max-w-[140px] text-center text-[10px] leading-tight sm:max-w-[180px] sm:text-[11px]" style={{ color: "#94a3b8" }}>{result.nameB}</p>
                </div>
              </div>
            </div>

            <div style={{ height: 2, backgroundColor: "#0f3d6b", opacity: 0.15 }} />

            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} fundA={currentFundA} fundB={currentFundB} sourcesA={fundSources[tickerA]} sourcesB={fundSources[tickerB]} />

            <PieWithTable title="Sector Allocation" dataA={result.pieDataA} dataB={result.pieDataB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              rows={result.sectorAllocation} rowLabel="Sector" viewMode="advisor" />

            <PieWithTable title="Credit Quality" dataA={result.creditPieA} dataB={result.creditPieB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              subtitleA={"Avg Credit Quality: " + result.avgCreditA} subtitleB={"Avg Credit Quality: " + result.avgCreditB}
              rows={result.creditQuality} rowLabel="Rating" viewMode="advisor" />

            <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} fundA={currentFundA} fundB={currentFundB} sourcesA={fundSources[tickerA]} sourcesB={fundSources[tickerB]} />

            <GrowthChart tickerA={result.tickerA} tickerB={result.tickerB} mode="advisor" />

            {takeaway && (
              <div className="rounded border p-4 sm:p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
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
              <img src="/images/angel-oak-logo.svg" alt="Angel Oak Capital Advisors" className="mx-auto opacity-20 brightness-0" style={{ width: 120, height: "auto" }} />
              <p className="mt-2 text-[10px]" style={{ color: "#94a3b8" }}>For informational purposes only. Past performance is not indicative of future results.</p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ===== FUND MAP SECTION (always mounted to preserve state) ===== */}
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-6" style={{ display: section === "map" ? undefined : "none" }}>
        <UniverseChart
          funds={funds}
          highlightTicker={undefined}
          onSelectFund={(t) => {
            setLookupTicker(t)
            setCameFromMap(true)
            setSection("lookup")
          }}
        />
      </div>

      {/* ===== FUND LOOKUP SECTION ===== */}
      {section === "lookup" && (
      <div className="mx-auto max-w-6xl px-3 sm:px-6">
        <div className="border-b py-4 sm:py-5" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex items-end gap-4">
            <div className="max-w-sm flex-1">
              <TickerInput label="Look Up Fund" value={lookupTicker} onChange={(v) => { setLookupTicker(v); if (!v) setCameFromMap(false) }} options={tickers} />
            </div>
            {cameFromMap && (
              <button
                onClick={() => setSection("map")}
                className="mb-0.5 flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition-all hover:bg-[#f0f7ff]"
                style={{ borderColor: "#e2e8f0", color: "#0f3d6b" }}
              >
                <Crosshair className="h-3.5 w-3.5" />
                Back to Map
              </button>
            )}
          </div>
        </div>

        {!lookupTicker && (
          <div className="flex flex-col items-center justify-center py-20 text-center sm:py-28">
            <Search className="h-8 w-8" style={{ color: "#e2e8f0" }} />
            <p className="mt-4 text-sm" style={{ color: "#94a3b8" }}>Search for a fund to view its profile</p>
          </div>
        )}

        {lookupTicker && (() => {
          const fund = funds.find(f => f.ticker === lookupTicker)
          if (!fund) return null
          const ANGEL_OAK_TICKERS = new Set(["ANGIX", "CARY", "UYLD", "AOUIX", "ASCIX", "TRBF", "AOHY", "MBS", "FINS"])
          return <FundLookup fund={fund} allTickers={tickers} sources={fundSources[lookupTicker.toUpperCase()]} onCompare={(ticker) => {
            if (ANGEL_OAK_TICKERS.has(ticker)) {
              // Angel Oak fund goes into "Our Fund" slot
              setTickerA(ticker)
              setTickerB("")
            } else {
              // Non-Angel Oak fund goes into competitors
              setTickerB(ticker)
              if (!competitors.includes(ticker)) setCompetitors(prev => [...prev.slice(0, 4), ticker])
              setTickerA("")
            }
            setSection("comparison")
          }} />
        })()}
      </div>
      )}
    </main>
  )
}
