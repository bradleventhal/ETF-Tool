"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import type { AnalysisResult } from "@/lib/fund-types"
import { MessageSquare, Send, ChevronDown } from "lucide-react"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

function buildFundContext(result: AnalysisResult): string {
  const lines: string[] = []
  lines.push(`Our Fund: ${result.tickerA} (${result.nameA})`)
  lines.push(`Competitor: ${result.tickerB} (${result.nameB})`)
  lines.push("")
  lines.push("KEY STATS:")
  for (const row of result.keyStats) {
    lines.push(`  ${row.label}: ${result.tickerA}=${row.a}  ${result.tickerB}=${row.b}`)
  }
  lines.push("")
  lines.push("PERFORMANCE:")
  for (const row of result.performance) {
    lines.push(`  ${row.label}: ${result.tickerA}=${row.a}  ${result.tickerB}=${row.b}`)
  }
  lines.push("")
  lines.push("SECTOR ALLOCATION:")
  for (const row of result.sectorAllocation) {
    lines.push(`  ${row.label}: ${result.tickerA}=${row.a}  ${result.tickerB}=${row.b}`)
  }
  lines.push("")
  lines.push("CREDIT QUALITY:")
  for (const row of result.creditQuality) {
    lines.push(`  ${row.label}: ${result.tickerA}=${row.a}  ${result.tickerB}=${row.b}`)
  }
  lines.push("")
  lines.push(`Average Credit: ${result.tickerA}=${result.avgCreditA}  ${result.tickerB}=${result.avgCreditB}`)

  const takeaway = result.narrative.find(s => s.title === "Takeaway")
  if (takeaway) {
    lines.push("")
    lines.push("ANALYSIS TAKEAWAY:")
    takeaway.lines.forEach(l => lines.push(`  - ${l}`))
  }

  const reversePitch = result.reversePitch
  if (reversePitch) {
    lines.push("")
    lines.push("COMPETITOR PITCH AGAINST US:")
    reversePitch.lines.forEach(l => lines.push(`  - ${l}`))
  }

  return lines.join("\n")
}

function generateAnticipatedQuestions(result: AnalysisResult): string[] {
  // These should be PRACTICAL / SITUATIONAL questions a rep would ask
  // NOT the same things already covered in the war room (arguments, rebuttals, metrics)
  const questions: string[] = []

  // Pitch framing — different from rebuttals
  questions.push(`Give me a 30-second elevator pitch for ${result.tickerA} over ${result.tickerB} for a conservative income client.`)

  // Client-type specific
  questions.push(`How should I position ${result.tickerA} for an advisor moving clients out of money markets?`)

  // Allocation context
  const secA = result.sectorAllocation.find(r => r.label === "Securitized")
  const corpA = result.sectorAllocation.find(r => r.label === "Corporate Credit")
  if (secA && secA.nA != null && secA.nA > 0.20) {
    questions.push(`An advisor says "I don't understand securitized credit." How do I explain our allocation simply?`)
  } else if (corpA && corpA.nA != null && corpA.nA > 0.30) {
    questions.push(`What's the case for our corporate allocation vs a more diversified approach?`)
  }

  // Forward-looking
  questions.push(`Given where rates and spreads are today, which fund is better positioned for the next 12 months?`)

  return questions.slice(0, 4)
}

interface FundChatProps {
  result: AnalysisResult
}

export function FundChat({ result }: FundChatProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fundContext = useMemo(() => buildFundContext(result), [result])
  const anticipatedQuestions = useMemo(() => generateAnticipatedQuestions(result), [result])

  // Reset when comparison changes
  useEffect(() => {
    setMessages([])
    setStreaming(false)
    setInput("")
  }, [result.tickerA, result.tickerB])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text }
    const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: "" }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput("")
    setStreaming(true)

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    try {
      const controller = new AbortController()
      abortRef.current = controller
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, fundContext }),
        signal: controller.signal,
      })

      const text = await res.text()

      let data: { content?: string; error?: string }
      try {
        data = JSON.parse(text)
      } catch {
        data = { error: "Failed to parse response: " + text.slice(0, 100) }
      }

      if (!res.ok || data.error) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${data.error || res.statusText}` }
          return updated
        })
        return
      }

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: data.content || "No response received" }
        return updated
      })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${errorMsg}` }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming, fundContext])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded border px-4 py-3 text-sm font-medium transition-colors hover:bg-blue-50/50"
        style={{ borderColor: "#0f3d6b", color: "#0f3d6b", backgroundColor: "#f0f7ff" }}
      >
        <MessageSquare size={16} />
        Ask about this matchup
      </button>
    )
  }

  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
        <div className="flex items-center gap-2">
          <MessageSquare size={14} style={{ color: "#0f3d6b" }} />
          <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Analytical Copilot</h4>
        </div>
        <button onClick={() => setOpen(false)} className="rounded p-1 transition-colors hover:bg-gray-200">
          <ChevronDown size={14} style={{ color: "#94a3b8" }} />
        </button>
      </div>

      <div ref={scrollRef} className="max-h-[400px] overflow-y-auto px-4 py-3" style={{ minHeight: 120 }}>
        {messages.length === 0 && !streaming && (
          <div>
            <p className="mb-3 text-xs" style={{ color: "#94a3b8" }}>
              Context-aware analysis for {result.tickerA} vs {result.tickerB}. All fund data is loaded.
            </p>
            <div className="space-y-2">
              {anticipatedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="block w-full rounded border px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50/50"
                  style={{ borderColor: "#e2e8f0", color: "#334155" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (!msg.content && msg.role === "assistant" && streaming) {
            return (
              <div key={msg.id} className="mb-3">
                <div className="inline-block rounded-lg border px-3.5 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: "#94a3b8", animationDelay: "0.2s" }} />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: "#94a3b8", animationDelay: "0.4s" }} />
                  </div>
                </div>
              </div>
            )
          }
          if (!msg.content) return null
          const isUser = msg.role === "user"
          return (
            <div key={msg.id} className={`mb-3 ${isUser ? "text-right" : ""}`}>
              <div
                className={`inline-block max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${isUser ? "ml-auto" : ""}`}
                style={{
                  backgroundColor: isUser ? "#0f3d6b" : "#f8fafc",
                  color: isUser ? "#fff" : "#1e293b",
                  border: isUser ? "none" : "1px solid #e2e8f0",
                }}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content.split(/\*\*(.+?)\*\*/g).map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
        className="flex items-center gap-2 border-t px-3 py-2.5"
        style={{ borderColor: "#e2e8f0" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this comparison..."
          disabled={streaming}
          className="min-w-0 flex-1 rounded border px-3 py-2 text-sm outline-none transition-colors focus:border-[#0f3d6b]"
          style={{ borderColor: "#e2e8f0", color: "#1e293b", fontSize: 16 }}
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded transition-colors disabled:opacity-30"
          style={{ backgroundColor: "#0f3d6b", color: "#fff" }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
