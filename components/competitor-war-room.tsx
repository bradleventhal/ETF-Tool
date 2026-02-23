"use client"

import { useState } from "react"
import type { WarRoom, DifficultyTier, ConfidenceTag } from "@/lib/fund-types"
import { ChevronDown, ChevronRight, Shield, MessageSquare } from "lucide-react"

const DIFFICULTY_COLORS: Record<DifficultyTier, { bg: string; text: string; border: string }> = {
  "Very Easy": { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  "Easy": { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
  "Moderate": { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
  "Difficult": { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
  "Very Difficult": { bg: "#fef2f2", text: "#7f1d1d", border: "#f87171" },
}

const CONFIDENCE_STYLES: Record<ConfidenceTag, { bg: string; text: string }> = {
  "Airtight": { bg: "#dcfce7", text: "#166534" },
  "Strong": { bg: "#e0f2fe", text: "#0c4a6e" },
  "Use With Caution": { bg: "#fef9c3", text: "#854d0e" },
}

function DifficultyBadge({ tier }: { tier: DifficultyTier }) {
  const colors = DIFFICULTY_COLORS[tier]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {tier}
    </span>
  )
}

function ConfidenceBadge({ tag }: { tag: ConfidenceTag }) {
  const s = CONFIDENCE_STYLES[tag]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {tag}
    </span>
  )
}

export function CompetitorWarRoom({ warRoom, competitorTicker, ourTicker, polishing }: {
  warRoom: WarRoom
  competitorTicker: string
  ourTicker: string
  polishing?: boolean
}) {
  const [pitchOpen, setPitchOpen] = useState(false)
  const [rebuttalsOpen, setRebuttalsOpen] = useState(false)

  return (
    <div className="space-y-3">
      {/* Overall Difficulty Rating */}
      <div className="flex items-start gap-3 rounded border p-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <Shield size={18} style={{ color: "#0f3d6b", flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Competitive Difficulty</span>
            <DifficultyBadge tier={warRoom.overallDifficulty} />
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#334155" }}>{warRoom.difficultySummary}</p>
          <p className="mt-2 text-[10px] italic" style={{ color: "#94a3b8" }}>{warRoom.marketContext}</p>
        </div>
      </div>

      {/* Polish loading indicator */}
      {polishing && (
        <div className="flex items-center gap-2 rounded border px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
          <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "#0f3d6b" }} />
          <span className="text-[11px] font-medium" style={{ color: "#64748b" }}>Analyzing matchup with market intelligence...</span>
        </div>
      )}

      {/* Layup — no sections needed */}
      {warRoom.isLayup && warRoom.layupMessage && (
        <div className="rounded border-l-4 p-5" style={{ borderColor: "#22c55e", backgroundColor: "#f0fdf4" }}>
          <p className="text-sm leading-relaxed" style={{ color: "#166534" }}>{warRoom.layupMessage}</p>
        </div>
      )}

      {/* Section 1: How They'd Pitch Against You */}
      {!warRoom.isLayup && warRoom.competitorArguments.length > 0 && (
        <div className="overflow-hidden rounded border" style={{ borderColor: pitchOpen ? "#fca5a5" : "#e2e8f0", transition: "border-color 0.2s" }}>
          <button
            onClick={() => setPitchOpen(!pitchOpen)}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors"
            style={{ backgroundColor: pitchOpen ? "#fef2f2" : "#fafafa" }}
          >
            <Shield size={16} style={{ color: "#dc2626", flexShrink: 0 }} />
            <div className="flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#dc2626" }}>
                How {competitorTicker} Would Pitch Against You
              </span>
              {!pitchOpen && (
                <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
                  {warRoom.competitorArguments.length} argument{warRoom.competitorArguments.length > 1 ? "s" : ""} identified
                </span>
              )}
            </div>
            {pitchOpen
              ? <ChevronDown size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
              : <ChevronRight size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
            }
          </button>

          {pitchOpen && (
            <div className="border-t space-y-0" style={{ borderColor: "#fca5a5" }}>
              {warRoom.competitorArguments.map((arg, i) => (
                <div
                  key={arg.id}
                  className="px-5 py-4"
                  style={{ borderBottom: i < warRoom.competitorArguments.length - 1 ? "1px solid #fee2e2" : undefined, backgroundColor: i % 2 === 0 ? "#fff" : "#fffbfb" }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: "#991b1b" }}>{arg.metric}</span>
                    <DifficultyBadge tier={arg.difficulty} />
                    <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
                      {arg.theirValue} vs {arg.ourValue}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed italic" style={{ color: "#7f1d1d" }}>
                    &ldquo;{arg.argument}&rdquo;
                  </p>
                  {arg.oneLiner && (
                    <p className="mt-2 rounded px-2.5 py-1.5 text-[11px] font-medium" style={{ backgroundColor: "#fef2f2", color: "#991b1b", borderLeft: "2px solid #fca5a5" }}>
                      One-liner: &ldquo;{arg.oneLiner}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Recommended Responses */}
      {!warRoom.isLayup && warRoom.rebuttals.length > 0 && (
        <div className="overflow-hidden rounded border" style={{ borderColor: rebuttalsOpen ? "#93c5fd" : "#e2e8f0", transition: "border-color 0.2s" }}>
          <button
            onClick={() => setRebuttalsOpen(!rebuttalsOpen)}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors"
            style={{ backgroundColor: rebuttalsOpen ? "#eff6ff" : "#fafafa" }}
          >
            <MessageSquare size={16} style={{ color: "#0f3d6b", flexShrink: 0 }} />
            <div className="flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>
                Recommended Responses
              </span>
              {!rebuttalsOpen && (
                <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
                  {warRoom.rebuttals.length} rebuttal{warRoom.rebuttals.length > 1 ? "s" : ""} ready
                </span>
              )}
            </div>
            {rebuttalsOpen
              ? <ChevronDown size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
              : <ChevronRight size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
            }
          </button>

          {rebuttalsOpen && (
            <div className="border-t space-y-0" style={{ borderColor: "#93c5fd" }}>
              {warRoom.rebuttals.map((reb, i) => (
                <div
                  key={reb.argumentId}
                  className="px-5 py-4"
                  style={{ borderBottom: i < warRoom.rebuttals.length - 1 ? "1px solid #dbeafe" : undefined, backgroundColor: i % 2 === 0 ? "#fff" : "#f8fbff" }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: "#0f3d6b" }}>{reb.metric}</span>
                    <ConfidenceBadge tag={reb.confidence} />
                  </div>
                  <p className="mb-2.5 text-sm leading-relaxed italic" style={{ color: "#1e40af" }}>
                    &ldquo;{reb.opener}&rdquo;
                  </p>
                  <ul className="space-y-1.5">
                    {reb.bullets.map((bullet, j) => (
                      <li key={j} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: "#334155" }}>
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#0f3d6b" }} />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  {reb.oneLiner && (
                    <p className="mt-2.5 rounded px-2.5 py-1.5 text-[11px] font-medium" style={{ backgroundColor: "#eff6ff", color: "#1e40af", borderLeft: "2px solid #93c5fd" }}>
                      Drop this line: &ldquo;{reb.oneLiner}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
