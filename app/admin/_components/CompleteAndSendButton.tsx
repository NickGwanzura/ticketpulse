"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useActionState, useEffect, useState } from "react"
import { CheckSquare, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeAndSendAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function CompleteAndSendButton({
  orderId,
  variant = "desktop",
}: {
  orderId: string
  variant?: "desktop" | "mobile" | "menu"
}) {
  const [dismissed, setDismissed] = useState(false)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, _form: FormData) => {
      try {
        const result = await completeAndSendAction(orderId)
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
      const t = setTimeout(() => setDismissed(true), 8000)
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
