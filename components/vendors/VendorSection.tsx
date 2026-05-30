"use client"
import { UtensilsCrossed, Star, CheckCircle, Lock, Plus, Minus, ShoppingCart } from "lucide-react"
import { useCart } from "@/lib/cart-context"
import { formatCurrency, vendorCategoryLabel } from "@/lib/utils"
import type { VendorListing } from "@/types"

interface VendorSectionProps {
  listings: VendorListing[]
  eventId: string
  eventSlug: string
  eventTitle: string
  isOrganizer: boolean
}

export default function VendorSection({ listings, eventId, eventSlug, eventTitle, isOrganizer }: VendorSectionProps) {
  const { items, addItem, updateQty } = useCart()
  if (!listings.length) return null

  const available = listings.filter((l) => !l.booked)
  const booked = listings.filter((l) => l.booked)

  // For ticket buyers, the addon qty is tracked in the cart (max 1 per listing)
  const cartAddon = (listingId: string) =>
    items.find((i) => i.kind === "vendor_addon" && i.listingId === listingId) as (typeof items)[number] | undefined

  const handleAdd = (listing: VendorListing) => {
    addItem({
      kind: "vendor_addon",
      listingId: listing.id,
      vendorName: listing.vendor.businessName,
      packageName: listing.packageName,
      category: listing.vendor.category,
      eventSlug,
      eventTitle,
      price: listing.price,
      currency: listing.currency,
      qty: 1,
    })
  }

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15">
          <UtensilsCrossed size={16} className="text-brand-600" />
        </span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Vendors and Caterers</p>
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">Enhance your experience</h2>
        </div>
        {!isOrganizer && (
          <span className="ml-auto text-[10px] text-ink-3 border border-line rounded-full px-2.5 py-1">
            Optional add-ons
          </span>
        )}
      </div>

      {available.length > 0 && (
        <div className="mb-6">
          {!isOrganizer && (
            <p className="text-xs text-ink-3 mb-3">
              Add catering, photography, and more to your order.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {available.map((listing) => {
              const inCart = cartAddon(listing.id)
              return (
                <div
                  key={listing.id}
                  className={`rounded-2xl border bg-paper p-5 transition-colors ${
                    inCart ? "border-blue/40 ring-2 ring-green-500/15" : "border-line hover:border-line-2"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-paper-2 ring-1 ring-line flex items-center justify-center text-lg shrink-0">
                      🍽️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-semibold tracking-tight text-ink truncate">{listing.vendor.businessName}</span>
                        {listing.vendor.verified && (
                          <CheckCircle size={12} className="text-brand-600 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-ink-2 mb-2">
                        <span className="bg-paper-2 border border-line px-2 py-0.5 rounded-full">
                          {vendorCategoryLabel(listing.vendor.category)}
                        </span>
                        {listing.vendor.rating && (
                          <span className="flex items-center gap-0.5 text-ink-2">
                            <Star size={10} className="text-amber-500 fill-amber-500" />
                            {Number(listing.vendor.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-[13.5px] font-medium text-ink">{listing.packageName}</p>
                      {listing.packageDescription && (
                        <p className="text-xs text-ink-2 mt-0.5 line-clamp-2">{listing.packageDescription}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[14px] font-bold tracking-tight text-ink">
                        {formatCurrency(listing.price, listing.currency)}
                      </div>

                      {isOrganizer && (
                        <button className="mt-2 text-[11px] bg-brand-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-700 transition-colors">
                          Book slot
                        </button>
                      )}

                      {!isOrganizer && !inCart && (
                        <button
                          onClick={() => handleAdd(listing)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] bg-brand-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-700 active:scale-[0.97] transition"
                        >
                          <Plus size={11} /> Add to cart
                        </button>
                      )}

                      {!isOrganizer && inCart && (
                        <div className="mt-2 inline-flex items-center gap-1">
                          <button
                            onClick={() => updateQty(inCart.key, inCart.qty - 1)}
                            className="w-7 h-7 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 flex items-center justify-center transition"
                            aria-label="Remove addon"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="text-xs font-semibold w-5 text-center text-ink tabular-nums">
                            {inCart.qty}
                          </span>
                          <button
                            onClick={() => updateQty(inCart.key, inCart.qty + 1)}
                            className="w-7 h-7 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 flex items-center justify-center transition"
                            aria-label="Increase addon"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            )}
          </div>
        </div>
      )}

      {booked.length > 0 && (
        <div>
          <p className="text-xs text-ink-3 mb-3 flex items-center gap-1.5">
            <Lock size={10} /> {booked.length} slot{booked.length > 1 ? "s" : ""} booked
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {booked.map((listing) => (
              <div key={listing.id} className="rounded-2xl border border-line bg-paper-2 p-4 opacity-80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-paper ring-1 ring-line flex items-center justify-center text-lg">🍽️</div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{listing.vendor.businessName}</p>
                    <p className="text-xs text-ink-2">{listing.packageName}</p>
                  </div>
                  <span className="ml-auto text-[10px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Booked</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
