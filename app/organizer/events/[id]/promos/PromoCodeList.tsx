"use client"

import { useActionState } from "react"
import { Tag, ToggleLeft, ToggleRight, Trash2, Calendar, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { togglePromoCodeAction, deletePromoCodeAction } from "./actions"

type PromoCode = {
  id: string
  eventId: string
  code: string
  type: "percent" | "fixed"
  value: string
  maxUses: number
  usedCount: number
  minPurchaseAmount: string
  expiresAt: string | null
  active: boolean
  createdAt: string
}

export default function PromoCodeList({ codes, eventId }: { codes: PromoCode[]; eventId: string }) {
  return (
    <div className="space-y-3">
      {codes.map((code) => (
        <PromoCodeRow key={code.id} code={code} eventId={eventId} />
      ))}
    </div>
  )
}

function PromoCodeRow({ code, eventId }: { code: PromoCode; eventId: string }) {
  const [, toggleAction, togglePending] = useActionState(
    togglePromoCodeAction.bind(null, code.id, eventId),
    undefined,
  )
  const [, deleteAction, deletePending] = useActionState(
    deletePromoCodeAction.bind(null, code.id, eventId),
    undefined,
  )

  const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date()
  const isMaxed = code.maxUses > 0 && code.usedCount >= code.maxUses
  const isInactive = !code.active || isExpired || isMaxed

  const discountLabel =
    code.type === "percent" ? `${code.value}% off` : `$${Number(code.value).toFixed(2)} off`

  const usageLabel =
    code.maxUses > 0 ? `${code.usedCount}/${code.maxUses} used` : `${code.usedCount} used · unlimited`

  return (
    <div
      className={cn(
        "rounded-xl border bg-paper p-4 md:p-5 transition",
        isInactive ? "border-red-200 bg-red-50/30" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={cn(
              "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
              isInactive ? "bg-red-100" : "bg-blue/10",
            )}
          >
            <Tag size={15} className={isInactive ? "text-red-500" : "text-blue"} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[14px] font-bold tracking-tight text-ink">{code.code}</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                  code.type === "percent"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-indigo-100 text-indigo-700",
                )}
              >
                {discountLabel}
              </span>
              {isExpired && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10.5px] font-semibold text-red-600">
                  Expired
                </span>
              )}
              {isMaxed && !isExpired && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10.5px] font-semibold text-orange-600">
                  Maxed out
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
              <span className="inline-flex items-center gap-1">
                <Users size={12} />
                {usageLabel}
              </span>
              {code.minPurchaseAmount && Number(code.minPurchaseAmount) > 0 && (
                <span>Min. ${Number(code.minPurchaseAmount).toFixed(2)}</span>
              )}
              {code.expiresAt && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} />
                  Expires {new Date(code.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle active */}
          <form action={toggleAction}>
            <button
              type="submit"
              disabled={togglePending}
              title={code.active ? "Deactivate" : "Activate"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition",
                code.active
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-ink/5 text-ink-3 hover:bg-ink/10",
              )}
            >
              {code.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {code.active ? "Active" : "Inactive"}
            </button>
          </form>

          {/* Delete */}
          <form action={deleteAction}>
            <button
              type="submit"
              disabled={deletePending}
              title="Delete promo code"
              className="flex items-center justify-center rounded-lg px-3 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50 transition"
            >
              <Trash2 size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
