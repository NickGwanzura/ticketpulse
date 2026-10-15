"use client"

import { useActionState, useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CheckSquare, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { completeAndSendAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

// Shown in turn while the server works, so the admin can see it is progressing.
const STEPS = ["Confirming payment…", "Generating tickets…", "Sending email…", "Sending WhatsApp…"]

/**
 * "Complete & Send" always asks for confirmation in a modal: it marks the order
 * paid and delivers tickets, so it should never fire from a stray tap. The
 * modal is rendered in a portal so it is never clipped by a table row,
 * dropdown menu or card, and it becomes a bottom sheet on phones.
 */
export default function CompleteAndSendButton({
  orderId,
  variant = "desktop",
  action = completeAndSendAction,
  requireReference = false,
  expectedAmount,
  currency = "USD",
  orderLabel,
  customer,
  status,
}: {
  orderId: string
  variant?: "desktop" | "mobile" | "menu"
  /** Defaults to the admin action; the organizer orders page passes its own. */
  action?: typeof completeAndSendAction
  /** Unpaid gateway order: an admin must enter the provider transaction reference. */
  requireReference?: boolean
  /** Order total (gateway fee included), shown so the admin can check the proof against it. */
  expectedAmount?: number
  currency?: string
  /** Short order reference shown in the modal, e.g. "#3df37cff". */
  orderLabel?: string
  customer?: string
  /** Current order status, e.g. "expired". */
  status?: string
}) {
  const [open, setOpen] = useState(false)
  const [dismissedState, setDismissedState] = useState<ActionState>(null)
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

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

  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!pending) {
      const reset = setTimeout(() => setStep(0), 0)
      return () => clearTimeout(reset)
    }
    const t = setInterval(() => setStep((i) => Math.min(i + 1, STEPS.length - 1)), 2200)
    return () => clearInterval(t)
  }, [pending])

  // While the modal is open: lock page scroll and move focus into it.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const focusTimer = setTimeout(() => (firstFieldRef.current ?? confirmRef.current)?.focus(), 0)
    return () => {
      document.body.style.overflow = previous
      clearTimeout(focusTimer)
    }
  }, [open])

  const openModal = () => {
    setDismissedState(state) // forget the previous attempt's message
    setOpen(true)
  }
  const closeModal = () => { if (!pending) setOpen(false) }

  // Escape closes the modal wherever focus is (it can drop to <body> after a failed submit).
  useEffect(() => {
    if (!open || pending) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, pending])

  const error = open && state && !state.ok && state !== dismissedState ? state.message : null
  // Success toasts show once the modal has closed; failures stay inside the modal.
  const showToast = !open && state && state !== dismissedState
  const wasExpired = status === "expired"
  const canPortal = typeof document !== "undefined"

  return (
    <span className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={openModal}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors",
          "relative overflow-hidden disabled:cursor-wait",
          variant === "desktop"
            ? "px-2.5 py-1.5 text-[11px] text-violet-700 hover:bg-violet-50 border border-violet-200"
            : "px-3 py-2 text-[12px] text-violet-700 hover:bg-violet-50 border border-violet-200",
          variant === "menu" && "w-full justify-start",
          pending && "bg-violet-50",
          state?.ok && !pending && showToast && "bg-green-50 text-green-700 border-green-200",
        )}
        title="Complete order and send tickets (email and WhatsApp)"
        aria-haspopup="dialog"
        aria-busy={pending}
      >
        {pending ? (
          <Loader2 size={variant === "desktop" ? 11 : 12} className="animate-spin" />
        ) : state?.ok && showToast ? (
          <CheckCircle size={variant === "desktop" ? 11 : 12} />
        ) : (
          <CheckSquare size={variant === "desktop" ? 11 : 12} />
        )}
        <span aria-live="polite">{pending ? STEPS[step] : state?.ok && showToast ? "Done" : "Complete & Send"}</span>
      </button>

      {open && canPortal && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            e.stopPropagation() // keep a parent menu from treating modal clicks as outside clicks
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <form
            action={formAction}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-paper shadow-2xl ring-1 ring-line sm:rounded-2xl"
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <h3 id={titleId} className="text-[17px] font-semibold tracking-tight text-ink">Complete this order</h3>

              <dl className="mt-3 space-y-1.5 rounded-xl bg-paper-2 px-3.5 py-3 text-[13px]">
                {orderLabel && (
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Order</dt><dd className="font-mono font-medium text-ink">{orderLabel}</dd></div>
                )}
                {customer && (
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Customer</dt><dd className="truncate font-medium text-ink">{customer}</dd></div>
                )}
                {status && (
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Status now</dt><dd className="font-medium capitalize text-ink">{status.replace(/_/g, " ")}</dd></div>
                )}
                {expectedAmount != null && (
                  <div className="flex justify-between gap-3"><dt className="text-ink-3">Order total</dt><dd className="font-semibold text-ink">{currency} {expectedAmount.toFixed(2)}</dd></div>
                )}
              </dl>

              <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-3">What happens next</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-snug text-ink-2">
                <li>The order is marked paid and recorded in the payment ledger.</li>
                {wasExpired && <li>Its tickets are put back into stock (this fails if they have sold out).</li>}
                <li>Tickets are generated and sent to the customer by email and WhatsApp.</li>
              </ul>

              {requireReference && (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  <p className="text-[12px] leading-relaxed text-ink-2">
                    Enter what the customer&apos;s proof of payment shows. The order is released only if the reference has not been used before and the amount covers the order total.
                  </p>
                  <div>
                    <label className="block text-[12px] font-semibold text-ink-2" htmlFor={`${titleId}-ref`}>Transaction reference</label>
                    <input ref={firstFieldRef} id={`${titleId}-ref`} name="providerReference" type="text" required minLength={4} autoComplete="off"
                      placeholder="e.g. EcoCash / bank transaction ID"
                      className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-600/30" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-ink-2" htmlFor={`${titleId}-amt`}>Amount shown on the proof ({currency})</label>
                    <input id={`${titleId}-amt`} name="amountReceived" type="number" required min="0.01" step="0.01" inputMode="decimal"
                      className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-600/30" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-ink-2" htmlFor={`${titleId}-note`}>Note (optional)</label>
                    <input id={`${titleId}-note`} name="proofNote" type="text" maxLength={300} autoComplete="off"
                      placeholder="Who sent it, on WhatsApp or email, anything unusual"
                      className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-600/30" />
                  </div>
                </div>
              )}

            </div>

            {error && (
              <p role="alert" className="mx-5 mb-2 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 ring-1 ring-rose-200">
                <XCircle size={14} className="mt-0.5 shrink-0" /> <span className="break-words">{error}</span>
              </p>
            )}

            <div className="flex gap-2 border-t border-line bg-paper px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={pending}
                onClick={closeModal}
                className="min-h-11 flex-1 rounded-xl border border-line px-4 text-[14px] font-medium text-ink-2 hover:bg-paper-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-[14px] font-semibold text-white hover:bg-violet-700 disabled:cursor-wait disabled:opacity-70"
              >
                {pending ? (<><Loader2 size={14} className="animate-spin" /> {STEPS[step]}</>) : requireReference ? "Verify, complete & send" : "Complete & send"}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}

      {showToast && state && (
        // Fixed so a dropdown's overflow can't clip it; dismissable.
        <div
          role="alert"
          className={cn(
            "fixed bottom-4 right-4 z-[100] flex max-w-[360px] items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-medium shadow-lg",
            state.ok
              ? "bg-green-50 text-green-700 ring-1 ring-green-200"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
          )}
        >
          {state.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
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
    </span>
  )
}
