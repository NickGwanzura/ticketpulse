"use client"
import { UtensilsCrossed, Star, CheckCircle, Lock } from "lucide-react"
import { formatCurrency, vendorCategoryLabel } from "@/lib/utils"
import type { VendorListing } from "@/types"

interface VendorSectionProps {
  listings: VendorListing[]
  isOrganizer: boolean
}

export default function VendorSection({ listings, isOrganizer }: VendorSectionProps) {
  if (!listings.length) return null

  const available = listings.filter((l) => !l.booked)
  const booked = listings.filter((l) => l.booked)

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15">
          <UtensilsCrossed size={16} className="text-blue" />
        </span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Vendors and Caterers</p>
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">Event vendor slots</h2>
        </div>
        {!isOrganizer && (
          <span className="ml-auto text-xs text-ink-3 border border-line rounded-full px-3 py-1">
            Organizers can book
          </span>
        )}
      </div>

      {available.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-ink-3 mb-3">{available.length} slot{available.length > 1 ? "s" : ""} available</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {available.map((listing) => (
              <div key={listing.id} className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-paper-2 ring-1 ring-line flex items-center justify-center text-lg shrink-0">
                    🍽️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold tracking-tight text-ink truncate">{listing.vendor.businessName}</span>
                      {listing.vendor.verified && (
                        <CheckCircle size={12} className="text-emerald-600 shrink-0" />
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
                      <button className="mt-2 text-[11px] bg-navy text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-navy-700 transition-colors">
                        Book slot
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                  <span className="ml-auto text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Booked</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
