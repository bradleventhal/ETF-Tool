"use client"

import { useState } from "react"
import type { AnalysisResult, WarRoom } from "@/lib/fund-types"
import { FileDown, Printer, Copy, Check, ChevronDown, ChevronRight, Shield, Send } from "lucide-react"

interface Props {
  result: AnalysisResult
  warRoom: WarRoom | null
}

type CardMode = "internal" | "advisor"

export function BattleCard({ result, warRoom }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<CardMode>("internal")

  const ticker = result.tickerA
  const competitor = result.tickerB
  const leadWith = warRoom?.leadWith?.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3) || []
  const difficulty = warRoom?.overallDifficulty || "—"
  const summary = warRoom?.difficultySummary || ""
  const topArgs = (warRoom?.competitorArguments || []).slice(0, 3)
  const topRebuttals = (warRoom?.rebuttals || []).slice(0, 3)
  const keyStats = result.keyStats.filter(r => r.a !== "\u2014" && r.b !== "\u2014").slice(0, 8)
  const performance = result.performance.filter(r => r.a !== "\u2014" && r.b !== "\u2014")
  const takeaway = result.narrative.find(s => s.title === "Takeaway")
  const outlook = result.narrative.find(s => s.title === "Outlook")

  // Sector allocation for advisor view
  const sectors = result.sectorAllocation.filter(r => r.a !== "\u2014" || r.b !== "\u2014").slice(0, 7)
  const creditQuality = result.creditQuality.filter(r => r.a !== "\u2014" || r.b !== "\u2014").slice(0, 8)

  function buildInternalHTML(): string {
    return `
      <html><head><title>${ticker} vs ${competitor} — Internal Prep</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; color: #1e293b; font-size: 12px; line-height: 1.5; }
        h1 { color: #0f3d6b; font-size: 18px; margin: 0 0 4px; }
        h2 { color: #0f3d6b; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; margin: 16px 0 8px; border-bottom: 2px solid #0f3d6b; padding-bottom: 4px; }
        .subtitle { color: #64748b; font-size: 11px; margin-bottom: 16px; }
        .difficulty { display: inline-block; background: #0f3d6b; color: white; padding: 2px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; }
        .summary { color: #475569; margin: 8px 0 16px; }
        .internal-badge { display: inline-block; background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
        th:not(:first-child) { text-align: center; }
        td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', 'Consolas', monospace; }
        td:not(:first-child) { text-align: center; }
        .bold { font-weight: 700; color: #0f3d6b; }
        .arg { background: #fff7ed; border-left: 3px solid #f59e0b; padding: 6px 10px; margin-bottom: 6px; border-radius: 0 4px 4px 0; }
        .rebuttal { background: #f0fdf4; border-left: 3px solid #16a34a; padding: 6px 10px; margin-bottom: 6px; border-radius: 0 4px 4px 0; }
        .oneliner { font-style: italic; color: #0f3d6b; font-weight: 600; margin-top: 4px; }
        .lead { display: inline-block; background: #ecfdf5; color: #16a34a; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-right: 6px; }
        .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; color: #94a3b8; font-size: 9px; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h1>${ticker} vs ${competitor}<span class="internal-badge">Internal Only</span></h1>
      <div class="subtitle">${result.nameA} vs ${result.nameB} — Competitive Prep Card</div>
      <span class="difficulty">${difficulty}</span>
      <p class="summary">${summary}</p>
      ${leadWith.length ? `<h2>Lead With</h2><div>${leadWith.map(l => `<span class="lead">\u2713 ${l}</span>`).join("")}</div>` : ""}
      <h2>Key Statistics</h2>
      <table><thead><tr><th>Metric</th><th>${ticker}</th><th>${competitor}</th></tr></thead>
      <tbody>${keyStats.map(r => {
        const aWins = r.better === "high" ? (r.nA || 0) > (r.nB || 0) : r.better === "low" ? (r.nA || 0) < (r.nB || 0) : false
        const bWins = r.better === "high" ? (r.nB || 0) > (r.nA || 0) : r.better === "low" ? (r.nB || 0) < (r.nA || 0) : false
        return `<tr><td>${r.label}</td><td${aWins ? ' class="bold"' : ""}>${r.a}</td><td${bWins ? ' class="bold"' : ""}>${r.b}</td></tr>`
      }).join("")}</tbody></table>
      ${topArgs.length ? `<h2>Anticipated Objections</h2>${topArgs.map(a => `<div class="arg"><strong>${a.metric}</strong>: ${a.argument}</div>`).join("")}` : ""}
      ${topRebuttals.length ? `<h2>Your Responses</h2>${topRebuttals.map(r => `<div class="rebuttal"><strong>${r.metric}</strong>: ${r.opener}${r.oneLiner ? `<div class="oneliner">\u201C${r.oneLiner}\u201D</div>` : ""}</div>`).join("")}` : ""}
      ${takeaway ? `<h2>Key Takeaway</h2><ul>${takeaway.lines.map(l => `<li>${l}</li>`).join("")}</ul>` : ""}
      <div class="footer">Angel Oak Capital Advisors \u2014 Internal Use Only \u2014 Generated ${new Date().toLocaleDateString()}<br>DO NOT distribute to advisors or clients.</div>
      </body></html>`
  }

  function buildAdvisorHTML(): string {
    return `
      <html><head><title>${result.nameA} vs ${result.nameB} — Comparative Analysis</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; color: #1e293b; font-size: 12px; line-height: 1.6; }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #0f3d6b; }
        .logo { color: #0f3d6b; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
        .date { color: #94a3b8; font-size: 10px; }
        h1 { color: #0f3d6b; font-size: 20px; margin: 0 0 4px; font-weight: 700; }
        h2 { color: #0f3d6b; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 20px 0 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
        .subtitle { color: #64748b; font-size: 12px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #f8fafc; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        th:not(:first-child) { text-align: center; width: 25%; }
        td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-family: 'SF Mono', 'Consolas', monospace; font-size: 12px; }
        td:first-child { font-family: -apple-system, sans-serif; color: #475569; }
        td:not(:first-child) { text-align: center; }
        .bold { font-weight: 700; color: #0f3d6b; }
        .highlight { background: #f0f7ff; }
        .consideration { background: #f8fafc; border-left: 3px solid #0f3d6b; padding: 10px 14px; margin-bottom: 8px; border-radius: 0 4px 4px 0; color: #334155; }
        .footer { margin-top: 28px; border-top: 2px solid #e2e8f0; padding-top: 12px; color: #94a3b8; font-size: 9px; line-height: 1.6; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      <div class="header">
        <div class="logo">Angel Oak Capital Advisors</div>
        <div class="date">Prepared ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>
      <h1>Comparative Analysis</h1>
      <div class="subtitle">${result.nameA} (${ticker}) vs ${result.nameB} (${competitor})</div>

      <h2>Key Statistics</h2>
      <table><thead><tr><th>Metric</th><th>${ticker}</th><th>${competitor}</th></tr></thead>
      <tbody>${keyStats.map((r, i) => `<tr${i % 2 === 0 ? ' class="highlight"' : ""}><td>${r.label}</td><td>${r.a}</td><td>${r.b}</td></tr>`).join("")}</tbody></table>

      ${performance.length ? `
        <h2>Performance</h2>
        <table><thead><tr><th>Period</th><th>${ticker}</th><th>${competitor}</th></tr></thead>
        <tbody>${performance.map((r, i) => `<tr${i % 2 === 0 ? ' class="highlight"' : ""}><td>${r.label}</td><td>${r.a}</td><td>${r.b}</td></tr>`).join("")}</tbody></table>
      ` : ""}

      ${sectors.length ? `
        <h2>Sector Allocation</h2>
        <table><thead><tr><th>Sector</th><th>${ticker}</th><th>${competitor}</th></tr></thead>
        <tbody>${sectors.map((r, i) => `<tr${i % 2 === 0 ? ' class="highlight"' : ""}><td>${r.label}</td><td>${r.a}</td><td>${r.b}</td></tr>`).join("")}</tbody></table>
      ` : ""}

      ${creditQuality.length ? `
        <h2>Credit Quality</h2>
        <table><thead><tr><th>Rating</th><th>${ticker}</th><th>${competitor}</th></tr></thead>
        <tbody>${creditQuality.map((r, i) => `<tr${i % 2 === 0 ? ' class="highlight"' : ""}><td>${r.label}</td><td>${r.a}</td><td>${r.b}</td></tr>`).join("")}</tbody></table>
      ` : ""}

      ${takeaway || outlook ? `
        <h2>Investment Considerations</h2>
        ${(takeaway?.lines || []).map(l => `<div class="consideration">${l}</div>`).join("")}
        ${(outlook?.lines || []).map(l => `<div class="consideration">${l}</div>`).join("")}
      ` : ""}

      <div class="footer">
        <strong>Angel Oak Capital Advisors</strong> | Atlanta, GA | angeloakcapital.com<br>
        This material is provided for informational purposes only and does not constitute investment advice.
        Past performance is not indicative of future results. Data as of ${new Date().toLocaleDateString()}.
        Please refer to each fund's prospectus for complete information including fees, risks, and investment objectives.
      </div>
      </body></html>`
  }

  const handlePrint = () => {
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(mode === "internal" ? buildInternalHTML() : buildAdvisorHTML())
    win.document.close()
    win.print()
  }

  const handleCopy = () => {
    let text: string
    if (mode === "internal") {
      text = [
        `${ticker} vs ${competitor} — INTERNAL PREP CARD`,
        `${result.nameA} vs ${result.nameB}`,
        `Difficulty: ${difficulty}`,
        summary, "",
        leadWith.length ? `LEAD WITH: ${leadWith.join(", ")}` : "", "",
        "KEY STATS:",
        ...keyStats.map(r => `  ${r.label}: ${ticker}=${r.a}  ${competitor}=${r.b}`), "",
        topArgs.length ? "ANTICIPATED OBJECTIONS:" : "",
        ...topArgs.map(a => `  ${a.metric}: ${a.argument}`), "",
        topRebuttals.length ? "YOUR RESPONSES:" : "",
        ...topRebuttals.map(r => `  ${r.metric}: ${r.opener}${r.oneLiner ? ` → "${r.oneLiner}"` : ""}`), "",
        takeaway ? "KEY TAKEAWAY:" : "",
        ...(takeaway?.lines || []).map(l => `  • ${l}`),
      ].filter(Boolean).join("\n")
    } else {
      text = [
        `${result.nameA} (${ticker}) vs ${result.nameB} (${competitor})`,
        `Comparative Analysis — ${new Date().toLocaleDateString()}`, "",
        "KEY STATISTICS:",
        ...keyStats.map(r => `  ${r.label}: ${ticker}=${r.a}  ${competitor}=${r.b}`), "",
        "PERFORMANCE:",
        ...performance.map(r => `  ${r.label}: ${ticker}=${r.a}  ${competitor}=${r.b}`), "",
        sectors.length ? "SECTOR ALLOCATION:" : "",
        ...sectors.map(r => `  ${r.label}: ${ticker}=${r.a}  ${competitor}=${r.b}`), "",
        takeaway ? "INVESTMENT CONSIDERATIONS:" : "",
        ...(takeaway?.lines || []).map(l => `  • ${l}`),
        ...(outlook?.lines || []).map(l => `  • ${l}`), "",
        "Angel Oak Capital Advisors | angeloakcapital.com",
        "Past performance is not indicative of future results.",
      ].filter(Boolean).join("\n")
    }
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
            Export
          </span>
          <span className="ml-2 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
            Internal prep card or advisor follow-up
          </span>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: "#94a3b8" }} /> : <ChevronRight size={14} style={{ color: "#94a3b8" }} />}
      </button>

      {expanded && (
        <div className="p-4 sm:p-5">
          {/* Mode toggle */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex overflow-hidden rounded border" style={{ borderColor: "#d1d5db" }}>
              <button
                onClick={() => setMode("internal")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors"
                style={{ backgroundColor: mode === "internal" ? "#0f3d6b" : "#fff", color: mode === "internal" ? "#fff" : "#64748b" }}
              >
                <Shield size={11} />
                Internal Prep
              </button>
              <button
                onClick={() => setMode("advisor")}
                className="flex items-center gap-1.5 border-l px-3 py-1.5 text-[11px] font-semibold transition-colors"
                style={{ borderColor: "#d1d5db", backgroundColor: mode === "advisor" ? "#0f3d6b" : "#fff", color: mode === "advisor" ? "#fff" : "#64748b" }}
              >
                <Send size={11} />
                Advisor Follow-Up
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-semibold transition-colors hover:opacity-90"
                style={{ backgroundColor: "#0f3d6b", color: "#fff" }}>
                <Printer size={12} />
                Print / PDF
              </button>
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-gray-50"
                style={{ borderColor: "#d1d5db", color: "#334155" }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy Text"}
              </button>
            </div>
          </div>

          {/* Internal Prep Preview */}
          {mode === "internal" && (
            <div className="rounded border p-4 text-[12px]" style={{ borderColor: "#e2e8f0" }}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-base font-bold" style={{ color: "#0f3d6b" }}>{ticker} vs {competitor}</span>
                <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>Internal Only</span>
              </div>
              <div className="mb-3 text-[11px]" style={{ color: "#64748b" }}>{result.nameA} vs {result.nameB}</div>
              <span className="inline-block rounded px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "#0f3d6b", color: "#fff" }}>{difficulty}</span>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#475569" }}>{summary}</p>

              {leadWith.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Lead With</div>
                  <div className="flex flex-wrap gap-1.5">
                    {leadWith.map(l => <span key={l} className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#ecfdf5", color: "#16a34a" }}>{"\u2713"} {l}</span>)}
                  </div>
                </div>
              )}

              {topArgs.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#f59e0b" }}>Anticipated Objections</div>
                  {topArgs.map(a => (
                    <div key={a.id} className="mb-1.5 rounded border-l-2 py-1 pl-2.5 text-[11px]" style={{ borderColor: "#f59e0b", backgroundColor: "#fffbeb" }}>
                      <span className="font-semibold" style={{ color: "#92400e" }}>{a.metric}:</span> {a.argument}
                    </div>
                  ))}
                </div>
              )}

              {topRebuttals.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#16a34a" }}>Your Responses</div>
                  {topRebuttals.map(r => (
                    <div key={r.argumentId} className="mb-1.5 rounded border-l-2 py-1 pl-2.5 text-[11px]" style={{ borderColor: "#16a34a", backgroundColor: "#f0fdf4" }}>
                      <span className="font-semibold" style={{ color: "#166534" }}>{r.metric}:</span> {r.opener}
                      {r.oneLiner && <div className="mt-0.5 font-semibold italic" style={{ color: "#0f3d6b" }}>{"\u201C"}{r.oneLiner}{"\u201D"}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Advisor Follow-Up Preview */}
          {mode === "advisor" && (
            <div className="rounded border p-4 text-[12px]" style={{ borderColor: "#e2e8f0" }}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wide" style={{ color: "#0f3d6b" }}>Angel Oak Capital Advisors</span>
                <span className="text-[10px]" style={{ color: "#94a3b8" }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="mb-1 mt-3 text-base font-bold" style={{ color: "#0f3d6b" }}>Comparative Analysis</div>
              <div className="mb-4 text-[11px]" style={{ color: "#64748b" }}>{result.nameA} ({ticker}) vs {result.nameB} ({competitor})</div>

              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Key Statistics</div>
              <table className="mb-4 w-full text-[11px]">
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase" style={{ color: "#94a3b8" }}>Metric</th>
                    <th className="px-2 py-1.5 text-center text-[9px] font-bold uppercase" style={{ color: "#0f3d6b" }}>{ticker}</th>
                    <th className="px-2 py-1.5 text-center text-[9px] font-bold uppercase" style={{ color: "#64748b" }}>{competitor}</th>
                  </tr>
                </thead>
                <tbody>
                  {keyStats.map((r, i) => (
                    <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? "#f8fafc" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                      <td className="px-2 py-1.5" style={{ color: "#475569" }}>{r.label}</td>
                      <td className="px-2 py-1.5 text-center font-mono" style={{ color: "#334155" }}>{r.a}</td>
                      <td className="px-2 py-1.5 text-center font-mono" style={{ color: "#334155" }}>{r.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {performance.length > 0 && (
                <>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Performance</div>
                  <table className="mb-4 w-full text-[11px]">
                    <tbody>
                      {performance.map((r, i) => (
                        <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? "#f8fafc" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                          <td className="px-2 py-1.5" style={{ color: "#475569" }}>{r.label}</td>
                          <td className="px-2 py-1.5 text-center font-mono" style={{ color: "#334155" }}>{r.a}</td>
                          <td className="px-2 py-1.5 text-center font-mono" style={{ color: "#334155" }}>{r.b}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {takeaway && (
                <>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Investment Considerations</div>
                  {takeaway.lines.map((l, i) => (
                    <div key={i} className="mb-1.5 rounded border-l-2 py-1.5 pl-3 text-[11px] leading-relaxed" style={{ borderColor: "#0f3d6b", backgroundColor: "#f8fafc", color: "#334155" }}>
                      {l}
                    </div>
                  ))}
                </>
              )}

              <div className="mt-4 border-t pt-3 text-[9px] leading-relaxed" style={{ borderColor: "#e2e8f0", color: "#94a3b8" }}>
                <strong>Angel Oak Capital Advisors</strong> | Atlanta, GA | angeloakcapital.com<br />
                This material is for informational purposes only. Past performance is not indicative of future results.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
