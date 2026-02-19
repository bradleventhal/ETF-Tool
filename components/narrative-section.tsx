"use client"

import type { AnalysisResult } from "@/lib/fund-types"

interface NarrativeSectionProps {
  result: AnalysisResult
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
        {title}
      </h3>
      {children}
    </div>
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
    <div className="overflow-hidden rounded-md border border-border text-xs">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="px-3 py-1.5 text-left font-semibold text-foreground" />
            <th className="px-3 py-1.5 text-center font-semibold text-foreground">
              {tickerA}
            </th>
            <th className="px-3 py-1.5 text-center font-semibold text-foreground">
              {tickerB}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={i % 2 === 0 ? "bg-card" : "bg-background"}
            >
              <td className="px-3 py-1.5 text-muted-foreground">{row.label}</td>
              <td className="px-3 py-1.5 text-center font-medium text-foreground">
                {row.valueA}
              </td>
              <td className="px-3 py-1.5 text-center font-medium text-foreground">
                {row.valueB}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function NarrativeSection({ result }: NarrativeSectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Structure">
        <p className="text-sm leading-relaxed text-foreground">{result.structureText}</p>
      </Section>

      {result.sectorTable.length > 0 && (
        <Section title="Sector Allocation">
          <MiniTable
            rows={result.sectorTable}
            tickerA={result.tickerA}
            tickerB={result.tickerB}
          />
        </Section>
      )}

      <Section title="Income">
        <p className="text-sm leading-relaxed text-foreground">{result.incomeText}</p>
      </Section>

      <Section title="Risk">
        <p className="text-sm leading-relaxed text-foreground">{result.riskText}</p>
      </Section>

      {result.performanceTable.length > 0 && (
        <Section title="Performance">
          <MiniTable
            rows={result.performanceTable}
            tickerA={result.tickerA}
            tickerB={result.tickerB}
          />
        </Section>
      )}

      <Section title={result.summaryLabel}>
        <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm leading-relaxed text-foreground">
            {result.summaryText}
          </p>
        </div>
      </Section>
    </div>
  )
}
