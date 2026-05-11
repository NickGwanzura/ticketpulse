import { Search, DollarSign, Receipt, RefreshCw, TrendingUp, Smartphone, CreditCard, Building2, Banknote, ShoppingCart } from "lucide-react"
import { and, desc, eq, gte, sql } from "drizzle-orm"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { db } from "@/db"
import { events, orders, users } from "@/db/schema"

type Status = "paid" | "pending" | "refunded"
type Method = "EcoCash" | "Card" | "Bank" | "USD cash"

type Order = {
  id: string
  customer: string
  event: string
  amount: number
  currency: string
  method: Method
  status: Status
  at: Date
}

const STATUS_STYLE: Record<Status, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  refunded: "bg-rose-50 text-rose-700",
}

const METHOD_ICON: Record<Method, { Icon: typeof Smartphone; color: string }> = {
  EcoCash: { Icon: Smartphone, color: "text-emerald-700" },
  Card: { Icon: CreditCard, color: "text-blue" },
  Bank: { Icon: Building2, color: "text-sky-700" },
  "USD cash": { Icon: Banknote, color: "text-amber-700" },
}

const FILTER_PILLS = ["All", "Paid", "Pending", "Refunded"]

function normalizeMethod(method: string | null | undefined): Method {
  const m = (method || "").toLowerCase()
  if (m.includes("eco")) return "EcoCash"
  if (m.includes("card") || m.includes("visa") || m.includes("master")) return "Card"
  if (m.includes("bank") || m.includes("transfer")) return "Bank"
  return "USD cash"
}

export default async function AdminOrdersPage() {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startWeek = new Date(now)
  startWeek.setDate(now.getDate() - 7)
  const start30 = new Date(now)
  start30.setDate(now.getDate() - 30)

  const recentRows = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
      guestName: orders.guestName,
      userName: users.name,
      eventTitle: events.title,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .leftJoin(events, eq(events.id, orders.eventId))
    .orderBy(desc(orders.createdAt))
    .limit(100)

  const ORDERS: Order[] = recentRows
    .filter((r) => r.status === "paid" || r.status === "pending" || r.status === "refunded")
    .map((r) => ({
      id: r.id,
      customer: r.userName || r.guestName || "Guest",
      event: r.eventTitle || "Untitled event",
      amount: Number(r.totalAmount ?? 0),
      currency: r.currency || "USD",
      method: normalizeMethod(r.paymentMethod),
      status: r.status as Status,
      at: new Date(r.createdAt || new Date()),
    }))

  const todayPaidRows = await db
    .select({ amount: orders.totalAmount, currency: orders.currency })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, startToday)))

  const todayRevenue = todayPaidRows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const todayCurrency = todayPaidRows[0]?.currency || "USD"

  const todayOrdersRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(gte(orders.createdAt, startToday))

  const refundsWeekRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.status, "refunded"), gte(orders.createdAt, startWeek)))

  const paid30Rows = await db
    .select({ amount: orders.totalAmount })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, start30)))

  const paid30Count = paid30Rows.length
  const paid30Revenue = paid30Rows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const aov = paid30Count > 0 ? paid30Revenue / paid30Count : 0

  const stats = [
    { label: "Today's revenue", value: formatCurrency(todayRevenue, todayCurrency), icon: DollarSign, tone: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Today's orders", value: String(Number(todayOrdersRow[0]?.count ?? 0)), icon: Receipt, tone: "text-sky-700", bg: "bg-sky-50" },
    { label: "Refunds this week", value: String(Number(refundsWeekRow[0]?.count ?? 0)), icon: RefreshCw, tone: "text-rose-700", bg: "bg-rose-50" },
    { label: "AOV", value: formatCurrency(aov, todayCurrency), icon: TrendingUp, tone: "text-blue", bg: "bg-blue-soft" },
  ]

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Orders"
        title="Recent transactions"
        subtitle="Every order placed across the platform."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {stats.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
              <span className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon size={16} className={tone} />
              </span>
              <div>
                <p className="text-[11.5px] text-ink-3 mb-0.5">{label}</p>
                <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 tp-fade-up-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="Search by order # or customer"
              className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {FILTER_PILLS.map((p, i) => (
              <button
                key={p}
                className={`rounded-lg px-3.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                  i === 0 ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          {ORDERS.length > 0 ? (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">Order</th>
                      <th className="text-left px-3 py-3 font-semibold">Customer</th>
                      <th className="text-left px-3 py-3 font-semibold">Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Method</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-right px-5 py-3 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ORDERS.map((o) => {
                      const { Icon, color } = METHOD_ICON[o.method]
                      return (
                        <tr key={o.id} className="hover:bg-paper-2 transition-colors">
                          <td className="px-5 py-3.5 text-[12.5px] font-mono font-semibold text-ink whitespace-nowrap">#{o.id}</td>
                          <td className="px-3 py-3.5 text-[12.5px] text-ink whitespace-nowrap">{o.customer}</td>
                          <td className="px-3 py-3.5 text-[12.5px] text-ink-2 line-clamp-1 max-w-[220px]">{o.event}</td>
                          <td className="px-3 py-3.5">
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                              <Icon size={12} className={color} />
                              {o.method}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[o.status]}`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">{formatDateShort(o.at)}</td>
                          <td className="px-5 py-3.5 text-right text-[13.5px] font-bold tracking-tight text-ink whitespace-nowrap">
                            {formatCurrency(o.amount, o.currency)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="md:hidden divide-y divide-line">
                {ORDERS.map((o) => {
                  const { Icon, color } = METHOD_ICON[o.method]
                  return (
                    <li key={o.id} className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="min-w-0">
                          <p className="text-[12px] font-mono font-semibold text-ink-3">#{o.id}</p>
                          <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{o.customer}</p>
                          <p className="text-[11.5px] text-ink-3 line-clamp-1">{o.event}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                            {formatCurrency(o.amount, o.currency)}
                          </p>
                          <span className={`mt-1 inline-block text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status]}`}>
                            {o.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11.5px] text-ink-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon size={11} className={color} /> {o.method}
                        </span>
                        <span>{formatDateShort(o.at)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="No orders yet"
              body="Ticket purchases across all events will appear here."
              variant="inline"
            />
          )}
        </div>
      </div>
    </div>
  )
}
