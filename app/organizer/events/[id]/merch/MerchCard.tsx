"use client"

import { useState } from "react"
import { Pencil, X, Trash2, Power } from "lucide-react"

import MerchForm from "./MerchForm"
import { deleteMerchAction, toggleMerchActiveAction } from "./actions"
import { formatCurrency } from "@/lib/utils"

type Merch = {
  id: string
  name: string
  description: string | null
  price: string
  currency: string | null
  images: string[] | null
  sizes: string[] | null
  colors: string[] | null
  stockQuantity: number | null
  soldQuantity: number | null
  active: boolean | null
  deliveryAvailable: boolean | null
  pickupAtEvent: boolean | null
}

export default function MerchCard({ eventId, merch }: { eventId: string; merch: Merch }) {
  const [editing, setEditing] = useState(false)
  const primary = merch.images?.[0]
  const price = Number.parseFloat(merch.price) || 0

  return (
    <div className="rounded-2xl border border-line bg-paper overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-44 aspect-square shrink-0 bg-paper-2">
          {primary ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primary} alt={merch.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[12px] text-ink-3">No image</div>
          )}
        </div>
        <div className="flex-1 p-5 md:p-6 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[15px] font-semibold text-ink truncate">{merch.name}</p>
                <span className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${merch.active ? "bg-green-50 text-green-700" : "bg-paper-2 text-ink-2 ring-1 ring-line"}`}>
                  {merch.active ? "Active" : "Hidden"}
                </span>
              </div>
              {merch.description && (
                <p className="text-[13px] text-ink-2 line-clamp-2">{merch.description}</p>
              )}
            </div>
            <p className="text-[15px] font-bold tracking-tight text-ink whitespace-nowrap">
              {formatCurrency(price, merch.currency ?? "USD")}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3 mb-4">
            <span><span className="text-ink-2 font-medium">{merch.stockQuantity ?? 0}</span> in stock</span>
            <span><span className="text-ink-2 font-medium">{merch.soldQuantity ?? 0}</span> sold</span>
            {(merch.sizes?.length ?? 0) > 0 && <span>Sizes: {merch.sizes!.join(", ")}</span>}
            {(merch.colors?.length ?? 0) > 0 && <span>Colors: {merch.colors!.join(", ")}</span>}
            {merch.pickupAtEvent && <span>Pickup at event</span>}
            {merch.deliveryAvailable && <span>Delivery</span>}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-ink hover:border-line-2"
            >
              {editing ? <><X size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
            </button>

            <form action={toggleMerchActiveAction}>
              <input type="hidden" name="merchId" value={merch.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="next" value={(!merch.active).toString()} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-ink hover:border-line-2"
              >
                <Power size={12} /> {merch.active ? "Hide" : "Make active"}
              </button>
            </form>

            <form
              action={deleteMerchAction}
              onSubmit={(e) => {
                if (!confirm(`Delete "${merch.name}"?`)) e.preventDefault()
              }}
            >
              <input type="hidden" name="merchId" value={merch.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <button
                type="submit"
                title="Delete merch"
                className="inline-flex items-center justify-center rounded-lg border border-line bg-paper p-1.5 text-ink-2 hover:text-rose-600 hover:border-rose-200"
              >
                <Trash2 size={13} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {editing && (
        <div className="border-t border-line bg-paper-2/40 p-5 md:p-6">
          <MerchForm
            eventId={eventId}
            merch={{
              id: merch.id,
              name: merch.name,
              description: merch.description,
              price: merch.price,
              currency: merch.currency,
              images: merch.images,
              sizes: merch.sizes,
              colors: merch.colors,
              stockQuantity: merch.stockQuantity,
              active: merch.active,
              deliveryAvailable: merch.deliveryAvailable,
              pickupAtEvent: merch.pickupAtEvent,
            }}
            onDone={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  )
}
