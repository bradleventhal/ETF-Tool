"use client"

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts"

interface PerformanceChartProps {
  data: { period: string; fundA: number; fundB: number }[]
  tickerA: string
  tickerB: string
}

export function PerformanceChart({ data, tickerA, tickerB }: PerformanceChartProps) {
  // Compute colors in JS (not CSS vars)
  const colorA = "#1e4e78"
  const colorB = "#2a9d8f"

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="bg-secondary px-4 py-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Total Return Comparison
        </h4>
      </div>
      <div className="bg-card p-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              label={{ value: "Return (%)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)}%`]}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            <Bar dataKey="fundA" name={tickerA} fill={colorA} radius={[4, 4, 0, 0]} />
            <Bar dataKey="fundB" name={tickerB} fill={colorB} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
