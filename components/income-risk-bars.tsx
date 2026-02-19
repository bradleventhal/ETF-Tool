"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList } from "recharts"

interface IncomeItem { label: string; a: number; b: number }

interface IncomeBarProps {
  items: IncomeItem[]
  tickerA: string
  tickerB: string
}

// Income section: horizontal grouped bar chart
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
          <Bar dataKey={tickerA} fill="#0f3d6b" radius={[0, 3, 3, 0]} barSize={12}>
            <LabelList dataKey={tickerA} position="right" formatter={(v: number) => `${v.toFixed(2)}%`} style={{ fontSize: 9, fill: "#0f3d6b", fontWeight: 600 }} />
          </Bar>
          <Bar dataKey={tickerB} fill="#85c1e9" radius={[0, 3, 3, 0]} barSize={12}>
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

// Risk section: table with inline spark bars, each metric on its own scale
interface RiskItem { label: string; a: number; b: number; unit: string }
interface RiskTableProps {
  items: RiskItem[]
  tickerA: string
  tickerB: string
}

function SparkBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((Math.abs(value) / max) * 100, 100) : 0
  return (
    <div className="h-2 w-16 overflow-hidden rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export function RiskTable({ items, tickerA, tickerB }: RiskTableProps) {
  if (items.length === 0) return null

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
          <th className="py-2 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Metric</th>
          <th className="py-2 text-right text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }} colSpan={2}>{tickerA}</th>
          <th className="py-2 text-right text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }} colSpan={2}>{tickerB}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const maxVal = Math.max(Math.abs(item.a), Math.abs(item.b), 0.001)
          return (
            <tr key={item.label} style={{ borderBottom: i < items.length - 1 ? "1px solid #f1f5f9" : undefined }}>
              <td className="py-2.5 text-[12px] font-medium" style={{ color: "#475569" }}>{item.label}</td>
              <td className="py-2.5 text-right font-mono text-[12px]" style={{ color: "#334155" }}>
                {item.a === 0 ? "\u2014" : `${item.a.toFixed(2)}${item.unit}`}
              </td>
              <td className="py-2.5 pl-2"><SparkBar value={item.a} max={maxVal} color="#0f3d6b" /></td>
              <td className="py-2.5 text-right font-mono text-[12px]" style={{ color: "#334155" }}>
                {item.b === 0 ? "\u2014" : `${item.b.toFixed(2)}${item.unit}`}
              </td>
              <td className="py-2.5 pl-2"><SparkBar value={item.b} max={maxVal} color="#85c1e9" /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
