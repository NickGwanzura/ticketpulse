"use client"

import { useState, useTransition } from "react"
import { CheckCircle2 } from "lucide-react"
import { approvePayoutAction } from "./actions"

/**
 * Bulk-approve selected pending payouts. Approve is the one bulk action
 * that's genuinely safe to fire in a loop with no per-row input required
 * (reject needs a reason, pay needs a proof reference per row) — the other
 * transitions stay single-row for now.
 */
export default function PayoutsBulkActions({
  selectedIds,
  clearSelection,
  allPending,
}: {
  selectedIds: string[]
  clearSelection: () => void
  allPending: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!allPending) return null

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[12px] text-red-600">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            try {
              await Promise.all(selectedIds.map((id) => approvePayoutAction(id)))
              clearSelection()
            } catch (err) {
              setError(err instanceof Error ? err.message : "Bulk approve failed")
            }
          })
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
      >
        <CheckCircle2 size={13} /> {pending ? "Approving..." : `Approve ${selectedIds.length}`}
      </button>
    </div>
  )
}
