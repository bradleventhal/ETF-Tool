"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Search, X } from "lucide-react"

interface TickerOption { ticker: string; name: string }

interface TickerInputProps {
  label: string
  value: string
  onChange: (ticker: string) => void
  options: TickerOption[]
  placeholder?: string
}

export function TickerInput({ label, value, onChange, options, placeholder = "Type ticker..." }: TickerInputProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [hlIdx, setHlIdx] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const unique = Array.from(new Map(options.map((o) => [o.ticker, o])).values())
  const selected = unique.find((o) => o.ticker === value)
  const filtered = query.trim() === "" ? unique : unique.filter((o) => {
    const q = query.toLowerCase()
    return o.ticker.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)
  })

  useEffect(() => {
    function onClickOut(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener("mousedown", onClickOut)
    return () => document.removeEventListener("mousedown", onClickOut)
  }, [])

  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll("li[role='option']")
      items[hlIdx]?.scrollIntoView({ block: "nearest" })
    }
  }, [hlIdx, isOpen])

  const select = useCallback((t: string) => { onChange(t); setQuery(""); setIsOpen(false) }, [onChange])

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setIsOpen(true); setHlIdx(0); e.preventDefault() }
      return
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setHlIdx((p) => Math.min(p + 1, filtered.length - 1)); break
      case "ArrowUp": e.preventDefault(); setHlIdx((p) => Math.max(p - 1, 0)); break
      case "Enter": e.preventDefault(); if (filtered[hlIdx]) select(filtered[hlIdx].ticker); break
      case "Escape": setIsOpen(false); break
    }
  }, [isOpen, filtered, hlIdx, select])

  return (
    <div className="flex flex-col gap-1" ref={wrapperRef}>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <div className="relative">
        {value && selected ? (
          <div className="flex h-8 items-center gap-2 rounded border border-[#1e3048] bg-[#0b1322] px-3">
            <span className="font-mono text-sm font-bold text-slate-100">{selected.ticker}</span>
            <span className="flex-1 truncate text-xs text-slate-500">{selected.name}</span>
            <button onClick={() => { onChange(""); setQuery(""); setTimeout(() => inputRef.current?.focus(), 0) }} className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-300" aria-label="Clear">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setHlIdx(0) }}
              onFocus={() => { setIsOpen(true); setHlIdx(0) }}
              onKeyDown={onKey}
              placeholder={placeholder}
              className="h-8 w-full rounded border border-[#1e3048] bg-[#0b1322] pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              autoComplete="off"
            />
          </>
        )}

        {isOpen && !value && (
          <ul ref={listRef} className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded border border-[#1e3048] bg-[#0f1c2e] shadow-xl shadow-black/40" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-500">No match</li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={`${opt.ticker}-${i}`}
                  role="option"
                  aria-selected={i === hlIdx}
                  onMouseDown={(e) => { e.preventDefault(); select(opt.ticker) }}
                  onMouseEnter={() => setHlIdx(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === hlIdx ? "bg-blue-600/20 text-slate-100" : "text-slate-300 hover:bg-[#1e3048]"}`}
                >
                  <span className="w-14 shrink-0 font-mono text-xs font-bold text-slate-200">{opt.ticker}</span>
                  <span className="truncate text-xs text-slate-500">{opt.name}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
