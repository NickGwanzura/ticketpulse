"use client"

import { useState, useActionState, useMemo } from "react"
import { Plus, X, Search, Store } from "lucide-react"
import { useFormStatus } from "react-dom"

import Button from "@/components/ui/Button"
import { vendorCategoryLabel } from "@/lib/utils"
import { addVendorListingAction, type VendorListingFormState } from "./actions"

const CURRENCIES = ["USD", "ZWL", "ZAR"]

type MarketplaceVendor = {
  id: string
  businessName: string
  category: string
  logo: string | null
  verified: boolean | null
  rating: string | null
  city: string | null
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" loading={pending} size="md">
      <Plus size={14} /> {pending ? "Adding…" : "Add to event"}
    </Button>
  )
}

export default function AddVendorPanel({
  eventId,
  vendors,
}: {
  eventId: string
  vendors: MarketplaceVendor[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedVendor, setSelectedVendor] = useState<MarketplaceVendor | null>(null)
  const [state, formAction] = useActionState(addVendorListingAction, { ok: true })

  const filtered = useMemo(() => {
    if (!search.trim()) return vendors
    const q = search.toLowerCase()
    return vendors.filter(
      (v) =>
        v.businessName.toLowerCase().includes(q) ||
        vendorCategoryLabel(v.category).toLowerCase().includes(q) ||
        (v.city ?? "").toLowerCase().includes(q),
    )
  }, [vendors, search])

  const handleVendorSelect = (v: MarketplaceVendor) => {
    setSelectedVendor(v)
    setSearch("")
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-2/40 p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[14.5px] font-semibold text-ink">Vendors from marketplace</p>
          <p className="text-[12.5px] text-ink-2 mt-0.5">
            Browse vendors on TicketPulse and add them as optional add-ons for this event.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            setSelectedVendor(null)
            setSearch("")
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-green-700 transition"
        >
          {open ? <><X size={13} /> Close</> : <><Plus size={13} /> Add vendor</>}
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-line bg-paper p-5 mt-3 space-y-4">
          {!selectedVendor ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type="text"
                  placeholder="Search vendors by name, category or city…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-green-500/15"
                />
              </div>

              {/* Vendor grid */}
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-ink-3">
                  <Store size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-[13px]">No vendors found. Try a different search term.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {filtered.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleVendorSelect(v)}
                      className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3.5 text-left hover:border-line-2 hover:bg-paper-2/60 transition text-[13px]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-paper-2 shrink-0 grid place-items-center text-lg overflow-hidden ring-1 ring-line">
                        {v.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.logo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Store size={16} className="text-ink-3" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink truncate">
                          {v.businessName}
                          {v.verified && <span className="ml-1 text-[11px] text-green-600">✓ Verified</span>}
                        </p>
                        <p className="text-ink-3 truncate">
                          {vendorCategoryLabel(v.category)}{v.city ? ` · ${v.city}` : ""}
                        </p>
                        {v.rating && (
                          <p className="text-ink-3 text-[12px]">★ {Number.parseFloat(v.rating).toFixed(1)}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Selected vendor — show form */}
              <div className="flex items-start gap-3 pb-3 border-b border-line">
                <div className="w-10 h-10 rounded-lg bg-paper-2 shrink-0 grid place-items-center text-lg overflow-hidden ring-1 ring-line">
                  {selectedVendor.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedVendor.logo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Store size={16} className="text-ink-3" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{selectedVendor.businessName}</p>
                  <p className="text-[12.5px] text-ink-2">
                    {vendorCategoryLabel(selectedVendor.category)}
                    {selectedVendor.city ? ` · ${selectedVendor.city}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVendor(null)}
                  className="text-ink-3 hover:text-ink transition shrink-0"
                >
                  <X size={15} />
                </button>
              </div>

              <form action={formAction} className="space-y-4">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="vendorId" value={selectedVendor.id} />

                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-1">
                    Package name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    name="packageName"
                    required
                    placeholder="e.g. Premium catering package"
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-green-500/15"
                  />
                  {state.fieldErrors?.packageName && (
                    <p className="mt-1 text-[12px] text-rose-600">{state.fieldErrors.packageName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-1">
                    Package description
                  </label>
                  <textarea
                    name="packageDescription"
                    rows={3}
                    placeholder="What's included? (optional)"
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-green-500/15 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-ink mb-1">
                      Price <span className="text-rose-500">*</span>
                    </label>
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-green-500/15"
                    />
                    {state.fieldErrors?.price && (
                      <p className="mt-1 text-[12px] text-rose-600">{state.fieldErrors.price}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-ink mb-1">
                      Currency
                    </label>
                    <select
                      name="currency"
                      defaultValue="USD"
                      className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-green-500/15"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-1">
                    Max capacity
                  </label>
                  <input
                    name="maxCapacity"
                    type="number"
                    min="1"
                    placeholder="Leave blank for unlimited"
                    className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:border-line-2 focus:ring-green-500/15"
                  />
                  <p className="mt-1 text-[11.5px] text-ink-3">
                    Maximum number of ticket buyers who can purchase this add-on.
                  </p>
                  {state.fieldErrors?.maxCapacity && (
                    <p className="mt-1 text-[12px] text-rose-600">{state.fieldErrors.maxCapacity}</p>
                  )}
                </div>

                {state.error && (
                  <p className="text-[13px] text-rose-600">{state.error}</p>
                )}

                {state.ok && state.message && (
                  <p className="text-[13px] text-green-600">{state.message}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <SubmitButton />
                  <button
                    type="button"
                    onClick={() => setSelectedVendor(null)}
                    className="text-[12.5px] text-ink-2 hover:text-ink font-medium px-3 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}
