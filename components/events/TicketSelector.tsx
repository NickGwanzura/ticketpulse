"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingBag, Check, Zap, Users, ChevronDown } from "lucide-react"
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
  earlyBirdPrice: number | null
  earlyBirdUntil: Date | string | null
  earlyBirdQuantity: number | null
  groupPrice: number | null
  groupMinQty: number | null
  salesStart?: Date | string | null
  salesEnd?: Date | string | null
  /** Computed by the page at render time; the live clock takes over after hydration. */
  saleStatus?: "open" | "ended" | "upcoming"
}

function saleWindowStatus(tier: Tier, now: Date | null): "open" | "ended" | "upcoming" {
  if (!now) return tier.saleStatus ?? "open"
  if (tier.salesStart && now < new Date(tier.salesStart)) return "upcoming"
  if (tier.salesEnd && now >= new Date(tier.salesEnd)) return "ended"
  return "open"
}

type EffectivePrice = {
  price: number
  isEarlyBird: boolean
  isGroupDiscount: boolean
  expiresAt: Date | null
  spotsLeft: number | null
}

function computeEffectivePrice(tier: Tier, qty: number, now: Date): EffectivePrice {
  // Early bird check
  if (tier.earlyBirdPrice) {
    const expiresAt = tier.earlyBirdUntil ? new Date(tier.earlyBirdUntil) : null
    const dateExpired = expiresAt && now >= expiresAt
    const spotsLeft = tier.earlyBirdQuantity !== null ? Math.max(0, tier.earlyBirdQuantity - tier.soldQuantity) : null
    const qtyExpired = spotsLeft !== null && spotsLeft <= 0
    const isEarlyBird = !dateExpired && !qtyExpired
    if (isEarlyBird) {
      return { price: tier.earlyBirdPrice, isEarlyBird: true, isGroupDiscount: false, expiresAt, spotsLeft }
    }
  }

  // Group discount — applies when total qty of this tier >= groupMinQty
  if (tier.groupPrice && tier.groupMinQty && qty >= tier.groupMinQty) {
    return { price: tier.groupPrice, isEarlyBird: false, isGroupDiscount: true, expiresAt: null, spotsLeft: null }
  }

  return { price: tier.price, isEarlyBird: false, isGroupDiscount: false, expiresAt: null, spotsLeft: null }
}

interface TicketSelectorProps {
  eventSlug: string
  eventTitle: string
  eventStartsAt: Date | string
  eventEndsAt?: Date | string | null
  eventVenue: string
  emoji: string
  tiers: Tier[]
}

export default function TicketSelector({ eventSlug, eventTitle, eventStartsAt, eventEndsAt, eventVenue, emoji, tiers }: TicketSelectorProps) {
  const router = useRouter()
  const { addItem } = useCart()
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [added, setAdded] = useState(false)
  // Keep the first render identical on the server and client. The live clock
  // starts after hydration so an early-bird boundary cannot cause a mismatch.
  const [now, setNow] = useState<Date | null>(null)

  // Refresh prices and sale windows while this page stays open.
  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(new Date()), 0)
    const hasTimedTiers = tiers.some((t) => t.salesStart || t.salesEnd || (t.earlyBirdPrice && t.earlyBirdUntil))
    if (!hasTimedTiers) return () => window.clearTimeout(initialTimer)
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => {
      window.clearTimeout(initialTimer)
      clearInterval(id)
    }
  }, [tiers])

  // Compute effective prices — re-computed whenever qtys or now changes
  const priceMap = useMemo(() => {
    const map: Record<string, EffectivePrice & { qty: number }> = {}
    for (const tier of tiers) {
      const qty = qtys[tier.id] ?? 0
      map[tier.id] = { ...computeEffectivePrice(tier, qty, now ?? new Date(0)), qty }
    }
    return map
  }, [tiers, qtys, now])

  const { availableTiers, upcomingTiers, closedTiers } = useMemo(() => {
    const availableTiers: Tier[] = []
    const upcomingTiers: Tier[] = []
    const closedTiers: Tier[] = []
    for (const tier of tiers) {
      const status = saleWindowStatus(tier, now)
      if (tier.totalQuantity - tier.soldQuantity <= 0 || status === "ended") closedTiers.push(tier)
      else if (status === "upcoming") upcomingTiers.push(tier)
      else availableTiers.push(tier)
    }
    return { availableTiers, upcomingTiers, closedTiers }
  }, [tiers, now])

  const update = (id: string, delta: number, max: number) => {
    setQtys((prev) => {
      const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + delta))
      return { ...prev, [id]: next }
    })
  }

  const total = availableTiers.reduce((s, t) => s + (qtys[t.id] ?? 0) * (priceMap[t.id]?.price ?? t.price), 0)
  const lineCount = availableTiers.reduce((s, t) => s + (qtys[t.id] ?? 0), 0)
  const selectedCurrencies = [...new Set(availableTiers.filter((t) => (qtys[t.id] ?? 0) > 0).map((t) => t.currency))]
  const hasMixedCurrencies = selectedCurrencies.length > 1
  const baseCurrency = selectedCurrencies[0] ?? availableTiers[0]?.currency ?? tiers[0]?.currency ?? "USD"

  const addToCart = () => {
    availableTiers.forEach((t) => {
      const qty = qtys[t.id] ?? 0
      if (qty > 0) {
        addItem({
          kind: "ticket",
          eventSlug,
          eventTitle,
          eventStartsAt: new Date(eventStartsAt).toISOString(),
          eventEndsAt: eventEndsAt ? new Date(eventEndsAt).toISOString() : undefined,
          eventVenue,
          tierId: t.id,
          tierName: t.name,
          emoji,
          price: priceMap[t.id]?.price ?? t.price,
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
    availableTiers.forEach((t) => {
      const qty = qtys[t.id] ?? 0
      if (qty > 0) {
        addItem({
          kind: "ticket",
          eventSlug,
          eventTitle,
          eventStartsAt: new Date(eventStartsAt).toISOString(),
          eventEndsAt: eventEndsAt ? new Date(eventEndsAt).toISOString() : undefined,
          eventVenue,
          tierId: t.id,
          tierName: t.name,
          emoji,
          price: priceMap[t.id]?.price ?? t.price,
          currency: t.currency,
          qty,
        })
      }
    })
    // Check out only this event, so tickets left in the cart from another event
    // don't send the buyer to the "choose an order" screen.
    const currencies = [...new Set(availableTiers.filter((t) => (qtys[t.id] ?? 0) > 0).map((t) => t.currency))]
    const params = new URLSearchParams({ event: eventSlug })
    if (currencies.length === 1) params.set("currency", currencies[0])
    router.push(`/checkout?${params.toString()}`)
  }

  const inactiveTierRow = (tier: Tier) => {
    const soldOut = tier.totalQuantity - tier.soldQuantity <= 0
    const status = soldOut ? "Sold out" : saleWindowStatus(tier, now) === "upcoming" ? "Not on sale yet" : "Sales ended"
    return (
      <div key={tier.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-2" title={tier.name}>{tier.name}</p>
          <p className="mt-0.5 text-[11px] text-ink-3">{status}</p>
        </div>
        <span className="shrink-0 text-[13px] font-semibold text-ink-2">{formatCurrency(priceMap[tier.id]?.price ?? tier.price, tier.currency)}</span>
      </div>
    )
  }

  return (
    <div id="tickets" className="lg:sticky lg:top-24 rounded-2xl border border-line bg-paper p-5 sm:p-6 shadow-sm shadow-ink/[0.04] scroll-mt-24">
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-2">Select tickets</h2>
      <p className="text-xs text-ink-3 mb-5">All prices include taxes. Gateway fees are shown at checkout.</p>

      <div className="space-y-3 mb-5">
        {availableTiers.length === 0 && (
          <p className="rounded-xl border border-line bg-paper-2 px-4 py-3 text-[13px] text-ink-2">
            No tickets are on sale right now.
          </p>
        )}

        {availableTiers.map((tier) => {
          const remaining = tier.totalQuantity - tier.soldQuantity
          const qty = qtys[tier.id] ?? 0
          const max = Math.min(tier.maxPerOrder, remaining)
          const ep = priceMap[tier.id]!

          return (
            <div
              key={tier.id}
              className={`rounded-xl border p-4 transition-colors ${qty > 0 ? "border-navy bg-green-50/40 ring-1 ring-navy/15" : "border-line bg-paper hover:border-line-2"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-snug tracking-tight text-ink">{tier.name}</p>
                  {tier.description && <p className="mt-1 text-[12px] leading-snug text-ink-2">{tier.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[16px] font-bold leading-snug tracking-tight text-ink">{formatCurrency(ep.price, tier.currency)}</p>
                  {(ep.isEarlyBird || ep.isGroupDiscount) && tier.price !== ep.price && (
                    <p className="text-[11px] text-ink-3 line-through">{formatCurrency(tier.price, tier.currency)}</p>
                  )}
                  <p className="text-[10px] text-ink-3">per entry</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium">
                <span className={remaining <= 20 ? "text-amber-700" : "text-green-700"}>
                  {remaining <= 20 ? `Only ${remaining} left` : "Available"}
                </span>
                {ep.isEarlyBird && <span className="inline-flex items-center gap-1 text-amber-700"><Zap size={11} /> Early bird</span>}
                {ep.isGroupDiscount && <span className="inline-flex items-center gap-1 text-sky-700"><Users size={11} /> Group rate</span>}
                {ep.isEarlyBird && ep.spotsLeft !== null && (
                  <span className="text-ink-3">{ep.spotsLeft} at early bird price</span>
                )}
                {ep.isEarlyBird && ep.expiresAt && ep.spotsLeft === null && (
                  <span className="text-ink-3">Ends {ep.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                )}
                {tier.groupPrice && tier.groupMinQty && !ep.isGroupDiscount && (
                  <span className="text-sky-700">{formatCurrency(tier.groupPrice, tier.currency)}/person for {tier.groupMinQty}+</span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <span className="text-[11px] text-ink-3">Max {max} per order</span>
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => update(tier.id, -1, max)}
                    disabled={qty === 0}
                    aria-label={`Decrease ${tier.name} quantity`}
                    className="flex size-9 items-center justify-center rounded-lg border border-line bg-paper text-ink-2 transition-colors hover:border-line-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">{qty}</span>
                  <button
                    type="button"
                    onClick={() => update(tier.id, 1, max)}
                    disabled={qty >= max}
                    aria-label={`Increase ${tier.name} quantity`}
                    className="flex size-9 items-center justify-center rounded-lg border border-line bg-paper text-ink-2 transition-colors hover:border-line-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {upcomingTiers.length > 0 && (
          <div className="rounded-xl border border-line bg-paper-2 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">On sale soon</p>
            <div className="divide-y divide-line">{upcomingTiers.map(inactiveTierRow)}</div>
          </div>
        )}

        {closedTiers.length > 0 && (
          <details className="group rounded-xl border border-line bg-paper-2 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-medium text-ink-2 [&::-webkit-details-marker]:hidden">
              <span>Sold out &amp; past phases <span className="text-ink-3">({closedTiers.length})</span></span>
              <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-3 divide-y divide-line border-t border-line pt-3">{closedTiers.map(inactiveTierRow)}</div>
          </details>
        )}
      </div>

      {availableTiers.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between rounded-xl bg-paper-2 p-4 ring-1 ring-line">
            <span className="text-[12px] font-medium text-ink-2">
              {lineCount} {lineCount === 1 ? "ticket" : "tickets"}
            </span>
            <span className="text-[18px] font-bold tracking-tight text-ink">
              {hasMixedCurrencies ? "Mixed" : formatCurrency(total, baseCurrency)}
            </span>
          </div>

          <button
            onClick={checkout}
            disabled={lineCount === 0}
            className="mb-2 w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand-600"
          >
            {lineCount === 0 ? "Choose tickets" : `Checkout · ${hasMixedCurrencies ? "Mixed" : formatCurrency(total, baseCurrency)}`}
          </button>
          <button
            onClick={addToCart}
            disabled={lineCount === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper py-3 text-sm font-medium text-ink transition-colors hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {added ? (
              <><Check size={14} className="text-brand-600" /> Added to cart</>
            ) : (
              <><ShoppingBag size={14} /> Add to cart</>
            )}
          </button>

          <div className="mt-5 text-center">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-3">Accepted payments</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {["EcoCash", "USD", "ZWL", "Card"].map((m) => (
                <span key={m} className="rounded-md border border-line bg-paper-2 px-2 py-1 text-[11px] font-medium text-ink-2">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
