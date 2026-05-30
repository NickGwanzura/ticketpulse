"use client"

import { useActionState, useEffect, useState } from "react"
import { TicketCheck, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { deliverTicketAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function DeliverButton({
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
        const result = await deliverTicketAction(orderId)
        if (result.success) {
          return { ok: true, message: `Delivered (${result.ticketCount} tickets, email: ${result.emailSent ? "yes" : "no"})` }
        }
        return { ok: false, message: result.error ?? "Delivery failed" }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Delivery failed"
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
          "inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variant === "desktop"
            ? "px-2.5 py-1.5 text-[11px]"
            : "px-3 py-2 text-[12px]",
        )}
        title="Deliver tickets"
      >
        <TicketCheck size={variant === "desktop" ? 11 : 12} />
        {pending ? "Delivering…" : "Deliver"}
      </button>

      {showFeedback && (
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-lg whitespace-nowrap pointer-events-none",
            state.ok
              ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
              : "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
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
