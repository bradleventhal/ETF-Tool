"use client"

import type { AnalysisResult } from "@/lib/fund-types"

interface NarrativeSectionProps {
  result: AnalysisResult
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
      {children}
    </h3>
  )
}

function NarrativeText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-foreground">{children}</p>
  )
}

function MiniTable({
  rows,
  tickerA,
  tickerB,
}: {
  rows: { label: string; valueA: string; valueB: string }[]
  tickerA: string
  tickerB: string
}) {
  if (rows.length === 0) return null
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-primary/5">
            <th className="px-3 py-1.5 text-left text-xs font-semibold text-foreground">
              Sector
            </th>
            <th className="px-3 py-1.5 text-center text-xs font-semibold text-foreground">
              {tickerA}
            </th>
            <th className="px-3 py-1.5 text-center text-xs font-semibold text-foreground">
              {tickerB}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "bg-card" : "bg-background"}`}
            >
              <td className="px-3 py-1.5 text-xs text-muted-foreground">{row.label}</td>
              <td className="px-3 py-1.5 text-center text-xs font-medium text-foreground">{row.valueA}</td>
              <td className="px-3 py-1.5 text-center text-xs font-medium text-foreground">{row.valueB}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function NarrativeSection({ result }: NarrativeSectionProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="rounded-lg bg-primary/5 px-5 py-4 text-center">
        <h2 className="text-xl font-bold tracking-tight text-primary">
          {result.title}
        </h2>
      </div>

      {/* Structure */}
      <div className="flex flex-col gap-2">
        <SectionHeader>Structure</SectionHeader>
        <NarrativeText>{result.structureText}</NarrativeText>
      </div>

      {/* Sector Allocation Table */}
      <div className="flex flex-col gap-2">
        <SectionHeader>Sector Allocation</SectionHeader>
        <MiniTable
          rows={result.sectorTable}
          tickerA={result.tickerA}
          tickerB={result.tickerB}
        />
      </div>

      {/* Income */}
      <div className="flex flex-col gap-2">
        <SectionHeader>Income</SectionHeader>
        <NarrativeText>{result.incomeText}</NarrativeText>
      </div>

      {/* Risk */}
      <div className="flex flex-col gap-2">
        <SectionHeader>Risk</SectionHeader>
        <NarrativeText>{result.riskText}</NarrativeText>
      </div>

      {/* Performance Table */}
      <div className="flex flex-col gap-2">
        <SectionHeader>Performance</SectionHeader>
        <MiniTable
          rows={result.performanceTable}
          tickerA={result.tickerA}
          tickerB={result.tickerB}
        />
      </div>

      {/* Summary / Takeaway */}
      <div className="flex flex-col gap-2">
        <SectionHeader>{result.summaryLabel}</SectionHeader>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm leading-relaxed text-amber-950">
            {result.summaryText}
          </p>
        </div>
      </div>
    </div>
  )
}
