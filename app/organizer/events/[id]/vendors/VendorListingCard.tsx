"use client"

import { useState } from "react"
import { Pencil, X, Trash2, Power, Store } from "lucide-react"

import { formatCurrency, vendorCategoryLabel } from "@/lib/utils"
import {
  removeVendorListingAction,
  toggleVendorListingAvailableAction,
  updateVendorListingAction,
  type VendorListingFormState,
} from "./actions"
import { useFormStatus } from "react-dom"
import { useActionState } from "react"
import Button from "@/components/ui/Button"

const CURRENCIES = ["USD"]

type ListingVendor = {
  businessName: string
  category: "catering" | "bar" | "food_truck" | "photography" | "sound" | "security" | "decor" | "other"
  logo: string | null
  verified: boolean
  rating: number | null
}

type Listing = {
  id: string
  vendorId: string
  packageName: string
  packageDescription: string | null
  price: string
  currency: string
  maxCapacity: number | null
  available: boolean
  booked: boolean
  vendor: ListingVendor
}

function UpdateSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} size="sm">
      <Pencil size={13} /> {pending ? "Saving…" : "Save"}
    </Button>
  )
}

export default function VendorListingCard({
  eventId,
  listing,
}: {
  eventId: string
  listing: Listing
}) {
  const [editing, setEditing] = useState(false)
  const [state, formAction] = useActionState(updateVendorListingAction, { ok: true })
  const price = Number.parseFloat(listing.price) || 0

  return (
    <div className="rounded-2xl border border-line bg-paper overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Vendor avatar */}
        <div className="relative w-full sm:w-28 aspect-square shrink-0 bg-paper-2 grid place-items-center">
          {listing.vendor.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy"
              src={listing.vendor.logo}
              alt={listing.vendor.businessName}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <Store size={28} className="text-ink-3" />
          )}
        </div>

        <div className="flex-1 p-5 md:p-6 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[15px] font-semibold text-ink truncate">
                  {listing.packageName}
                </p>
                <span
                  className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${
                    listing.available && !listing.booked
                      ? "bg-green-50 text-green-700"
                      : listing.booked
                        ? "bg-amber-50 text-amber-700"
                        : "bg-paper-2 text-ink-2 ring-1 ring-line"
                  }`}
                >
                  {listing.booked ? "Booked" : listing.available ? "Active" : "Hidden"}
                </span>
              </div>
              <p className="text-[13px] text-ink-2">
                {listing.vendor.businessName}
                {listing.vendor.verified && (
                  <span className="ml-1 text-brand-600">✓ Verified</span>
                )}
                <span className="mx-1.5 text-ink-3">·</span>
                {vendorCategoryLabel(listing.vendor.category)}
                {listing.vendor.rating !== null && (
                  <>
                    <span className="mx-1.5 text-ink-3">·</span>
                    ★ {listing.vendor.rating.toFixed(1)}
                  </>
                )}
              </p>
              {listing.packageDescription && (
                <p className="text-[13px] text-ink-2 mt-1 line-clamp-2">
                  {listing.packageDescription}
                </p>
              )}
            </div>
            <p className="text-[15px] font-bold tracking-tight text-ink whitespace-nowrap">
              {formatCurrency(price, listing.currency)}
            </p>
          </div>

          {listing.maxCapacity && (
            <p className="text-[12px] text-ink-3 mb-3">
              Max <span className="text-ink-2 font-medium">{listing.maxCapacity}</span> buyers
            </p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setEditing((v) => !v)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-ink hover:border-line-2"
            >
              {editing ? <><X size={12} /> Cancel</> : <><Pencil size={12} /> Edit</>}
            </button>

            <form
              action={toggleVendorListingAvailableAction}
              onSubmit={() => setEditing(false)}
            >
              <input type="hidden" name="listingId" value={listing.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <input
                type="hidden"
                name="next"
                value={listing.available && !listing.booked ? "false" : "true"}
              />
              <button
                type="submit"
                disabled={listing.booked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-ink hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Power size={12} />
                {listing.booked ? "Booked" : listing.available ? "Hide" : "Show"}
              </button>
            </form>

            <form action={removeVendorListingAction}>
              <input type="hidden" name="listingId" value={listing.id} />
              <input type="hidden" name="eventId" value={eventId} />
              <button
                type="submit"
                onClick={(e) => {
                  if (!confirm("Remove this vendor listing from the event?")) {
                    e.preventDefault()
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-rose-600 hover:border-rose-300"
              >
                <Trash2 size={12} /> Remove
              </button>
            </form>
          </div>

          {/* Inline edit form */}
          {editing && (
            <form action={formAction} className="mt-4 pt-4 border-t border-line space-y-3">
              <input type="hidden" name="listingId" value={listing.id} />
              <input type="hidden" name="eventId" value={eventId} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">
                    Package name
                  </label>
                  <input
                    name="packageName"
                    defaultValue={listing.packageName}
                    required
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[12px] font-medium text-ink mb-1">Price</label>
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={listing.price}
                      required
                      className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-ink mb-1">Currency</label>
                    <select
                      name="currency"
                      defaultValue={listing.currency}
                      className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink mb-1">Description</label>
                <textarea
                  name="packageDescription"
                  rows={2}
                  defaultValue={listing.packageDescription ?? ""}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-ink mb-1">Max capacity</label>
                  <input
                    name="maxCapacity"
                    type="number"
                    min="1"
                    defaultValue={listing.maxCapacity ?? ""}
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-brand-500/15"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      name="available"
                      value="on"
                      defaultChecked={listing.available && !listing.booked}
                      disabled={listing.booked}
                      className="rounded border-line text-navy focus:ring-navy/30"
                    />
                    Available for purchase
                  </label>
                </div>
              </div>

              {state.error && (
                <p className="text-[13px] text-rose-600">{state.error}</p>
              )}

              {state.ok && state.message && (
                <p className="text-[13px] text-brand-600">{state.message}</p>
              )}

              <div className="flex items-center gap-2">
                <UpdateSubmitButton />
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
