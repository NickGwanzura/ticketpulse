import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { eq, desc, or, inArray, notInArray, sql, and } from "drizzle-orm"
import {
  Plus, ArrowUpRight, ScanLine, AlertCircle,
  Ticket, DollarSign, TrendingUp, Users,
  Activity, Tag, Mail, MailCheck, HelpCircle, Zap,
  CheckCircle2, ClipboardList, Wallet, ReceiptText,
} from "lucide-react"

import { formatCurrency } from "@/lib/utils"
import { db } from "@/db"
import { events, eventOrganisers, orders, ticketTiers, tickets, users } from "@/db/schema"
import { getEventRevenueSummaries, getOrganizerRevenueSummary } from "@/lib/revenue-summary"
import AiInsightCard from "@/components/ai/AiInsightCard"
import EmptyState from "@/components/dashboard/EmptyState"
import SplitCTA from "@/components/ui/SplitCTA"
import NewOrganizerChecklist from "@/components/dashboard/NewOrganizerChecklist"

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

const STATUS: Record<string, { dot: string; label: string }> = {
  published: { dot: "bg-emerald-500", label: "Live" },
  draft:     { dot: "bg-amber-400",   label: "Draft" },
  sold_out:  { dot: "bg-rose-500",    label: "Sold out" },
  cancelled: { dot: "bg-rose-500",    label: "Cancelled" },
  completed: { dot: "bg-ink-3",       label: "Ended" },
}

function hasValidWhatsappContact(phone: string | null | undefined) {
  if (!phone) return false
  return /^(\+?263|0)?7[1789]\d{7}$/.test(phone.replace(/[\s-]/g, ""))
}

function CapacityBar({ sold, capacity }: { sold: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0
  const color = pct >= 90 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-ink"
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-paper-3 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-ink-3 tabular-nums shrink-0">{pct}%</span>
    </div>
  )
}

function EventHealthBadges({
  status,
  capacity,
  sold,
  netRevenue,
  hasTiers,
  salesEnded,
}: {
  status: string
  capacity: number
  sold: number
  netRevenue: number
  hasTiers: boolean
  salesEnded: boolean
}) {
  const remaining = Math.max(0, capacity - sold)
  const badges: { label: string; className: string }[] = []

  if (status === "published") badges.push({ label: "Published", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" })
  if (status === "pending_review") badges.push({ label: "Pending review", className: "bg-amber-50 text-amber-700 ring-amber-200" })
  if (status === "draft") badges.push({ label: "Draft", className: "bg-amber-50 text-amber-700 ring-amber-200" })
  if (!hasTiers) badges.push({ label: "Needs tiers", className: "bg-rose-50 text-rose-700 ring-rose-200" })
  if (salesEnded) badges.push({ label: "Sales closed", className: "bg-rose-50 text-rose-700 ring-rose-200" })
  if (capacity > 0 && remaining <= 10 && remaining > 0) badges.push({ label: `${remaining} left`, className: "bg-amber-50 text-amber-700 ring-amber-200" })
  if (capacity > 0 && remaining === 0) badges.push({ label: "Sold out", className: "bg-ink text-white ring-ink" })
  if (netRevenue > 0) badges.push({ label: "Earning", className: "bg-blue/10 text-blue ring-blue/20" })

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {badges.slice(0, 3).map((badge) => (
        <span key={badge.label} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${badge.className}`}>
          {badge.label}
        </span>
      ))}
    </div>
  )
}

export default async function OrganizerPage({ searchParams }: { searchParams: Promise<{ filter?: string; rev?: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/organizer")
  const isAdmin = session.user.role === "admin"

  if (!isAdmin && session.user.role === "organizer") {
    const [account] = await db
      .select({ frozenAt: users.organizerFrozenAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (account?.frozenAt) {
      return (
        <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-20 tp-fade-up">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-sky-50 border border-sky-200 mb-6">
              <ClipboardList size={28} className="text-sky-600" />
            </div>
            <h1 className="text-[24px] font-bold tracking-tight text-ink mb-3">Organizer access is temporarily frozen.</h1>
            <p className="text-[15px] text-ink-2 leading-relaxed mb-2">Your organizer account has not created an event yet, so access to organizer tools is paused.</p>
            <p className="text-[14px] text-ink-3 leading-relaxed">Contact TicketPulse support if you need your organizer access restored.</p>
          </div>
        </div>
      )
    }
  }

  // Unverified organizers see a verification gate — they must click the link
  // in the verification email before they can proceed.
  if (!isAdmin && session.user.role === "organizer" && !session.user.emailVerified) {
    const firstName = session.user.name?.split(" ")[0] ?? null
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-20 tp-fade-up">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 mb-6">
            <MailCheck size={28} className="text-amber-600" />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-ink mb-3">
            {firstName ? `Check your inbox, ${firstName}.` : "Check your inbox."}
          </h1>
          <p className="text-[15px] text-ink-2 leading-relaxed mb-2">
            We sent a verification email to <strong>{session.user.email}</strong>.
          </p>
          <p className="text-[14px] text-ink-3 leading-relaxed mb-8">
            Click the link in the email to verify your address and start organising
            events. The link expires in 48 hours.
          </p>
          <div className="rounded-xl border border-line bg-paper-2 px-5 py-4 text-left space-y-3 mb-8">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-[13px] text-ink-2">Account created successfully</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 border-amber-400 bg-amber-100" />
              <p className="text-[13px] text-ink-2">Awaiting email verification</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 border-line bg-paper" />
              <p className="text-[13px] text-ink-3">Start organising events</p>
            </div>
          </div>
          <p className="text-[13px] text-ink-3">
            Didn&apos;t receive the email?{" "}
            <a
              href={`/api/auth/resend-verification`}
              className="text-navy hover:underline font-medium"
            >
              Resend verification email
            </a>
          </p>
        </div>
      </div>
    )
  }

  // Unapproved organizers see a holding page instead of the full dashboard
  if (!isAdmin && session.user.role === "organizer" && !session.user.approvedAt) {
    const firstName = session.user.name?.split(" ")[0] ?? null
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-20 tp-fade-up">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 mb-6">
            <ClipboardList size={28} className="text-amber-600" />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-ink mb-3">
            {firstName ? `Welcome, ${firstName}.` : "Welcome to TicketPulse."}
          </h1>
          <p className="text-[15px] text-ink-2 leading-relaxed mb-2">
            Your organizer account is being reviewed by our team.
          </p>
          <p className="text-[14px] text-ink-3 leading-relaxed mb-8">
            This usually takes less than 24 hours. You will receive an email as soon as
            your account is approved and you can start creating events.
          </p>
          <div className="rounded-xl border border-line bg-paper-2 px-5 py-4 text-left space-y-3 mb-8">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-[13px] text-ink-2">Account created successfully</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 border-amber-400 bg-amber-100" />
              <p className="text-[13px] text-ink-2">Awaiting team approval</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 border-line bg-paper" />
              <p className="text-[13px] text-ink-3">Create your first event</p>
            </div>
          </div>
          <p className="text-[13px] text-ink-3">
            Questions?{" "}
            <a href="mailto:hello@ticketpulse.tech" className="text-navy hover:underline font-medium">
              hello@ticketpulse.tech
            </a>
          </p>
        </div>
      </div>
    )
  }

  const invitedEventIds = isAdmin ? [] : await db
    .select({ eventId: eventOrganisers.eventId })
    .from(eventOrganisers).where(eq(eventOrganisers.userId, session.user.id))

  if (!isAdmin && session.user.role !== "organizer" && invitedEventIds.length === 0) redirect("/dashboard")

  if (!isAdmin && session.user.role === "organizer") {
    const [profile] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (!hasValidWhatsappContact(profile?.phone)) {
      redirect("/organizer/onboarding?step=2&error=whatsapp_required")
    }
  }

  const sp = await searchParams
  const filter = sp.filter || "all"

  const ownedIds = invitedEventIds.map(r => r.eventId)
  const whereClause = isAdmin ? undefined
    : ownedIds.length > 0 ? or(eq(events.organizerId, session.user.id), inArray(events.id, ownedIds))
    : eq(events.organizerId, session.user.id)

  const rawEvents = await db
    .select({ id: events.id, slug: events.slug, title: events.title, category: events.category, venue: events.venue, city: events.city, startsAt: events.startsAt, endsAt: events.endsAt, status: events.status })
    .from(events).where(whereClause).orderBy(desc(events.startsAt)).limit(50)

  const eventIds = rawEvents.map(r => r.id)

  const [allTiers, revenueSummaries, organizerRevenueSummary, attendingByEvent, checkedInByEvent, recentOrdersRaw, issueRows] = await Promise.all([
    eventIds.length > 0 ? db.select({ eventId: ticketTiers.eventId, totalQuantity: ticketTiers.totalQuantity, price: ticketTiers.price, currency: ticketTiers.currency, salesEnd: ticketTiers.salesEnd }).from(ticketTiers).where(inArray(ticketTiers.eventId, eventIds)) : Promise.resolve([]),
    // Canonical per-event revenue — same maths as payout balances and admin pages.
    getEventRevenueSummaries(eventIds),
    isAdmin ? Promise.resolve(null) : getOrganizerRevenueSummary(session.user.id),
    // Count actual issued buyer tickets, not tier soldQuantity reservations or paid orders whose delivery failed.
    eventIds.length > 0 ? db.select({ eventId: tickets.eventId, attending: sql<number>`COUNT(*)::int` }).from(tickets).where(and(inArray(tickets.eventId, eventIds), eq(tickets.isStaffTicket, false), notInArray(tickets.status, ["cancelled", "refunded"]))).groupBy(tickets.eventId) : Promise.resolve([]),
    eventIds.length > 0 ? db.select({ eventId: tickets.eventId, checkedIn: sql<number>`COUNT(*)::int` }).from(tickets).where(and(inArray(tickets.eventId, eventIds), eq(tickets.isStaffTicket, false), notInArray(tickets.status, ["cancelled", "refunded"]), sql`scanned_at IS NOT NULL`)).groupBy(tickets.eventId) : Promise.resolve([]),
    eventIds.length > 0 ? db.select({ guestName: orders.guestName, guestEmail: orders.guestEmail, totalAmount: orders.totalAmount, currency: orders.currency, paymentMethod: orders.paymentMethod, status: orders.status, createdAt: orders.createdAt, eventId: orders.eventId }).from(orders).where(and(inArray(orders.eventId, eventIds), inArray(orders.status, ["paid", "completed", "refunded"]), sql`${orders.paymentMethod} IS DISTINCT FROM 'complimentary'`)).orderBy(desc(orders.createdAt)).limit(8) : Promise.resolve([]),
    eventIds.length > 0 ? db.execute(sql`
      WITH organizer_orders AS (
        SELECT o.id, o.metadata
        FROM orders o
        WHERE o.event_id IN (${sql.join(eventIds.map((eventId) => sql`${eventId}`), sql`, `)})
          AND o.status IN ('paid', 'completed')
      ),
      ticket_counts AS (
        SELECT order_id, COUNT(*)::int AS ticket_count
        FROM tickets
        WHERE order_id IN (SELECT id FROM organizer_orders)
          AND is_staff_ticket = false
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY order_id
      ),
      ledger_counts AS (
        SELECT order_id, COUNT(*)::int AS ledger_count
        FROM payment_ledger
        WHERE order_id IN (SELECT id FROM organizer_orders)
        GROUP BY order_id
      )
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(tc.ticket_count, 0) = 0)::int AS paid_no_tickets,
        COUNT(*) FILTER (WHERE COALESCE(lc.ledger_count, 0) > 1)::int AS duplicate_ledgers,
        COUNT(*) FILTER (
          WHERE COALESCE(organizer_orders.metadata->'delivery'->>'status', '') IN ('FAILED', 'EMAIL_FAILED')
        )::int AS delivery_attention
      FROM organizer_orders
      LEFT JOIN ticket_counts tc ON tc.order_id = organizer_orders.id
      LEFT JOIN ledger_counts lc ON lc.order_id = organizer_orders.id
    `) : Promise.resolve({ rows: [] }),
  ])

  // eslint-disable-next-line react-hooks/purity -- Server-rendered countdown seed.
  const now = Date.now()

  // Enrich events
  const EVENTS = rawEvents.map(r => {
    const tiers = allTiers.filter(t => t.eventId === r.id)
    const capacity = tiers.reduce((s, t) => s + (t.totalQuantity ?? 0), 0)
    // Use delivered buyer tickets so the dashboard matches the attendee list.
    const sold = attendingByEvent.find(s => s.eventId === r.id)?.attending ?? 0
    const checkedIn = checkedInByEvent.find(s => s.eventId === r.id)?.checkedIn ?? 0
    const summary = revenueSummaries.get(r.id)
    const revenue = summary?.grossRevenue ?? 0
    const netRevenue = summary?.netRevenue ?? 0
    const currency = tiers[0]?.currency ?? "USD"
    const hasTiers = tiers.length > 0
    const eventEndedAt = r.endsAt ?? r.startsAt
    const isPast = eventEndedAt.getTime() < now
    const salesEnded = hasTiers && tiers.every((t) => t.salesEnd ? new Date(t.salesEnd).getTime() < now : false)
    return { ...r, capacity, sold, checkedIn, revenue, netRevenue, currency, status: r.status ?? "draft", hasTiers, salesEnded, isPast }
  })

  const filtered = EVENTS.filter(e =>
    filter === "live" ? e.status === "published" && !e.isPast :
    filter === "drafts" ? e.status === "draft" :
    filter === "pending" ? e.status === "pending_review" :
    filter === "past" ? e.isPast :
    true
  )
  const totalSold = EVENTS.reduce((s, e) => s + e.sold, 0)
  const liveCount = EVENTS.filter(e => e.status === "published" && !e.isPast).length
  const pastCount = EVENTS.filter(e => e.isPast).length
  const draftCount = EVENTS.filter(e => e.status === "draft").length
  const pendingReviewCount = EVENTS.filter(e => e.status === "pending_review").length
  const visibleSummary = Array.from(revenueSummaries.values()).reduce(
    (acc, summary) => ({
      grossRevenue: acc.grossRevenue + summary.grossRevenue,
      platformFee: acc.platformFee + summary.platformFee,
      netRevenue: acc.netRevenue + summary.netRevenue,
      paidOut: acc.paidOut + summary.paidOut,
      pendingPayouts: acc.pendingPayouts + summary.pendingPayouts,
      availableBalance: acc.availableBalance + summary.availableBalance,
    }),
    { grossRevenue: 0, platformFee: 0, netRevenue: 0, paidOut: 0, pendingPayouts: 0, availableBalance: 0 },
  )
  const payoutSummary = organizerRevenueSummary ?? visibleSummary
  const gross = payoutSummary.grossRevenue
  const platformFee = payoutSummary.platformFee
  const net = payoutSummary.netRevenue
  const totalPaidOut = payoutSummary.paidOut
  const pendingPayout = payoutSummary.pendingPayouts
  const availableBalance = payoutSummary.availableBalance

  const hasEvents = EVENTS.length > 0
  const hasTiers = allTiers.length > 0
  const hasPublished = EVENTS.some(e => e.status === "published")
  const hasSales = totalSold > 0
  const orderIssues = (issueRows.rows?.[0] ?? {}) as { paid_no_tickets?: number; duplicate_ledgers?: number; delivery_attention?: number }
  const paidNoTickets = Number(orderIssues.paid_no_tickets ?? 0)
  const duplicateLedgers = Number(orderIssues.duplicate_ledgers ?? 0)
  const deliveryAttention = Number(orderIssues.delivery_attention ?? 0)
  const lowInventoryCount = EVENTS.filter((e) => e.status === "published" && e.capacity > 0 && e.capacity - e.sold <= 10 && e.capacity - e.sold > 0).length
  const closedSalesCount = EVENTS.filter((e) => e.status === "published" && e.salesEnded).length
  const missingTierCount = EVENTS.filter((e) => !e.hasTiers).length
  const missingTierEvent = EVENTS.find(e => !e.hasTiers)
  const lowCheckinEvent = EVENTS.find(e => e.status === "published" && e.sold > 0 && e.checkedIn < e.sold && !e.isPast)
  const needsAttention = [
    { label: "Draft events", value: draftCount, href: draftCount > 0 ? `/organizer/events/${EVENTS.find(e => e.status === "draft")?.id}/edit` : "/organizer/events/new", icon: ClipboardList, tone: "amber" },
    { label: "Missing tiers", value: missingTierCount, href: missingTierEvent ? `/organizer/events/${missingTierEvent.id}/tiers` : "/organizer/events/new", icon: Ticket, tone: "rose" },
    { label: "Paid, no tickets", value: paidNoTickets, href: "/organizer/orders", icon: AlertCircle, tone: "rose" },
    { label: "Delivery issues", value: deliveryAttention, href: "/organizer/orders", icon: Mail, tone: "amber" },
    { label: "Payment warnings", value: duplicateLedgers, href: "/organizer/orders", icon: Zap, tone: "amber" },
    { label: "Sales closed", value: closedSalesCount, href: "/organizer", icon: AlertCircle, tone: "rose" },
    { label: "Low inventory", value: lowInventoryCount, href: "/organizer?filter=live", icon: Ticket, tone: "amber" },
    { label: "Payout available", value: availableBalance > 0 ? 1 : 0, href: "/payouts/request", icon: Wallet, tone: "green", amount: availableBalance },
    ...(lowCheckinEvent ? [{ label: "Low check-in rate", value: Math.round((lowCheckinEvent.checkedIn / lowCheckinEvent.sold) * 100), href: `/organizer/events/${lowCheckinEvent.id}/live`, icon: Activity, tone: "amber" as const }] : []),
  ].filter((item) => item.value > 0)

  const insightEvent = EVENTS.find(e => e.status === "published" && !e.isPast && e.sold > 0) || EVENTS.find(e => e.status === "published" && !e.isPast) || EVENTS[0]
  const SALES_TOP = [...EVENTS].filter(e => e.netRevenue > 0).sort((a, b) => b.netRevenue - a.netRevenue).slice(0, 5)
  const maxRevenue = Math.max(...SALES_TOP.map(e => e.netRevenue), 1)

  const firstName = session.user.name?.split(" ")[0] ?? "organizer"

  return (
    <div className="tp-fade-up">
      {/* Header */}
      <div className="border-b border-line bg-paper">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-1">Organizer</p>
            <h1 className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none">
              {firstName}&apos;s events
            </h1>
            <span className="mt-2 inline-flex text-[12px] text-ink-3">
              Event-specific TicketPulse fee on confirmed paid tickets
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/organizer/scan" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-ink/85 transition-colors">
              <ScanLine size={14} /> Scan tickets
            </Link>
            <SplitCTA href="/organizer/events/new" label="New event" size="sm" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-8">
        <Link
          href="/organizer/scan"
          className="lg:hidden sticky top-24 z-20 flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[14px] font-bold text-white shadow-lg shadow-ink/15"
        >
          <ScanLine size={16} /> Open gate scanner
          {EVENTS.some(e => e.status === "published" && !e.isPast && e.sold > 0) && (
            <span className="inline-flex ml-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </Link>

        {/* Checklist for new organizers */}
        <NewOrganizerChecklist
          hasEvents={hasEvents}
          hasTiers={hasTiers}
          hasPublished={hasPublished}
          hasSales={hasSales}
          firstEventId={EVENTS[0]?.id}
        />

        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-1">
          <div className="px-5 py-4 border-b border-line flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold text-ink">Needs attention</p>
              <p className="text-[12px] text-ink-2 mt-0.5">Operational checks across publishing, payment, delivery, inventory, and payouts.</p>
            </div>
            <Link href="/organizer/orders" className="inline-flex items-center gap-1 text-[12px] font-semibold text-navy">
              Review orders <ArrowUpRight size={11} />
            </Link>
          </div>
          {needsAttention.length === 0 ? (
            <div className="px-5 py-5 flex items-center gap-3 text-[13px] text-emerald-700">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Everything important is clear right now.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-x-0 lg:divide-x divide-line">
              {needsAttention.map(({ label, value, href, icon: Icon, tone, amount }) => (
                <Link key={label} href={href} className="px-5 py-4 hover:bg-paper-2 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex w-8 h-8 items-center justify-center rounded-lg ring-1 ${
                      tone === "rose" ? "bg-rose-50 text-rose-700 ring-rose-200" :
                      tone === "green" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                      "bg-amber-50 text-amber-700 ring-amber-200"
                    }`}>
                      <Icon size={15} />
                    </span>
                    <ArrowUpRight size={12} className="text-ink-3" />
                  </div>
                  <p className="mt-3 text-[20px] font-bold text-ink tabular-nums">{amount ? formatCurrency(amount, "USD") : value.toLocaleString()}</p>
                  <p className="mt-1 text-[12px] font-medium text-ink-2">{label}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* KPI row — flat, no card borders */}
        <div className="grid grid-cols-2 md:grid-cols-4 border border-line rounded-2xl bg-paper overflow-hidden divide-y md:divide-y-0 md:divide-x divide-line tp-fade-up-1">
          {[
            { label: "Live events",    value: liveCount.toLocaleString(),            icon: Activity },
            { label: "Attending",      value: totalSold.toLocaleString(),            icon: Ticket },
            { label: "Gross ticket sales", value: formatCurrency(gross, "USD"),       icon: DollarSign },
            { label: "Net earnings",   value: formatCurrency(net, "USD"),            icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="px-5 py-5">
              <div className="flex items-center gap-1.5 mb-3">
                <Icon size={12} className="text-ink-3" />
                <span className="text-[12px] text-ink-3">{label}</span>
              </div>
              <p className="text-[22px] md:text-[24px] font-bold tracking-tight text-ink leading-none tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tp-fade-up-2">
          {[
            { label: "New event",      href: "/organizer/events/new", icon: Plus },
            { label: "Scan tickets",   href: "/organizer/scan",       icon: ScanLine },
            { label: "Payout report",  href: "/api/payouts/statement", icon: ReceiptText },
            { label: "Manage orders",  href: "/organizer/orders",      icon: Zap },
          ].map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 rounded-xl border border-line bg-paper p-4 hover:border-line-2 hover:bg-paper-2 transition-all text-[12px] font-medium text-ink-2"
            >
              <Icon size={18} className="text-ink-3" />
              {label}
            </Link>
          ))}
        </div>

        {/* Events + payout */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 tp-fade-up-2">

          {/* Events table */}
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">Your events</h2>
              <div className="flex items-center gap-1">
                {[
                { v: "all",     l: "All" },
                { v: "live",    l: liveCount          > 0 ? `Live ${liveCount}`             : "Live"    },
                { v: "pending", l: pendingReviewCount > 0 ? `Pending ${pendingReviewCount}` : "Pending" },
                { v: "drafts",  l: draftCount         > 0 ? `Drafts ${draftCount}`          : "Drafts"  },
                { v: "past",    l: pastCount          > 0 ? `Past ${pastCount}`             : "Past"    },
              ].map(f => (
                  <Link key={f.v} href={`/organizer?filter=${f.v}`}
                    className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${filter === f.v ? "bg-paper-2 text-ink ring-1 ring-line" : "text-ink-2 hover:text-ink"}`}>
                    {f.l}
                  </Link>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Activity} title={filter === "all" ? "No events yet" : `No ${filter} events`}
                body={filter === "all" ? "Create your first event to start selling." : "Try a different filter."}
                ctaLabel={filter === "all" ? "Create event" : undefined} ctaHref={filter === "all" ? "/organizer/events/new" : undefined} />
            ) : (
              <>
                {/* Mobile */}
                <div className="md:hidden divide-y divide-line">
                  {filtered.map(e => {
                    const s = e.isPast ? { dot: "bg-ink-3", label: "Past" } : (STATUS[e.status] ?? STATUS.draft)
                    return (
                      <div key={e.id} className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Link href={`/organizer/events/${e.id}`} className="flex-1 min-w-0">
                            <p className="text-[15px] font-semibold text-ink line-clamp-1">{e.title}</p>
                            <p className="text-[12px] text-ink-3 mt-0.5">{e.venue} · {e.startsAt.toLocaleDateString()}</p>
                          </Link>
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            <span className="text-[12px] text-ink-2">{s.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-bold text-ink tabular-nums">{formatCurrency(e.netRevenue, e.currency)}</p>
                          <div className="text-right">
                            <p className="text-[12px] text-ink-3">{e.sold} / {e.capacity} attending</p>
                            {e.checkedIn > 0 && <p className="text-[11px] text-green-700 font-semibold">{e.checkedIn} checked in</p>}
                          </div>
                        </div>
                        <CapacityBar sold={e.sold} capacity={e.capacity} />
                        <div className="mt-3 flex items-center gap-3 pt-3 border-t border-line">
                          {[
                            { icon: Activity, label: "Live", href: `/organizer/events/${e.id}/live` },
                            { icon: Users, label: "Attendees", href: `/organizer/events/${e.id}/attendees` },
                            { icon: Tag, label: "Promos", href: `/organizer/events/${e.id}/promos` },
                            { icon: HelpCircle, label: "Questions", href: `/organizer/events/${e.id}/questions` },
                            { icon: Mail, label: "Email", href: `/organizer/events/${e.id}/email` },
                          ].map(({ icon: Icon, label, href }) => (
                            <Link key={label} href={href} className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-2 hover:text-navy transition-colors">
                              <Icon size={12} /> {label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop */}
                <table className="hidden md:table w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3">Event</th>
                      <th className="text-left px-3 py-3">Date</th>
                      <th className="text-right px-3 py-3">Attending</th>
                      <th className="text-right px-3 py-3">Checked in</th>
                      <th className="text-right px-3 py-3">Net revenue</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map(e => {
                      const s = e.isPast ? { dot: "bg-ink-3", label: "Past" } : (STATUS[e.status] ?? STATUS.draft)
                      return (
                        <tr key={e.id} className="hover:bg-paper-2 transition-colors">
                          <td className="px-5 py-4 max-w-[240px]">
                            <Link href={`/organizer/events/${e.id}`} className="block">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
                              <p className="text-[14px] font-semibold text-ink line-clamp-1 hover:text-navy transition-colors">{e.title}</p>
                            </div>
                            <p className="text-[12px] text-ink-3 pl-3.5">{e.venue}</p>
                            <EventHealthBadges status={e.status} capacity={e.capacity} sold={e.sold} netRevenue={e.netRevenue} hasTiers={e.hasTiers} salesEnded={e.salesEnded} />
                          </Link>
                          </td>
                          <td className="px-3 py-4 text-[13px] text-ink-2 whitespace-nowrap">{e.startsAt.toLocaleDateString()}</td>
                          <td className="px-3 py-4 text-right min-w-[120px]">
                            <p className="text-[13px] font-medium text-ink tabular-nums">{e.sold}<span className="text-ink-3 font-normal"> / {e.capacity}</span></p>
                            <CapacityBar sold={e.sold} capacity={e.capacity} />
                          </td>
                          <td className="px-3 py-4 text-right">
                            <p className="text-[13px] font-semibold text-ink tabular-nums">{e.checkedIn}</p>
                            {e.sold > 0 && <p className="text-[11px] text-ink-3">{Math.round((e.checkedIn / e.sold) * 100)}%</p>}
                          </td>
                          <td className="px-3 py-4 text-right text-[14px] font-bold text-ink tabular-nums whitespace-nowrap">
                            {formatCurrency(e.netRevenue, e.currency)}
                          </td>
                          <td className="px-3 py-4 text-right">
                            <div className="flex items-center gap-0.5 justify-end">
                              {[
                                { icon: Activity, title: "Live dashboard", href: `/organizer/events/${e.id}/live` },
                                { icon: Users, title: "Attendees", href: `/organizer/events/${e.id}/attendees` },
                                { icon: Tag, title: "Promo codes", href: `/organizer/events/${e.id}/promos` },
                                { icon: HelpCircle, title: "Questions", href: `/organizer/events/${e.id}/questions` },
                                { icon: Mail, title: "Email attendees", href: `/organizer/events/${e.id}/email` },
                              ].map(({ icon: Icon, title, href }) => (
                                <Link key={title} href={href} title={title} aria-label={title}
                                  className="p-1.5 rounded-md text-ink-3 hover:text-navy hover:bg-navy/5 transition-colors">
                                  <Icon size={14} />
                                </Link>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Payout card */}
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-4">Earnings</p>
              <p className="text-[28px] font-bold tracking-tight text-ink tabular-nums">{formatCurrency(availableBalance, "USD")}</p>
              <p className="text-[12px] text-ink-3 mt-0.5 mb-5">available balance</p>
              <div className="space-y-2.5 text-[13px] pb-5 border-b border-line mb-4">
                <div className="flex justify-between">
                  <span className="text-ink-2">Gross ticket sales</span>
                  <span className="font-semibold text-ink tabular-nums">{formatCurrency(gross, "USD")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">TicketPulse fee</span>
                  <span className="font-semibold text-ink tabular-nums">-{formatCurrency(platformFee, "USD")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Net revenue</span>
                  <span className="font-semibold text-ink tabular-nums">{formatCurrency(net, "USD")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-2">Paid out</span>
                  <span className="font-semibold text-ink tabular-nums">{formatCurrency(totalPaidOut, "USD")}</span>
                </div>
                {pendingPayout > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-2">In progress</span>
                    <span className="font-semibold text-amber-700 tabular-nums">{formatCurrency(pendingPayout, "USD")}</span>
                  </div>
                )}
              </div>
              {availableBalance > 0 ? (
                <Link href="/payouts/request"
                  className="block w-full rounded-xl bg-ink text-center py-2.5 text-[13px] font-semibold text-white hover:bg-ink/85 transition-colors">
                  Request {formatCurrency(availableBalance, "USD")}
                </Link>
              ) : (
                <p className="text-center text-[13px] text-ink-3 py-2">No balance available to withdraw.</p>
              )}
              <a href="/api/payouts/statement" className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-paper py-2.5 text-[13px] font-semibold text-ink-2 hover:bg-paper-2 transition-colors">
                <ReceiptText size={13} /> Download payout report
              </a>
            </div>

            {/* AI insight */}
            {insightEvent && (
              <AiInsightCard
                eventTitle={insightEvent.title}
                sold={insightEvent.sold}
                capacity={insightEvent.capacity}
                daysRemaining={Math.max(0, Math.ceil((new Date(insightEvent.startsAt).getTime() - now) / 86400000))}
                category={insightEvent.category}
                city={insightEvent.city}
              />
            )}
          </div>
        </div>

        {/* Revenue by event + recent orders */}
        <div className="grid lg:grid-cols-[2fr_3fr] gap-6 tp-fade-up-3">

          {/* Sales bars */}
          <div className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-semibold text-ink">Net sales by event</h2>
              <Link href="/organizer/orders" className="text-[12px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                All orders <ArrowUpRight size={11} />
              </Link>
            </div>
            {SALES_TOP.length === 0 ? (
              <EmptyState icon={DollarSign} title="No sales yet" body="Net revenue by event will appear here." variant="inline" />
            ) : (
              <div className="space-y-4">
                {SALES_TOP.map(e => (
                  <div key={e.id}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <Link href={`/organizer/events/${e.id}`} className="text-[13px] font-medium text-ink hover:text-navy transition-colors truncate max-w-[180px]">
                        {e.title}
                      </Link>
                      <span className="text-[13px] font-bold text-ink tabular-nums ml-2 shrink-0">{formatCurrency(e.netRevenue, e.currency)}</span>
                    </div>
                    <div className="h-1.5 bg-paper-3 rounded-full overflow-hidden">
                      <div className="h-full bg-ink rounded-full" style={{ width: `${Math.round((e.netRevenue / maxRevenue) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold text-ink">Recent orders</h2>
            </div>
            {recentOrdersRaw.length === 0 ? (
              <EmptyState icon={Ticket} title="No orders yet" body="Orders appear as attendees buy tickets." />
            ) : (
              <ul className="divide-y divide-line">
                {recentOrdersRaw.map((o, index) => (
                  <li key={`${o.guestEmail ?? "guest"}-${o.createdAt ? new Date(o.createdAt).toISOString() : index}`} className="px-5 py-3.5 flex items-center gap-3">
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${o.status === "paid" || o.status === "completed" ? "bg-emerald-500" : "bg-rose-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">{o.guestName || o.guestEmail || "Guest"}</p>
                      <p className="text-[12px] text-ink-3">{o.createdAt ? timeAgo(new Date(o.createdAt)) : "—"} · {o.paymentMethod?.toUpperCase() ?? "—"}</p>
                    </div>
                    <span className="text-[13px] font-bold text-ink tabular-nums">{formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Gate scanner CTA + quick links */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 tp-fade-up-3">
          <Link href="/organizer/scan"
            className="sm:col-span-2 lg:col-span-2 rounded-2xl bg-ink text-white p-5 flex items-start gap-4 hover:bg-ink/90 transition-colors">
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-white/10 shrink-0">
              <ScanLine size={18} className="text-white" />
            </span>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-white/60 uppercase mb-1">Gate entry</p>
              <div className="flex items-center gap-2">
                {EVENTS.some(e => e.status === "published" && !e.isPast && e.sold > 0) && (
                  <span className="inline-flex w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <p className="text-[16px] font-bold tracking-tight text-white">Open scanner</p>
              </div>
              <p className="text-[13px] text-white/70 mt-1 leading-relaxed">
                Reads PDF, mobile QR, and wallet passes. No extra hardware.
              </p>
            </div>
          </Link>
          {[
            { title: "Order management", body: "Complete, resend, and manage orders.", href: "/organizer/orders", icon: Zap },
            { title: "Browse vendors", body: "Catering, sound, security and more.", href: "/vendors", icon: Users },
            { title: "Payout history", body: "Track all your payouts and balances.", href: "/payouts", icon: DollarSign },
            { title: "Help & guides", body: "Selling tips for event organizers.", href: "/help/organizers", icon: HelpCircle },
          ].map(({ title, body, href, icon: Icon }) => (
            <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 hover:bg-paper-2 transition-colors">
              <Icon size={14} className="text-ink-3 mb-3" />
              <p className="text-[14px] font-semibold text-ink">{title}</p>
              <p className="text-[13px] text-ink-2 mt-0.5 leading-snug">{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
