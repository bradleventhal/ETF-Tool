"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList } from "recharts"

interface Item {
  label: string
  a: number
  b: number
}

interface Props {
  items: Item[]
  tickerA: string
  tickerB: string
}

export function IncomeRiskBars({ items, tickerA, tickerB }: Props) {
  if (items.length === 0) return null

  const data = items.map((item) => ({
    name: item.label,
    [tickerA]: item.a != null ? Math.round(item.a * 10000) / 100 : 0,
    [tickerB]: item.b != null ? Math.round(item.b * 10000) / 100 : 0,
  }))

  const navy = "#0f3d6b"
  const steel = "#94a3b8"

  return (
    <ResponsiveContainer width="100%" height={items.length * 60 + 30}>
      <BarChart data={data} layout="vertical" barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(2)}%`]}
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            fontSize: 12,
            padding: "6px 12px",
            color: "#1e293b",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
          cursor={{ fill: "rgba(0,0,0,0.02)" }}
        />
        <Bar dataKey={tickerA} fill={navy} radius={[0, 3, 3, 0]} barSize={12}>
          <LabelList dataKey={tickerA} position="right" formatter={(v: number) => `${v.toFixed(2)}%`} style={{ fontSize: 9, fill: "#475569", fontWeight: 600 }} />
        </Bar>
        <Bar dataKey={tickerB} fill={steel} radius={[0, 3, 3, 0]} barSize={12}>
          <LabelList dataKey={tickerB} position="right" formatter={(v: number) => `${v.toFixed(2)}%`} style={{ fontSize: 9, fill: "#94a3b8", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
