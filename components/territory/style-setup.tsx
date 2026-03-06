"use client"

import { useState, useEffect } from "react"
import { Loader2, Check, Plus, Trash2, Save } from "lucide-react"

interface StyleSetupProps {
  repName: string
  onClose: () => void
}

export function StyleSetup({ repName, onClose }: StyleSetupProps) {
  const [examples, setExamples] = useState<string[]>(["", ""])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existingProfile, setExistingProfile] = useState<{ style_summary: string; style_examples: string[] } | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Fetch existing profile
    fetch(`/api/analyze-style?repName=${encodeURIComponent(repName)}`)
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          setExistingProfile(data.profile)
          if (data.profile.style_examples?.length > 0) {
            setExamples(data.profile.style_examples)
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [repName])

  const addExample = () => setExamples([...examples, ""])
  const removeExample = (i: number) => setExamples(examples.filter((_, idx) => idx !== i))
  const updateExample = (i: number, val: string) => {
    const updated = [...examples]
    updated[i] = val
    setExamples(updated)
  }

  const handleSave = async () => {
    const validExamples = examples.filter(e => e.trim().length > 50)
    if (validExamples.length < 2) {
      alert("Please provide at least 2 email examples (each at least 50 characters)")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repName, examples: validExamples }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setExistingProfile({ style_summary: data.styleSummary, style_examples: validExamples })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
      alert("Failed to save style profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#94a3b8" }} />
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>
          Writing Style Setup for {repName}
        </h3>
        <button
          onClick={onClose}
          className="text-xs hover:underline"
          style={{ color: "#94a3b8" }}
        >
          Close
        </button>
      </div>

      {existingProfile?.style_summary && (
        <div className="mb-4 rounded border p-3" style={{ backgroundColor: "#0f172a", borderColor: "#334155" }}>
          <p className="mb-1 text-xs font-medium" style={{ color: "#10b981" }}>Current Style Profile:</p>
          <p className="text-xs leading-relaxed" style={{ color: "#cbd5e1" }}>
            {existingProfile.style_summary}
          </p>
        </div>
      )}

      <p className="mb-3 text-xs" style={{ color: "#94a3b8" }}>
        Paste 2-5 of your past follow-up emails. The AI will analyze your writing style and use it for all future emails.
      </p>

      <div className="space-y-3">
        {examples.map((ex, i) => (
          <div key={i} className="relative">
            <textarea
              value={ex}
              onChange={(e) => updateExample(i, e.target.value)}
              placeholder={`Paste email example ${i + 1}...`}
              className="w-full rounded border p-2 text-xs"
              style={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                color: "#f1f5f9",
                minHeight: 100,
              }}
            />
            {examples.length > 2 && (
              <button
                onClick={() => removeExample(i)}
                className="absolute right-2 top-2 rounded p-1 hover:bg-red-500/20"
                style={{ color: "#ef4444" }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {examples.length < 5 && (
          <button
            onClick={addExample}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs"
            style={{ backgroundColor: "#334155", color: "#f1f5f9" }}
          >
            <Plus className="h-3 w-3" /> Add Example
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: "#3b82f6", color: "#fff" }}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
          {saving ? "Analyzing..." : saved ? "Saved!" : "Save Style Profile"}
        </button>
      </div>
    </div>
  )
}
