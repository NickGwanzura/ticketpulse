"use client"

import { useActionState, useState } from "react"
import { Trash2, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { cancelTicketsAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function CancelTicketButton({
  ticketId,
  variant = "desktop",
}: {
  ticketId: string
  variant?: "desktop" | "mobile"
}) {
  const [confirming, setConfirming] = useState(false)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, _form: FormData) => {
      try {
        await cancelTicketsAction([ticketId])
        return { ok: true, message: "Ticket cancelled" }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to cancel ticket"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  const showFeedback = state && !confirming

  // If cancelled successfully, don't show the button anymore
  if (state?.ok) return null

  return (
    <form action={formAction} className="relative inline-flex items-center">
      {confirming ? (
        <div className="inline-flex items-center gap-1">
          <span className="text-[10.5px] text-rose-700 font-medium whitespace-nowrap">
            Are you sure?
          </span>
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {pending ? "…" : "Yes, cancel"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] font-medium text-ink-2 hover:text-ink transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper font-medium text-ink-3 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition-colors",
            variant === "desktop"
              ? "px-2.5 py-1.5 text-[11px]"
              : "px-3 py-2 text-[12px]",
          )}
          title="Cancel this ticket"
        >
          <Trash2 size={variant === "desktop" ? 11 : 12} />
          Cancel
        </button>
      )}

      {/* Inline toast — appears above the button */}
      {showFeedback && !state.ok && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-lg whitespace-nowrap pointer-events-none",
            state.ok
              ? "bg-green-50 text-green-700 ring-1 ring-green-200"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
          )}
        >
          {state.ok ? (
            <CheckCircle size={11} className="shrink-0" />
          ) : (
            <XCircle size={11} className="shrink-0" />
          )}
          {state.message}
        </div>
      )}
    </form>
  )
}
