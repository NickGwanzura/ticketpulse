"use client"

import { useActionState, useState } from "react"
import { Calendar, Percent, DollarSign, Infinity } from "lucide-react"
import { cn } from "@/lib/utils"
import { createPromoCodeAction } from "./actions"

export default function PromoCreateForm({ eventId }: { eventId: string }) {
  const [type, setType] = useState<"percent" | "fixed">("percent")

  const boundAction = createPromoCodeAction.bind(null, eventId)
  const [state, formAction, pending] = useActionState(boundAction, { ok: false })

  const inputCls = (hasErr?: boolean) =>
    cn(
      "w-full rounded-lg border bg-paper px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-3 transition",
      "focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-green-500",
      hasErr ? "border-red-400" : "border-line",
    )

  return (
    <form action={formAction} className="space-y-5">
      {state.error && !state.fieldErrors && (
        <p className="text-[12.5px] text-red-500">{state.error}</p>
      )}
      {state.ok && state.message && (
        <p className="text-[12.5px] text-green-600">{state.message}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Code */}
        <div>
          <label className="block text-[12px] font-semibold tracking-tight text-ink-2 mb-1.5">Code</label>
          <input
            name="code"
            required
            maxLength={40}
            placeholder="SUMMER20"
            className={inputCls(!!state.fieldErrors?.code)}
          />
          {state.fieldErrors?.code && (
            <p className="text-[11.5px] text-red-500 mt-1">{state.fieldErrors.code}</p>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-[12px] font-semibold tracking-tight text-ink-2 mb-1.5">Discount type</label>
          <div className="flex rounded-lg border border-line overflow-hidden">
            <button
              type="button"
              onClick={() => setType("percent")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition",
                type === "percent" ? "bg-navy text-white" : "bg-paper text-ink-3 hover:text-ink",
              )}
            >
              <Percent size={13} /> %
            </button>
            <button
              type="button"
              onClick={() => setType("fixed")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition",
                type === "fixed" ? "bg-navy text-white" : "bg-paper text-ink-3 hover:text-ink",
              )}
            >
              <DollarSign size={13} /> Fixed
            </button>
          </div>
          <input type="hidden" name="type" value={type} />
        </div>

        {/* Value */}
        <div>
          <label className="block text-[12px] font-semibold tracking-tight text-ink-2 mb-1.5">
            {type === "percent" ? "Percentage off" : "Amount off"}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">
              {type === "percent" ? "%" : "$"}
            </span>
            <input
              name="value"
              type="number"
              required
              min="0"
              step={type === "percent" ? "1" : "0.01"}
              max={type === "percent" ? "100" : undefined}
              placeholder={type === "percent" ? "20" : "5.00"}
              className={cn(inputCls(!!state.fieldErrors?.value), "pl-8")}
            />
          </div>
        </div>

        {/* Max uses */}
        <div>
          <label className="block text-[12px] font-semibold tracking-tight text-ink-2 mb-1.5">Max uses</label>
          <div className="relative">
            <Infinity size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              name="maxUses"
              type="number"
              min="0"
              placeholder="0 = unlimited"
              className={cn(inputCls(), "pl-8")}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Min purchase */}
        <div>
          <label className="block text-[12px] font-semibold tracking-tight text-ink-2 mb-1.5">Min. purchase amount</label>
          <input
            name="minPurchaseAmount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className={inputCls()}
          />
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-[12px] font-semibold tracking-tight text-ink-2 mb-1.5">
            <Calendar size={12} className="inline mr-1" />
            Expires at (optional)
          </label>
          <input
            name="expiresAt"
            type="datetime-local"
            className={inputCls()}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 active:scale-[0.99] transition disabled:opacity-70"
        >
          {pending ? "Creating…" : "Create promo code"}
        </button>
      </div>
    </form>
  )
}
