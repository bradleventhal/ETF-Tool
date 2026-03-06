"use client"

import { useState } from "react"
import { Loader2, Copy, Check, RefreshCw, Mail, Paperclip, Settings, ChevronDown } from "lucide-react"
import { StyleSetup } from "./style-setup"
import type { Contact } from "@/lib/territory-types"

const AO_FUNDS = ["UYLD", "AOUIX", "ANGIX", "CARY", "AOHY", "ASCIX", "MBS"]
const NEXT_STEPS = [
  "Send materials",
  "Schedule follow up call",
  "Schedule next meeting",
  "No action needed",
]

interface FollowUpGeneratorProps {
  contact: Contact
  repName: string
  onClose: () => void
}

export function FollowUpGenerator({ contact, repName, onClose }: FollowUpGeneratorProps) {
  const [showStyleSetup, setShowStyleSetup] = useState(false)
  const [meetingNotes, setMeetingNotes] = useState("")
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0])
  const [fundsDiscussed, setFundsDiscussed] = useState<string[]>([])
  const [nextStep, setNextStep] = useState("")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ subject: string; body: string; suggestedAttachments: string[] } | null>(null)
  const [copiedSubject, setCopiedSubject] = useState(false)
  const [copiedBody, setCopiedBody] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedBody, setEditedBody] = useState("")

  const toggleFund = (fund: string) => {
    setFundsDiscussed(prev =>
      prev.includes(fund) ? prev.filter(f => f !== fund) : [...prev, fund]
    )
  }

  const handleGenerate = async () => {
    if (!meetingNotes.trim()) {
      alert("Please enter your meeting notes")
      return
    }

    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch("/api/generate-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repName,
          contactName: `${contact.firstName} ${contact.lastName}`,
          contactFirm: contact.firm,
          contactCity: contact.city,
          contactState: contact.state,
          contactStatus: contact.status,
          relevantStrategies: contact.relevantStrategies,
          meetingNotes,
          meetingDate,
          fundsDiscussed,
          nextStep,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
      setEditedBody(data.body)
    } catch (err) {
      console.error(err)
      alert("Failed to generate email")
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, type: "subject" | "body") => {
    await navigator.clipboard.writeText(text)
    if (type === "subject") {
      setCopiedSubject(true)
      setTimeout(() => setCopiedSubject(false), 2000)
    } else {
      setCopiedBody(true)
      setTimeout(() => setCopiedBody(false), 2000)
    }
  }

  const copyAll = async () => {
    if (!result) return
    const fullEmail = `Subject: ${result.subject}\n\n${editMode ? editedBody : result.body}`
    await navigator.clipboard.writeText(fullEmail)
    setCopiedBody(true)
    setTimeout(() => setCopiedBody(false), 2000)
  }

  if (showStyleSetup) {
    return <StyleSetup repName={repName} onClose={() => setShowStyleSetup(false)} />
  }

  return (
    <div className="rounded-lg border" style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#334155" }}>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" style={{ color: "#3b82f6" }} />
          <h3 className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>
            Generate Follow Up Email
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStyleSetup(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs"
            style={{ backgroundColor: "#334155", color: "#94a3b8" }}
          >
            <Settings className="h-3 w-3" /> Style Setup
          </button>
          <button onClick={onClose} className="text-xs hover:underline" style={{ color: "#94a3b8" }}>
            Close
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Contact Info */}
        <div className="mb-4 rounded border p-3" style={{ backgroundColor: "#0f172a", borderColor: "#334155" }}>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "#cbd5e1" }}>
            <span><strong>To:</strong> {contact.firstName} {contact.lastName}</span>
            <span><strong>Firm:</strong> {contact.firm}</span>
            <span><strong>Location:</strong> {contact.city}, {contact.state}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{
              backgroundColor: contact.status === "Client" ? "#166534" : contact.status === "Pipeline" ? "#7e22ce" : contact.status === "Warm" ? "#a16207" : "#475569",
              color: "#fff"
            }}>
              {contact.status}
            </span>
          </div>
          {contact.relevantStrategies && (
            <p className="mt-1 text-[10px]" style={{ color: "#94a3b8" }}>
              Relevant strategies: {contact.relevantStrategies}
            </p>
          )}
        </div>

        {!result ? (
          <>
            {/* Meeting Notes */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium" style={{ color: "#f1f5f9" }}>
                Meeting Notes
              </label>
              <textarea
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                placeholder="What did you talk about? How do they run their practice? What fixed income do they use? What strategies came up? Any follow up items or next steps?"
                className="w-full rounded border p-2 text-xs"
                style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f1f5f9", minHeight: 120 }}
              />
            </div>

            {/* Options Row */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "#f1f5f9" }}>
                  Meeting Date
                </label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-xs"
                  style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f1f5f9" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "#f1f5f9" }}>
                  Next Step
                </label>
                <select
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-xs"
                  style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f1f5f9" }}
                >
                  <option value="">Select...</option>
                  {NEXT_STEPS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Funds Discussed */}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium" style={{ color: "#f1f5f9" }}>
                Funds Discussed
              </label>
              <div className="flex flex-wrap gap-1.5">
                {AO_FUNDS.map(fund => (
                  <button
                    key={fund}
                    onClick={() => toggleFund(fund)}
                    className="rounded px-2 py-1 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: fundsDiscussed.includes(fund) ? "#3b82f6" : "#334155",
                      color: fundsDiscussed.includes(fund) ? "#fff" : "#94a3b8",
                    }}
                  >
                    {fund}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !meetingNotes.trim()}
              className="flex w-full items-center justify-center gap-2 rounded py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#3b82f6", color: "#fff" }}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Writing in {repName}&apos;s voice...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Generate Follow Up Email
                </>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Generated Email */}
            <div className="mb-3 rounded border" style={{ backgroundColor: "#0f172a", borderColor: "#334155" }}>
              {/* Subject */}
              <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "#334155" }}>
                <div>
                  <span className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>Subject:</span>
                  <p className="text-xs font-medium" style={{ color: "#f1f5f9" }}>{result.subject}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(result.subject, "subject")}
                  className="rounded p-1 hover:bg-white/10"
                  style={{ color: copiedSubject ? "#10b981" : "#94a3b8" }}
                >
                  {copiedSubject ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Body */}
              <div className="p-3">
                {editMode ? (
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="w-full rounded border p-2 text-xs"
                    style={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f1f5f9", minHeight: 200 }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "#cbd5e1" }}>
                    {result.body}
                  </p>
                )}
              </div>
            </div>

            {/* Suggested Attachments */}
            {result.suggestedAttachments.length > 0 && (
              <div className="mb-3 rounded border p-2" style={{ backgroundColor: "#0f172a", borderColor: "#334155" }}>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-medium" style={{ color: "#94a3b8" }}>
                  <Paperclip className="h-3 w-3" /> Suggested Attachments:
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.suggestedAttachments.map(att => (
                    <span key={att} className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: "#334155", color: "#f1f5f9" }}>
                      {att}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: "#10b981", color: "#fff" }}
              >
                {copiedBody ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedBody ? "Copied!" : "Copy Email"}
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: "#334155", color: "#f1f5f9" }}
              >
                <ChevronDown className="h-3.5 w-3.5" style={{ transform: editMode ? "rotate(180deg)" : undefined }} />
                {editMode ? "Done Editing" : "Edit"}
              </button>
              <button
                onClick={() => { setResult(null); setEditMode(false) }}
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: "#334155", color: "#f1f5f9" }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
