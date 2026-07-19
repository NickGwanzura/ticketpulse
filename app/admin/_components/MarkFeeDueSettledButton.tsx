"use client"

import { useActionState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { markFeeDueSettledAction } from "@/app/admin/actions/orders"

type ActionState = { ok: boolean; message: string } | null

export default function MarkFeeDueSettledButton({ feeDueId }: { feeDueId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async () => {
      try {
        await markFeeDueSettledAction(feeDueId)
        return { ok: true, message: "Marked settled" }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to mark settled"
        return { ok: false, message: msg }
      }
    },
    null,
  )

  return (
    <form action={formAction} className="relative inline-flex items-center">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-green-700 hover:bg-brand-50 border border-brand-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <CheckCircle2 size={11} />
        {pending ? "Saving…" : "Mark settled"}
      </button>

      {state && !state.ok && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-20 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium shadow-lg whitespace-nowrap bg-rose-50 text-rose-700 ring-1 ring-rose-200">
          <XCircle size={11} className="shrink-0" />
          {state.message}
        </div>
      )}
    </form>
  )
}
