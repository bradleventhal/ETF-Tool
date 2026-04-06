"use client"

import { useState, useRef } from "react"
import type { AnalysisResult, WarRoom } from "@/lib/fund-types"
import { FileDown, Printer, Copy, Check } from "lucide-react"

interface Props {
  result: AnalysisResult
  warRoom: WarRoom | null
}

export function BattleCard({ result, warRoom }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const ticker = result.tickerA
  const competitor = result.tickerB

  // Build the battle card content
  const leadWith = warRoom?.leadWith?.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3) || []
  const difficulty = warRoom?.overallDifficulty || "—"
  const summary = warRoom?.difficultySummary || ""

  // Top arguments they'll throw at you
  const topArgs = (warRoom?.competitorArguments || []).slice(0, 3)

  // Your responses
  const topRebuttals = (warRoom?.rebuttals || []).slice(0, 3)

  // Key stats comparison
  const keyStats = result.keyStats.filter(r => r.a !== "\u2014" && r.b !== "\u2014").slice(0, 8)

  // Narrative takeaway
  const takeaway = result.narrative.find(s => s.title === "Takeaway")

  const handlePrint = () => {
    if (!cardRef.current) return
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(`
      <html><head><title>${ticker} vs ${competitor} — Battle Card</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; color: #1e293b; font-size: 12px; line-height: 1.5; }
        h1 { color: #0f3d6b; font-size: 18px; margin: 0 0 4px; }
        h2 { color: #0f3d6b; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin: 16px 0 8px; border-bottom: 2px solid #0f3d6b; padding-bottom: 4px; }
        .subtitle { color: #64748b; font-size: 11px; margin-bottom: 16px; }
        .difficulty { display: inline-block; background: #0f3d6b; color: white; padding: 2px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; }
        .summary { color: #475569; margin: 8px 0 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
        th:not(:first-child) { text-align: center; }
        td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', 'Consolas', monospace; }
        td:not(:first-child) { text-align: center; }
        .bold { font-weight: 700; color: #0f3d6b; }
        .section { margin-bottom: 14px; }
        .arg { background: #fff7ed; border-left: 3px solid #f59e0b; padding: 6px 10px; margin-bottom: 6px; border-radius: 0 4px 4px 0; }
        .rebuttal { background: #f0fdf4; border-left: 3px solid #16a34a; padding: 6px 10px; margin-bottom: 6px; border-radius: 0 4px 4px 0; }
        .oneliner { font-style: italic; color: #0f3d6b; font-weight: 600; margin-top: 4px; }
        .lead { display: inline-block; background: #ecfdf5; color: #16a34a; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-right: 6px; }
        .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; color: #94a3b8; font-size: 9px; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h1>${ticker} vs ${competitor}</h1>
      <div class="subtitle">${result.nameA} vs ${result.nameB} — Competitive Battle Card</div>
      <span class="difficulty">${difficulty}</span>
      <p class="summary">${summary}</p>

      ${leadWith.length ? `<h2>Lead With</h2><div class="section">${leadWith.map(l => `<span class="lead">✓ ${l}</span>`).join("")}</div>` : ""}

      <h2>Key Statistics</h2>
      <table>
        <thead><tr><th>Metric</th><th>${ticker}</th><th>${competitor}</th></tr></thead>
        <tbody>${keyStats.map(r => {
          const aWins = r.better === "high" ? (r.nA || 0) > (r.nB || 0) : r.better === "low" ? (r.nA || 0) < (r.nB || 0) : false
          const bWins = r.better === "high" ? (r.nB || 0) > (r.nA || 0) : r.better === "low" ? (r.nB || 0) < (r.nA || 0) : false
          return `<tr><td>${r.label}</td><td${aWins ? ' class="bold"' : ""}>${r.a}</td><td${bWins ? ' class="bold"' : ""}>${r.b}</td></tr>`
        }).join("")}</tbody>
      </table>

      ${topArgs.length ? `
        <h2>What They'll Say</h2>
        ${topArgs.map(a => `<div class="arg"><strong>${a.metric}</strong>: ${a.argument}</div>`).join("")}
      ` : ""}

      ${topRebuttals.length ? `
        <h2>Your Response</h2>
        ${topRebuttals.map(r => `<div class="rebuttal"><strong>${r.metric}</strong>: ${r.opener}${r.oneLiner ? `<div class="oneliner">"${r.oneLiner}"</div>` : ""}</div>`).join("")}
      ` : ""}

      ${takeaway ? `
        <h2>Key Takeaway</h2>
        <ul>${takeaway.lines.map(l => `<li>${l}</li>`).join("")}</ul>
      ` : ""}

      <div class="footer">
        Angel Oak Capital Advisors — Generated ${new Date().toLocaleDateString()} — Data as of ${result.keyStats[0]?.a ? "latest" : "—"}
        <br>For internal use only. Not for distribution to clients.
      </div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  const handleCopy = () => {
    const text = [
      `${ticker} vs ${competitor} — Battle Card`,
      `${result.nameA} vs ${result.nameB}`,
      `Difficulty: ${difficulty}`,
      summary,
      "",
      leadWith.length ? `LEAD WITH: ${leadWith.join(", ")}` : "",
      "",
      "KEY STATS:",
      ...keyStats.map(r => `  ${r.label}: ${ticker}=${r.a}  ${competitor}=${r.b}`),
      "",
      topArgs.length ? "WHAT THEY'LL SAY:" : "",
      ...topArgs.map(a => `  ${a.metric}: ${a.argument}`),
      "",
      topRebuttals.length ? "YOUR RESPONSE:" : "",
      ...topRebuttals.map(r => `  ${r.metric}: ${r.opener}${r.oneLiner ? ` → "${r.oneLiner}"` : ""}`),
      "",
      takeaway ? "KEY TAKEAWAY:" : "",
      ...(takeaway?.lines || []).map(l => `  • ${l}`),
    ].filter(Boolean).join("\n")

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 border-b px-3.5 py-3 text-left sm:gap-3 sm:px-5 sm:py-3.5"
        style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
      >
        <FileDown size={16} style={{ color: "#0f3d6b", flexShrink: 0 }} />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>
            Battle Card
          </span>
          <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
            One-page meeting follow-up
          </span>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: "#94a3b8" }} /> : <ChevronRight size={14} style={{ color: "#94a3b8" }} />}
      </button>

      {expanded && (
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "#0f3d6b", color: "#fff" }}>
              <Printer size={12} />
              Print / Save PDF
            </button>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-gray-50"
              style={{ borderColor: "#d1d5db", color: "#334155" }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy Text"}
            </button>
          </div>

          {/* Preview */}
          <div ref={cardRef} className="rounded border p-4 text-[12px]" style={{ borderColor: "#e2e8f0" }}>
            <div className="mb-1 text-base font-bold" style={{ color: "#0f3d6b" }}>{ticker} vs {competitor}</div>
            <div className="mb-3 text-[11px]" style={{ color: "#64748b" }}>{result.nameA} vs {result.nameB}</div>
            <span className="inline-block rounded px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "#0f3d6b", color: "#fff" }}>{difficulty}</span>
            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#475569" }}>{summary}</p>

            {leadWith.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Lead With</div>
                <div className="flex flex-wrap gap-1.5">
                  {leadWith.map(l => (
                    <span key={l} className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#ecfdf5", color: "#16a34a" }}>✓ {l}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Key Stats</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <th className="px-2 py-1 text-left text-[9px] font-bold uppercase" style={{ color: "#94a3b8" }}>Metric</th>
                    <th className="px-2 py-1 text-center text-[9px] font-bold uppercase" style={{ color: "#0f3d6b" }}>{ticker}</th>
                    <th className="px-2 py-1 text-center text-[9px] font-bold uppercase" style={{ color: "#64748b" }}>{competitor}</th>
                  </tr>
                </thead>
                <tbody>
                  {keyStats.map(r => (
                    <tr key={r.label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td className="px-2 py-1" style={{ color: "#64748b" }}>{r.label}</td>
                      <td className="px-2 py-1 text-center font-mono" style={{ color: "#334155" }}>{r.a}</td>
                      <td className="px-2 py-1 text-center font-mono" style={{ color: "#334155" }}>{r.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {topArgs.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>What They{"'"}ll Say</div>
                {topArgs.map(a => (
                  <div key={a.id} className="mb-1.5 rounded border-l-2 py-1 pl-2.5 text-[11px]" style={{ borderColor: "#f59e0b", backgroundColor: "#fffbeb" }}>
                    <span className="font-semibold" style={{ color: "#92400e" }}>{a.metric}:</span> {a.argument}
                  </div>
                ))}
              </div>
            )}

            {topRebuttals.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#16a34a" }}>Your Response</div>
                {topRebuttals.map(r => (
                  <div key={r.argumentId} className="mb-1.5 rounded border-l-2 py-1 pl-2.5 text-[11px]" style={{ borderColor: "#16a34a", backgroundColor: "#f0fdf4" }}>
                    <span className="font-semibold" style={{ color: "#166534" }}>{r.metric}:</span> {r.opener}
                    {r.oneLiner && <div className="mt-0.5 font-semibold italic" style={{ color: "#0f3d6b" }}>{"\u201C"}{r.oneLiner}{"\u201D"}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
