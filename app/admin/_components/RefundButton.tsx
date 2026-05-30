"use client"

import { useActionState, useEffect, useState } from "react"
import { RotateCcw, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { refundOrderAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function RefundButton({
  orderId,
  variant = "desktop",
}: {
  orderId: string
  variant?: "desktop" | "mobile"
}) {
  const [confirming, setConfirming] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, _form: FormData) => {
      try {
        await refundOrderAction(orderId)
        return { ok: true, message: "Refunded!" }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to refund"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setDismissed(true), 4000)
      return () => clearTimeout(t)
    }
    setDismissed(false)
  }, [state])

  const showFeedback = state && !dismissed

  return (
    <div className="relative inline-flex items-center">
      {confirming ? (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
            variant === "desktop"
              ? "px-2.5 py-1.5 text-[11px]"
              : "px-3 py-2 text-[12px]",
          )}
        >
          <AlertTriangle size={variant === "desktop" ? 11 : 12} className="text-rose-600" />
          <span className="text-rose-700">Sure?</span>
          <form action={formAction} className="inline-flex">
            <button
              type="submit"
              disabled={pending}
              className="ml-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 disabled:opacity-50"
            >
              {pending ? "…" : "Yes"}
            </button>
          </form>
          <button
            onClick={() => setConfirming(false)}
            className="ml-1 px-2 py-0.5 rounded-md border border-line text-ink-2 text-[11px] hover:bg-paper-2"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
            variant === "desktop"
              ? "px-2.5 py-1.5 text-[11px] text-rose-700 hover:bg-rose-50 border border-rose-200"
              : "px-3 py-2 text-[12px] text-rose-700 hover:bg-rose-50 border border-rose-200",
          )}
          title="Refund order"
        >
          <RotateCcw size={variant === "desktop" ? 11 : 12} />
          Refund
        </button>
      )}

      {showFeedback && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-lg whitespace-nowrap pointer-events-none",
            state.ok
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
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
    </div>
  )
}
