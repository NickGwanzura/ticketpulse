import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, and, inArray, desc, sql, isNotNull } from "drizzle-orm"
import Link from "next/link"
import {
  Ticket, Users, DollarSign, Activity, Mail, MessageCircle,
  Tag, QrCode, ShoppingBag, ImageIcon, Store, ArrowUpRight,
  TrendingUp, Calendar, ScanLine, HelpCircle, Wallet, CheckCircle2,
  AlertTriangle, ClipboardCheck, Star,
} from "lucide-react"

import { db } from "@/db"
import { events, orders, payouts, ticketTiers, tickets } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import { getEventRevenueSummaries } from "@/lib/revenue-summary"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"
import AiInsightCard from "@/components/ai/AiInsightCard"
import { publishOrganizerEventAction } from "../actions"
import PublishEventButton from "../PublishEventButton"
import DeleteEventForm from "../DeleteEventForm"

export const metadata = { title: "Event overview" }

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

type RouteParams = { id: string }

export default async function EventOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<{ published?: "1" | "already" | "pending"; publishError?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}`)

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      status: events.status,
      category: events.category,
      city: events.city,
      startsAt: events.startsAt,
      venue: events.venue,
    })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  // ── Ticket tiers summary ───────────────────────────────────────────────────
  const tiers = await db
    .select({
      id: ticketTiers.id,
      name: ticketTiers.name,
      price: ticketTiers.price,
      currency: ticketTiers.currency,
      totalQuantity: ticketTiers.totalQuantity,
      soldQuantity: ticketTiers.soldQuantity,
    })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, id))

  const totalCapacity = tiers.reduce((s, t) => s + (t.totalQuantity ?? 0), 0)

  const tierSoldRows = await db
    .select({
      tierId: tickets.tierId,
      sold: sql<number>`COUNT(*)::int`,
    })
    .from(tickets)
    .where(and(
      eq(tickets.eventId, id),
      eq(tickets.isStaffTicket, false),
      inArray(tickets.status, ["sold", "used"]),
    ))
    .groupBy(tickets.tierId)

  const soldByTier = new Map(tierSoldRows.map((r) => [r.tierId, Number(r.sold ?? 0)]))
  const totalSold = tierSoldRows.reduce((s, t) => s + Number(t.sold ?? 0), 0)

  // ── Revenue — canonical maths shared with payouts and admin pages ──────────
  const revenueSummaries = await getEventRevenueSummaries([id])
  const summary = revenueSummaries.get(id)
  const grossRevenue = summary?.grossRevenue ?? 0
  const netRevenue = summary?.netRevenue ?? 0
  const currency = tiers[0]?.currency ?? "USD"

  // ── Event payout ledger ───────────────────────────────────────────────────
  const payoutRows = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      method: payouts.method,
      status: payouts.status,
      bankName: payouts.bankName,
      proofReference: payouts.proofReference,
      notes: payouts.notes,
      createdAt: payouts.createdAt,
      processedAt: payouts.processedAt,
    })
    .from(payouts)
    .where(eq(payouts.eventId, id))
    .orderBy(desc(payouts.createdAt))
    .limit(6)

  const paidOut = summary?.paidOut ?? 0
  const availablePayoutBalance = summary?.availableBalance ?? 0

  // ── Attendees ──────────────────────────────────────────────────────────────
  const attendeeRows = await db
    .select({
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      totalAmount: orders.totalAmount,
    })
    .from(orders)
    .where(and(eq(orders.eventId, id), inArray(orders.status, ["paid", "completed"])))

  // Top buyers by total spend
  const spendByBuyer = new Map<string, { name: string; spent: number; tickets: number }>()
  for (const r of attendeeRows) {
    if (!r.guestEmail) continue
    const existing = spendByBuyer.get(r.guestEmail)
    if (existing) {
      existing.spent += Number(r.totalAmount ?? 0)
      existing.tickets += 1
    } else {
      spendByBuyer.set(r.guestEmail, {
        name: r.guestName || r.guestEmail,
        spent: Number(r.totalAmount ?? 0),
        tickets: 1,
      })
    }
  }
  const totalBuyers = spendByBuyer.size
  const topBuyers = Array.from(spendByBuyer.values())
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5)

  // ── Check-ins ──────────────────────────────────────────────────────────────
  const [checkinRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(tickets)
    .where(and(eq(tickets.eventId, id), isNotNull(tickets.scannedAt)))

  const checkedIn = checkinRow?.count ?? 0

  // ── Recent orders ──────────────────────────────────────────────────────────
  const recentOrders = await db
    .select({
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.eventId, id), inArray(orders.status, ["paid", "completed", "awaiting_verification", "refunded"])))
    .orderBy(desc(orders.createdAt))
    .limit(5)

  // ── Recent activity (synthesized) ──────────────────────────────────────────
  const activity: { text: string; ago: string }[] = []
  for (const o of recentOrders.slice(0, 4)) {
    if (o.status === "paid" || o.status === "awaiting_verification") {
      activity.push({
        text: `${o.guestName || o.guestEmail || "Someone"} purchased tickets`,
        ago: o.createdAt ? timeAgo(new Date(o.createdAt)) : "Recently",
      })
    }
  }
  if (checkedIn > 0) {
    activity.push({ text: `${checkedIn} attendee${checkedIn !== 1 ? "s" : ""} checked in`, ago: "Total so far" })
  }

  const daysRemaining = Math.max(0, Math.ceil((new Date(event.startsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
  const isPublished = event.status === "published"
  const isPendingReview = event.status === "pending_review"
  const publishAction = publishOrganizerEventAction.bind(null, id)
  const healthItems = [
    { label: "Event is published", ok: isPublished, href: `/organizer/events/${id}`, action: "Publish" },
    { label: "Ticket tiers are configured", ok: tiers.length > 0, href: `/organizer/events/${id}/tiers`, action: "Add tiers" },
    { label: "Capacity is set", ok: totalCapacity > 0, href: `/organizer/events/${id}/tiers`, action: "Set capacity" },
    { label: "Public page has venue and date", ok: Boolean(event.venue && event.startsAt), href: `/organizer/events/${id}/edit`, action: "Edit details" },
    { label: "Email tool ready", ok: tiers.length > 0, href: `/organizer/events/${id}/email`, action: "Open email" },
    { label: "Payout ledger is balanced", ok: availablePayoutBalance >= 0, href: "/payouts", action: "Review payouts" },
  ]
  const healthScore = Math.round((healthItems.filter((item) => item.ok).length / healthItems.length) * 100)
  const healthTone = healthScore >= 85
    ? "text-emerald-700 bg-emerald-50 ring-emerald-200"
    : healthScore >= 60
      ? "text-amber-700 bg-amber-50 ring-amber-200"
      : "text-rose-700 bg-rose-50 ring-rose-200"
  const nextAction = healthItems.find((item) => !item.ok) ?? (
    availablePayoutBalance > 0
      ? { label: "Payout is available", ok: true, href: "/payouts/request", action: "Request payout" }
      : { label: "Ready for live operations", ok: true, href: "/organizer/scan", action: "Open scanner" }
  )
  const salesPct = totalCapacity > 0 ? Math.min(100, Math.round((totalSold / totalCapacity) * 100)) : 0

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={event.title}
        subtitle={`${event.venue} · ${event.city} · ${event.startsAt.toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
                  href={`/organizer/scan?event=${event.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85 transition"
            >
              <ScanLine size={14} /> Scan tickets
            </Link>
            {isPendingReview && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                Pending review
              </span>
            )}
            {!isPublished && !isPendingReview && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  Draft
                </span>
                <form action={publishAction}>
                  <PublishEventButton />
                </form>
              </>
            )}
            <Link
              href={`/events/${event.slug ?? id}`}
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-line-2 transition"
            >
              <ArrowUpRight size={14} /> {isPublished ? "View live" : "Preview"}
            </Link>
            <DeleteEventForm eventId={id} eventTitle={event.title} compact />
          </div>
        }
      />

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-8">
        {sp.published === "1" && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-800">
            Event published. It is now visible on TicketPulse.
          </div>
        )}

        {sp.published === "pending" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">
            Submitted for review. It will go live once an admin approves it.
          </div>
        )}

        {sp.published === "already" && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-800">
            This event is already published.
          </div>
        )}

        {sp.publishError === "locked" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
            This event cannot be published because it is cancelled or completed.
          </div>
        )}

        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="grid lg:grid-cols-[1.25fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-line">
            <div className="p-5 md:p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${healthTone}`}>
                  {healthScore >= 85 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  {healthScore}% ready
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                  isPublished ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
                }`}>
                  {isPublished ? "Published" : isPendingReview ? "Pending review" : "Draft"}
                </span>
              </div>
              <p className="text-[20px] font-bold tracking-tight text-ink">Event command center</p>
              <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">
                {nextAction.label}. Keep publishing, ticketing, scanning, and payout readiness in one place.
              </p>
              <Link
                href={nextAction.href}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink/85 transition-colors"
              >
                {nextAction.action} <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-ink-3 uppercase tracking-[0.14em]">Sales</p>
                <span className="text-[12px] font-bold text-ink tabular-nums">{salesPct}%</span>
              </div>
              <p className="text-[28px] font-bold tracking-tight text-ink tabular-nums">{totalSold.toLocaleString()} / {totalCapacity.toLocaleString()}</p>
              <p className="mt-1 text-[12px] text-ink-2">confirmed tickets issued</p>
              <div className="mt-4 h-2 rounded-full bg-paper-3 overflow-hidden">
                <div className="h-full rounded-full bg-ink" style={{ width: `${salesPct}%` }} />
              </div>
            </div>
            <div className="p-5 md:p-6">
              <p className="text-[12px] font-semibold text-ink-3 uppercase tracking-[0.14em]">Payout</p>
              <p className="mt-3 text-[28px] font-bold tracking-tight text-ink tabular-nums">{formatCurrency(availablePayoutBalance, currency)}</p>
              <p className="mt-1 text-[12px] text-ink-2">available from {formatCurrency(netRevenue, currency)} net earned</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-paper-2 p-2 ring-1 ring-line">
                  <p className="text-ink-3">Fee</p>
                  <p className="font-bold text-ink tabular-nums">-{formatCurrency(grossRevenue - netRevenue, currency)}</p>
                </div>
                <div className="rounded-lg bg-paper-2 p-2 ring-1 ring-line">
                  <p className="text-ink-3">Paid out</p>
                  <p className="font-bold text-ink tabular-nums">{formatCurrency(paidOut, currency)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: "Tickets sold", value: `${totalSold.toLocaleString()} / ${totalCapacity.toLocaleString()}`, icon: Ticket, color: "text-navy" },
            { label: "Net revenue", value: formatCurrency(netRevenue, currency), icon: DollarSign, color: "text-green-700" },
            { label: "Unique buyers", value: totalBuyers.toLocaleString(), icon: Users, color: "text-blue" },
            { label: "Checked in", value: `${checkedIn.toLocaleString()} / ${totalSold.toLocaleString()}`, icon: Activity, color: "text-violet-700" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex w-6 h-6 items-center justify-center rounded-md bg-paper-2 ring-1 ring-line">
                  <Icon size={13} className="text-ink-2" />
                </span>
                <span className="text-[12px] text-ink-3">{label}</span>
              </div>
              <p className={`text-[22px] md:text-[24px] font-bold tracking-tight leading-none tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-2xl border border-line bg-paper p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <p className="text-[16px] font-semibold tracking-tight text-ink">Event payout ledger</p>
                <p className="text-[12px] text-ink-2 mt-0.5">Gross, TicketPulse fee, paid payouts, and available balance for this event only.</p>
              </div>
              <Link
                href="/payouts"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-[12px] font-semibold text-ink hover:border-line-2 transition-colors"
              >
                <Wallet size={13} /> Payouts
              </Link>
            </div>

            <dl className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[12px]">
              <div className="rounded-xl bg-paper-2 p-3 ring-1 ring-line">
                <dt className="text-ink-3">Gross</dt>
                <dd className="mt-1 text-[15px] font-bold text-ink tabular-nums">{formatCurrency(grossRevenue, currency)}</dd>
              </div>
              <div className="rounded-xl bg-paper-2 p-3 ring-1 ring-line">
                <dt className="text-ink-3">Fee</dt>
                <dd className="mt-1 text-[15px] font-bold text-ink tabular-nums">-{formatCurrency(grossRevenue - netRevenue, currency)}</dd>
              </div>
              <div className="rounded-xl bg-paper-2 p-3 ring-1 ring-line">
                <dt className="text-ink-3">Net</dt>
                <dd className="mt-1 text-[15px] font-bold text-ink tabular-nums">{formatCurrency(netRevenue, currency)}</dd>
              </div>
              <div className="rounded-xl bg-paper-2 p-3 ring-1 ring-line">
                <dt className="text-ink-3">Paid out</dt>
                <dd className="mt-1 text-[15px] font-bold text-ink tabular-nums">-{formatCurrency(paidOut, currency)}</dd>
              </div>
              <div className="rounded-xl bg-brand-50/70 p-3 ring-1 ring-brand-200">
                <dt className="text-brand-700">Available</dt>
                <dd className="mt-1 text-[15px] font-bold text-ink tabular-nums">{formatCurrency(availablePayoutBalance, currency)}</dd>
              </div>
            </dl>

            {payoutRows.length > 0 && (
              <div className="mt-4 divide-y divide-line rounded-xl border border-line overflow-hidden">
                {payoutRows.map((p) => {
                  const manualCash = p.bankName?.toLowerCase() === "manual cash payment" || p.notes?.toLowerCase().includes("manual cash")
                  const label = manualCash ? "Manual cash" : p.method === "ecocash" ? "EcoCash" : "USD Bank"
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-ink">{label} · {p.status}</p>
                        <p className="text-[11px] text-ink-3 truncate">{p.proofReference ?? p.id.slice(0, 8)}</p>
                      </div>
                      <span className="text-[13px] font-bold text-ink tabular-nums">{formatCurrency(Number(p.amount ?? 0), p.currency ?? currency)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[16px] font-semibold tracking-tight text-ink">Event health</p>
                <p className="text-[12px] text-ink-2 mt-0.5">Readiness checks for sales, delivery, scanning, and payouts.</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${healthTone}`}>
                {healthScore >= 85 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {healthScore}%
              </span>
            </div>
            <div className="space-y-2">
              {healthItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-paper-2 transition-colors"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    {item.ok ? <CheckCircle2 size={14} className="text-emerald-700 shrink-0" /> : <ClipboardCheck size={14} className="text-amber-700 shrink-0" />}
                    <span className="text-[13px] text-ink-2 truncate">{item.label}</span>
                  </span>
                  {!item.ok && <span className="text-[11px] font-semibold text-navy shrink-0">{item.action}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Left column */}
          <div className="col-span-12 lg:col-span-8 space-y-6">

            {/* Ticket tiers progress */}
            <div className="rounded-2xl border border-line bg-paper overflow-hidden">
              <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
                <h2 className="text-[16px] font-semibold tracking-tight text-ink">Ticket tiers</h2>
                <Link
                  href={`/organizer/events/${id}/tiers`}
                  className="text-[13px] font-medium text-navy hover:underline"
                >
                  Manage
                </Link>
              </div>
              {tiers.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="No tiers yet"
                  body="Add ticket tiers so people can buy."
                  ctaLabel="Add tiers"
                  ctaHref={`/organizer/events/${id}/tiers`}
                />
              ) : (
                <div className="divide-y divide-line">
                  {tiers.map((t) => {
                    const sold = soldByTier.get(t.id) ?? 0
                    const cap = t.totalQuantity ?? 0
                    const pct = cap > 0 ? Math.round((sold / cap) * 100) : 0
                    const price = Number.parseFloat(t.price as unknown as string) || 0
                    return (
                      <div key={t.id} className="px-5 md:px-6 py-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[14px] font-semibold text-ink">{t.name}</p>
                          <span className="text-[13px] font-bold text-ink tabular-nums">{formatCurrency(price, t.currency ?? currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[12px] text-ink-3 mb-2">
                          <span>{sold.toLocaleString()} sold</span>
                          <span>{cap.toLocaleString()} capacity</span>
                        </div>
                        <div className="h-1.5 bg-paper-2 rounded-full overflow-hidden">
                          <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent orders */}
            <div className="rounded-2xl border border-line bg-paper overflow-hidden">
              <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
                <h2 className="text-[16px] font-semibold tracking-tight text-ink">Recent orders</h2>
                <Link
                  href={`/organizer/events/${id}/attendees`}
                  className="text-[13px] font-medium text-navy hover:underline"
                >
                  View all
                </Link>
              </div>
              {recentOrders.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No orders yet"
                  body="Orders will appear here as people buy tickets."
                  variant="inline"
                />
              ) : (
                <div className="divide-y divide-line">
                  {recentOrders.map((o) => (
                    <div key={`${o.guestEmail}-${o.createdAt}`} className="px-5 md:px-6 py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate">{o.guestName || o.guestEmail || "Guest"}</p>
                        <p className="text-[12px] text-ink-3">{o.guestEmail}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-[13px] font-bold text-ink tabular-nums">{formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? currency)}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                          o.status === "paid" ? "bg-green-50 text-green-700" :
                          o.status === "pending" ? "bg-amber-50 text-amber-700" :
                          "bg-rose-50 text-rose-600"
                        }`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

            {/* AI Insight */}
            {tiers.length > 0 && (
              <AiInsightCard
                eventTitle={event.title}
                sold={totalSold}
                capacity={totalCapacity}
                daysRemaining={daysRemaining}
                category={event.category}
                city={event.city}
              />
            )}

            {/* Quick actions */}
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Quick actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {[
                  { label: "Email attendees", href: `/organizer/events/${id}/email`, icon: Mail },
                  { label: "Sales funnel", href: `/organizer/events/${id}/funnel`, icon: TrendingUp },
                  { label: "WhatsApp broadcast", href: `/organizer/events/${id}/whatsapp`, icon: MessageCircle },
                  { label: "Promo codes", href: `/organizer/events/${id}/promos`, icon: Tag },
                  { label: "Gate scanner", href: `/organizer/scan`, icon: ScanLine },
                  { label: "Complimentary tickets", href: `/organizer/events/${id}/staff`, icon: QrCode },
                  { label: "Photo gallery", href: `/organizer/events/${id}/gallery`, icon: ImageIcon },
                  { label: "Questions", href: `/organizer/events/${id}/questions`, icon: HelpCircle },
                  { label: "Collect reviews", href: `/reviews/new?event=${encodeURIComponent(event.slug ?? id)}`, icon: Star },
                  { label: "Merch", href: `/organizer/events/${id}/merch`, icon: ShoppingBag },
                  { label: "Vendors", href: `/organizer/events/${id}/vendors`, icon: Store },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors"
                  >
                    <Icon size={14} className="text-ink-3 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Top buyers */}
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Top buyers</p>
              {topBuyers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No buyers yet"
                  body="Top ticket buyers will appear here."
                  variant="inline"
                />
              ) : (
                <div className="space-y-3">
                  {topBuyers.map((b, i) => (
                    <div key={b.name} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-ink-3 w-4 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{b.name}</p>
                        <p className="text-[11px] text-ink-3">{b.tickets} order{b.tickets !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-[13px] font-bold text-ink tabular-nums shrink-0">{formatCurrency(b.spent, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity */}
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Latest orders</p>
              {activity.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No recent activity"
                  body="Activity from your event will appear here."
                  variant="inline"
                />
              ) : (
                <div className="space-y-3">
                  {activity.map((a, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-paper-2 p-1.5 shrink-0">
                        <Activity size={13} className="text-ink-2" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-ink leading-snug">{a.text}</p>
                        <p className="text-[11px] text-ink-3 mt-0.5">{a.ago}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
