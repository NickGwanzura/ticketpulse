"use client"

import { useActionState, useEffect, useState } from "react"
import { CheckSquare, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeAndSendAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function CompleteAndSendButton({
  orderId,
  variant = "desktop",
  action = completeAndSendAction,
  requireReference = false,
}: {
  orderId: string
  variant?: "desktop" | "mobile" | "menu"
  /** Defaults to the admin action; the organizer orders page passes its own. */
  action?: typeof completeAndSendAction
  /** Unpaid gateway order: an admin must enter the Velocity transaction reference. */
  requireReference?: boolean
}) {
  const [dismissedState, setDismissedState] = useState<ActionState>(null)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, form: FormData) => {
      try {
        const reference = String(form.get("providerReference") ?? "").trim() || undefined
        const result = await action(orderId, reference)
        return { ok: result.success, message: result.message }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to complete and send"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setDismissedState(state), 8000)
      return () => clearTimeout(t)
    }
  }, [state])

  const showFeedback = state && state !== dismissedState

  return (
    <form action={formAction} className="relative inline-flex items-center gap-1">
      {requireReference && (
        <input
          name="providerReference"
          type="text"
          required
          minLength={4}
          aria-label="Velocity transaction reference"
          placeholder="Velocity ref"
          className="w-24 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3/60 focus:outline-none focus:ring-1 focus:ring-brand-600/20"
        />
      )}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variant === "desktop"
            ? "px-2.5 py-1.5 text-[11px] text-violet-700 hover:bg-violet-50 border border-violet-200"
            : "px-3 py-2 text-[12px] text-violet-700 hover:bg-violet-50 border border-violet-200",
          variant === "menu" && "w-full justify-start",
        )}
        title="Complete order and send tickets"
      >
        <CheckSquare size={variant === "desktop" ? 11 : 12} />
        {pending ? "Processing…" : "Complete & Send"}
      </button>

      {showFeedback && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-lg whitespace-nowrap pointer-events-none max-w-[260px]",
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
          <span className="truncate">{state.message}</span>
        </div>
      )}
    </form>
  )
}
