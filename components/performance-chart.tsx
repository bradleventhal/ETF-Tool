"use client"

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts"

interface PerformanceChartProps {
  data: { period: string; fundA: number; fundB: number }[]
  tickerA: string
  tickerB: string
}

export function PerformanceChart({ data, tickerA, tickerB }: PerformanceChartProps) {
  const colorA = "#1e3a5f"
  const colorB = "#2a9d8f"

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-secondary/60 px-3 py-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Total Return Comparison
        </h4>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={50} />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)}%`]}
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 11, padding: "6px 10px" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            <Bar dataKey="fundA" name={tickerA} fill={colorA} radius={[3, 3, 0, 0]} />
            <Bar dataKey="fundB" name={tickerB} fill={colorB} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
