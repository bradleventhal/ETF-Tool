"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

const COLORS = ["#0f3d6b", "#1a6fb5", "#3498db", "#5dade2", "#85c1e9", "#2e86ab", "#7fb3d3", "#aed6f1"]

interface Props {
  data: { name: string; value: number }[]
  ticker: string
}

export function SectorPieChart({ data, ticker }: Props) {
  if (data.length === 0) return null

  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-center font-mono text-xs font-bold tracking-wider" style={{ color: "#0f3d6b" }}>{ticker}</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, idx) => (
              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`]}
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
            wrapperStyle={{ fontSize: 11, color: "#475569", lineHeight: "18px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
