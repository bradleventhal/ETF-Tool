"use client"

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts"

interface Props {
  data: { period: string; fundA: number; fundB: number }[]
  tickerA: string
  tickerB: string
}

export function PerformanceChart({ data, tickerA, tickerB }: Props) {
  const navy = "#1e3a5f"
  const steel = "#94a3b8"

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/50 px-4 py-2.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Return Comparison</h4>
      </div>
      <div className="px-4 py-6">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={48} />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)}%`]}
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 12, padding: "8px 14px", color: "#1e293b", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
              labelStyle={{ color: "#64748b", fontSize: 11, marginBottom: 4, fontWeight: 600 }}
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12, color: "#475569" }} />
            <Bar dataKey="fundA" name={tickerA} fill={navy} radius={[4, 4, 0, 0]} />
            <Bar dataKey="fundB" name={tickerB} fill={steel} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
