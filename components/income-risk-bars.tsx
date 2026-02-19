"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList, Legend } from "recharts"

interface IncomeItem { label: string; a: number; b: number }

interface IncomeBarProps {
  items: IncomeItem[]
  tickerA: string
  tickerB: string
}

// Income section: horizontal grouped bar chart + table
export function IncomeBars({ items, tickerA, tickerB }: IncomeBarProps) {
  if (items.length === 0) return null

  const data = items.map((item) => ({
    name: item.label,
    [tickerA]: item.a != null ? Math.round(item.a * 10000) / 100 : 0,
    [tickerB]: item.b != null ? Math.round(item.b * 10000) / 100 : 0,
  }))

  return (
    <div>
      <ResponsiveContainer width="100%" height={items.length * 56 + 30}>
        <BarChart data={data} layout="vertical" barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }} axisLine={false} tickLine={false} width={80} />
          <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`]} contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12, padding: "6px 12px", color: "#1e293b", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#475569", paddingTop: 4 }} />
          <Bar dataKey={tickerA} fill="#0f3d6b" radius={[0, 3, 3, 0]} barSize={12}>
            <LabelList dataKey={tickerA} position="right" formatter={(v: number) => `${v.toFixed(2)}%`} style={{ fontSize: 9, fill: "#0f3d6b", fontWeight: 600 }} />
          </Bar>
          <Bar dataKey={tickerB} fill="#17a2b8" radius={[0, 3, 3, 0]} barSize={12}>
            <LabelList dataKey={tickerB} position="right" formatter={(v: number) => `${v.toFixed(2)}%`} style={{ fontSize: 9, fill: "#64748b", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Small table below the chart */}
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th className="py-1.5 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Metric</th>
            <th className="py-1.5 text-right font-mono text-[11px] font-bold" style={{ color: "#0f3d6b" }}>{tickerA}</th>
            <th className="py-1.5 text-right font-mono text-[11px] font-bold" style={{ color: "#64748b" }}>{tickerB}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.name} style={{ borderBottom: i < data.length - 1 ? "1px solid #f1f5f9" : undefined }}>
              <td className="py-1.5 text-[12px]" style={{ color: "#64748b" }}>{row.name}</td>
              <td className="py-1.5 text-right font-mono text-[12px]" style={{ color: "#334155" }}>{(row[tickerA] as number).toFixed(2)}%</td>
              <td className="py-1.5 text-right font-mono text-[12px]" style={{ color: "#334155" }}>{(row[tickerB] as number).toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Risk section: clean comparison table (same style as Key Stats)
interface RiskItem { label: string; a: number; b: number; unit: string; better?: "low" | "high" | "none" }
interface RiskTableProps {
  items: RiskItem[]
  tickerA: string
  tickerB: string
}

export function RiskTable({ items, tickerA, tickerB }: RiskTableProps) {
  if (items.length === 0) return null

  function fmt(val: number, unit: string): string {
    if (val === 0) return "\u2014"
    return `${val.toFixed(2)}${unit}`
  }

  function isBetter(a: number, b: number, better?: "low" | "high" | "none"): "a" | "b" | "none" {
    if (!better || better === "none" || a === 0 || b === 0) return "none"
    if (better === "high") return a > b ? "a" : (b > a ? "b" : "none")
    return a < b ? "a" : (b < a ? "b" : "none")
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
          <th className="py-2 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Metric</th>
          <th className="py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#0f3d6b" }}>{tickerA}</th>
          <th className="py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#64748b" }}>{tickerB}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const winner = isBetter(item.a, item.b, item.better)
          return (
            <tr key={item.label} style={{ borderBottom: i < items.length - 1 ? "1px solid #f1f5f9" : undefined }}>
              <td className="py-2 text-[12px] font-medium" style={{ color: "#475569" }}>{item.label}</td>
              <td className="py-2 text-right font-mono text-[12px]" style={{ color: winner === "a" ? "#0f3d6b" : "#334155", fontWeight: winner === "a" ? 700 : 400 }}>
                {fmt(item.a, item.unit)}
              </td>
              <td className="py-2 text-right font-mono text-[12px]" style={{ color: winner === "b" ? "#0f3d6b" : "#334155", fontWeight: winner === "b" ? 700 : 400 }}>
                {fmt(item.b, item.unit)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
