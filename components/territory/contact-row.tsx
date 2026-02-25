"use client"

import { useState } from "react"
import { ChevronDown, Copy, Check, Award } from "lucide-react"
import type { TerritoryContact } from "@/lib/territory-types"
import { getContactStatus, STATUS_CONFIG } from "@/lib/territory-types"

export function ContactRow({ contact, onCopyEmail }: { contact: TerritoryContact; onCopyEmail?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const status = getContactStatus(contact)
  const cfg = STATUS_CONFIG[status]

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(contact.email)
    setCopied(true)
    onCopyEmail?.()
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: "#f1f5f9", backgroundColor: expanded ? "#f8fafc" : undefined }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] sm:gap-3 sm:px-4"
      >
        {/* Expand chevron */}
        <ChevronDown
          className="h-3 w-3 shrink-0 transition-transform"
          style={{ color: "#94a3b8", transform: expanded ? "rotate(180deg)" : undefined }}
        />

        {/* Name + awards */}
        <div className="flex min-w-[120px] items-center gap-1 sm:min-w-[160px]">
          <span className="truncate font-medium" style={{ color: "#0f172a" }}>
            {contact.combinedName}
          </span>
          {(contact.forbes || contact.barrons) && (
            <Award className="h-3 w-3 shrink-0" style={{ color: "#eab308" }} title={contact.forbes ? "Forbes Ranked" : "Barron's Ranked"} />
          )}
        </div>

        {/* Firm */}
        <span className="hidden truncate sm:block sm:min-w-[140px]" style={{ color: "#64748b" }}>
          {contact.firmName}
        </span>

        {/* City */}
        <span className="hidden truncate md:block md:min-w-[90px]" style={{ color: "#94a3b8" }}>
          {contact.city}
        </span>

        {/* Title */}
        <span className="hidden truncate lg:block lg:min-w-[120px]" style={{ color: "#94a3b8" }}>
          {contact.title}
        </span>

        {/* Status badge */}
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: cfg.bg, color: cfg.text }}
        >
          {cfg.label}
        </span>

        {/* AO AUM */}
        <span
          className="ml-auto min-w-[60px] text-right font-mono text-[11px]"
          style={{ color: contact.aoAum ? "#0f3d6b" : "#cbd5e1" }}
        >
          {contact.aoAum ? `$${contact.aoAum.toFixed(1)}M` : "--"}
        </span>

        {/* Strategies */}
        <span className="hidden min-w-[80px] truncate text-[10px] sm:block" style={{ color: "#94a3b8" }}>
          {contact.relevantStrategies.length > 0 ? contact.relevantStrategies.join(", ") : "--"}
        </span>

        {/* Email copy */}
        <button
          onClick={handleCopy}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
          style={{ color: copied ? "#22c55e" : "#94a3b8" }}
          title={`Copy ${contact.email}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-8 pb-3 sm:px-10">
          <div className="flex flex-col gap-1.5 text-[11px]" style={{ color: "#64748b" }}>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><strong style={{ color: "#475569" }}>Firm:</strong> {contact.firmName}</span>
              <span><strong style={{ color: "#475569" }}>Title:</strong> {contact.title}</span>
              <span><strong style={{ color: "#475569" }}>City:</strong> {contact.city}, {contact.state}</span>
              <span><strong style={{ color: "#475569" }}>Email:</strong> {contact.email}</span>
            </div>
            {contact.relevantStrategies.length > 0 && (
              <div className="flex items-center gap-1.5">
                <strong style={{ color: "#475569" }}>Relevant Strategies:</strong>
                {contact.relevantStrategies.map((s) => (
                  <span key={s} className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#eff6ff", color: "#1d4ed8" }}>{s}</span>
                ))}
              </div>
            )}
            {contact.notes && (
              <div>
                <strong style={{ color: "#475569" }}>Notes:</strong>{" "}
                <span style={{ color: "#475569" }}>{contact.notes}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-0.5">
              {contact.nextTime && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>Next Time</span>}
              {contact.dripList && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "#ffedd5", color: "#c2410c" }}>Drip List</span>}
              {contact.blastContact && !contact.removeFromBlast && !contact.unsubscribe && (
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "#f0fdf4", color: "#15803d" }}>Blast Eligible</span>
              )}
              {contact.forbes && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "#fef9c3", color: "#a16207" }}>Forbes</span>}
              {contact.barrons && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "#fef9c3", color: "#a16207" }}>{"Barron's"}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
