"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { AnalysisResult } from "@/lib/fund-types"
import { MessageSquare, Send, X, ChevronDown } from "lucide-react"

function getUIMessageText(msg: { parts?: { type: string; text?: string }[] }): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts.filter((p): p is { type: "text"; text: string } => p.type === "text").map(p => p.text).join("")
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
  const questions: string[] = []
  const yieldA = result.keyStats.find(r => r.label === "30-Day SEC Yield")
  const durA = result.keyStats.find(r => r.label === "Duration")
  const expA = result.keyStats.find(r => r.label === "Expense Ratio")

  if (yieldA && yieldA.nA != null && yieldA.nB != null) {
    if (yieldA.nB > yieldA.nA) {
      questions.push(`Why does ${result.tickerB} have a higher yield than us, and how do I address that?`)
    } else {
      questions.push(`Our yield advantage over ${result.tickerB} — what's driving it and how sustainable is it?`)
    }
  }

  if (durA && durA.nA != null && durA.nB != null && Math.abs(durA.nA - durA.nB) > 0.3) {
    questions.push(`How does the duration difference between these two funds affect positioning in the current rate environment?`)
  }

  if (expA && expA.nA != null && expA.nB != null && expA.nB < expA.nA) {
    questions.push(`${result.tickerB} has a lower expense ratio. How do I counter that in a meeting?`)
  }

  questions.push(`Give me a 30-second pitch for ${result.tickerA} over ${result.tickerB} for an income-focused client.`)

  if (result.reversePitch) {
    questions.push(`What are the top 3 pushbacks I should expect and how do I handle them?`)
  }

  return questions.slice(0, 4)
}

interface FundChatProps {
  result: AnalysisResult
}

export function FundChat({ result }: FundChatProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const fundContext = useMemo(() => buildFundContext(result), [result])
  const anticipatedQuestions = useMemo(() => generateAnticipatedQuestions(result), [result])
  const fundContextRef = useRef(fundContext)
  fundContextRef.current = fundContext

  const transportRef = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: { messages: msgs, id, fundContext: fundContextRef.current },
      }),
    })
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: transportRef.current,
  })

  const isLoading = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Reset chat when comparison changes
  useEffect(() => {
    setMessages([])
  }, [result.tickerA, result.tickerB, setMessages])

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return
    sendMessage({ text })
    setInput("")
  }

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
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
        <div className="flex items-center gap-2">
          <MessageSquare size={14} style={{ color: "#0f3d6b" }} />
          <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Analytical Copilot</h4>
        </div>
        <button onClick={() => setOpen(false)} className="rounded p-1 transition-colors hover:bg-gray-200">
          <ChevronDown size={14} style={{ color: "#94a3b8" }} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-[400px] overflow-y-auto px-4 py-3" style={{ minHeight: 120 }}>
        {messages.length === 0 && (
          <div>
            <p className="mb-3 text-xs" style={{ color: "#94a3b8" }}>
              Context-aware analysis for {result.tickerA} vs {result.tickerB}. All fund data is loaded.
            </p>
            <div className="space-y-2">
              {anticipatedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
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
          const text = getUIMessageText(msg)
          if (!text) return null
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
                <div className="whitespace-pre-wrap">{text}</div>
              </div>
            </div>
          )
        })}

        {isLoading && messages.length > 0 && !getUIMessageText(messages[messages.length - 1]) && (
          <div className="mb-3">
            <div className="inline-block rounded-lg border px-3.5 py-2.5" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: "#94a3b8", animationDelay: "0.2s" }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: "#94a3b8", animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(input) }}
        className="flex items-center gap-2 border-t px-3 py-2.5"
        style={{ borderColor: "#e2e8f0" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this comparison..."
          disabled={isLoading}
          className="min-w-0 flex-1 rounded border px-3 py-2 text-sm outline-none transition-colors focus:border-[#0f3d6b]"
          style={{ borderColor: "#e2e8f0", color: "#1e293b", fontSize: 16 }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded transition-colors disabled:opacity-30"
          style={{ backgroundColor: "#0f3d6b", color: "#fff" }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
