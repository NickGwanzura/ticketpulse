import Link from "next/link"
import {
  ArrowUpRight, ArrowDownRight,
  AlertCircle, CalendarCheck, LayoutList,
  ShoppingCart,
} from "lucide-react"
import { and, desc, eq, gte, sql } from "drizzle-orm"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"
import { db } from "@/db"
import { events, orders, users } from "@/db/schema"

type KPI = { label: string; value: number; currency: string | null; delta: number; up: boolean; spark: readonly number[] }
type Activity = { kind: string; icon: React.ElementType; iconColor: string; iconBg: string; who: string; msg: string; when: string }
type TopEvent = { title: string; organizer: string; sold: number; capacity: number; revenue: number; currency: string }
type Pending = { kind: string; title: string; detail: string; primary: string }

function Sparkline({ points, up }: { points: readonly number[]; up: boolean }) {
  const w = 120, h = 36, pad = 2
  const min = Math.min(...points), max = Math.max(...points)
  const span = max - min || 1
  const step = (w - pad * 2) / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = pad + i * step
    const y = h - pad - ((v - min) / span) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={coords}
        fill="none"
        stroke={up ? "rgb(10 37 64)" : "rgb(190 18 60)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function relTime(input: Date | null | undefined) {
  if (!input) return "Recently"
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return "Recently"
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

export default async function AdminOverviewPage() {
  const now = new Date()
  const start30 = new Date(now)
  start30.setDate(now.getDate() - 30)
  const prev30 = new Date(start30)
  prev30.setDate(start30.getDate() - 30)

  const paidRecentRows = await db
    .select({
      amount: orders.totalAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, prev30)))

  const currentRows = paidRecentRows.filter((r) => {
    const d = r.createdAt ? new Date(r.createdAt) : null
    return d ? d >= start30 : false
  })

  const previousRows = paidRecentRows.filter((r) => {
    const d = r.createdAt ? new Date(r.createdAt) : null
    return d ? d >= prev30 && d < start30 : false
  })

  const currentRevenue = currentRows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const prevRevenue = previousRows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const revenueDelta = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : (currentRevenue > 0 ? 100 : 0)

  const activeEventsRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(eq(events.status, "published"))

  const newUsersCurrentRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(gte(users.createdAt, start30))

  const newUsersPrevRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(gte(users.createdAt, prev30), sql`${users.createdAt} < ${start30}`))

  const activeEvents = Number(activeEventsRow[0]?.count ?? 0)
  const newUsersCurrent = Number(newUsersCurrentRow[0]?.count ?? 0)
  const newUsersPrev = Number(newUsersPrevRow[0]?.count ?? 0)
  const userDelta = newUsersPrev > 0 ? ((newUsersCurrent - newUsersPrev) / newUsersPrev) * 100 : (newUsersCurrent > 0 ? 100 : 0)

  const paidCountCurrentRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, start30)))

  const paidCountPrevRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, prev30), sql`${orders.createdAt} < ${start30}`))

  const paidCountCurrent = Number(paidCountCurrentRow[0]?.count ?? 0)
  const paidCountPrev = Number(paidCountPrevRow[0]?.count ?? 0)
  const paidCountDelta = paidCountPrev > 0 ? ((paidCountCurrent - paidCountPrev) / paidCountPrev) * 100 : (paidCountCurrent > 0 ? 100 : 0)

  const defaultCurrency = currentRows[0]?.currency ?? "USD"
  const KPIS: KPI[] = [
    {
      label: "Gross volume (30d)",
      value: currentRevenue,
      currency: defaultCurrency,
      delta: revenueDelta,
      up: revenueDelta >= 0,
      spark: [2, 4, 3, 5, 6, 4, 7, 8],
    },
    {
      label: "Paid orders (30d)",
      value: paidCountCurrent,
      currency: null,
      delta: paidCountDelta,
      up: paidCountDelta >= 0,
      spark: [1, 1, 2, 3, 2, 4, 4, 5],
    },
    {
      label: "Active events",
      value: activeEvents,
      currency: null,
      delta: 0,
      up: true,
      spark: [1, 1, 1, 2, 2, 2, 2, 2],
    },
    {
      label: "New users (30d)",
      value: newUsersCurrent,
      currency: null,
      delta: userDelta,
      up: userDelta >= 0,
      spark: [1, 2, 1, 3, 2, 3, 4, 4],
    },
  ]

  const recentOrders = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      amount: orders.totalAmount,
      currency: orders.currency,
      guestName: orders.guestName,
      userName: users.name,
      eventTitle: events.title,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.status, "paid"))
    .orderBy(desc(orders.createdAt))
    .limit(8)

  const ACTIVITY: Activity[] = recentOrders.map((o) => ({
    kind: "order",
    icon: ShoppingCart,
    iconColor: "text-emerald-700",
    iconBg: "bg-emerald-50",
    who: o.userName || o.guestName || "Guest",
    msg: `placed a paid order for ${o.eventTitle || "an event"} (${formatCurrency(Number(o.amount ?? 0), o.currency || "USD")})`,
    when: relTime(o.createdAt),
  }))

  const topEventsRows = await db
    .select({
      title: events.title,
      organizer: users.name,
      sold: sql<number>`count(${orders.id})`,
      revenue: sql<string>`sum(${orders.totalAmount})`,
      currency: orders.currency,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .leftJoin(users, eq(users.id, events.organizerId))
    .where(and(eq(orders.status, "paid"), gte(orders.createdAt, start30)))
    .groupBy(events.title, users.name, orders.currency)
    .orderBy(desc(sql`sum(${orders.totalAmount})`))
    .limit(5)

  const TOP_EVENTS: TopEvent[] = topEventsRows.map((r) => ({
    title: r.title || "Untitled event",
    organizer: r.organizer || "Organizer",
    sold: Number(r.sold ?? 0),
    capacity: Math.max(Number(r.sold ?? 0), 1),
    revenue: Number(r.revenue ?? 0),
    currency: r.currency || "USD",
  }))

  const PENDING: Pending[] = []

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Overview"
        title="Platform pulse"
        subtitle="Real-time activity across organizers, vendors, and attendees."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {KPIS.length > 0 ? KPIS.map(({ label, value, currency, delta, up, spark }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <p className="text-[11.5px] text-ink-3 mb-2.5">{label}</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {currency ? formatCurrency(value, currency) : value.toLocaleString()}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>
                  {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(delta).toFixed(1)}% MoM
                </span>
                <div className="flex-1 max-w-[120px]">
                  <Sparkline points={spark} up={up} />
                </div>
              </div>
            </div>
          )) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 tp-fade-up-2">
          <div className="lg:col-span-3 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Recent activity</h2>
              <Link href="/admin/orders" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                View all <ArrowUpRight size={12} />
              </Link>
            </div>
            {ACTIVITY.length > 0 ? (
              <ul className="divide-y divide-line">
                {ACTIVITY.map((a, i) => {
                  const Icon = a.icon
                  return (
                    <li key={i} className="px-5 md:px-6 py-3.5 flex items-start gap-3 hover:bg-paper-2 transition-colors">
                      <span className={`shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-lg ${a.iconBg}`}>
                        <Icon size={14} className={a.iconColor} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] text-ink leading-snug">
                          <span className="font-semibold">{a.who}</span> <span className="text-ink-2">{a.msg}</span>
                        </p>
                        <p className="text-[11.5px] text-ink-3 mt-0.5">{a.when}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState
                icon={LayoutList}
                title="No activity yet"
                body="Platform events, signups, orders, payouts, and refunds will appear here."
                variant="inline"
              />
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Top events this week</h2>
              <Link href="/admin/events" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                Manage <ArrowUpRight size={12} />
              </Link>
            </div>
            {TOP_EVENTS.length > 0 ? (
              <ul className="divide-y divide-line">
                {TOP_EVENTS.map((e) => {
                  const pct = Math.round((e.sold / e.capacity) * 100)
                  return (
                    <li key={`${e.title}-${e.currency}`} className="px-5 md:px-6 py-3.5 hover:bg-paper-2 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                          <p className="text-[11.5px] text-ink-3 mt-0.5">{e.organizer}</p>
                        </div>
                        <p className="text-[13px] font-bold tracking-tight text-ink whitespace-nowrap">
                          {formatCurrency(e.revenue, e.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-paper-2 rounded-full overflow-hidden">
                          <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-ink-3 whitespace-nowrap tabular-nums">{e.sold}/{e.capacity}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="No events this week"
                body="Published events with ticket sales will appear here."
                variant="inline"
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Pending review</h2>
              <p className="text-[12px] text-ink-3 mt-0.5">{PENDING.length} items waiting on you</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-[11px] font-semibold">
              <AlertCircle size={11} /> Action needed
            </span>
          </div>
          {PENDING.length > 0 ? (
            <ul className="divide-y divide-line">
              {PENDING.map((p, i) => (
                <li key={i} className="px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-paper-2 text-ink-2 ring-1 ring-line">
                        {p.kind}
                      </span>
                      <p className="text-[13.5px] font-semibold tracking-tight text-ink truncate">{p.title}</p>
                    </div>
                    <p className="text-[12.5px] text-ink-2">{p.detail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors">
                      Reject
                    </button>
                    <button className="rounded-lg bg-navy text-white px-3 py-1.5 text-[12.5px] font-semibold shadow-sm shadow-navy/20 hover:bg-navy-700 transition-colors">
                      {p.primary}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={AlertCircle}
              title="All clear"
              body="No events, vendors, or refunds are waiting for review."
              variant="inline"
            />
          )}
        </div>
      </div>
    </div>
  )
}
