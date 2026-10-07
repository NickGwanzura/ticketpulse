"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import { syncTierCounterAction } from "@/app/admin/actions/stock"

export default function SyncCounterButton({ tierId, expected }: { tierId: string; expected: number }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Set this tier's sold counter to ${expected}, matching the tickets that really exist?`)) return
          startTransition(async () => {
            const r = await syncTierCounterAction(tierId)
            setMessage(r.message)
          })
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-paper-2 disabled:opacity-60"
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        {pending ? "Fixing…" : `Set counter to ${expected}`}
      </button>
      {message && <span className="text-[11px] text-ink-3">{message}</span>}
    </div>
  )
}
