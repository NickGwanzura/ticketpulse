"use client"

import { useActionState, useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { refundOrderAction, type RefundMethod } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function RefundButton({
  orderId,
  variant = "desktop",
}: {
  orderId: string
  variant?: "desktop" | "mobile" | "menu"
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [dismissedState, setDismissedState] = useState<ActionState>(null)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, form: FormData) => {
      try {
        await refundOrderAction(orderId, {
          method: String(form.get("method") ?? "") as RefundMethod,
          reference: String(form.get("reference") ?? ""),
          reason: String(form.get("reason") ?? ""),
        })
        return { ok: true, message: "Marked refunded. Buyer emailed." }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to refund"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  // Track state transitions so we can reset `confirming` after
  // the action completes.
  const prevStateRef = useRef(state)
  useEffect(() => {
    if (state && state !== prevStateRef.current) {
      setConfirming(false)
    }
    prevStateRef.current = state
  }, [state])

  // Refresh the page after a successful refund so the table
  // reflects the current database state.
  useEffect(() => {
    if (state?.ok) {
      router.refresh()
    }
  }, [state, router])

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setDismissedState(state), 4000)
      return () => clearTimeout(t)
    }
  }, [state])

  const showFeedback = state && state !== dismissedState

  return (
    <div className="relative inline-flex items-center">
      {confirming ? (
        <form
          action={formAction}
          className="absolute right-0 top-full z-30 mt-1.5 w-64 space-y-2 rounded-xl border border-line bg-paper p-3 text-left shadow-lg"
        >
          <p className="flex items-start gap-1.5 text-[12px] font-semibold text-rose-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Send the money back first
          </p>
          <p className="text-[11px] leading-snug text-ink-3">
            This only records the refund, voids the tickets, and emails the buyer. Return the money in Velocity, EcoCash, or your bank before confirming.
          </p>
          <select name="method" required defaultValue="" aria-label="How the money was returned" className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[12px] text-ink">
            <option value="" disabled>How was it returned?</option>
            <option value="ecocash">EcoCash</option>
            <option value="card">Card (Velocity)</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
          </select>
          <input name="reference" required minLength={3} aria-label="Refund reference" placeholder="Refund reference" className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[12px] text-ink placeholder:text-ink-3/60" />
          <input name="reason" aria-label="Reason (optional)" placeholder="Reason (optional)" className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[12px] text-ink placeholder:text-ink-3/60" />
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-md bg-rose-600 px-2 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Mark refunded"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-line px-2 py-1.5 text-[12px] text-ink-2 hover:bg-paper-2"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
            variant === "desktop"
              ? "px-2.5 py-1.5 text-[11px] text-rose-700 hover:bg-rose-50 border border-rose-200"
              : "px-3 py-2 text-[12px] text-rose-700 hover:bg-rose-50 border border-rose-200",
            variant === "menu" && "w-full justify-start",
          )}
          title="Record a refund you have already sent"
        >
          <RotateCcw size={variant === "desktop" ? 11 : 12} />
          Mark refunded
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
