import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, and, inArray, desc, sql, isNotNull } from "drizzle-orm"
import Link from "next/link"
import {
  Ticket, Users, DollarSign, Activity, Mail, MessageCircle,
  Tag, QrCode, ShoppingBag, ImageIcon, Store, ArrowUpRight,
  TrendingUp, Calendar, ScanLine, HelpCircle,
} from "lucide-react"

import { db } from "@/db"
import { events, orders, ticketTiers, tickets } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"
import AiInsightCard from "@/components/ai/AiInsightCard"
import { publishOrganizerEventAction } from "../actions"
import PublishEventButton from "../PublishEventButton"

export const metadata = { title: "Event overview" }

type RouteParams = { id: string }

export default async function EventOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<{ published?: string; publishError?: string }>
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

  // ── Revenue from paid orders ───────────────────────────────────────────────
  const [revenueRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${orders.totalAmount})::numeric, 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.eventId, id), inArray(orders.status, ["paid", "completed"])))

  const revenue = Number(revenueRow?.total ?? 0)
  const currency = tiers[0]?.currency ?? "USD"

  // ── Attendees ──────────────────────────────────────────────────────────────
  const attendeeRows = await db
    .select({
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      totalAmount: orders.totalAmount,
    })
    .from(orders)
    .where(and(eq(orders.eventId, id), inArray(orders.status, ["paid", "completed"])))

  const totalAttendees = totalSold

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
  for (const o of recentOrders.slice(0, 3)) {
    if (o.status === "paid") {
      activity.push({
        text: `${o.guestName || o.guestEmail || "Someone"} purchased tickets`,
        ago: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "Recently",
      })
    }
  }
  if (checkedIn > 0) {
    activity.push({ text: `${checkedIn} attendee${checkedIn !== 1 ? "s" : ""} checked in`, ago: "Total" })
  }

  const daysRemaining = Math.max(0, Math.ceil((new Date(event.startsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
  const isPublished = event.status === "published"
  const publishAction = publishOrganizerEventAction.bind(null, id)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={event.title}
        subtitle={`${event.venue} · ${event.city} · ${event.startsAt.toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            {!isPublished && (
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
          </div>
        }
      />

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-8">
        {sp.published === "1" && (
          <div className="rounded-xl border border-brand-200 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-800">
            Event published. It is now visible on TicketPulse.
          </div>
        )}

        {sp.published === "already" && (
          <div className="rounded-xl border border-brand-200 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-800">
            This event is already published.
          </div>
        )}

        {sp.publishError === "locked" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
            This event cannot be published because it is cancelled or completed.
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: "Tickets sold", value: `${totalSold.toLocaleString()} / ${totalCapacity.toLocaleString()}`, icon: Ticket, color: "text-navy" },
            { label: "Revenue", value: formatCurrency(revenue, currency), icon: DollarSign, color: "text-green-700" },
            { label: "Attendees", value: totalAttendees.toLocaleString(), icon: Users, color: "text-blue" },
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
                  { label: "Staff tickets", href: `/organizer/events/${id}/staff`, icon: QrCode },
                  { label: "Photo gallery", href: `/organizer/events/${id}/gallery`, icon: ImageIcon },
                  { label: "Questions", href: `/organizer/events/${id}/questions`, icon: HelpCircle },
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
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">What&apos;s happening</p>
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
