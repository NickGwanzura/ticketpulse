"use client"

import { useActionState, useEffect, useState } from "react"
import { Send, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { sendTicketsAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function SendTicketsButton({
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
        const result = await sendTicketsAction(orderId)
        const parts: string[] = []
        if (result.success) parts.push("✓ Ticket Generated")
        if (result.emailSent) parts.push("✓ Email Sent")
        if (result.success && result.emailSent) parts.push("✓ Delivery Successful")
        if (result.error) parts.push(`✗ ${result.error}`)
        return { ok: result.success || result.emailSent, message: parts.join(" · ") || "Delivery failed" }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to send tickets"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  useEffect(() => {
    if (state) {
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
            ? "px-2.5 py-1.5 text-[11px] text-blue-700 hover:bg-blue-50 border border-blue-200"
            : "px-3 py-2 text-[12px] text-blue-700 hover:bg-blue-50 border border-blue-200",
        )}
        title="Send tickets to buyer"
      >
        <Send size={variant === "desktop" ? 11 : 12} />
        {pending ? "Sending…" : "Send Tickets"}
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
