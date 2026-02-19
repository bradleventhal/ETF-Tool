"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Search, ChevronDown, X } from "lucide-react"

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

export function TickerInput({ label, value, onChange, options, placeholder = "Type ticker or name..." }: TickerInputProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find((o) => o.ticker === value)

  const filtered = query.trim() === ""
    ? options
    : options.filter((o) => {
        const q = query.toLowerCase()
        return o.ticker.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)
      })

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll("li")
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

  const handleClear = useCallback(() => {
    onChange("")
    setQuery("")
    setIsOpen(false)
  }, [onChange])

  const handleInputFocus = useCallback(() => {
    setIsOpen(true)
    setHighlightIndex(0)
  }, [])

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
          setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1))
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlightIndex((prev) => Math.max(prev - 1, 0))
          break
        case "Enter":
          e.preventDefault()
          if (filtered[highlightIndex]) {
            handleSelect(filtered[highlightIndex].ticker)
          }
          break
        case "Escape":
          setIsOpen(false)
          break
      }
    },
    [isOpen, filtered, highlightIndex, handleSelect]
  )

  return (
    <div className="flex flex-col gap-1.5" ref={wrapperRef}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        {value && selectedOption ? (
          // Selected state
          <div className="flex h-10 items-center rounded-md border border-border bg-card px-3">
            <span className="flex-1 truncate text-sm text-card-foreground">
              <span className="font-mono font-bold">{selectedOption.ticker}</span>
              <span className="ml-2 text-muted-foreground">{selectedOption.name}</span>
            </span>
            <button
              onClick={handleClear}
              className="ml-2 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          // Search input
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIsOpen(true)
                setHighlightIndex(0)
              }}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-8 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => {
                setIsOpen(!isOpen)
                inputRef.current?.focus()
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
              tabIndex={-1}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          </>
        )}

        {/* Dropdown */}
        {isOpen && !value && (
          <ul
            ref={listRef}
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No matching funds
              </li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={opt.ticker}
                  role="option"
                  aria-selected={i === highlightIndex}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(opt.ticker)
                  }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                    i === highlightIndex ? "bg-primary/10 text-foreground" : "text-card-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="shrink-0 font-mono font-bold">{opt.ticker}</span>
                  <span className="truncate text-muted-foreground">{opt.name}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
