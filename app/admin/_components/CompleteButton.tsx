"use client"

import { useActionState, useEffect, useState } from "react"
import { CheckCircle2, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { markOrderCompleteAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function CompleteButton({
  orderId,
  variant = "desktop",
}: {
  orderId: string
  variant?: "desktop" | "mobile"
}) {
  const [dismissed, setDismissed] = useState(false)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, _form: FormData) => {
      try {
        const result = await markOrderCompleteAction(orderId)
        return { ok: result.success, message: result.message }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to complete order"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setDismissed(true), 6000)
      return () => clearTimeout(t)
    }
    setDismissed(false)
  }, [state])

  const showFeedback = state && !dismissed

  return (
    <form action={formAction} className="relative inline-flex items-center">
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variant === "desktop"
            ? "px-2.5 py-1.5 text-[11px] text-green-700 hover:bg-brand-50 border border-brand-200"
            : "px-3 py-2 text-[12px] text-green-700 hover:bg-brand-50 border border-brand-200",
        )}
        title="Mark order as complete"
      >
        <CheckCircle2 size={variant === "desktop" ? 11 : 12} />
        {pending ? "Completing…" : "Complete"}
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
