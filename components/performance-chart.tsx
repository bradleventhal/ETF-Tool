"use client"

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip, LabelList } from "recharts"

interface Props {
  data: { period: string; fundA: number; fundB: number }[]
  tickerA: string
  tickerB: string
}

export function PerformanceChart({ data, tickerA, tickerB }: Props) {
  const navy = "#0f3d6b"
  const steel = "#94a3b8"

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <div className="border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
        <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Total Return Comparison</h4>
      </div>
      <div className="px-4 py-6">
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
      </div>
    </div>
  )
}
