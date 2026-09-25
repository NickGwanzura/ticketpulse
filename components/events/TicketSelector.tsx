"use client"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingBag, Check, Zap, Users } from "lucide-react"
import { useCart, type CartLineInput } from "@/lib/cart-context"
import { formatCurrency } from "@/lib/utils"
import Button from "@/components/ui/Button"

interface Tier {
  id: string
  name: string
  description: string
  price: number
  currency: string
  totalQuantity: number
  soldQuantity: number
  maxPerOrder: number
  salesStart: Date | string | null
  salesEnd: Date | string | null
  earlyBirdPrice: number | null
  earlyBirdUntil: Date | string | null
  earlyBirdQuantity: number | null
  groupPrice: number | null
  groupMinQty: number | null
}

type EffectivePrice = {
  price: number
  isEarlyBird: boolean
  isGroupDiscount: boolean
  expiresAt: Date | null
  spotsLeft: number | null
}

type SaleWindow = { state: "on_sale" } | { state: "not_started"; startsAt: Date } | { state: "ended" }

const PAYMENT_METHODS = ["EcoCash", "Visa", "Mastercard"]

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

// Mirrors the sales-window checks in the checkout API so buyers never pick a
// tier that will be rejected at payment.
function saleWindow(tier: Tier, now: Date): SaleWindow {
  if (tier.salesStart && new Date(tier.salesStart) > now) return { state: "not_started", startsAt: new Date(tier.salesStart) }
  if (tier.salesEnd && new Date(tier.salesEnd) < now) return { state: "ended" }
  return { state: "on_sale" }
}

function formatSaleStart(date: Date) {
  return new Intl.DateTimeFormat("en-ZW", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Harare" }).format(date)
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
  const { addItem, setItem } = useCart()
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [added, setAdded] = useState(false)
  // Keep the first render identical on the server and client. The live clock
  // starts after hydration so an early-bird boundary cannot cause a mismatch.
  const [now, setNow] = useState<Date | null>(null)

  // Refresh clock for early bird expiry and sales-window checks
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0)
    const hasTimedChange = tiers.some((t) => (t.earlyBirdPrice && t.earlyBirdUntil) || t.salesStart || t.salesEnd)
    if (!hasTimedChange) return () => clearTimeout(first)
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [tiers])

  const baseCurrency = tiers[0]?.currency ?? "USD"
  const clock = now ?? new Date(0)

  // Compute effective prices — re-computed whenever qtys or now changes
  const priceMap = useMemo(() => {
    const map: Record<string, EffectivePrice & { qty: number }> = {}
    for (const tier of tiers) {
      const qty = qtys[tier.id] ?? 0
      map[tier.id] = { ...computeEffectivePrice(tier, qty, now ?? new Date(0)), qty }
    }
    return map
  }, [tiers, qtys, now])

  const update = (id: string, delta: number, max: number) => {
    setQtys((prev) => {
      const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + delta))
      return { ...prev, [id]: next }
    })
  }

  const total = tiers.reduce((s, t) => s + (qtys[t.id] ?? 0) * (priceMap[t.id]?.price ?? t.price), 0)
  const lineCount = Object.values(qtys).reduce((s, q) => s + q, 0)
  const hasMixedCurrencies = new Set(tiers.filter((t) => (qtys[t.id] ?? 0) > 0).map((t) => t.currency)).size > 1
  const allSoldOut = tiers.length > 0 && tiers.every((t) => t.totalQuantity - t.soldQuantity <= 0)

  const selectedLines = (): CartLineInput[] =>
    tiers
      .filter((t) => (qtys[t.id] ?? 0) > 0)
      .map((t) => ({
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
        qty: qtys[t.id] ?? 0,
        maxQty: Math.max(1, Math.min(t.maxPerOrder, t.totalQuantity - t.soldQuantity)),
      }))

  const addToCart = () => {
    selectedLines().forEach(addItem)
    setAdded(true)
    setQtys({})
    setTimeout(() => setAdded(false), 4000)
  }

  // "Checkout" buys exactly what is selected here: quantities replace (not add
  // to) any earlier cart lines for these tiers, and checkout is scoped to this event.
  const checkout = () => {
    selectedLines().forEach(setItem)
    router.push(`/checkout?event=${encodeURIComponent(eventSlug)}`)
  }

  if (tiers.length === 0) {
    return (
      <div id="tickets" className="lg:sticky lg:top-24 rounded-2xl border border-line bg-paper p-7 shadow-sm shadow-ink/[0.04] scroll-mt-24">
        <h2 className="text-[18px] font-semibold tracking-tight text-ink">Tickets coming soon</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">The organizer hasn&apos;t released tickets for this event yet. Check back soon.</p>
      </div>
    )
  }

  return (
    <div id="tickets" className="lg:sticky lg:top-24 rounded-2xl border border-line bg-paper p-6 md:p-8 shadow-sm shadow-ink/[0.04] scroll-mt-24">
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">{allSoldOut ? "Sold out" : "Select tickets"}</h2>
      <p className="text-xs text-ink-3 mb-5">
        {allSoldOut ? "Every ticket for this event has been sold." : "All prices include taxes."}
      </p>

      <div className="space-y-3 mb-5">
        {tiers.map((tier) => {
          const remaining = tier.totalQuantity - tier.soldQuantity
          const soldOut = remaining <= 0
          const sale = saleWindow(tier, clock)
          const unavailable = soldOut || (now !== null && sale.state !== "on_sale")
          const qty = qtys[tier.id] ?? 0
          const max = Math.min(tier.maxPerOrder, remaining)
          const ep = priceMap[tier.id]!

          const availability = soldOut
            ? { text: "Sold out", tone: "text-rose-700" }
            : now !== null && sale.state === "not_started"
            ? { text: `On sale ${formatSaleStart(sale.startsAt)}`, tone: "text-ink-3" }
            : now !== null && sale.state === "ended"
            ? { text: "Sales ended", tone: "text-ink-3" }
            : remaining <= 20
            ? { text: `Only ${remaining} left`, tone: "text-amber-700" }
            : { text: "Available", tone: "text-green-700" }

          return (
            <div
              key={tier.id}
              className={`relative rounded-xl border p-4 transition-all ${
                unavailable
                  ? "border-line bg-paper-2 opacity-70"
                  : qty > 0
                  ? "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600/15"
                  : "border-line bg-paper hover:border-line-2"
              }`}
            >
              {!unavailable && ep.isEarlyBird && (
                <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm">
                  <Zap size={9} /> EARLY BIRD
                </span>
              )}
              {!unavailable && ep.isGroupDiscount && (
                <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-sky-700 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  <Users size={9} /> GROUP RATE
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold tracking-tight text-ink">{tier.name}</p>
                  {tier.description && <p className="text-xs text-ink-2 mt-0.5">{tier.description}</p>}
                  {!unavailable && ep.isEarlyBird && ep.spotsLeft !== null && (
                    <p className="text-[11px] mt-1 font-medium text-amber-700">{ep.spotsLeft} spot{ep.spotsLeft !== 1 ? "s" : ""} at early bird price</p>
                  )}
                  {!unavailable && ep.isEarlyBird && ep.expiresAt && ep.spotsLeft === null && (
                    <p className="text-[11px] mt-1 font-medium text-amber-700">
                      Early bird ends {ep.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  )}
                  {!unavailable && tier.groupPrice && tier.groupMinQty && !ep.isGroupDiscount && (
                    <p className="text-[11px] mt-1 font-medium text-sky-700">
                      {formatCurrency(tier.groupPrice, tier.currency)}/person for {tier.groupMinQty}+
                    </p>
                  )}
                  <p className={`text-[11px] mt-1.5 font-medium ${availability.tone}`}>{availability.text}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold tracking-tight text-ink">
                    {ep.price === 0 ? "Free" : formatCurrency(ep.price, tier.currency)}
                  </p>
                  {(ep.isEarlyBird || ep.isGroupDiscount) && tier.price !== ep.price && (
                    <p className="text-[11px] text-ink-3 line-through">{formatCurrency(tier.price, tier.currency)}</p>
                  )}
                  <p className="text-[10px] text-ink-3">per entry</p>
                </div>
              </div>

              {!unavailable && (
                <div className="mt-3 pt-3 border-t border-dashed border-line flex items-center justify-between">
                  <span className="text-[11px] text-ink-3">Max {max} per order</span>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => update(tier.id, -1, max)}
                      disabled={qty === 0}
                      aria-label={`Remove one ${tier.name} ticket`}
                      className="w-11 h-11 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-semibold w-8 text-center text-ink tabular-nums" aria-live="polite" aria-label={`${qty} ${tier.name} selected`}>{qty}</span>
                    <button
                      type="button"
                      onClick={() => update(tier.id, 1, max)}
                      disabled={qty >= max}
                      aria-label={`Add one ${tier.name} ticket`}
                      className="w-11 h-11 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!allSoldOut && (
        <>
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
          <Button type="button" onClick={checkout} disabled={lineCount === 0} size="lg" fullWidth className="mb-2">
            {lineCount === 0 ? "Choose tickets" : `Checkout · ${hasMixedCurrencies ? "Mixed" : formatCurrency(total, baseCurrency)}`}
          </Button>
          <Button type="button" variant="secondary" onClick={addToCart} disabled={lineCount === 0} size="md" fullWidth>
            <ShoppingBag size={14} /> Add to cart
          </Button>
          {added && (
            <p role="status" className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-ink-2">
              <Check size={14} className="text-green-700" /> Added.{" "}
              <Link href="/cart" className="font-semibold text-ink underline underline-offset-2">View cart</Link>
            </p>
          )}

          <div className="mt-5 text-center">
            <p className="text-[10px] font-semibold tracking-widest text-ink-3 uppercase mb-2">Pay with</p>
            <div className="flex gap-1.5 justify-center flex-wrap">
              {PAYMENT_METHODS.map((m) => (
                <span key={m} className="text-[11px] font-medium bg-paper-2 border border-line text-ink-2 px-2 py-1 rounded-md">
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
