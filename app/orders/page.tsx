"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowUpRight, Ticket, ArrowRight, Sparkles, AlertCircle } from "lucide-react"
import EmptyTickets from "@/components/EmptyTickets"

export default function OrdersPage() {
  // useCart must be at the top level (Rules of Hooks). The context is
  // provided by CartProvider in layout/Providers.tsx. If the context is
  // somehow missing, useCart throws — we catch that in the effect below.
  const { ready, getOrders } = useCart()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (error) return // don't retry after a fatal error
    if (!ready) return

    try {
      const result = getOrders()
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrates the local order list from the persisted cart store.
      setOrders(result)
    } catch (e) {
      console.error("[orders] getOrders failed", e)
      setError("Could not load your orders. Please refresh the page.")
    }
  }, [ready, getOrders, error])

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <div className="text-center py-8 md:py-14">
          <AlertCircle size={32} className="mx-auto text-ink-3 mb-4" />
          <p className="text-[15px] text-ink-2">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-32 bg-paper-2 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Orders</p>
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
            Your orders
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-2">{orders.length} {orders.length === 1 ? "order" : "orders"} total</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10">
        {orders.length === 0 ? (
          <div className="text-center py-8 md:py-14">
            <EmptyTickets />
            <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-ink uppercase shadow-sm shadow-ink/5">
              <Sparkles size={11} className="text-brand-600" /> No orders yet
            </p>
            <h2 className="mt-5 text-[24px] md:text-[28px] font-bold tracking-tight text-ink">Your tickets will live here.</h2>
            <p className="mt-3 text-[15px] text-ink-2 max-w-sm mx-auto">After your first checkout, every QR code, receipt, and refund is one tap away.</p>
            <Link
              href="/events"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition shadow-sm shadow-brand-600/20"
            >
              Browse events <ArrowRight size={14} />
            </Link>
            <Link
              href="/orders/lookup"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-sm font-semibold text-ink hover:border-line-2 transition"
            >
              Find tickets by email <Ticket size={14} />
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const lineCount = o.items.reduce((s, i) => s + i.qty, 0)
              const eventNames = Array.from(new Set(o.items.map((i) => i.eventTitle)))
              return (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="group relative flex items-center gap-4 md:gap-6 rounded-2xl border border-line bg-paper p-5 md:p-6 hover:border-line-2 hover:shadow-sm transition-all"
                  >
                    <div className="shrink-0 inline-flex w-12 h-12 md:w-14 md:h-14 items-center justify-center rounded-2xl bg-paper-2 ring-1 ring-line">
                      <Ticket size={20} className="text-ink-2" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${
                          o.status === "paid" ? "bg-green-50 text-green-700"
                          : o.status === "refunded" ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                        }`}>
                          {o.status}
                        </span>
                        <span className="text-[11px] font-mono text-ink-3">{o.id}</span>
                      </div>
                      <p className="text-[15px] font-semibold tracking-tight text-ink line-clamp-1">
                        {eventNames.join(", ")}
                      </p>
                      <p className="text-[13px] text-ink-3 mt-0.5">
                        {lineCount} {lineCount === 1 ? "item" : "items"} · {formatDate(o.createdAt)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {Object.entries(o.totalsByCurrency).map(([cur, total]) => (
                        <p key={cur} className="text-[15px] font-bold tracking-tight text-ink whitespace-nowrap">
                          {formatCurrency(total, cur)}
                        </p>
                      ))}
                      <ArrowUpRight size={14} className="text-ink-3 group-hover:text-ink ml-auto mt-1 transition-colors" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
