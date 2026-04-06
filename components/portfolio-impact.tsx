"use client"

import { useState, useMemo, useCallback } from "react"
import type { FundData } from "@/lib/fund-types"
import { Plus, Trash2, ArrowRight, DollarSign, TrendingUp, Shield, Clock } from "lucide-react"

interface Holding {
  ticker: string
  name: string
  allocation: number // 0-100
  fund: FundData | null
}

interface Props {
  funds: FundData[]
  onCompare?: (tickerA: string, tickerB: string) => void
}

const AO_TICKERS = new Set(["UYLD", "CARY", "ANGIX", "AOHY", "AOUIX", "MBS"])

function nz(v: number | null | undefined): number { return v ?? 0 }
function fPct(v: number | null | undefined, d = 2): string {
  if (v == null) return "—"
  return (v * 100).toFixed(d) + "%"
}
function fDol(v: number): string {
  if (Math.abs(v) >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M"
  if (Math.abs(v) >= 1_000) return "$" + (v / 1_000).toFixed(1) + "K"
  return "$" + v.toFixed(0)
}

function blended(holdings: Holding[], field: keyof FundData): number {
  let total = 0, weight = 0
  for (const h of holdings) {
    if (h.fund && h.allocation > 0) {
      const val = h.fund[field]
      if (typeof val === "number" && !isNaN(val)) {
        total += val * (h.allocation / 100)
        weight += h.allocation / 100
      }
    }
  }
  return weight > 0 ? total / weight * weight : 0
}

export function PortfolioImpact({ funds, onCompare }: Props) {
  const [portfolioSize, setPortfolioSize] = useState<number>(10_000_000) // $10M default
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [swapFrom, setSwapFrom] = useState<string>("")
  const [swapTo, setSwapTo] = useState<string>("")
  const [swapPct, setSwapPct] = useState<number>(100) // % of the holding to swap
  const [showSearch, setShowSearch] = useState(false)

  const addHolding = useCallback((ticker: string) => {
    if (holdings.some(h => h.ticker === ticker)) return
    const fund = funds.find(f => f.ticker === ticker) || null
    setHoldings(prev => [...prev, { ticker, name: fund?.name || ticker, allocation: 0, fund }])
    setSearchQuery("")
    setShowSearch(false)
  }, [holdings, funds])

  const removeHolding = useCallback((ticker: string) => {
    setHoldings(prev => prev.filter(h => h.ticker !== ticker))
    if (swapFrom === ticker) setSwapFrom("")
    if (swapTo === ticker) setSwapTo("")
  }, [swapFrom, swapTo])

  const updateAllocation = useCallback((ticker: string, alloc: number) => {
    setHoldings(prev => prev.map(h => h.ticker === ticker ? { ...h, allocation: Math.max(0, Math.min(100, alloc)) } : h))
  }, [])

  const totalAllocation = holdings.reduce((s, h) => s + h.allocation, 0)

  // Compute before/after metrics
  const beforeMetrics = useMemo(() => ({
    yield: blended(holdings, "secYield"),
    duration: blended(holdings, "duration"),
    expense: blended(holdings, "expense"),
    sharpe: blended(holdings, "sharpe"),
    ytw: blended(holdings, "ytwYtm"),
  }), [holdings])

  const afterHoldings = useMemo(() => {
    if (!swapFrom || !swapTo || swapPct <= 0) return holdings
    const fromH = holdings.find(h => h.ticker === swapFrom)
    if (!fromH) return holdings

    const swapAmount = fromH.allocation * (swapPct / 100)
    const toFund = funds.find(f => f.ticker === swapTo) || null

    return holdings.map(h => {
      if (h.ticker === swapFrom) return { ...h, allocation: h.allocation - swapAmount }
      return h
    }).concat(
      holdings.some(h => h.ticker === swapTo)
        ? [] // Already in portfolio — just increase allocation
        : [{ ticker: swapTo, name: toFund?.name || swapTo, allocation: swapAmount, fund: toFund }]
    ).map(h => {
      if (h.ticker === swapTo && holdings.some(x => x.ticker === swapTo)) {
        const existing = holdings.find(x => x.ticker === swapTo)!
        const fromH2 = holdings.find(x => x.ticker === swapFrom)!
        return { ...h, allocation: existing.allocation + fromH2.allocation * (swapPct / 100) }
      }
      return h
    }).filter(h => h.allocation > 0)
  }, [holdings, swapFrom, swapTo, swapPct, funds])

  const afterMetrics = useMemo(() => ({
    yield: blended(afterHoldings, "secYield"),
    duration: blended(afterHoldings, "duration"),
    expense: blended(afterHoldings, "expense"),
    sharpe: blended(afterHoldings, "sharpe"),
    ytw: blended(afterHoldings, "ytwYtm"),
  }), [afterHoldings])

  const hasSwap = swapFrom && swapTo && swapPct > 0

  // Income impact in dollars
  const incBefore = beforeMetrics.yield * portfolioSize
  const incAfter = afterMetrics.yield * portfolioSize
  const incDelta = incAfter - incBefore

  // Search filter
  const searchResults = searchQuery.length >= 1
    ? funds.filter(f => !holdings.some(h => h.ticker === f.ticker) &&
        (f.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
         (f.name || "").toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 8)
    : []

  return (
    <div className="space-y-4">
      <div className="rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Portfolio Impact Simulator</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>Portfolio Size</span>
            <select
              value={portfolioSize}
              onChange={e => setPortfolioSize(Number(e.target.value))}
              className="rounded border px-2 py-1 text-[12px] font-mono font-medium"
              style={{ borderColor: "#d1d5db", color: "#334155" }}
            >
              <option value={1000000}>$1M</option>
              <option value={5000000}>$5M</option>
              <option value={10000000}>$10M</option>
              <option value={25000000}>$25M</option>
              <option value={50000000}>$50M</option>
              <option value={100000000}>$100M</option>
            </select>
          </div>
        </div>

        <div className="p-4">
          {/* Holdings */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Current Holdings</span>
              <span className="text-[10px] font-medium" style={{ color: totalAllocation > 100 ? "#dc2626" : totalAllocation === 100 ? "#16a34a" : "#94a3b8" }}>
                {totalAllocation.toFixed(0)}% allocated
              </span>
            </div>

            {holdings.map(h => (
              <div key={h.ticker} className="mb-1.5 flex items-center gap-2">
                <span className="w-16 text-[12px] font-bold" style={{ color: AO_TICKERS.has(h.ticker) ? "#0f3d6b" : "#334155" }}>{h.ticker}</span>
                <input
                  type="range" min={0} max={100} step={1}
                  value={h.allocation}
                  onChange={e => updateAllocation(h.ticker, Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
                  style={{ accentColor: "#0f3d6b" }}
                />
                <input
                  type="number" min={0} max={100} step={1}
                  value={h.allocation}
                  onChange={e => updateAllocation(h.ticker, Number(e.target.value))}
                  className="w-14 rounded border px-1.5 py-0.5 text-center font-mono text-[12px]"
                  style={{ borderColor: "#d1d5db" }}
                />
                <span className="text-[11px]" style={{ color: "#94a3b8" }}>%</span>
                <button onClick={() => removeHolding(h.ticker)} className="p-0.5 text-gray-300 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* Add fund */}
            <div className="relative mt-2">
              <input
                placeholder="Add fund to portfolio..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSearch(true) }}
                onFocus={() => setShowSearch(true)}
                className="w-full rounded border px-3 py-1.5 text-[12px]"
                style={{ borderColor: "#d1d5db" }}
              />
              {showSearch && searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border bg-white shadow-lg" style={{ borderColor: "#e2e8f0" }}>
                  {searchResults.map(f => (
                    <button key={f.ticker} onClick={() => addHolding(f.ticker)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-gray-50">
                      <span className="font-bold" style={{ color: AO_TICKERS.has(f.ticker) ? "#0f3d6b" : "#334155" }}>{f.ticker}</span>
                      <span style={{ color: "#94a3b8" }}>{f.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Swap Proposal */}
          {holdings.length >= 1 && (
            <div className="rounded border p-3" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Propose a Swap</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px]" style={{ color: "#64748b" }}>Move</span>
                <select value={swapPct} onChange={e => setSwapPct(Number(e.target.value))}
                  className="rounded border px-2 py-1 text-[12px] font-mono" style={{ borderColor: "#d1d5db" }}>
                  <option value={25}>25%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                  <option value={100}>100%</option>
                </select>
                <span className="text-[11px]" style={{ color: "#64748b" }}>of</span>
                <select value={swapFrom} onChange={e => setSwapFrom(e.target.value)}
                  className="rounded border px-2 py-1 text-[12px] font-bold" style={{ borderColor: "#d1d5db", color: "#334155" }}>
                  <option value="">Select fund...</option>
                  {holdings.filter(h => h.allocation > 0).map(h => (
                    <option key={h.ticker} value={h.ticker}>{h.ticker} ({h.allocation}%)</option>
                  ))}
                </select>
                <ArrowRight size={14} style={{ color: "#94a3b8" }} />
                <select value={swapTo} onChange={e => setSwapTo(e.target.value)}
                  className="rounded border px-2 py-1 text-[12px] font-bold" style={{ borderColor: "#d1d5db", color: "#0f3d6b" }}>
                  <option value="">Select fund...</option>
                  {["UYLD", "CARY", "ANGIX", "AOHY", "AOUIX", "MBS"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option disabled>───────</option>
                  {funds.filter(f => !AO_TICKERS.has(f.ticker)).slice(0, 20).map(f => (
                    <option key={f.ticker} value={f.ticker}>{f.ticker}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Before / After Impact */}
          {holdings.length >= 1 && totalAllocation > 0 && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Current Portfolio</div>
                  <table className="w-full text-[12px]">
                    <tbody>
                      <tr className="border-b" style={{ borderColor: "#f1f5f9" }}>
                        <td className="py-1.5" style={{ color: "#64748b" }}>Blended Yield</td>
                        <td className="py-1.5 text-right font-mono font-medium" style={{ color: "#334155" }}>{fPct(beforeMetrics.yield)}</td>
                      </tr>
                      <tr className="border-b" style={{ borderColor: "#f1f5f9" }}>
                        <td className="py-1.5" style={{ color: "#64748b" }}>Blended Duration</td>
                        <td className="py-1.5 text-right font-mono font-medium" style={{ color: "#334155" }}>{beforeMetrics.duration.toFixed(2)} yrs</td>
                      </tr>
                      <tr className="border-b" style={{ borderColor: "#f1f5f9" }}>
                        <td className="py-1.5" style={{ color: "#64748b" }}>Blended Expense</td>
                        <td className="py-1.5 text-right font-mono font-medium" style={{ color: "#334155" }}>{fPct(beforeMetrics.expense)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5" style={{ color: "#64748b" }}>Annual Income</td>
                        <td className="py-1.5 text-right font-mono font-bold" style={{ color: "#0f3d6b" }}>{fDol(incBefore)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {hasSwap && (
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>After Swap</div>
                    <table className="w-full text-[12px]">
                      <tbody>
                        <tr className="border-b" style={{ borderColor: "#f1f5f9" }}>
                          <td className="py-1.5" style={{ color: "#64748b" }}>Blended Yield</td>
                          <td className="py-1.5 text-right font-mono font-medium" style={{ color: afterMetrics.yield > beforeMetrics.yield ? "#16a34a" : afterMetrics.yield < beforeMetrics.yield ? "#dc2626" : "#334155" }}>
                            {fPct(afterMetrics.yield)}
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: "#f1f5f9" }}>
                          <td className="py-1.5" style={{ color: "#64748b" }}>Blended Duration</td>
                          <td className="py-1.5 text-right font-mono font-medium" style={{ color: afterMetrics.duration < beforeMetrics.duration ? "#16a34a" : "#334155" }}>
                            {afterMetrics.duration.toFixed(2)} yrs
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: "#f1f5f9" }}>
                          <td className="py-1.5" style={{ color: "#64748b" }}>Blended Expense</td>
                          <td className="py-1.5 text-right font-mono font-medium" style={{ color: "#334155" }}>{fPct(afterMetrics.expense)}</td>
                        </tr>
                        <tr>
                          <td className="py-1.5" style={{ color: "#64748b" }}>Annual Income</td>
                          <td className="py-1.5 text-right font-mono font-bold" style={{ color: "#0f3d6b" }}>{fDol(incAfter)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Impact Summary */}
              {hasSwap && Math.abs(incDelta) > 0 && (
                <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: incDelta > 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${incDelta > 0 ? "#bbf7d0" : "#fecaca"}` }}>
                  <div className="flex items-center gap-3">
                    <DollarSign size={20} style={{ color: incDelta > 0 ? "#16a34a" : "#dc2626" }} />
                    <div>
                      <div className="text-lg font-bold" style={{ color: incDelta > 0 ? "#16a34a" : "#dc2626" }}>
                        {incDelta > 0 ? "+" : ""}{fDol(incDelta)}/year
                      </div>
                      <div className="text-[12px]" style={{ color: "#64748b" }}>
                        in {incDelta > 0 ? "additional" : "reduced"} annual income on {fDol(portfolioSize)} portfolio
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3">
                    {afterMetrics.yield !== beforeMetrics.yield && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <TrendingUp size={12} style={{ color: afterMetrics.yield > beforeMetrics.yield ? "#16a34a" : "#dc2626" }} />
                        <span style={{ color: "#64748b" }}>Yield: {fPct(beforeMetrics.yield)} → {fPct(afterMetrics.yield)}</span>
                      </div>
                    )}
                    {afterMetrics.duration !== beforeMetrics.duration && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Clock size={12} style={{ color: afterMetrics.duration < beforeMetrics.duration ? "#16a34a" : "#f59e0b" }} />
                        <span style={{ color: "#64748b" }}>Duration: {beforeMetrics.duration.toFixed(2)} → {afterMetrics.duration.toFixed(2)} yrs</span>
                      </div>
                    )}
                    {afterMetrics.expense !== beforeMetrics.expense && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Shield size={12} style={{ color: afterMetrics.expense < beforeMetrics.expense ? "#16a34a" : "#f59e0b" }} />
                        <span style={{ color: "#64748b" }}>Expense: {fPct(beforeMetrics.expense)} → {fPct(afterMetrics.expense)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {holdings.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "#94a3b8" }}>Add funds to build the advisor{"'"}s current portfolio, then propose a swap to show the impact.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
