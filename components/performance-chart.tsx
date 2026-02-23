"use client"

import { useState, useEffect } from "react"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip, LabelList } from "recharts"

interface Props {
  tickerA: string
  tickerB: string
}

function dateMinusYears(years: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
}

function ytdStart(): string {
  return `${new Date().getFullYear()}-01-01`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

interface BarPoint {
  period: string
  fundA: number
  fundB: number
}

export function PerformanceChart({ tickerA, tickerB }: Props) {
  const navy = "#0f3d6b"
  const steel = "#94a3b8"
  const [data, setData] = useState<BarPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = todayStr()
    const periods: { label: string; start: string }[] = [
      { label: "YTD", start: ytdStart() },
      { label: "1Y", start: dateMinusYears(1) },
      { label: "3Y", start: dateMinusYears(3) },
    ]

    setLoading(true)

    // First fetch common inception date, then add CI period
    fetch(`/api/growth/recommend?tickerA=${tickerA}&tickerB=${tickerB}`)
      .then(r => r.json())
      .then(json => {
        if (json.commonInceptionDate) {
          periods.push({ label: "CI", start: json.commonInceptionDate })
        }
      })
      .catch(() => {})
      .finally(() => {

    Promise.all(
      periods.map(async (p) => {
        try {
          const res = await fetch(`/api/growth?tickers=${tickerA},${tickerB}&start=${p.start}&end=${today}`)
          const json = await res.json()
          if (json.error || !json.funds || json.funds.length < 2) return null
          const fundA = json.funds[0]
          const fundB = json.funds[1]
          const lastA = fundA.data[fundA.data.length - 1]?.growth ?? 0
          const lastB = fundB.data[fundB.data.length - 1]?.growth ?? 0
          return { period: p.label, fundA: parseFloat(lastA.toFixed(2)), fundB: parseFloat(lastB.toFixed(2)) }
        } catch {
          return null
        }
      })
    ).then((results) => {
      setData(results.filter((r): r is BarPoint => r !== null && (r.fundA !== 0 || r.fundB !== 0)))
      setLoading(false)
    })

    }) // end .finally from recommend fetch
  }, [tickerA, tickerB])

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
        <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Performance</h4>
      </div>
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm" style={{ color: "#94a3b8" }}>Loading performance data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm" style={{ color: "#94a3b8" }}>No performance data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={48} />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)}%`]}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12, padding: "8px 14px", color: "#1e293b", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                labelStyle={{ color: "#64748b", fontSize: 11, marginBottom: 4, fontWeight: 600 }}
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12, color: "#475569" }} />
              <Bar dataKey="fundA" name={tickerA} fill={navy} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="fundA" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fontSize: 10, fill: "#475569", fontWeight: 600 }} />
              </Bar>
              <Bar dataKey="fundB" name={tickerB} fill={steel} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="fundB" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
