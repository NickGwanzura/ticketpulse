"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useActionState, useEffect, useState } from "react"
import { Mail, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { resendOrderEmailAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function ResendButton({
  orderId,
  status,
  variant = "desktop",
}: {
  orderId: string
  status: string
  variant?: "desktop" | "mobile" | "menu"
}) {
  const [dismissed, setDismissed] = useState(false)

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev: ActionState, _form: FormData) => {
      try {
        await resendOrderEmailAction(orderId)
        return { ok: true, message: "Email sent!" }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to send email"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  // Auto-dismiss success after 4 seconds
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setDismissed(true), 4000)
      return () => clearTimeout(t)
    }
    setDismissed(false)
  }, [state])

  const showFeedback = state && !dismissed

  const label =
    status === "paid" ? "Resend confirmation" : "Resend verification"

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
          variant === "menu" && "w-full justify-start",
        )}
        title={label}
      >
        <Mail size={variant === "desktop" ? 11 : 12} className="shrink-0" />
        {pending ? "Sending…" : "Resend"}
      </button>

      {/* Inline toast — appears above the button so it doesn't overlap adjacent actions */}
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
