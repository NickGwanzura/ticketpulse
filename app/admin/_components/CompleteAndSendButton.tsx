"use client"

import { useActionState, useEffect, useState } from "react"
import { CheckSquare, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeAndSendAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

// Shown in turn while the server works, so the admin can see it is progressing.
const STEPS = ["Confirming payment…", "Generating tickets…", "Sending email…", "Sending WhatsApp…"]

export default function CompleteAndSendButton({
  orderId,
  variant = "desktop",
  action = completeAndSendAction,
  requireReference = false,
  expectedAmount,
  currency = "USD",
}: {
  orderId: string
  variant?: "desktop" | "mobile" | "menu"
  /** Defaults to the admin action; the organizer orders page passes its own. */
  action?: typeof completeAndSendAction
  /** Unpaid gateway order: an admin must enter the Velocity transaction reference. */
  requireReference?: boolean
  /** Order total (gateway fee included), shown so the admin can check the proof against it. */
  expectedAmount?: number
  currency?: string
}) {
  const [open, setOpen] = useState(false)
  const [dismissedState, setDismissedState] = useState<ActionState>(null)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, form: FormData) => {
      try {
        const reference = String(form.get("providerReference") ?? "").trim() || undefined
        const amountRaw = String(form.get("amountReceived") ?? "").trim()
        const amountReceived = amountRaw ? Number(amountRaw) : undefined
        const note = String(form.get("proofNote") ?? "").trim() || undefined
        const result = await action(orderId, reference, requireReference ? { amountReceived, note } : undefined)
        if (result.success) setOpen(false)
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

  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!pending) {
      const reset = setTimeout(() => setStep(0), 0)
      return () => clearTimeout(reset)
    }
    const t = setInterval(() => setStep((i) => Math.min(i + 1, STEPS.length - 1)), 2200)
    return () => clearInterval(t)
  }, [pending])

  return (
    <form action={formAction} className="relative inline-flex items-center gap-1">
      {requireReference && open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Complete order with proof of payment"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onKeyDown={(e) => { if (e.key === "Escape" && !pending) setOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl bg-paper p-5 shadow-xl ring-1 ring-line">
            <h3 className="text-[16px] font-semibold tracking-tight text-ink">Complete with proof of payment</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
              Enter what the customer&apos;s proof shows. The order is released only if the reference has not been used before and the amount covers the order total.
            </p>
            {expectedAmount != null && (
              <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-[12px] text-ink">
                Order total (includes gateway fee): <span className="font-semibold">{currency} {expectedAmount.toFixed(2)}</span>
              </p>
            )}
            <label className="mt-3 block text-[12px] font-semibold text-ink-2" htmlFor={`ref-${orderId}`}>Transaction reference</label>
            <input id={`ref-${orderId}`} name="providerReference" type="text" required minLength={4} autoFocus autoComplete="off"
              placeholder="e.g. EcoCash / bank transaction ID"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-brand-600/30" />
            <label className="mt-3 block text-[12px] font-semibold text-ink-2" htmlFor={`amt-${orderId}`}>Amount shown on the proof ({currency})</label>
            <input id={`amt-${orderId}`} name="amountReceived" type="number" required min="0.01" step="0.01" inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-brand-600/30" />
            <label className="mt-3 block text-[12px] font-semibold text-ink-2" htmlFor={`note-${orderId}`}>Note (optional)</label>
            <input id={`note-${orderId}`} name="proofNote" type="text" maxLength={300} autoComplete="off"
              placeholder="Who sent it, on WhatsApp or email, anything unusual"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-brand-600/30" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)}
                className="rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-ink-2 hover:bg-paper-2 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                {pending ? <><Loader2 size={12} className="animate-spin" /> {STEPS[step]}</> : "Verify, complete & send"}
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        type={requireReference ? "button" : "submit"}
        onClick={requireReference ? () => setOpen(true) : undefined}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
          "relative overflow-hidden disabled:cursor-wait",
          variant === "desktop"
            ? "px-2.5 py-1.5 text-[11px] text-violet-700 hover:bg-violet-50 border border-violet-200"
            : "px-3 py-2 text-[12px] text-violet-700 hover:bg-violet-50 border border-violet-200",
          variant === "menu" && "w-full justify-start",
          pending && "bg-violet-50",
          state?.ok && !pending && showFeedback && "bg-green-50 text-green-700 border-green-200",
        )}
        title="Complete order and send tickets (email and WhatsApp)"
        aria-busy={pending}
      >
        {pending ? (
          <Loader2 size={variant === "desktop" ? 11 : 12} className="animate-spin" />
        ) : state?.ok && showFeedback ? (
          <CheckCircle size={variant === "desktop" ? 11 : 12} className="animate-bounce" />
        ) : (
          <CheckSquare size={variant === "desktop" ? 11 : 12} />
        )}
        <span aria-live="polite">
          {pending ? STEPS[step] : state?.ok && showFeedback ? "Done" : "Complete & Send"}
        </span>
        {pending && (
          <span
            aria-hidden
            className="absolute bottom-0 left-0 h-0.5 bg-violet-500 transition-all duration-[2200ms] ease-linear"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        )}
      </button>

      {showFeedback && (
        // Fixed so a dropdown's overflow can't clip it; errors stay until dismissed.
        <div
          role="alert"
          className={cn(
            "fixed bottom-4 right-4 z-[100] flex max-w-[360px] items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-medium shadow-lg",
            state.ok
              ? "bg-green-50 text-green-700 ring-1 ring-green-200"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
          )}
        >
          {state.ok ? (
            <CheckCircle size={13} className="mt-0.5 shrink-0" />
          ) : (
            <XCircle size={13} className="mt-0.5 shrink-0" />
          )}
          <span className="break-words">{state.message}</span>
          <button
            type="button"
            onClick={() => setDismissedState(state)}
            className="ml-1 shrink-0 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </form>
  )
}
