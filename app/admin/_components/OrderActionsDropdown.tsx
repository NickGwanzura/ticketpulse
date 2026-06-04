"use client"

import { useState, useRef, useEffect } from "react"
import { MoreHorizontal } from "lucide-react"

export default function OrderActionsDropdown({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
        title="Actions"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 min-w-[168px] rounded-xl border border-line bg-paper shadow-xl p-1.5 flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  )
}
