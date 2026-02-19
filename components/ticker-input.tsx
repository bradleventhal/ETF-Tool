"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Search, X } from "lucide-react"

interface TickerOption {
  ticker: string
  name: string
}

interface TickerInputProps {
  label: string
  value: string
  onChange: (ticker: string) => void
  options: TickerOption[]
  placeholder?: string
}

export function TickerInput({
  label,
  value,
  onChange,
  options,
  placeholder = "Type ticker or name...",
}: TickerInputProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const uniqueOptions = Array.from(
    new Map(options.map((o) => [o.ticker, o])).values()
  )

  const selectedOption = uniqueOptions.find((o) => o.ticker === value)

  const filtered =
    query.trim() === ""
      ? uniqueOptions
      : uniqueOptions.filter((o) => {
          const q = query.toLowerCase()
          return (
            o.ticker.toLowerCase().includes(q) ||
            o.name.toLowerCase().includes(q)
          )
        })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll("li[role='option']")
      items[highlightIndex]?.scrollIntoView({ block: "nearest" })
    }
  }, [highlightIndex, isOpen])

  const handleSelect = useCallback(
    (ticker: string) => {
      onChange(ticker)
      setQuery("")
      setIsOpen(false)
    },
    [onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true)
          setHighlightIndex(0)
          e.preventDefault()
        }
        return
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setHighlightIndex((p) => Math.min(p + 1, filtered.length - 1))
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlightIndex((p) => Math.max(p - 1, 0))
          break
        case "Enter":
          e.preventDefault()
          if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex].ticker)
          break
        case "Escape":
          setIsOpen(false)
          break
      }
    },
    [isOpen, filtered, highlightIndex, handleSelect]
  )

  return (
    <div className="flex flex-col gap-1" ref={wrapperRef}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        {value && selectedOption ? (
          <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3">
            <span className="font-mono text-sm font-bold text-foreground">
              {selectedOption.ticker}
            </span>
            <span className="flex-1 truncate text-sm text-muted-foreground">
              {selectedOption.name}
            </span>
            <button
              onClick={() => {
                onChange("")
                setQuery("")
                setTimeout(() => inputRef.current?.focus(), 0)
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
                setHighlightIndex(0)
              }}
              onFocus={() => {
                setIsOpen(true)
                setHighlightIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              autoComplete="off"
            />
          </>
        )}

        {isOpen && !value && (
          <ul
            ref={listRef}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card shadow-lg"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-muted-foreground">
                No matching funds
              </li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={`${opt.ticker}-${i}`}
                  role="option"
                  aria-selected={i === highlightIndex}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(opt.ticker)
                  }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                    i === highlightIndex
                      ? "bg-primary/10 text-foreground"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="w-14 shrink-0 font-mono text-xs font-bold">
                    {opt.ticker}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {opt.name}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
