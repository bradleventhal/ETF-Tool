"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

// Navy, blue, teal, steel-gray, sky -- clearly distinguishable, cohesive
const COLORS = ["#0a2e52", "#1a6fa0", "#17a2b8", "#5c7a94", "#4fc3f7", "#80cbc4", "#a3c4d9", "#cfd8dc"]

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
  // Internal: always show warning if any negative. Advisor: only if -10% or more
  const showLeverageWarning = mode === "internal" ? hasNegative : sorted.some(d => d.value <= -10.0)

  // For the chart, use absolute values (pie can't show negatives)
  const chartData = sorted.map(d => ({ ...d, value: Math.abs(d.value) }))

  return (
    <div className="flex flex-col items-center">
      <p className="mb-0.5 text-center font-mono text-xs font-bold tracking-wider" style={{ color: "#0f3d6b" }}>{ticker}</p>
      {subtitle && <p className="mb-3 text-center text-[10px] font-medium" style={{ color: "#64748b" }}>{subtitle}</p>}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart margin={{ top: 15, right: 5, bottom: 5, left: 5 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            label={({ cx, cy, midAngle, outerRadius: oR, index }) => {
              const RADIAN = Math.PI / 180
              const radius = oR + 16
              const x = cx + radius * Math.cos(-midAngle * RADIAN)
              const y = cy + radius * Math.sin(-midAngle * RADIAN)
              const original = sorted[index]
              const display = original ? original.value : chartData[index].value
              return (
                <text x={x} y={y} fill="#475569" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={10} fontWeight={600}>
                  {`${display < 0 ? "" : ""}${display.toFixed(1)}%`}
                </text>
              )
            }}
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
    </div>
  )
}
