"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, Users, Building2 } from "lucide-react"
import { PLATFORM_FEE_PERCENT } from "@/lib/platform-fee"
import { updateAbsorbFeeAction } from "../actions"

interface FeeSwitcherProps {
  eventId: string
  currentlyAbsorb: boolean
}

export default function FeeSwitcher({ eventId, currentlyAbsorb }: FeeSwitcherProps) {
  const [absorb, setAbsorb] = useState(currentlyAbsorb)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const feeRate = PLATFORM_FEE_PERCENT / 100
  const examplePrice = 10
  const exampleFee = Number((examplePrice * feeRate).toFixed(2))
  const exampleBuyerPays = Number((examplePrice + exampleFee).toFixed(2))
  const exampleOrganizerReceives = Number((examplePrice - exampleFee).toFixed(2))

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateAbsorbFeeAction(eventId, absorb)
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error ?? "Something went wrong.")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Current status note */}
      <p className="text-[13px] text-ink-2 rounded-xl border border-line bg-paper-2 px-4 py-3">
        {currentlyAbsorb
          ? "Currently: You absorb the fee — buyers see the clean ticket price."
          : "Currently: Buyers pay — the platform fee is added on top at checkout."}
      </p>

      {/* Option cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Option 1: Buyer pays */}
        <button
          type="button"
          onClick={() => setAbsorb(false)}
          className={`relative flex flex-col gap-3 rounded-xl border p-5 text-left transition-all ${
            !absorb
              ? "border-ink bg-paper ring-2 ring-ink/10"
              : "border-line bg-paper hover:border-line-2 hover:bg-paper-2"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex w-8 h-8 items-center justify-center rounded-lg ${!absorb ? "bg-ink text-white" : "bg-paper-2 text-ink-3"}`}>
                <Users size={15} />
              </span>
              <p className="text-[14px] font-semibold text-ink">Buyer pays fees</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-paper-2 text-ink-3 ring-1 ring-line">
                Default
              </span>
              {!absorb && (
                <CheckCircle2 size={16} className="text-ink shrink-0" />
              )}
            </div>
          </div>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            The {PLATFORM_FEE_PERCENT}% platform fee is added on top of your ticket price. Buyers see the total at checkout.
          </p>
          <div className="rounded-lg bg-paper-2 px-3 py-2.5 text-[12px] text-ink-3 border border-line">
            For a ${examplePrice} ticket, buyer pays{" "}
            <span className="font-semibold text-ink">${exampleBuyerPays}</span>
          </div>
        </button>

        {/* Option 2: You absorb */}
        <button
          type="button"
          onClick={() => setAbsorb(true)}
          className={`relative flex flex-col gap-3 rounded-xl border p-5 text-left transition-all ${
            absorb
              ? "border-ink bg-paper ring-2 ring-ink/10"
              : "border-line bg-paper hover:border-line-2 hover:bg-paper-2"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex w-8 h-8 items-center justify-center rounded-lg ${absorb ? "bg-ink text-white" : "bg-paper-2 text-ink-3"}`}>
                <Building2 size={15} />
              </span>
              <p className="text-[14px] font-semibold text-ink">You absorb fees</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {absorb && (
                <>
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                    Active
                  </span>
                  <CheckCircle2 size={16} className="text-ink shrink-0" />
                </>
              )}
            </div>
          </div>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            The fee is deducted from your payout. Buyers see the clean ticket price at checkout.
          </p>
          <div className="rounded-lg bg-paper-2 px-3 py-2.5 text-[12px] text-ink-3 border border-line">
            For a ${examplePrice} ticket, buyer pays{" "}
            <span className="font-semibold text-ink">${examplePrice}</span>,
            you receive <span className="font-semibold text-ink">${exampleOrganizerReceives}</span>
          </div>
        </button>
      </div>

      {/* Save controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || absorb === currentlyAbsorb}
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-ink/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
            <CheckCircle2 size={14} /> Saved
          </span>
        )}
        {error && (
          <span className="text-[13px] text-rose-600">{error}</span>
        )}
      </div>
    </div>
  )
}
