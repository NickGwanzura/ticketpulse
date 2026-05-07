"use client"
import { ShoppingBag, Package, Truck } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { MerchItem } from "@/types"
import { useState } from "react"

interface MerchSectionProps {
  items: MerchItem[]
  eventTitle: string
}

export default function MerchSection({ items, eventTitle }: MerchSectionProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [sizes, setSizes] = useState<Record<string, string>>({})

  if (!items.length) return null

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15">
          <ShoppingBag size={16} className="text-blue" />
        </span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Official merch</p>
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">{eventTitle} Store</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const remaining = item.stockQuantity - item.soldQuantity
          const soldOut = remaining <= 0
          const low = !soldOut && remaining <= 5
          return (
            <div
              key={item.id}
              className={`overflow-hidden rounded-2xl border bg-paper transition-all cursor-pointer ${
                selected === item.id ? "border-navy shadow-sm" : "border-line hover:border-line-2 hover:shadow-sm"
              }`}
              onClick={() => setSelected(selected === item.id ? null : item.id)}
            >
              <div className="h-36 bg-paper-2 flex items-center justify-center text-4xl">👕</div>
              <div className="p-4">
                <p className="text-[14px] font-semibold tracking-tight text-ink mb-1 line-clamp-1">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-ink-2 mb-2.5 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold tracking-tight text-ink">
                    {formatCurrency(item.price, item.currency)}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    soldOut ? "bg-rose-50 text-rose-700"
                    : low ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {soldOut ? "Sold out" : `${remaining} left`}
                  </span>
                </div>

                {selected === item.id && (
                  <div className="mt-3 space-y-2.5 pt-3 border-t border-line">
                    {item.sizes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold tracking-widest text-ink-3 uppercase mb-1.5">Size</p>
                        <div className="flex gap-1 flex-wrap">
                          {item.sizes.map((s) => (
                            <button
                              key={s}
                              onClick={(e) => { e.stopPropagation(); setSizes(prev => ({ ...prev, [item.id]: s })) }}
                              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                                sizes[item.id] === s
                                  ? "bg-navy text-white border-navy"
                                  : "border-line bg-paper text-ink-2 hover:border-line-2"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {item.pickupAtEvent && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-2">
                          <Package size={10} /> Pickup at event
                        </span>
                      )}
                      {item.deliveryAvailable && (
                        <span className="flex items-center gap-1 text-[10px] text-ink-2">
                          <Truck size={10} /> Delivery available
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-navy text-white text-xs font-semibold py-2 rounded-lg hover:bg-navy-700 transition-colors"
                    >
                      Add to order
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
