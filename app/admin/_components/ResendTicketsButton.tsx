"use client"

import { useActionState, useEffect, useState } from "react"
import { RotateCcw, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { sendTicketsAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function ResendTicketsButton({
  orderId,
  variant = "desktop",
  action = sendTicketsAction,
}: {
  orderId: string
  variant?: "desktop" | "mobile" | "menu"
  /** Defaults to the admin action; the organizer orders page passes its own. */
  action?: typeof sendTicketsAction
}) {
  const [dismissedState, setDismissedState] = useState<ActionState>(null)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, _form: FormData) => {
      try {
        const result = await action(orderId)
        if (result.emailSent) {
          return { ok: true, message: "Tickets resent successfully" }
        }
        return { ok: false, message: result.error ?? "Resend failed" }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to resend"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  useEffect(() => {
    if (state) {
      const t = setTimeout(() => setDismissedState(state), 6000)
      return () => clearTimeout(t)
    }
  }, [state])

  const showFeedback = state && state !== dismissedState

  return (
    <form action={formAction} className="relative inline-flex items-center">
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variant === "desktop"
            ? "px-2.5 py-1.5 text-[11px]"
            : "px-3 py-2 text-[12px]",
          variant === "menu" && "w-full justify-start",
        )}
        title="Resend ticket email"
      >
        <RotateCcw size={variant === "desktop" ? 11 : 12} />
        {pending ? "Resending…" : "Resend"}
      </button>

      {showFeedback && (
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
