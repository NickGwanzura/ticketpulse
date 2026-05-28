import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowUpRight, ArrowDownRight,
  AlertCircle, CalendarCheck, LayoutList, CreditCard, ShoppingCart, Activity,
} from "lucide-react"
import { desc, eq, sql, and, gte, inArray } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, orders, users } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"
import { publishEventAction, verifyUserEmailAction } from "@/app/admin/actions"
import AiBriefCard from "@/components/ai/AiBriefCard"
import AiModerateButton from "@/components/ai/AiModerateButton"
import PurchaseFunnel from "@/components/dashboard/PurchaseFunnel"

type KPI = { label: string; value: number; currency: string | null; delta: number; up: boolean; spark: readonly number[] }
type Activity = { kind: string; icon: React.ElementType; iconColor: string; iconBg: string; who: string; msg: string; when: string }
type TopEvent = { id: string; title: string; organizer: string; sold: number; capacity: number; revenue: number; currency: string }
type Pending = { kind: string; title: string; detail: string; primary: string; action: (id: string) => Promise<void>; id: string; description: string; category: string }

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

export default async function AdminOverviewPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin")
  }

  // ── Total organizers (for AI brief) ─────────────────────────────────────

  const [orgCountRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(users)
    .where(eq(users.role, "organizer"))

  const totalOrganizers = orgCountRow?.count ?? 0

  // ── KPIs ────────────────────────────────────────────────────────────────

  const [revenueRow] = await db
    .select({
      gross: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    })
    .from(orders)
    .where(eq(orders.status, "paid"))

  const [activeEventsRow] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(events)
    .where(eq(events.status, "published"))

  const [newUsersThisMonth] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(users)
    .where(
      gte(users.createdAt, new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    )

  const grossVolume = Number(revenueRow?.gross ?? 0)
  const activeEvents = activeEventsRow?.count ?? 0
  const newUsers = newUsersThisMonth?.count ?? 0

  const KPIS: KPI[] = [
    { label: "Gross volume", value: grossVolume, currency: "USD", delta: 0, up: true, spark: [0, 0, 0, 0] },
    { label: "Net revenue", value: grossVolume, currency: "USD", delta: 0, up: true, spark: [0, 0, 0, 0] },
    { label: "Active events", value: activeEvents, currency: null, delta: 0, up: true, spark: [0, 0, 0, 0] },
    { label: "New users (month)", value: newUsers, currency: null, delta: 0, up: true, spark: [0, 0, 0, 0] },
  ]

  // ── Velocity stats ──────────────────────────────────────────────────────

  const hasVelocity = sql`${orders.metadata}->>'velocity' IS NOT NULL`

  const [velocityRevenueRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    })
    .from(orders)
    .where(and(hasVelocity, eq(orders.status, "paid")))

  const [velocityCountRow] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'pending')::int`,
      awaiting: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'awaiting_verification')::int`,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'paid')::int`,
    })
    .from(orders)
    .where(hasVelocity)

  const velocityRevenue = Number(velocityRevenueRow?.total ?? 0)
  const velocityTotal = velocityCountRow?.total ?? 0
  const velocityPending = (velocityCountRow?.pending ?? 0) + (velocityCountRow?.awaiting ?? 0)
  const velocityPaid = velocityCountRow?.paid ?? 0

  // ── Top category & city (for AI brief) ──────────────────────────────────

  const [topCatRow] = await db
    .select({
      category: events.category,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(events)
    .where(eq(events.status, "published"))
    .groupBy(events.category)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1)

  const [topCityRow] = await db
    .select({
      city: events.city,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(events)
    .where(eq(events.status, "published"))
    .groupBy(events.city)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1)

  const topCategory = topCatRow?.category ?? "N/A"
  const topCity = topCityRow?.city ?? "N/A"

  // ── Recent orders (activity) ────────────────────────────────────────────

  const recentOrders = await db
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      status: orders.status,
      createdAt: orders.createdAt,
      contactName: orders.guestName,
    })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(20)

  const ACTIVITY: Activity[] = recentOrders.map((o) => ({
    kind: "order",
    icon: o.status === "paid" ? CreditCard : ShoppingCart,
    iconColor: o.status === "paid" ? "text-green-700" : "text-ink-2",
    iconBg: o.status === "paid" ? "bg-green-50" : "bg-paper-2",
    who: o.contactName ?? "Someone",
    msg: o.status === "paid"
      ? `paid ${formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}`
      : `placed order ${o.id?.slice(0, 8)}… (${o.status})`,
    when: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—",
  }))

  // ── Top events ──────────────────────────────────────────────────────────

  const topEventRows = await db
    .select({
      id: events.id,
      title: events.title,
      organizerName: users.name,
      organizerEmail: users.email,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(eq(events.status, "published"))
    .orderBy(desc(events.createdAt))
    .limit(10)

  const eventIds = topEventRows.map((e) => e.id)

  // Get revenue per event
  const eventRevenue = eventIds.length > 0
    ? await db
        .select({
          eventId: orders.eventId,
          revenue: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
          currency: orders.currency,
        })
        .from(orders)
        .where(and(eq(orders.status, "paid"), inArray(orders.eventId, eventIds)))
        .groupBy(orders.eventId, orders.currency)
    : []

  const revMap = new Map<string, { revenue: number; currency: string }>()
  for (const r of eventRevenue) {
    if (!r.eventId) continue
    const amount = Number(r.revenue ?? 0)
    const cur = r.currency ?? "USD"
    const existing = revMap.get(r.eventId)
    if (!existing || amount > existing.revenue) {
      revMap.set(r.eventId, { revenue: amount, currency: cur })
    }
  }

  const TOP_EVENTS: TopEvent[] = topEventRows.map((e) => {
    const rev = revMap.get(e.id)
    return {
      id: e.id,
      title: e.title,
      organizer: e.organizerName ?? e.organizerEmail ?? "—",
      sold: 0,
      capacity: 0,
      revenue: rev?.revenue ?? 0,
      currency: rev?.currency ?? "USD",
    }
  })

  // ── Pending review ─────────────────────────────────────────────────────

  const draftEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      category: events.category,
      organizerName: users.name,
      organizerEmail: users.email,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(eq(events.status, "draft"))
    .orderBy(desc(events.createdAt))
    .limit(10)

  const unverifiedUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(sql`${users.emailVerified} IS NULL`)
    .orderBy(desc(users.createdAt))
    .limit(10)

  const PENDING: Pending[] = [
    ...draftEvents.map((e) => ({
      kind: "Draft event",
      title: e.title,
      detail: `by ${e.organizerName ?? e.organizerEmail ?? "—"}`,
      primary: "Publish",
      action: publishEventAction,
      id: e.id,
      description: e.description ?? "",
      category: e.category ?? "",
    })),
    ...unverifiedUsers.map((u) => ({
      kind: "Unverified user",
      title: u.name ?? "—",
      detail: u.email ?? "—",
      primary: "Verify email",
      action: verifyUserEmailAction,
      id: u.id,
      description: "",
      category: "",
    })),
  ]

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Overview"
        title="Platform pulse"
        subtitle="Real-time activity across organizers, vendors, and attendees."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-8">
        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {KPIS.length > 0 ? KPIS.map(({ label, value, currency, delta, up, spark }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <p className="text-[11.5px] text-ink-3 mb-2.5">{label}</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {currency ? formatCurrency(value, currency) : value.toLocaleString()}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium ${up ? "text-green-700" : "text-rose-700"}`}>
                  {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(delta).toFixed(1)}% MoM
                </span>
                <div className="flex-1 max-w-[120px]">
                  <Sparkline points={spark} up={up} />
                </div>
              </div>
            </div>
          )) : (
            <>
              {["Gross volume", "Net revenue", "Active events", "New users"].map((label) => (
                <div key={label} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
                  <p className="text-[11.5px] text-ink-3 mb-2.5">{label}</p>
                  <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">0</p>
                  <div className="mt-3">
                    <span className="text-[11.5px] text-ink-3">No data yet</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Velocity summary */}
        <div className="tp-fade-up-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex w-6 h-6 items-center justify-center rounded-md bg-indigo-50">
                <Activity size={12} className="text-indigo-600" />
              </span>
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">Velocity payments</h2>
            </div>
            <Link href="/admin/velocity" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
              Transaction viewer <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <p className="text-[11.5px] text-ink-3 mb-2.5">Velocity revenue</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {formatCurrency(velocityRevenue, "USD")}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <p className="text-[11.5px] text-ink-3 mb-2.5">Total transactions</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {velocityTotal.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <p className="text-[11.5px] text-ink-3 mb-2.5">Pending / awaiting</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {velocityPending.toLocaleString()}
              </p>
              {velocityPending > 0 && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-semibold">
                    <AlertCircle size={10} /> Needs recheck
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <p className="text-[11.5px] text-ink-3 mb-2.5">Completed</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {velocityPaid.toLocaleString()}
              </p>
              {velocityPaid > 0 && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                    <CreditCard size={10} /> Settled
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Purchase journey funnel + AI Brief */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 tp-fade-up-1">
          <div className="lg:col-span-3">
            <PurchaseFunnel />
          </div>
          <div className="lg:col-span-2">
            <AiBriefCard
              activeEvents={activeEvents}
              totalOrganizers={totalOrganizers}
              totalRevenue={grossVolume}
              topCategory={topCategory}
              topCity={topCity}
            />
          </div>
        </div>

        {/* Activity + Top events */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 tp-fade-up-2">
          <div className="lg:col-span-3 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Recent orders</h2>
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
                title="No orders yet"
                body="Orders and payments will appear here."
                variant="inline"
              />
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Published events</h2>
              <Link href="/admin/events" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                Manage <ArrowUpRight size={12} />
              </Link>
            </div>
            {TOP_EVENTS.length > 0 ? (
              <ul className="divide-y divide-line">
                {TOP_EVENTS.map((e) => (
                  <li key={e.id} className="px-5 md:px-6 py-3.5 hover:bg-paper-2 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                        <p className="text-[11.5px] text-ink-3 mt-0.5">{e.organizer}</p>
                      </div>
                      <p className="text-[13px] font-bold tracking-tight text-ink whitespace-nowrap">
                        {e.revenue > 0 ? formatCurrency(e.revenue, e.currency) : "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="No published events"
                body="Published events will appear here."
                variant="inline"
              />
            )}
          </div>
        </div>

        {/* Pending review */}
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
                    {p.kind === "Draft event" && p.description && (
                      <div className="mt-2">
                        <AiModerateButton title={p.title} description={p.description} category={p.category} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={p.action.bind(null, p.id)}>
                      <button
                        type="submit"
                        className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-[12.5px] font-semibold shadow-sm shadow-green-600/20 hover:bg-green-700 transition-colors"
                      >
                        {p.primary}
                      </button>
                    </form>
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
