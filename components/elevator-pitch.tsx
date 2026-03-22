"use client"

import { useState, useEffect, useCallback } from "react"
import type { AnalysisResult } from "@/lib/fund-types"
import { Mic, Copy, Check, RefreshCw, ChevronDown, ChevronRight } from "lucide-react"

interface PitchVariation {
  label: string
  pitch: string
}

interface PitchData {
  main: string
  variations: PitchVariation[]
}

function buildPitchContext(result: AnalysisResult): string {
  const lines: string[] = []
  lines.push(`Our Fund: ${result.tickerA} (${result.nameA})`)
  lines.push(`Competitor: ${result.tickerB} (${result.nameB})`)
  lines.push("")
  lines.push("KEY STATS:")
  for (const row of result.keyStats) {
    lines.push(`  ${row.label}: Ours=${row.a}  Theirs=${row.b}`)
  }
  lines.push("")
  lines.push("PERFORMANCE:")
  for (const row of result.performance) {
    lines.push(`  ${row.label}: Ours=${row.a}  Theirs=${row.b}`)
  }
  lines.push("")
  lines.push("SECTOR ALLOCATION:")
  for (const row of result.sectorAllocation) {
    lines.push(`  ${row.label}: Ours=${row.a}  Theirs=${row.b}`)
  }
  lines.push("")
  lines.push("CREDIT QUALITY:")
  for (const row of result.creditQuality) {
    lines.push(`  ${row.label}: Ours=${row.a}  Theirs=${row.b}`)
  }
  lines.push("")
  lines.push(`Average Credit: Ours=${result.avgCreditA}  Theirs=${result.avgCreditB}`)

  // Include takeaway if available
  const takeaway = result.narrative.find(s => s.title === "Takeaway")
  if (takeaway) {
    lines.push("")
    lines.push("ANALYSIS TAKEAWAY:")
    takeaway.lines.forEach(l => lines.push(`  - ${l}`))
  }

  return lines.join("\n")
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors hover:bg-gray-100"
      style={{ color: copied ? "#16a34a" : "#94a3b8" }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

export function ElevatorPitch({ result }: { result: AnalysisResult }) {
  const [pitchData, setPitchData] = useState<PitchData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeVariation, setActiveVariation] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(true)

  const fetchPitch = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPitchData(null)
    setActiveVariation(null)

    try {
      const res = await fetch("/api/elevator-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundContext: buildPitchContext(result) }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setPitchData(data)
      }
    } catch {
      setError("Failed to generate pitch")
    } finally {
      setLoading(false)
    }
  }, [result])

  useEffect(() => {
    fetchPitch()
  }, [fetchPitch])

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 border-b px-3.5 py-3 text-left sm:gap-3 sm:px-5 sm:py-3.5"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
      >
        <Mic size={16} style={{ color: "#0f3d6b", flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>
            Elevator Pitch
          </span>
          {!expanded && pitchData && (
            <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
              {pitchData.variations.length + 1} versions ready
            </span>
          )}
        </div>
        {expanded
          ? <ChevronDown size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
        }
      </button>

      {expanded && (
        <div className="p-3.5 sm:p-5">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm" style={{ color: "#94a3b8" }}>
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current" style={{ borderTopColor: "transparent" }} />
              Crafting your pitch...
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="py-4">
              <p className="mb-2 text-sm" style={{ color: "#dc2626" }}>{error}</p>
              <button
                onClick={fetchPitch}
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
                style={{ backgroundColor: "#0f3d6b", color: "#fff" }}
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          )}

          {/* Pitch content */}
          {pitchData && (
            <div className="space-y-4">
              {/* Main pitch */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Your Pitch
                  </span>
                  <div className="flex items-center gap-1">
                    <CopyButton text={pitchData.main} />
                    <button
                      onClick={fetchPitch}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors hover:bg-gray-100"
                      style={{ color: "#94a3b8" }}
                      title="Regenerate"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>
                <div
                  className="rounded-lg border-l-4 px-4 py-3.5"
                  style={{ borderColor: "#0f3d6b", backgroundColor: "#f0f7ff" }}
                >
                  <p className="text-sm leading-relaxed" style={{ color: "#1e293b" }}>
                    {pitchData.main}
                  </p>
                </div>
              </div>

              {/* Scenario variations */}
              {pitchData.variations.length > 0 && (
                <div>
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Scenario Variations
                  </span>
                  <div className="space-y-1.5">
                    {pitchData.variations.map((v, i) => (
                      <div key={i}>
                        <button
                          onClick={() => setActiveVariation(activeVariation === i ? null : i)}
                          className="flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-gray-50"
                          style={{
                            borderColor: activeVariation === i ? "#93c5fd" : "#e2e8f0",
                            color: "#334155",
                            backgroundColor: activeVariation === i ? "#eff6ff" : "#fff",
                          }}
                        >
                          {v.label}
                          {activeVariation === i
                            ? <ChevronDown size={12} style={{ color: "#94a3b8" }} />
                            : <ChevronRight size={12} style={{ color: "#94a3b8" }} />
                          }
                        </button>
                        {activeVariation === i && (
                          <div className="mt-1 rounded-b border border-t-0 px-3 py-3" style={{ borderColor: "#93c5fd", backgroundColor: "#f8fbff" }}>
                            <div className="flex justify-end mb-1">
                              <CopyButton text={v.pitch} />
                            </div>
                            <p className="text-sm leading-relaxed" style={{ color: "#1e293b" }}>
                              {v.pitch}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
