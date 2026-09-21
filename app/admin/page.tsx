import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  FileWarning,
  Inbox,
  Ticket,
  Users,
  Zap,
} from "lucide-react"
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, orders, payouts, reviews, users } from "@/db/schema"
import { formatCurrency } from "@/lib/utils"
import { ACTIVE_PAYOUT_STATUSES } from "@/lib/revenue-summary"
import { ORDER_ISSUES, ORDER_ISSUE_WINDOW_DAYS, orderIssueCondition, orderIssueWindowStart } from "@/lib/order-issues"
import { HEARTBEAT_KEYS, ageLabel, getHeartbeats } from "@/lib/heartbeat"
import { approveEventAction, rejectEventAction } from "@/app/admin/actions/events"
import { approveOrganizerAction, rejectOrganizerAction, verifyUserEmailAction } from "@/app/admin/actions/users"
import RejectEventButton from "@/app/admin/actions/RejectEventButton"
import EmptyState from "@/components/dashboard/EmptyState"
import PollNowButton from "@/app/admin/_components/PollNowButton"

type QueueTone = "rose" | "amber" | "green" | "blue"

function queueToneClasses(tone: QueueTone) {
  return tone === "rose"
    ? "bg-rose-50 text-rose-700 ring-rose-200"
    : tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "blue"
        ? "bg-blue/10 text-blue ring-blue/20"
        : "bg-amber-50 text-amber-700 ring-amber-200"
}

function orderStatus(status: string | null) {
  if (status === "paid" || status === "completed") {
    return { label: status === "completed" ? "Completed" : "Paid", className: "text-emerald-700 bg-emerald-50" }
  }
  if (status === "failed" || status === "cancelled" || status === "expired") {
    return { label: status[0].toUpperCase() + status.slice(1), className: "text-rose-700 bg-rose-50" }
  }
  return { label: status ? status.replaceAll("_", " ") : "Unknown", className: "text-amber-800 bg-amber-50" }
}

export default async function AdminOverviewPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin")
  }

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const hasVelocity = sql`${orders.metadata}->>'velocity' IS NOT NULL`
  const liveEventWindow = or(isNull(events.endsAt), gte(events.endsAt, now))
  const issueWindowStart = orderIssueWindowStart(now)
  const heartbeatsPromise = getHeartbeats([HEARTBEAT_KEYS.cronTick, HEARTBEAT_KEYS.velocityWebhook]).catch((error) => {
    console.error("[admin] heartbeat read failed", error)
    return null
  })

  const [
    [activeEventsRow],
    [newUsersRow],
    recentOrders,
    topEventRows,
    draftEvents,
    pendingOrganizers,
    unverifiedUsers,
    [velocityCountRow],
    [pendingPayoutsRow],
    [pendingReviewsRow],
    [staleDraftsRow],
    [staleReviewsRow],
    [noEventOrganizersRow],
    [frozenOrganizersRow],
    [stalePaymentRow],
    orderIssueCounts,
  ] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(events)
      .where(and(eq(events.status, "published"), liveEventWindow)),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(gte(users.createdAt, thisMonthStart)),

    db.select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      status: orders.status,
      createdAt: orders.createdAt,
      contactName: orders.guestName,
      eventTitle: events.title,
    })
      .from(orders)
      .leftJoin(events, eq(orders.eventId, events.id))
      .orderBy(desc(orders.createdAt))
      .limit(8),

    db.select({
      id: events.id,
      title: events.title,
      organizerName: users.name,
      organizerEmail: users.email,
    })
      .from(events)
      // Cast both sides so this remains safe when an older deployment has a
      // UUID organizer column while the current schema uses text IDs.
      .leftJoin(users, sql`${events.organizerId}::text = ${users.id}::text`)
      .where(and(eq(events.status, "published"), liveEventWindow))
      .orderBy(desc(events.createdAt))
      .limit(6),

    db.select({
      id: events.id,
      title: events.title,
      description: events.description,
      category: events.category,
      organizerName: users.name,
      organizerEmail: users.email,
      total: sql<number>`COUNT(*) OVER()::int`,
    })
      .from(events)
      .leftJoin(users, sql`${events.organizerId}::text = ${users.id}::text`)
      .where(eq(events.status, "pending_review"))
      .orderBy(desc(events.createdAt))
      .limit(5),

    db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      total: sql<number>`COUNT(*) OVER()::int`,
    })
      .from(users)
      .where(and(eq(users.role, "organizer"), isNull(users.approvedAt)))
      .orderBy(desc(users.createdAt))
      .limit(5),

    db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      total: sql<number>`COUNT(*) OVER()::int`,
    })
      .from(users)
      // Organizers awaiting approval already appear in the organiser list above (approval requires a verified email); counting them here too double-counted them.
      .orderBy(desc(users.createdAt))
      .limit(5),

    db.select({
      pending: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'pending')::int`,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('paid', 'completed'))::int`,
    })
      .from(orders)
      .where(hasVelocity),

    db.select({
      count: sql<number>`COUNT(*)::int`,
      total: sql<string>`COALESCE(SUM(${payouts.amount}), 0)`,
    })
      .from(payouts)
      .where(inArray(payouts.status, [...ACTIVE_PAYOUT_STATUSES])),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(reviews)
      .where(eq(reviews.status, "pending")),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(events)
      .where(and(
        eq(events.status, "draft"),
        sql`COALESCE(${events.updatedAt}, ${events.createdAt}) < NOW() - INTERVAL '14 days'`,
      )),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(events)
      .where(and(
        eq(events.status, "pending_review"),
        sql`${events.createdAt} < NOW() - INTERVAL '24 hours'`,
      )),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(and(
        eq(users.role, "organizer"),
        sql`NOT EXISTS (SELECT 1 FROM events e_without_event WHERE e_without_event.organizer_id::text = ${users.id}::text)`,
      )),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(and(eq(users.role, "organizer"), sql`${users.organizerFrozenAt} IS NOT NULL`)),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(orders)
      .where(and(
        sql`${orders.status} IN ('pending', 'awaiting_verification')`,
        sql`${orders.createdAt} < NOW() - INTERVAL '30 minutes'`,
      )),

    // Shared definitions (lib/order-issues), windowed so the overview never scans all history.
    // A slow or failing count degrades to "unavailable" instead of blanking the whole page.
    Promise.all(ORDER_ISSUES.map((issue) =>
      db.select({ count: sql<number>`COUNT(*)::int` }).from(orders)
        .where(and(orderIssueCondition(issue), gte(orders.createdAt, issueWindowStart))),
    )).then(([noTickets, delivery, duplicate]) => ({
      ok: true as const,
      paid_no_tickets: noTickets[0]?.count ?? 0,
      delivery_failed: delivery[0]?.count ?? 0,
      duplicate_ledger: duplicate[0]?.count ?? 0,
    })).catch((error) => {
      console.error("[admin] order issue counts failed", error)
      return { ok: false as const, paid_no_tickets: 0, delivery_failed: 0, duplicate_ledger: 0 }
    }),
  ])

  const heartbeats = await heartbeatsPromise
  const cronBeat = heartbeats?.get(HEARTBEAT_KEYS.cronTick)
  const webhookBeat = heartbeats?.get(HEARTBEAT_KEYS.velocityWebhook)
  const cronAgeMin = cronBeat?.lastSuccessAt ? (now.getTime() - cronBeat.lastSuccessAt.getTime()) / 60_000 : null
  const cronState: "ok" | "warn" | "bad" | "unknown" = !heartbeats ? "unknown" : cronAgeMin === null ? "bad" : cronAgeMin <= 5 ? "ok" : cronAgeMin <= 15 ? "warn" : "bad"
  const webhookRejected = !!webhookBeat?.lastErrorAt && (!webhookBeat.lastSuccessAt || webhookBeat.lastErrorAt > webhookBeat.lastSuccessAt)
  const asOf = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Harare" })

  const activeEvents = activeEventsRow?.count ?? 0
  const newUsers = newUsersRow?.count ?? 0
  const velocityPending = velocityCountRow?.pending ?? 0
  const velocityPaid = velocityCountRow?.paid ?? 0
  const pendingPayouts = pendingPayoutsRow?.count ?? 0
  const pendingPayoutTotal = Number(pendingPayoutsRow?.total ?? 0)
  const pendingReviews = pendingReviewsRow?.count ?? 0
  const paidNoTickets = orderIssueCounts.paid_no_tickets
  const deliveryAttention = orderIssueCounts.delivery_failed
  const duplicateLedgers = orderIssueCounts.duplicate_ledger
  const pendingEventCount = Number(draftEvents[0]?.total ?? 0)
  const pendingOrganizerCount = Number(pendingOrganizers[0]?.total ?? 0)
  const unverifiedUserCount = Number(unverifiedUsers[0]?.total ?? 0)
  const pendingReviewCount = pendingEventCount + pendingOrganizerCount + unverifiedUserCount
  const staleDraftCount = staleDraftsRow?.count ?? 0
  const staleReviewCount = staleReviewsRow?.count ?? 0
  const noEventOrganizerCount = noEventOrganizersRow?.count ?? 0
  const frozenOrganizerCount = frozenOrganizersRow?.count ?? 0
  const stalePaymentCount = stalePaymentRow?.count ?? 0

  const operationsQueue = [
    { label: "Stale payment checks", value: stalePaymentCount, href: "/admin/orders?status=pending", icon: CreditCard, tone: "rose" as const, detail: "Pending or verification orders older than 30 minutes" },
    { label: "Paid, no tickets", value: paidNoTickets, href: "/admin/orders?issue=paid_no_tickets", icon: Ticket, tone: "rose" as const, detail: `Confirmed payment without issued tickets (last ${ORDER_ISSUE_WINDOW_DAYS} days)` },
    { label: "Delivery attention", value: deliveryAttention, href: "/admin/orders?issue=delivery_failed", icon: FileWarning, tone: "amber" as const, detail: `Ticket or email delivery needs action (last ${ORDER_ISSUE_WINDOW_DAYS} days)` },
    { label: "Duplicate ledgers", value: duplicateLedgers, href: "/admin/orders?issue=duplicate_ledger", icon: AlertTriangle, tone: "rose" as const, detail: `Multiple settled payment records (last ${ORDER_ISSUE_WINDOW_DAYS} days)` },
    { label: "Velocity pending", value: velocityPending, href: "/admin/velocity?status=pending", icon: Zap, tone: "amber" as const, detail: "Gateway confirmations unresolved" },
    { label: "Payout requests", value: pendingPayouts, href: "/admin/payouts?status=pending", icon: CreditCard, tone: "amber" as const, detail: `${formatCurrency(pendingPayoutTotal, "USD")} awaiting review` },
    { label: "Reviews", value: pendingReviews, href: "/admin/reviews", icon: CheckCircle2, tone: "blue" as const, detail: "Customer reviews awaiting moderation" },
    { label: "Stale event drafts", value: staleDraftCount, href: "/admin/events?status=draft", icon: FileWarning, tone: "amber" as const, detail: "Draft events untouched for 14+ days" },
    { label: "Old event reviews", value: staleReviewCount, href: "/admin/events?status=pending_review", icon: CalendarCheck, tone: "amber" as const, detail: "Publish requests waiting over 24 hours" },
    { label: "Frozen organisers", value: frozenOrganizerCount, href: "/admin/organizers?status=frozen", icon: Users, tone: "blue" as const, detail: "No-event accounts paused from organiser tools" },
    { label: "No-event organisers", value: noEventOrganizerCount, href: "/admin/organizers?status=no_event", icon: Users, tone: "blue" as const, detail: "Accounts needing onboarding follow-up" },
    { label: "Approvals & verification", value: pendingReviewCount, href: "#review", icon: Users, tone: "blue" as const, detail: "Events, organisers awaiting approval, and unverified attendee/vendor accounts" },
  ].filter((item) => item.value > 0)

  const actionCount = operationsQueue.reduce((total, item) => total + item.value, 0)
  const hasPendingAction = actionCount > 0

  return (
    <div className="tp-fade-up">
      <div className="border-b border-line bg-paper">
        <div className="px-5 md:px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-1">Admin</p>
            <h1 className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none">Platform overview</h1>
            <p className="mt-2 text-[13px] text-ink-2">The work that needs attention, at a glance. <span className="text-ink-3">Data as of {asOf} (Harare).</span></p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PollNowButton />
            <Link href="/admin/reconciliation" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] font-medium text-ink hover:border-line-2 transition-colors">
              <Zap size={13} className="text-amber-500" /> Reconciliation
            </Link>
            <Link href="/admin/orders" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2.5 text-[13px] font-semibold text-paper hover:bg-ink/90 transition-colors">
              <Activity size={13} /> All orders
            </Link>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 py-8 space-y-6">
        <section aria-label="System health" className="grid sm:grid-cols-2 gap-3">
          {[
            {
              label: "Scheduler (cron tick)",
              tone: cronState,
              value: !heartbeats ? "Health data unavailable" : cronBeat?.lastSuccessAt ? `Last ran ${ageLabel(cronBeat.lastSuccessAt, now)}` : "No heartbeat recorded yet",
              detail: cronState === "ok" ? "Payments are being rechecked every minute." : cronState === "unknown" ? "Could not read heartbeat records." : "Expected every minute. If this persists, pending payments are not being rechecked — verify the Dokploy cron job and CRON_SECRET.",
            },
            {
              label: "Velocity webhook",
              tone: (webhookRejected ? "bad" : webhookBeat?.lastSuccessAt ? "ok" : "unknown") as "ok" | "bad" | "unknown",
              value: !heartbeats ? "Health data unavailable" : webhookRejected ? `Last callback rejected ${ageLabel(webhookBeat?.lastErrorAt, now)}` : webhookBeat?.lastSuccessAt ? `Last callback ${ageLabel(webhookBeat.lastSuccessAt, now)}` : "No callback received yet",
              detail: webhookRejected ? (webhookBeat?.lastError ?? "Check the webhook secret and signature header in the Velocity dashboard.") : "Quiet is normal when nobody is paying; a rejected callback is not.",
            },
          ].map(({ label, tone, value, detail }) => (
            <div key={label} className="rounded-xl border border-line bg-paper px-4 py-3 flex items-start gap-3">
              <span aria-hidden="true" className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone === "ok" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : tone === "bad" ? "bg-rose-500" : "bg-ink-3"}`} />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-ink-2">{label}</p>
                <p className="text-[13px] font-semibold text-ink">{value}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-3 leading-snug">{detail}</p>
              </div>
            </div>
          ))}
        </section>
        {!orderIssueCounts.ok && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
            Payment and delivery issue counts are unavailable right now, so a zero above does not mean all clear. Check{" "}
            <Link href="/admin/reconciliation" className="font-semibold underline underline-offset-2">reconciliation</Link> directly.
          </div>
        )}        {hasPendingAction && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-start gap-3 tp-fade-up-1">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="flex-1 text-[13px] font-semibold text-amber-900">
              {actionCount.toLocaleString()} admin action{actionCount === 1 ? "" : "s"} need attention.
            </p>
            <Link href="#operations" className="shrink-0 text-[12px] font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2">
              Open queue
            </Link>
          </div>
        )}

        <section id="operations" aria-labelledby="operations-heading" className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-1">
          <div className="px-5 py-4 border-b border-line flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h2 id="operations-heading" className="text-[15px] font-semibold text-ink">Needs attention</h2>
              <p className="text-[12px] text-ink-2 mt-0.5">Payment, delivery, approval, and moderation work in one place.</p>
            </div>
            <Link href="/admin/reconciliation" className="inline-flex items-center gap-1 text-[12px] font-semibold text-navy">
              Full reconciliation <ArrowUpRight size={11} />
            </Link>
          </div>
          {operationsQueue.length === 0 ? (
            <div className="px-5 py-6 flex items-center gap-3 text-[13px] text-emerald-700">
              <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
              No admin work waiting right now.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line">
              {operationsQueue.map(({ label, value, href, icon: Icon, tone, detail }) => (
                <Link key={label} href={href} className="px-5 py-4 min-h-[150px] hover:bg-paper-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex w-8 h-8 items-center justify-center rounded-lg ring-1 ${queueToneClasses(tone)}`}>
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <ArrowUpRight size={12} className="text-ink-3" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-[22px] font-bold text-ink tabular-nums">{value.toLocaleString()}</p>
                  <p className="mt-1 text-[12px] font-semibold text-ink-2">{label}</p>
                  <p className="mt-1 text-[11px] text-ink-3 leading-snug">{detail}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Platform totals" className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-line border border-line rounded-2xl bg-paper overflow-hidden">
          {[
            { label: "Live / upcoming events", value: activeEvents.toLocaleString(), sub: "currently published" },
            { label: "Paid orders", value: velocityPaid.toLocaleString(), sub: "Velocity confirmed" },
            { label: "Pending payouts", value: pendingPayouts.toLocaleString(), sub: pendingPayouts > 0 ? formatCurrency(pendingPayoutTotal, "USD") + " waiting" : "nothing waiting" },
            { label: "New users", value: newUsers.toLocaleString(), sub: "this month" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="px-5 py-5">
              <p className="text-[12px] text-ink-3 mb-2">{label}</p>
              <p className="text-[24px] md:text-[26px] font-bold tracking-tight text-ink leading-none tabular-nums">{value}</p>
              <p className="mt-1.5 text-[11px] text-ink-3">{sub}</p>
            </div>
          ))}
        </section>

        <div className="grid lg:grid-cols-[3fr_2fr] gap-4">
          <section aria-labelledby="orders-heading" className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 id="orders-heading" className="text-[14px] font-semibold text-ink">Recent orders</h2>
              <Link href="/admin/orders" className="text-[12px] font-semibold text-navy inline-flex items-center gap-1">
                All orders <ArrowUpRight size={11} />
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {recentOrders.length === 0 ? (
                <li><EmptyState icon={Inbox} title="No orders yet" variant="inline" /></li>
              ) : recentOrders.map((order) => {
                const status = orderStatus(order.status)
                return (
                  <li key={order.id} className="px-5 py-3 flex items-center gap-3 hover:bg-paper-2 transition-colors">
                    <Link href={`/admin/orders?q=${encodeURIComponent(order.id)}`} className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{order.contactName ?? "Guest"}</p>
                      <p className="text-[11px] text-ink-3 truncate">{order.eventTitle ?? "Event unavailable"}</p>
                    </Link>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
                    <span className="text-[12px] font-semibold text-ink tabular-nums">{formatCurrency(Number(order.totalAmount ?? 0), order.currency ?? "USD")}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-labelledby="events-heading" className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 id="events-heading" className="text-[14px] font-semibold text-ink">Live &amp; upcoming events</h2>
              <Link href="/admin/events?status=published" className="text-[12px] font-semibold text-navy inline-flex items-center gap-1">
                Manage <ArrowUpRight size={11} />
              </Link>
            </div>
            {topEventRows.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No live or upcoming events" variant="inline" />
            ) : (
              <ul className="divide-y divide-line">
                {topEventRows.map((event) => (
                  <li key={event.id} className="px-5 py-3 flex items-center gap-3 hover:bg-paper-2 transition-colors">
                    <CalendarCheck size={14} className="text-ink-3 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink truncate">{event.title}</p>
                      <p className="text-[11px] text-ink-3 truncate">{event.organizerName ?? event.organizerEmail ?? "No organiser"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section id="review" aria-labelledby="review-heading" className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 id="review-heading" className="text-[14px] font-semibold text-ink">Approvals &amp; verification</h2>
              {pendingReviewCount > 0 && <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">{pendingReviewCount}</span>}
            </div>
            <Link href="/admin/events?status=pending_review" className="text-[12px] font-semibold text-navy inline-flex items-center gap-1">
              Event approvals <ArrowUpRight size={11} />
            </Link>
          </div>
          {pendingReviewCount === 0 ? (
            <div className="px-5 py-8 flex items-center gap-3 text-[13px] text-emerald-700">
              <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />
              All clear — nothing waiting for review.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {draftEvents.map((event) => (
                <li key={`event-${event.id}`} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-ink-3 bg-paper-2 px-1.5 py-0.5 rounded">Event approval</span>
                    <p className="mt-1 text-[14px] font-semibold text-ink">{event.title}</p>
                    <p className="text-[12px] text-ink-2">by {event.organizerName ?? event.organizerEmail ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RejectEventButton eventId={event.id} action={rejectEventAction} compact />
                    <form action={approveEventAction.bind(null, event.id)}>
                      <button type="submit" className="min-h-10 rounded-lg bg-ink text-paper px-4 py-2 text-[13px] font-semibold hover:bg-ink/85 transition-colors">Approve</button>
                    </form>
                  </div>
                </li>
              ))}
              {pendingOrganizers.map((organizer) => (
                <li key={`organizer-${organizer.id}`} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-blue bg-blue/10 px-1.5 py-0.5 rounded">Organiser approval</span>
                    <p className="mt-1 text-[14px] font-semibold text-ink">{organizer.name ?? "—"}</p>
                    <p className="text-[12px] text-ink-2">{organizer.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={rejectOrganizerAction.bind(null, organizer.id)}>
                      <button type="submit" className="min-h-10 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2 text-[13px] font-semibold hover:bg-rose-100 transition-colors">Reject</button>
                    </form>
                    <form action={approveOrganizerAction.bind(null, organizer.id)}>
                      <button type="submit" className="min-h-10 rounded-lg bg-ink text-paper px-4 py-2 text-[13px] font-semibold hover:bg-ink/85 transition-colors">Approve</button>
                    </form>
                  </div>
                </li>
              ))}
              {unverifiedUsers.map((user) => (
                <li key={`user-${user.id}`} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-ink-3 bg-paper-2 px-1.5 py-0.5 rounded">Email verification</span>
                    <p className="mt-1 text-[14px] font-semibold text-ink">{user.name ?? "—"}</p>
                    <p className="text-[12px] text-ink-2">{user.email}</p>
                  </div>
                  <form action={verifyUserEmailAction.bind(null, user.id)} className="shrink-0">
                    <button type="submit" className="min-h-10 rounded-lg border border-line bg-paper text-ink px-4 py-2 text-[13px] font-semibold hover:bg-paper-2 transition-colors">Verify email</button>
                  </form>
                </li>
              ))}
              {[
                { label: "event approvals", shown: draftEvents.length, total: pendingEventCount, href: "/admin/events?status=pending_review" },
                { label: "organiser approvals", shown: pendingOrganizers.length, total: pendingOrganizerCount, href: "/admin/organizers" },
                { label: "unverified accounts", shown: unverifiedUsers.length, total: unverifiedUserCount, href: "/admin/users" },
              ].filter((row) => row.total > row.shown).map((row) => (
                <li key={`more-${row.label}`} className="px-5 py-3 text-[12px] text-ink-3 flex items-center justify-between gap-3">
                  <span>Showing {row.shown} of {row.total} {row.label}.</span>
                  <Link href={row.href} className="font-semibold text-navy underline underline-offset-2">See all</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          {[
            { label: "Users", href: "/admin/users", icon: Users },
            { label: "Payouts", href: "/admin/payouts", icon: CreditCard },
            { label: "Analytics", href: "/admin/analytics", icon: Activity },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink transition-colors font-medium">
              <Icon size={13} className="text-ink-3" aria-hidden="true" /> {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
