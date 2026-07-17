import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowUpRight, AlertTriangle, CalendarCheck, CreditCard,
  Users, Activity, CheckCircle2, Clock, TrendingUp,
  Zap, FileWarning, Ticket,
} from "lucide-react"
import { desc, eq, sql, and, gte, inArray, isNull, lt } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, orders, payouts, reviews, users } from "@/db/schema"
import { formatCurrency } from "@/lib/utils"
import { approveEventAction, rejectEventAction } from "@/app/admin/actions/events"
import { verifyUserEmailAction, approveOrganizerAction } from "@/app/admin/actions/users"
import RejectEventButton from "@/app/admin/actions/RejectEventButton"
import PollNowButton from "@/app/admin/_components/PollNowButton"
import AiBriefCard from "@/components/ai/AiBriefCard"
import PurchaseFunnel from "@/components/dashboard/PurchaseFunnel"
import AiModerateButton from "@/components/ai/AiModerateButton"
import { getSmsBalance } from "@/lib/velocity/sms"

function MiniSparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (points.length < 2) return <span className="text-[11px] text-ink-3">—</span>
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const w = 56, h = 20, pad = 1
  const step = (w - pad * 2) / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = pad + i * step
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-5 shrink-0" aria-hidden>
      <polyline points={coords} fill="none"
        stroke={positive ? "rgb(5 150 105)" : "rgb(220 38 38)"}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DeltaBadge({ delta, inverted = false }: { delta: number; inverted?: boolean }) {
  const positive = inverted ? delta <= 0 : delta >= 0
  const sign = delta >= 0 ? "+" : ""
  return (
    <span className={`text-[11px] font-medium tabular-nums ${positive ? "text-emerald-700" : "text-rose-600"}`}>
      {sign}{delta.toFixed(1)}%
    </span>
  )
}

export default async function AdminOverviewPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin")
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const hasVelocity = sql`${orders.metadata}->>'velocity' IS NOT NULL`

  // Parallel data fetching
  const [
    [revenueRow],
    [activeEventsRow],
    [newUsersRow],
    [orgCountRow],
    dailyRevenue7d,
    dailyRevenue14d,
    [topCatRow],
    [topCityRow],
    recentOrders,
    topEventRows,
    draftEvents,
    pendingOrganizers,
    unverifiedUsers,
    [velocityCountRow],
    [velocityRevenueRow],
    [pendingPayoutsRow],
    [pendingReviewsRow],
    moneyPathIssueRows,
  ] = await Promise.all([
    db.select({ gross: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(eq(orders.status, "paid"), hasVelocity)),

    db.select({ count: sql<number>`COUNT(*)::int` }).from(events).where(eq(events.status, "published")),

    db.select({ count: sql<number>`COUNT(*)::int` }).from(users).where(gte(users.createdAt, thisMonthStart)),

    db.select({ count: sql<number>`COUNT(*)::int` }).from(users).where(eq(users.role, "organizer")),

    db.select({ day: sql<string>`DATE(${orders.createdAt})`, total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(eq(orders.status, "paid"), hasVelocity, gte(orders.createdAt, sevenDaysAgo)))
      .groupBy(sql`DATE(${orders.createdAt})`).orderBy(sql`DATE(${orders.createdAt})`),

    db.select({ day: sql<string>`DATE(${orders.createdAt})`, total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(eq(orders.status, "paid"), hasVelocity, gte(orders.createdAt, fourteenDaysAgo), lt(orders.createdAt, sevenDaysAgo)))
      .groupBy(sql`DATE(${orders.createdAt})`),

    db.select({ category: events.category, count: sql<number>`COUNT(*)::int` })
      .from(events).where(eq(events.status, "published"))
      .groupBy(events.category).orderBy(sql`COUNT(*) DESC`).limit(1),

    db.select({ city: events.city, count: sql<number>`COUNT(*)::int` })
      .from(events).where(eq(events.status, "published"))
      .groupBy(events.city).orderBy(sql`COUNT(*) DESC`).limit(1),

    db.select({ id: orders.id, totalAmount: orders.totalAmount, currency: orders.currency, status: orders.status, createdAt: orders.createdAt, contactName: orders.guestName })
      .from(orders).orderBy(desc(orders.createdAt)).limit(12),

    db.select({ id: events.id, title: events.title, organizerName: users.name, organizerEmail: users.email })
      .from(events).leftJoin(users, eq(events.organizerId, users.id))
      .where(eq(events.status, "published")).orderBy(desc(events.createdAt)).limit(8),

    db.select({ id: events.id, title: events.title, description: events.description, category: events.category, organizerName: users.name, organizerEmail: users.email })
      .from(events).leftJoin(users, eq(events.organizerId, users.id))
      .where(eq(events.status, "pending_review")).orderBy(desc(events.createdAt)).limit(10),

    db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, createdAt: users.createdAt })
      .from(users).where(and(eq(users.role, "organizer"), isNull(users.approvedAt)))
      .orderBy(desc(users.createdAt)).limit(10),

    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users).where(isNull(users.emailVerified))
      .orderBy(desc(users.createdAt)).limit(10),

    db.select({
      total: sql<number>`COUNT(*)::int`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'pending')::int`,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'paid')::int`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('expired', 'cancelled'))::int`,
    }).from(orders).where(hasVelocity),

    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(hasVelocity, eq(orders.status, "paid"))),

    db.select({ count: sql<number>`COUNT(*)::int`, total: sql<string>`COALESCE(SUM(${payouts.amount}), 0)` })
      .from(payouts).where(eq(payouts.status, "pending")),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(reviews).where(eq(reviews.status, "pending")),

    db.execute(sql`
      WITH confirmed_orders AS (
        SELECT id, metadata
        FROM orders
        WHERE status IN ('paid', 'completed')
      ),
      ticket_counts AS (
        SELECT order_id, COUNT(*)::int AS ticket_count
        FROM tickets
        WHERE order_id IN (SELECT id FROM confirmed_orders)
          AND is_staff_ticket = false
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY order_id
      ),
      duplicate_ledgers AS (
        SELECT order_id
        FROM payment_ledger
        GROUP BY order_id
        HAVING COUNT(*) > 1
      )
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(tc.ticket_count, 0) = 0)::int AS paid_no_tickets,
        COUNT(*) FILTER (WHERE COALESCE(confirmed_orders.metadata->'delivery'->>'status', '') IN ('FAILED', 'EMAIL_FAILED'))::int AS delivery_attention,
        (SELECT COUNT(*)::int FROM duplicate_ledgers)::int AS duplicate_ledgers
      FROM confirmed_orders
      LEFT JOIN ticket_counts tc ON tc.order_id = confirmed_orders.id
    `),
  ])

  const grossVolume = Number(revenueRow?.gross ?? 0)
  const activeEvents = activeEventsRow?.count ?? 0
  const newUsers = newUsersRow?.count ?? 0
  const totalOrganizers = orgCountRow?.count ?? 0
  const topCategory = topCatRow?.category ?? "N/A"
  const topCity = topCityRow?.city ?? "N/A"
  const velocityRevenue = Number(velocityRevenueRow?.total ?? 0)
  const velocityPending = velocityCountRow?.pending ?? 0
  const velocityPaid = velocityCountRow?.paid ?? 0
  const velocityFailed = velocityCountRow?.failed ?? 0
  const pendingPayouts = pendingPayoutsRow?.count ?? 0
  const pendingPayoutTotal = Number(pendingPayoutsRow?.total ?? 0)
  const pendingReviews = pendingReviewsRow?.count ?? 0
  const moneyPathIssues = (moneyPathIssueRows.rows?.[0] ?? {}) as { paid_no_tickets?: number; delivery_attention?: number; duplicate_ledgers?: number }
  const paidNoTickets = Number(moneyPathIssues.paid_no_tickets ?? 0)
  const deliveryAttention = Number(moneyPathIssues.delivery_attention ?? 0)
  const duplicateLedgers = Number(moneyPathIssues.duplicate_ledgers ?? 0)

  const smsBalance = await getSmsBalance().then((b) => b.balance).catch(() => null)

  const spark7 = dailyRevenue7d.map(d => Number(d.total))
  const spark14 = dailyRevenue14d.map(d => Number(d.total))
  const sum7 = spark7.reduce((a, b) => a + b, 0)
  const sum14 = spark14.reduce((a, b) => a + b, 0)
  const revDelta = sum14 > 0 ? ((sum7 - sum14) / sum14) * 100 : 0

  // Event revenue map
  const eventIds = topEventRows.map(e => e.id)
  const eventRevenue = eventIds.length > 0
    ? await db.select({ eventId: orders.eventId, revenue: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`, currency: orders.currency })
        .from(orders).where(and(eq(orders.status, "paid"), hasVelocity, inArray(orders.eventId, eventIds)))
        .groupBy(orders.eventId, orders.currency)
    : []
  const revMap = new Map<string, { revenue: number; currency: string }>()
  for (const r of eventRevenue) {
    if (!r.eventId) continue
    const existing = revMap.get(r.eventId)
    const amt = Number(r.revenue ?? 0)
    if (!existing || amt > existing.revenue) revMap.set(r.eventId, { revenue: amt, currency: r.currency ?? "USD" })
  }

  const pendingReview = [...draftEvents, ...unverifiedUsers, ...pendingOrganizers]
  const pendingOrganizerReviewed = draftEvents.length + unverifiedUsers.length + pendingOrganizers.length
  const operationsQueue = [
    { label: "Paid, no tickets", value: paidNoTickets, href: "/admin/orders", icon: Ticket, tone: "rose", detail: "Confirmed money path without issued tickets" },
    { label: "Delivery attention", value: deliveryAttention, href: "/admin/orders", icon: FileWarning, tone: "amber", detail: "Email or ticket delivery needs action" },
    { label: "Duplicate ledgers", value: duplicateLedgers, href: "/admin/reconciliation", icon: AlertTriangle, tone: "rose", detail: "Multiple payment records on one order" },
    { label: "Velocity pending", value: velocityPending, href: "/admin/velocity?status=pending", icon: Zap, tone: "amber", detail: "Gateway confirmations still unresolved" },
    { label: "Payout requests", value: pendingPayouts, href: "/admin/payouts?status=pending", icon: CreditCard, tone: "green", detail: `${formatCurrency(pendingPayoutTotal, "USD")} waiting for review` },
    { label: "Reviews", value: pendingReviews, href: "/admin/reviews", icon: CheckCircle2, tone: "blue", detail: "Customer reviews awaiting moderation" },
    { label: "Pending events", value: draftEvents.length, href: "#review", icon: CalendarCheck, tone: "amber", detail: "Submitted for review, not yet approved" },
    { label: "Unverified users", value: unverifiedUsers.length, href: "#review", icon: Users, tone: "amber", detail: "Accounts awaiting email verification" },
    { label: "Pending organizers", value: pendingOrganizers.length, href: "#review", icon: Users, tone: "blue", detail: "Organizer accounts awaiting approval" },
  ].filter((item) => item.value > 0)
  const hasPendingAction = operationsQueue.length > 0

  return (
    <div className="tp-fade-up">
      {/* Header strip */}
      <div className="border-b border-line bg-paper">
        <div className="px-5 md:px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-1">Admin</p>
            <h1 className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none">Platform overview</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PollNowButton />
            <Link href="/admin/velocity" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink hover:border-line-2 transition-colors">
              <Zap size={13} className="text-amber-500" /> Velocity
            </Link>
            <Link href="/admin/orders" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-ink/90 transition-colors">
              <Activity size={13} /> All orders
            </Link>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 py-8 space-y-8">

        {/* Action alert — only shown when there's something that needs doing */}
        {hasPendingAction && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-start gap-3 tp-fade-up-1">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-amber-900">
                {[
                  operationsQueue.length > 0 && `${operationsQueue.length} queue item${operationsQueue.length !== 1 ? "s" : ""} need attention`,
                  pendingReview.length > 0 && `${pendingReview.length} review item${pendingReview.length !== 1 ? "s" : ""}`,
                  velocityPending > 0 && `${velocityPending} Velocity payment${velocityPending !== 1 ? "s" : ""} pending`,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Link href="#operations" className="shrink-0 text-[12px] font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2">
              Open queue
            </Link>
          </div>
        )}

        <div id="operations" className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-1">
          <div className="px-5 py-4 border-b border-line flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-ink">Operations queue</p>
              <p className="text-[12px] text-ink-2 mt-0.5">Money path, delivery, moderation, publishing, and payout checks that need admin attention.</p>
            </div>
            <Link href="/admin/reconciliation" className="inline-flex items-center gap-1 text-[12px] font-semibold text-navy">
              Open reconciliation <ArrowUpRight size={11} />
            </Link>
          </div>
          {operationsQueue.length === 0 ? (
            <div className="px-5 py-5 flex items-center gap-3 text-[13px] text-emerald-700">
              <CheckCircle2 size={16} className="text-emerald-600" />
              No critical admin work waiting right now.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line">
              {operationsQueue.slice(0, 4).map(({ label, value, href, icon: Icon, tone, detail }) => (
                <Link key={label} href={href} className="px-5 py-4 hover:bg-paper-2 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex w-8 h-8 items-center justify-center rounded-lg ring-1 ${
                      tone === "rose" ? "bg-rose-50 text-rose-700 ring-rose-200" :
                      tone === "green" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                      tone === "blue" ? "bg-blue/10 text-blue ring-blue/20" :
                      "bg-amber-50 text-amber-700 ring-amber-200"
                    }`}>
                      <Icon size={15} />
                    </span>
                    <ArrowUpRight size={12} className="text-ink-3" />
                  </div>
                  <p className="mt-3 text-[22px] font-bold text-ink tabular-nums">{value.toLocaleString()}</p>
                  <p className="mt-1 text-[12px] font-semibold text-ink-2">{label}</p>
                  <p className="mt-1 text-[11px] text-ink-3 leading-snug">{detail}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Primary metrics — horizontal rule, not cards */}
        <div className="tp-fade-up-1">
          <div className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-line border border-line rounded-2xl bg-paper overflow-hidden">
            {[
              { label: "Velocity revenue (7d)", value: formatCurrency(sum7, "USD"), sub: <DeltaBadge delta={revDelta} />, spark: spark7 },
              { label: "Active events", value: activeEvents.toLocaleString(), sub: <span className="text-[11px] text-ink-3">published</span>, spark: [] },
              { label: "New users (month)", value: newUsers.toLocaleString(), sub: <span className="text-[11px] text-ink-3">this month</span>, spark: [] },
              { label: "Velocity paid", value: velocityPaid.toLocaleString(), sub: <span className="text-[11px] text-ink-3">orders confirmed</span>, spark: [] },
              {
                label: "SMS credits",
                value: smsBalance !== null ? smsBalance.toLocaleString() : "—",
                sub: smsBalance !== null
                  ? <span className={`text-[11px] ${smsBalance < 100 ? "text-rose-600 font-semibold" : "text-ink-3"}`}>
                      {smsBalance < 100 ? "low — top up" : "VelocityAfrica"}
                    </span>
                  : <span className="text-[11px] text-rose-600">unreachable</span>,
                spark: [],
              },
            ].map(({ label, value, sub, spark }, i) => (
              <div key={i} className="px-5 py-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] text-ink-3 mb-2">{label}</p>
                  <p className="text-[24px] md:text-[26px] font-bold tracking-tight text-ink leading-none tabular-nums">{value}</p>
                  <div className="mt-1.5">{sub}</div>
                </div>
                {spark.length >= 2 && <MiniSparkline points={spark} positive={revDelta >= 0} />}
              </div>
            ))}
          </div>
        </div>

        {/* Two-column: funnel + AI brief */}
        <div className="grid lg:grid-cols-[3fr_2fr] gap-4 tp-fade-up-2">
          <PurchaseFunnel />
          <AiBriefCard
            activeEvents={activeEvents}
            totalOrganizers={totalOrganizers}
            totalRevenue={grossVolume}
            topCategory={topCategory}
            topCity={topCity}
          />
        </div>

        {/* Velocity + recent orders side by side */}
        <div className="grid lg:grid-cols-[2fr_3fr] gap-4 tp-fade-up-2">
          {/* Velocity panel */}
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-500" />
                <h2 className="text-[14px] font-semibold text-ink">Velocity</h2>
              </div>
              <Link href="/admin/velocity" className="text-[12px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                Viewer <ArrowUpRight size={11} />
              </Link>
            </div>
            <div className="divide-y divide-line">
              {[
                { label: "Collected revenue", value: formatCurrency(velocityRevenue, "USD"), accent: "text-emerald-700" },
                { label: "Pending confirmation", value: velocityPending.toLocaleString(), accent: velocityPending > 0 ? "text-amber-700" : "text-ink" },
                { label: "Completed orders", value: velocityPaid.toLocaleString(), accent: "text-ink" },
                { label: "Failed / cancelled", value: velocityFailed.toLocaleString(), accent: velocityFailed > 0 ? "text-rose-700" : "text-ink" },
              ].map(({ label, value, accent }) => (
                <div key={label} className="px-5 py-3.5 flex items-center justify-between">
                  <span className="text-[13px] text-ink-2">{label}</span>
                  <span className={`text-[14px] font-bold tabular-nums ${accent}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent orders */}
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-ink">Recent orders</h2>
              <Link href="/admin/orders" className="text-[12px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                All <ArrowUpRight size={11} />
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {recentOrders.length === 0 ? (
                <li className="px-5 py-8 text-center text-[13px] text-ink-3">No orders yet</li>
              ) : recentOrders.slice(0, 8).map((o, i) => (
                <li key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-paper-2 transition-colors">
                  <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${o.status === "paid" ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <span className="flex-1 text-[13px] text-ink truncate">{o.contactName ?? "Guest"}</span>
                  <span className="text-[12px] font-semibold text-ink tabular-nums">{formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}</span>
                  <span className="text-[11px] text-ink-3 whitespace-nowrap hidden md:block">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Published events */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck size={14} className="text-ink-3" />
              <h2 className="text-[14px] font-semibold text-ink">Published events</h2>
            </div>
            <Link href="/admin/events" className="text-[12px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
              Manage all <ArrowUpRight size={11} />
            </Link>
          </div>
          {topEventRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">No published events</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                    <th className="text-left px-5 py-3">Event</th>
                    <th className="text-left px-3 py-3">Organizer</th>
                    <th className="text-right px-5 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {topEventRows.map((e) => {
                    const rev = revMap.get(e.id)
                    return (
                      <tr key={e.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-3 max-w-xs">
                          <Link href={`/admin/events`} className="text-[14px] font-semibold text-ink hover:text-navy transition-colors line-clamp-1">
                            {e.title}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-ink-2">{e.organizerName ?? e.organizerEmail ?? "—"}</td>
                        <td className="px-5 py-3 text-right text-[13px] font-bold text-ink tabular-nums">
                          {rev ? formatCurrency(rev.revenue, rev.currency) : <span className="text-ink-3 font-normal">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending review — actionable section */}
        <div id="review" className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileWarning size={14} className="text-ink-3" />
              <h2 className="text-[14px] font-semibold text-ink">Pending review</h2>
              {pendingReview.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {pendingReview.length}
                </span>
              )}
            </div>
          </div>
          {pendingReview.length === 0 ? (
            <div className="px-5 py-8 flex items-center gap-3 text-[13px] text-emerald-700">
              <CheckCircle2 size={16} className="text-emerald-500" />
              All clear — nothing waiting for review.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {draftEvents.map((e) => (
                <li key={e.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-ink-3 bg-paper-2 px-1.5 py-0.5 rounded">Pending review</span>
                    </div>
                    <p className="text-[14px] font-semibold text-ink">{e.title}</p>
                    <p className="text-[12px] text-ink-2">by {e.organizerName ?? e.organizerEmail ?? "—"}</p>
                    {e.description && (
                      <div className="mt-2">
                        <AiModerateButton title={e.title} description={e.description} category={e.category ?? ""} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RejectEventButton eventId={e.id} action={rejectEventAction} compact />
                    <form action={approveEventAction.bind(null, e.id)}>
                      <button type="submit" className="rounded-lg bg-ink text-white px-4 py-2 text-[13px] font-semibold hover:bg-ink/85 transition-colors">
                        Approve
                      </button>
                    </form>
                  </div>
                </li>
              ))}
              {unverifiedUsers.map((u) => (
                <li key={u.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-ink-3 bg-paper-2 px-1.5 py-0.5 rounded">Unverified user</span>
                    </div>
                    <p className="text-[14px] font-semibold text-ink">{u.name ?? "—"}</p>
                    <p className="text-[12px] text-ink-2">{u.email}</p>
                  </div>
                  <form action={verifyUserEmailAction.bind(null, u.id)} className="shrink-0">
                    <button type="submit" className="rounded-lg border border-line bg-paper text-ink px-4 py-2 text-[13px] font-semibold hover:bg-paper-2 transition-colors">
                      Verify email
                    </button>
                  </form>
                </li>
              ))}
              {pendingOrganizers.map((u: { id: string; name: string | null; email: string | null; phone: string | null }) => (
                <li key={u.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-blue bg-blue/10 px-1.5 py-0.5 rounded">Pending organizer</span>
                      {!u.phone && (
                        <span className="text-[10px] font-bold tracking-widest uppercase text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">Missing WhatsApp</span>
                      )}
                    </div>
                    <p className="text-[14px] font-semibold text-ink">{u.name ?? "—"}</p>
                    <p className="text-[12px] text-ink-2">{u.email}</p>
                    <p className="text-[12px] text-ink-3">WhatsApp: {u.phone ?? "Not provided"}</p>
                  </div>
                  <form action={approveOrganizerAction.bind(null, u.id)} className="shrink-0">
                    <button type="submit" className="rounded-lg bg-ink text-white px-4 py-2 text-[13px] font-semibold hover:bg-ink/85 transition-colors">
                      Approve
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer quick links */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] tp-fade-up-3">
          {[
            { label: "Users", href: "/admin/users", icon: Users },
            { label: "Payouts", href: "/admin/payouts", icon: CreditCard },
            { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
            { label: "Settings", href: "/admin/settings", icon: Clock },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink transition-colors font-medium">
              <Icon size={13} className="text-ink-3" /> {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
