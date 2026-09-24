"use client"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { orderAccessSignatureFor } from "@/lib/order-auth-client"
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/order-labels"
import { formatCurrency } from "@/lib/utils"
import { ArrowUpRight, Ticket, ArrowRight, Mail, Loader2 } from "lucide-react"
import EmptyTickets from "@/components/EmptyTickets"
import Button from "@/components/ui/Button"

type OrderSummary = {
  id: string
  status: OrderRecord["status"]
  total: number
  currency: string
  createdAt: string | null
  eventTitle: string
  eventSlug: string
  eventStartsAt: string | null
}

function fromLocal(o: OrderRecord): OrderSummary {
  const first = o.items[0]
  const [currency, total] = Object.entries(o.totalsByCurrency)[0] ?? ["USD", 0]
  return {
    id: o.id,
    status: o.status,
    total,
    currency,
    createdAt: o.createdAt,
    eventTitle: first?.eventTitle ?? "Event",
    eventSlug: first?.eventSlug ?? "",
    eventStartsAt: first?.eventStartsAt ?? null,
  }
}

function formatDay(iso: string | null) {
  if (!iso) return null
  return new Intl.DateTimeFormat("en-ZW", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Harare" }).format(new Date(iso))
}

export default function OrdersPage() {
  const { ready, getOrders } = useCart()
  const [local, setLocal] = useState<OrderSummary[]>([])
  const [server, setServer] = useState<OrderSummary[] | null>(null)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    if (!ready) return
    const saved = getOrders()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrates the list from orders saved on this device.
    setLocal(saved.map(fromLocal))

    // Refresh from the server: statuses on this device go stale (a card
    // payment saved as pending, a later refund), and signed-in buyers also
    // get the orders on their account.
    const proofs = saved
      .map((o) => ({ id: o.id, sig: orderAccessSignatureFor(o.id) }))
      .filter((o): o is { id: string; sig: string } => !!o.sig)
      .slice(0, 50)
    const controller = new AbortController()
    fetch("/api/orders/summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orders: proofs }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((data: { orders: OrderSummary[] }) => setServer(data.orders ?? []))
      .catch(() => { if (!controller.signal.aborted) setServer([]) })
    return () => controller.abort()
  }, [ready, getOrders])

  const orders = useMemo(() => {
    const byId = new Map<string, OrderSummary>()
    for (const o of local) byId.set(o.id, o)
    for (const o of server ?? []) byId.set(o.id, { ...byId.get(o.id), ...o })
    return Array.from(byId.values()).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
  }, [local, server])

  const upcoming = orders.filter((o) => o.eventStartsAt && new Date(o.eventStartsAt).getTime() >= now - 6 * 60 * 60 * 1000)
  const past = orders.filter((o) => !upcoming.includes(o))

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
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">My tickets</p>
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
            Your orders
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-[14px] text-ink-2">
            {server === null && <Loader2 size={13} className="animate-spin text-ink-3" aria-hidden />}
            Orders from this device and your account.
            <Link href="/orders/lookup" className="font-semibold text-ink underline underline-offset-2">Missing one?</Link>
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10">
        {orders.length === 0 ? (
          server === null ? (
            <div className="h-32 bg-paper-2 rounded-2xl animate-pulse" />
          ) : (
            <div className="text-center py-8 md:py-14">
              <EmptyTickets />
              <h2 className="mt-5 text-[24px] md:text-[28px] font-bold tracking-tight text-ink">No tickets on this device yet</h2>
              <p className="mt-3 text-[15px] text-ink-2 max-w-sm mx-auto">
                Bought on another phone or browser? We can email you links to every order.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                <Button href="/orders/lookup" size="lg">
                  <Mail size={14} /> Email my ticket links
                </Button>
                <Button href="/events" variant="secondary" size="lg">
                  Browse events <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-10">
            {upcoming.length > 0 && <OrderList title="Upcoming" orders={upcoming} />}
            {past.length > 0 && <OrderList title={upcoming.length > 0 ? "Past & other orders" : "Orders"} orders={past} />}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderList({ title, orders }: { title: string; orders: OrderSummary[] }) {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-3">{title}</h2>
      <ul className="space-y-3">
        {orders.map((o) => (
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
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_TONE[o.status]}`}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                </div>
                <p className="text-[15px] font-semibold tracking-tight text-ink line-clamp-1">{o.eventTitle}</p>
                <p className="text-[13px] text-ink-3 mt-0.5">
                  {o.eventStartsAt ? formatDay(o.eventStartsAt) : `Ordered ${formatDay(o.createdAt) ?? ""}`}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[15px] font-bold tracking-tight text-ink whitespace-nowrap">
                  {o.total === 0 ? "Free" : formatCurrency(o.total, o.currency)}
                </p>
                <ArrowUpRight size={14} className="text-ink-3 group-hover:text-ink ml-auto mt-1 transition-colors" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
