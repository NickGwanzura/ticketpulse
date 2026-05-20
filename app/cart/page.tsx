"use client"
import Link from "next/link"
import { useCart, type CartLine } from "@/lib/cart-context"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowLeft, ArrowRight, Minus, Plus, Trash2, ShieldCheck, Sparkles,
} from "lucide-react"
import EmptyTickets from "@/components/EmptyTickets"

function groupByEvent(items: CartLine[]) {
  const map: Record<string, { eventSlug: string; eventTitle: string; lines: CartLine[] }> = {}
  for (const it of items) {
    if (!map[it.eventSlug]) map[it.eventSlug] = { eventSlug: it.eventSlug, eventTitle: it.eventTitle, lines: [] }
    map[it.eventSlug].lines.push(it)
  }
  return Object.values(map)
}

function lineEmoji(line: CartLine) {
  if (line.kind === "ticket")       return line.emoji
  if (line.kind === "merch")        return "👕"
  if (line.kind === "vendor_addon") return "🍽️"
  return "🚌"
}

function lineLabel(line: CartLine) {
  if (line.kind === "ticket")       return line.tierName
  if (line.kind === "merch")        return line.size ? `${line.name} · ${line.size}` : line.name
  if (line.kind === "vendor_addon") return `${line.vendorName} · ${line.packageName}`
  return line.description
}

export default function CartPage() {
  const { items, ready, totalsByCurrency, updateQty, removeItem, clear } = useCart()

  if (!ready) {
    return (
      <div>
        <div className="border-b border-line bg-paper-2">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14 space-y-3">
            <div className="h-3 w-20 bg-paper-3 rounded animate-pulse" />
            <div className="h-9 w-72 bg-paper-3 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 grid lg:grid-cols-[1.6fr_1fr] gap-8">
          <div className="space-y-6">
            <div className="h-48 bg-paper-2 rounded-2xl animate-pulse" />
            <div className="h-32 bg-paper-2 rounded-2xl animate-pulse" />
          </div>
          <div className="h-80 bg-paper-2 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-12 md:py-20 text-center">
        <EmptyTickets />
        <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-[10.5px] font-semibold tracking-[0.16em] text-ink uppercase shadow-sm shadow-ink/5">
          <Sparkles size={11} className="text-blue" /> Your cart is empty
        </p>
        <h1 className="mt-5 text-[28px] md:text-[36px] font-bold tracking-tight text-ink">Add a few tickets first.</h1>
        <p className="mt-3 text-[14.5px] text-ink-2 max-w-md mx-auto leading-relaxed">
          Browse events, pick your tier, and they&apos;ll land here for one quick checkout.
        </p>
        <div className="mt-7 flex flex-wrap gap-2 justify-center">
          <Link href="/events" className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 transition">
            Browse events <ArrowRight size={14} />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-sm font-medium text-ink hover:border-line-2 transition-colors">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </div>
    )
  }

  const groups = groupByEvent(items)
  const lineCount = items.reduce((s, i) => s + i.qty, 0)

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Your cart</p>
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
            {lineCount} {lineCount === 1 ? "item" : "items"} ready to go
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 grid lg:grid-cols-[1.6fr_1fr] gap-8 md:gap-10">
        {/* Lines */}
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.eventSlug} className="rounded-2xl border border-line bg-paper overflow-hidden">
              <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase">Event</p>
                  <Link href={`/events/${group.eventSlug}`} className="text-[15px] font-semibold tracking-tight text-ink hover:text-navy-700 transition-colors line-clamp-1">
                    {group.eventTitle}
                  </Link>
                </div>
                <Link href={`/events/${group.eventSlug}`} className="hidden sm:inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy hover:gap-1.5 transition-all shrink-0">
                  Add more <ArrowRight size={12} />
                </Link>
              </div>

              <ul className="divide-y divide-line">
                {group.lines.map((line) => (
                  <li key={line.key} className="flex items-start gap-4 p-5">
                    <div className="shrink-0 inline-flex w-12 h-12 items-center justify-center rounded-xl bg-paper-2 ring-1 ring-line text-2xl">
                      {lineEmoji(line)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10.5px] font-semibold tracking-[0.18em] text-blue uppercase">{line.kind}</p>
                      <p className="text-[14px] font-semibold tracking-tight text-ink mt-0.5">{lineLabel(line)}</p>
                      <p className="text-[12.5px] text-ink-3 mt-0.5">
                        {formatCurrency(line.price, line.currency)} × {line.qty}
                      </p>

                      <div className="mt-3 inline-flex items-center gap-1">
                        <button
                          onClick={() => updateQty(line.key, line.qty - 1)}
                          aria-label="Decrease"
                          className="w-8 h-8 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 flex items-center justify-center transition-colors"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="text-sm font-semibold w-7 text-center text-ink tabular-nums">{line.qty}</span>
                        <button
                          onClick={() => updateQty(line.key, line.qty + 1)}
                          aria-label="Increase"
                          className="w-8 h-8 rounded-md border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 flex items-center justify-center transition-colors"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[15px] font-bold tracking-tight text-ink whitespace-nowrap">
                        {formatCurrency(line.price * line.qty, line.currency)}
                      </span>
                      <button
                        onClick={() => removeItem(line.key)}
                        aria-label="Remove"
                        className="text-ink-3 hover:text-rose-600 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={clear}
              className="text-[13px] font-medium text-ink-3 hover:text-rose-600 transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 size={13} /> Clear cart
            </button>
            <Link href="/events" className="text-[13px] font-semibold text-navy hover:underline">
              ← Continue shopping
            </Link>
          </div>
        </div>

        {/* Summary */}
        <aside>
          <div className="sticky top-24 rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.04]">
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">Order summary</h2>
            <p className="text-xs text-ink-3 mb-5">Taxes included.</p>

            <div className="space-y-3 mb-5">
              {Object.entries(totalsByCurrency).map(([cur, total]) => (
                <div key={cur} className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink-2">Subtotal · {cur}</span>
                  <span className="text-[18px] font-bold tracking-tight text-ink">
                    {formatCurrency(total, cur)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[12.5px] text-ink-3 pb-4 border-b border-line">
              <span>Booking fees</span>
              <span className="text-emerald-700 font-medium">Free</span>
            </div>

            <Link
              href="/checkout"
              className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3.5 text-[14.5px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition"
            >
              Proceed to checkout <ArrowRight size={15} />
            </Link>

            <ul className="mt-5 space-y-2 text-[12px] text-ink-2">
              <li className="flex items-center gap-2">
                <ShieldCheck size={13} className="text-emerald-600" />
                Verified organizers · escrowed payments
              </li>
              <li className="flex items-center gap-2">
                <Sparkles size={13} className="text-blue" />
                Refundable up to 24h before the event
              </li>
            </ul>

            <div className="mt-5 pt-5 border-t border-line">
              <p className="text-[10px] font-semibold tracking-widest text-ink-3 uppercase mb-2">Accepted payments</p>
              <div className="flex gap-1.5 flex-wrap">
                {["EcoCash", "USD", "ZAR", "Paynow", "Card"].map((m) => (
                  <span key={m} className="text-[10.5px] font-medium bg-paper-2 border border-line text-ink-2 px-2 py-1 rounded-md">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky mobile checkout bar */}
      <div className="lg:hidden sticky bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-xl px-5 py-3 shadow-[0_-8px_24px_-12px_rgba(10,37,64,0.15)]">
        <div className="flex items-center justify-between gap-3 max-w-3xl mx-auto">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold tracking-widest text-ink-3 uppercase">Total</p>
            <p className="text-[16px] font-bold tracking-tight text-ink truncate">
              {Object.entries(totalsByCurrency).map(([cur, total], i) => (
                <span key={cur}>{i > 0 && <span className="text-ink-3 font-normal mx-1">·</span>}{formatCurrency(total, cur)}</span>
              ))}
            </p>
          </div>
          <Link
            href="/checkout"
            className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-5 py-3 text-[13.5px] font-semibold text-white shadow-sm shadow-navy/20 active:scale-[0.99] transition shrink-0"
          >
            Checkout <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}
