"use client"

import { useActionState } from "react"
import { Percent } from "lucide-react"
import { updateCommissionRateAction } from "@/app/admin/actions"

type State = { ok: boolean; message?: string } | null

export default function CommissionRateInput({
  userId,
  rate,
}: {
  userId: string
  rate: string | null
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev: State, form: FormData) => {
      const val = parseFloat(form.get("rate") as string)
      if (Number.isNaN(val) || val < 0 || val > 100) {
        return { ok: false, message: "Enter 0–100" }
      }
      try {
        await updateCommissionRateAction(userId, val)
        return { ok: true }
      } catch {
        return { ok: false, message: "Failed" }
      }
    },
    null,
  )

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <div className="relative">
        <input
          type="number"
          name="rate"
          defaultValue={rate ?? "8.00"}
          step="0.5"
          min="0"
          max="100"
          className="w-20 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12px] text-ink tabular-nums text-right focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <Percent size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md px-2 py-1.5 text-[11px] font-medium text-blue hover:bg-green-50 disabled:opacity-40 transition-colors"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state && !state.ok && (
        <span className="text-[10px] text-rose-600">{state.message}</span>
      )}
    </form>
  )
}
