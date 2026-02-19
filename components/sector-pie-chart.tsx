"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

// Wide navy-to-sky spread for max differentiation
const COLORS = ["#0a2e52", "#0f4c81", "#2874a6", "#3498db", "#5bb8f5", "#85c1e9", "#aed6f1", "#d4e6f1"]

interface Props {
  data: { name: string; value: number }[]
  ticker: string
  subtitle?: string
  mode?: "internal" | "advisor"
}

export function SectorPieChart({ data, ticker, subtitle, mode = "internal" }: Props) {
  if (data.length === 0) return null

  // Sort biggest to smallest so sectors are contiguous by size
  const sorted = [...data].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

  // Check for negative values (leverage)
  const hasNegative = sorted.some(d => d.value < 0)
  const showLeverageWarning = mode === "internal" ? hasNegative : sorted.some(d => d.value <= -10)

  // For the chart, use absolute values (pie can't show negatives)
  const chartData = sorted.map(d => ({ ...d, value: Math.abs(d.value) }))

  return (
    <div className="flex flex-col items-center">
      <p className="mb-0.5 text-center font-mono text-xs font-bold tracking-wider" style={{ color: "#0f3d6b" }}>{ticker}</p>
      {subtitle && <p className="mb-2 text-center text-[10px] font-medium" style={{ color: "#64748b" }}>{subtitle}</p>}
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            label={({ name, value }) => `${value.toFixed(1)}%`}
          >
            {chartData.map((_, idx) => (
              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => {
              const original = sorted.find(d => d.name === name)
              const displayVal = original ? original.value : value
              return [`${displayVal.toFixed(1)}%`, name]
            }}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              fontSize: 12,
              padding: "6px 12px",
              color: "#1e293b",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#475569", lineHeight: "20px" }}
          />
        </PieChart>
      </ResponsiveContainer>
      {showLeverageWarning && (
        <div className="mt-2 flex items-center gap-1.5 rounded px-3 py-1.5" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
          <span className="text-xs font-bold" style={{ color: "#dc2626" }}>!</span>
          <span className="text-[11px] font-medium" style={{ color: "#dc2626" }}>Negative allocation implies use of leverage in the portfolio</span>
        </div>
      )}
    </div>
  )
}
