"use client"

import { useState } from "react"
import { Pencil, X, Trash2, Ticket, Eye } from "lucide-react"

import TierForm from "./TierForm"
import { deleteTierAction } from "./actions"
import { formatCurrency } from "@/lib/utils"
import SampleTicket from "@/components/SampleTicket"

type Tier = {
  id: string
  name: string
  description: string | null
  price: string
  currency: string | null
  totalQuantity: number
  soldQuantity: number | null
  maxPerOrder: number | null
  salesStart: Date | null
  salesEnd: Date | null
}

function formatWindow(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  if (start && end) return `${fmt(start)} → ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end!)}`
}

export default function TierCard({
  eventId,
  eventTitle,
  tier,
}: {
  eventId: string
  eventTitle: string
  tier: Tier
}) {
  const [editing, setEditing] = useState(false)
  const [showingSample, setShowingSample] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const price = Number.parseFloat(tier.price) || 0
  const sold = tier.soldQuantity ?? 0
  const total = tier.totalQuantity
  const remaining = Math.max(0, total - sold)
  const pct = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0
  const windowLabel = formatWindow(tier.salesStart, tier.salesEnd)

  return (
    <div className="rounded-2xl border border-line bg-paper overflow-hidden">
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-green-50 text-navy">
                <Ticket size={13} />
              </span>
              <p className="text-[15.5px] font-semibold text-ink truncate">{tier.name}</p>
            </div>
            {tier.description && (
              <p className="text-[12.5px] text-ink-2 line-clamp-2">{tier.description}</p>
            )}
          </div>
          <p className="text-[15px] font-bold tracking-tight text-ink whitespace-nowrap">
            {formatCurrency(price, tier.currency ?? "USD")}
          </p>
        </div>

        {sold >= 100 && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-1.5 bg-paper-2 rounded-full overflow-hidden">
              <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[12px] text-ink-3 whitespace-nowrap tabular-nums">
              <span className="text-ink-2 font-medium">{sold.toLocaleString()}</span> sold{" "}·{" "}
              <span className="text-ink-2 font-medium">{remaining.toLocaleString()}</span> left
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3 mb-4">
          <span>Capacity {total.toLocaleString()}</span>
          {tier.maxPerOrder != null && <span>Max per order {tier.maxPerOrder}</span>}
          {windowLabel && <span>{windowLabel}</span>}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-line-2"
          >
            {editing ? <><X size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
          </button>

          <button
            type="button"
            onClick={() => setShowingSample((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-green-200 hover:text-green-700"
          >
            {showingSample ? <><X size={12} /> Close</> : <><Eye size={12} /> Test ticket</>}
          </button>

          {deleteConfirm ? (
            <div className="inline-flex items-center gap-1">
              <span className="text-[10.5px] text-rose-700 font-medium whitespace-nowrap">
                {sold > 0 ? "Also cancels sold tickets — delete?" : "Delete tier?"}
              </span>
              <form action={deleteTierAction}>
                <input type="hidden" name="tierId" value={tier.id} />
                <input type="hidden" name="eventId" value={eventId} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 transition-colors"
                >
                  Yes
                </button>
              </form>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] font-medium text-ink-2 hover:text-ink transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              title="Delete tier"
              className="inline-flex items-center justify-center rounded-lg border border-line bg-paper p-1.5 text-ink-2 hover:text-rose-600 hover:border-rose-200 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="border-t border-line bg-paper-2/40 p-5 md:p-6">
          <TierForm
            eventId={eventId}
            tier={{
              id: tier.id,
              name: tier.name,
              description: tier.description,
              price: tier.price,
              currency: tier.currency,
              totalQuantity: tier.totalQuantity,
              maxPerOrder: tier.maxPerOrder,
              salesStart: tier.salesStart,
              salesEnd: tier.salesEnd,
            }}
            onDone={() => setEditing(false)}
          />
        </div>
      )}

      {showingSample && (
        <SampleTicket
          eventId={eventId}
          eventTitle={eventTitle}
          tier={{
            id: tier.id,
            name: tier.name,
            description: tier.description,
            price: tier.price,
            currency: tier.currency,
          }}
          onClose={() => setShowingSample(false)}
        />
      )}
    </div>
  )
}
