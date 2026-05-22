"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingBag, Check } from "lucide-react"
import { useCart } from "@/lib/cart-context"
import { formatCurrency } from "@/lib/utils"

interface Tier {
  id: string
  name: string
  description: string
  price: number
  currency: string
  totalQuantity: number
  soldQuantity: number
  maxPerOrder: number
}

interface TicketSelectorProps {
  eventSlug: string
  eventTitle: string
  emoji: string
  tiers: Tier[]
}

export default function TicketSelector({ eventSlug, eventTitle, emoji, tiers }: TicketSelectorProps) {
  const router = useRouter()
  const { addItem } = useCart()
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [added, setAdded] = useState(false)

  const baseCurrency = tiers[0]?.currency ?? "USD"

  const update = (id: string, delta: number, max: number) => {
    setQtys((prev) => {
      const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + delta))
      return { ...prev, [id]: next }
    })
  }

  const total = tiers.reduce((s, t) => s + (qtys[t.id] ?? 0) * t.price, 0)
  const lineCount = Object.values(qtys).reduce((s, q) => s + q, 0)
  const hasMixedCurrencies = new Set(tiers.filter((t) => (qtys[t.id] ?? 0) > 0).map((t) => t.currency)).size > 1

  const addToCart = () => {
    tiers.forEach((t) => {
      const qty = qtys[t.id] ?? 0
      if (qty > 0) {
        addItem({
          kind: "ticket",
          eventSlug,
          eventTitle,
          tierId: t.id,
          tierName: t.name,
          emoji,
          price: t.price,
          currency: t.currency,
          qty,
        })
      }
    })
    setAdded(true)
    setQtys({})
    setTimeout(() => setAdded(false), 1500)
  }

  const checkout = () => {
    tiers.forEach((t) => {
      const qty = qtys[t.id] ?? 0
      if (qty > 0) {
        addItem({
          kind: "ticket",
          eventSlug,
          eventTitle,
          tierId: t.id,
          tierName: t.name,
          emoji,
          price: t.price,
          currency: t.currency,
          qty,
        })
      }
    })
    router.push("/checkout")
  }

  return (
    <div id="tickets" className="lg:sticky lg:top-24 rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.04] scroll-mt-24">
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">Select tickets</h2>
      <p className="text-xs text-ink-3 mb-5">All prices include taxes.</p>

      <div className="space-y-2 mb-5">
        {tiers.map((tier) => {
          const remaining = tier.totalQuantity - tier.soldQuantity
          const soldOut = remaining <= 0
          const qty = qtys[tier.id] ?? 0
          const max = Math.min(tier.maxPerOrder, remaining)

          return (
            <div
              key={tier.id}
              className={`relative rounded-xl border p-4 transition-all ${
                soldOut
                  ? "border-line bg-paper-2 opacity-60"
                  : qty > 0
                  ? "border-navy bg-green-50/40 ring-1 ring-navy/15"
                  : "border-line bg-paper hover:border-line-2"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold tracking-tight text-ink">{tier.name}</p>
                  <p className="text-xs text-ink-2 mt-0.5">{tier.description}</p>
                  <p className={`text-[11px] mt-1.5 font-medium ${
                    soldOut ? "text-rose-700" : remaining <= 20 ? "text-amber-700" : "text-green-700"
                  }`}>
                    {soldOut ? "Sold out" : remaining <= 20 ? `Only ${remaining} left` : "Available"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold tracking-tight text-ink">
                    {formatCurrency(tier.price, tier.currency)}
                  </p>
                  <p className="text-[10px] text-ink-3">per entry</p>
                </div>
              </div>

              {!soldOut && (
                <div className="mt-3 pt-3 border-t border-dashed border-line flex items-center justify-between">
                  <span className="text-[11px] text-ink-3">Max {tier.maxPerOrder} per order</span>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => update(tier.id, -1, max)}
                      disabled={qty === 0}
                      aria-label="Decrease"
                      className="w-8 h-8 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="text-sm font-semibold w-7 text-center text-ink tabular-nums">{qty}</span>
                    <button
                      type="button"
                      onClick={() => update(tier.id, 1, max)}
                      disabled={qty >= max}
                      aria-label="Increase"
                      className="w-8 h-8 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Total */}
      <div className="rounded-xl bg-paper-2 ring-1 ring-line p-4 mb-4 flex items-center justify-between">
        <span className="text-[12px] font-medium text-ink-2">
          {lineCount} {lineCount === 1 ? "ticket" : "tickets"}
        </span>
        <span className="text-[18px] font-bold tracking-tight text-ink">
          {hasMixedCurrencies ? "Mixed" : formatCurrency(total, baseCurrency)}
        </span>
      </div>

      {/* CTAs */}
      <button
        onClick={checkout}
        disabled={lineCount === 0}
        className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl hover:bg-green-700 active:scale-[0.99] transition shadow-sm shadow-green-600/20 text-sm mb-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-green-600"
      >
        {lineCount === 0 ? "Choose tickets" : `Checkout · ${hasMixedCurrencies ? "Mixed" : formatCurrency(total, baseCurrency)}`}
      </button>
      <button
        onClick={addToCart}
        disabled={lineCount === 0}
        className="w-full inline-flex items-center justify-center gap-2 border border-line bg-paper text-ink font-medium py-3 rounded-xl hover:border-line-2 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {added ? (
          <><Check size={14} className="text-green-600" /> Added to cart</>
        ) : (
          <><ShoppingBag size={14} /> Add to cart</>
        )}
      </button>

      <div className="mt-5 text-center">
        <p className="text-[10px] font-semibold tracking-widest text-ink-3 uppercase mb-2">Accepted payments</p>
        <div className="flex gap-1.5 justify-center flex-wrap">
          {["EcoCash", "USD", "ZWL", "Paynow", "Card"].map((m) => (
            <span key={m} className="text-[10.5px] font-medium bg-paper-2 border border-line text-ink-2 px-2 py-1 rounded-md">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
