"use client"

import { useState, useEffect } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

const COLORS = ["#0a2e52", "#1a6fa0", "#17a2b8", "#5c7a94", "#4fc3f7", "#80cbc4", "#a3c4d9", "#cfd8dc"]

interface Props {
  data: { name: string; value: number }[]
  ticker: string
  subtitle?: string
  mode?: "internal" | "advisor"
}

function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    setMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [breakpoint])
  return mobile
}

export function SectorPieChart({ data, ticker, subtitle, mode = "internal" }: Props) {
  if (data.length === 0) return null
  const isMobile = useIsMobile()

  const sorted = [...data].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const chartData = sorted.map(d => ({ ...d, value: Math.abs(d.value) }))

  return (
    <div className="flex flex-col items-center">
      <p className="mb-0.5 text-center font-mono text-xs font-bold tracking-wider" style={{ color: "#0f3d6b" }}>{ticker}</p>
      {subtitle && <p className="mb-2 text-center text-[10px] font-medium" style={{ color: "#64748b" }}>{subtitle}</p>}
      <ResponsiveContainer width="100%" height={isMobile ? 170 : 240}>
        <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={isMobile ? 30 : 45}
            outerRadius={isMobile ? 55 : 75}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            label={isMobile ? false : ({ cx, cy, midAngle, outerRadius: oR, index }) => {
              const RADIAN = Math.PI / 180
              const radius = oR + 16
              const x = cx + radius * Math.cos(-midAngle * RADIAN)
              const y = cy + radius * Math.sin(-midAngle * RADIAN)
              const original = sorted[index]
              const display = original ? original.value : chartData[index].value
              return (
                <text x={x} y={y} fill="#334155" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12} fontWeight={600}>
                  {`${display.toFixed(1)}%`}
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
        </PieChart>
      </ResponsiveContainer>
      {/* Legend below chart -- wrapping horizontal layout */}
      <div className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1 px-1">
        {sorted.map((d, idx) => (
          <div key={d.name} className="flex items-center gap-1">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
            <span className="whitespace-nowrap text-[10px]" style={{ color: "#475569" }}>
              {d.name}{isMobile ? ` ${d.value.toFixed(0)}%` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
