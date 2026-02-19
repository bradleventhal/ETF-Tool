"use client"

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts"

interface Props {
  data: { period: string; fundA: number; fundB: number }[]
  tickerA: string
  tickerB: string
}

export function PerformanceChart({ data, tickerA, tickerB }: Props) {
  return (
    <div className="overflow-hidden rounded border border-[#1e3048]">
      <div className="bg-[#0f1c2e] px-3 py-2.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Return Comparison</h4>
      </div>
      <div className="bg-[#101b2e] px-4 py-5">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3048" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}%`} width={48} />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)}%`]}
              contentStyle={{ backgroundColor: "#0f1c2e", border: "1px solid #1e3048", borderRadius: "4px", fontSize: 11, padding: "8px 12px", color: "#e2e8f0" }}
              labelStyle={{ color: "#94a3b8", fontSize: 10, marginBottom: 4 }}
              itemStyle={{ color: "#e2e8f0" }}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "#94a3b8" }} />
            <Bar dataKey="fundA" name={tickerA} fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="fundB" name={tickerB} fill="#64748b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
