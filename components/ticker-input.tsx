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

export function TickerInput({ label, value, onChange, options, placeholder = "Search ticker or name..." }: TickerInputProps) {
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
    <div className="flex flex-col gap-1.5" ref={wrapperRef}>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="relative">
        {value && selected ? (
          <div className="flex h-10 items-center gap-2.5 rounded-md border border-border bg-card px-3 shadow-sm">
            <span className="font-mono text-sm font-bold text-primary">{selected.ticker}</span>
            <span className="flex-1 truncate text-xs text-muted-foreground">{selected.name}</span>
            <button onClick={() => { onChange(""); setQuery(""); setTimeout(() => inputRef.current?.focus(), 0) }} className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground" aria-label="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setHlIdx(0) }}
              onFocus={() => { setIsOpen(true); setHlIdx(0) }}
              onKeyDown={onKey}
              placeholder={placeholder}
              className="h-11 w-full rounded-md border border-border bg-card px-3 pl-9 text-foreground shadow-sm placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 sm:h-10 sm:text-sm"
              style={{ fontSize: 16 }}
              autoComplete="off"
            />
          </>
        )}

        {isOpen && !value && (
          <ul ref={listRef} className="absolute z-50 mt-1.5 max-h-64 w-full overflow-auto rounded-md border border-border bg-card shadow-lg" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">No match</li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={`${opt.ticker}-${i}`}
                  role="option"
                  aria-selected={i === hlIdx}
                  onMouseDown={(e) => { e.preventDefault(); select(opt.ticker) }}
                  onMouseEnter={() => setHlIdx(i)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors ${i === hlIdx ? "bg-primary/5 text-foreground" : "text-foreground hover:bg-muted"}`}
                >
                  <span className="w-14 shrink-0 font-mono text-xs font-bold text-primary">{opt.ticker}</span>
                  <span className="truncate text-xs text-muted-foreground">{opt.name}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
