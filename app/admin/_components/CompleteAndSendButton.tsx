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
