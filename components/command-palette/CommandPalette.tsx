"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, X, Ticket, Calendar, User, ShoppingCart, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

type SearchResult = {
  id: string
  type: string
  title: string
  subtitle: string
  href: string
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  order: ShoppingCart,
  event: Calendar,
  user: User,
  ticket: Ticket,
}

const TYPE_COLORS: Record<string, string> = {
  order: "text-sky-600 bg-sky-50",
  event: "text-violet-600 bg-violet-50",
  user: "text-emerald-600 bg-emerald-50",
  ticket: "text-amber-600 bg-amber-50",
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery("")
      setResults([])
      setSelectedIndex(0)
    }
  }, [open])

  // Search API call
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results ?? [])
        setSelectedIndex(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % results.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + results.length) % results.length)
      } else if (e.key === "Enter") {
        e.preventDefault()
        const result = results[selectedIndex]
        if (result) {
          setOpen(false)
          router.push(result.href)
        }
      }
    },
    [results, selectedIndex, router]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-xl rounded-2xl bg-paper shadow-2xl border border-line overflow-hidden tp-fade-up">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <Search size={18} className="text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search orders, events, users, tickets…"
            className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-line-2 border-t-brand-600 rounded-full animate-spin shrink-0" />
          )}
          <button
            onClick={() => setOpen(false)}
            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md bg-paper-2 text-ink-3 hover:text-ink transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-auto">
          {results.length > 0 ? (
            <ul className="py-2">
              {results.map((result, i) => {
                const Icon = TYPE_ICONS[result.type] ?? CreditCard
                const colorClass = TYPE_COLORS[result.type] ?? "text-ink-3 bg-paper-2"
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      onClick={() => {
                        setOpen(false)
                        router.push(result.href)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        i === selectedIndex ? "bg-paper-2" : "hover:bg-paper-2"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex w-8 h-8 items-center justify-center rounded-lg shrink-0",
                          colorClass
                        )}
                      >
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-ink truncate">{result.title}</p>
                        <p className="text-[12px] text-ink-3 truncate">{result.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-semibold tracking-wide uppercase text-ink-3 bg-paper-2 px-2 py-0.5 rounded-full shrink-0">
                        {result.type}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : query.length >= 2 && !loading ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[14px] text-ink-3">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-[12px] text-ink-3 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="px-4 py-6 space-y-1">
              <p className="text-[12px] font-semibold text-ink-3 uppercase tracking-wider px-2">Tips</p>
              <div className="px-2 py-1.5 text-[13px] text-ink-2">
                Type to search across orders, events, users, and tickets
              </div>
              <div className="flex flex-wrap gap-2 px-2 pt-1">
                {["paid orders", "live events", "organizers", "TP-"].map((tip) => (
                  <button
                    key={tip}
                    onClick={() => setQuery(tip)}
                    className="text-[12px] text-ink-3 bg-paper-2 hover:bg-paper-3 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {tip}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-line bg-paper-2 text-[11px] text-ink-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-paper border border-line text-[10px] font-mono">↑↓</kbd> Navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-paper border border-line text-[10px] font-mono">↵</kbd> Select
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-paper border border-line text-[10px] font-mono">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
}
