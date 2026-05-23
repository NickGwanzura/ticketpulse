import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { eq, desc, or, inArray, sql, and, gte } from "drizzle-orm"
import {
  Plus, ArrowUpRight, Calendar, DollarSign, Users, Ticket, TrendingUp,
  ScanLine, LayoutList, ShoppingCart,
  Activity, Mail, Tag, ExternalLink, AlertCircle,
  CheckCircle2, Percent,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"
import { db } from "@/db"
import { events, eventOrganisers, orders, orderItems, ticketTiers, tickets, users } from "@/db/schema"
import AiInsightCard from "@/components/ai/AiInsightCard"
import PurchaseFunnel from "@/components/dashboard/PurchaseFunnel"
import NewOrganizerChecklist from "@/components/dashboard/NewOrganizerChecklist"

/* ─── Types ───────────────────────────────────────────────────────────────── */

type EventRow = {
  id: string
  slug: string
  title: string
  category: string
  venue: string
  city: string
  startsAt: Date
  status: string
  sold: number
  capacity: number
  revenue: number
  currency: string
}

type OrderRow = {
  name: string
  event: string
  amount: number
  currency: string
  method: string
  status: string
  ago: string
}

type VipBuyer = {
  name: string
  spent: number
  tickets: number
}

type SalesByEvent = {
  id: string
  title: string
  revenue: number
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return d.toLocaleDateString()
}

const STATUS_STYLE: Record<string, string> = {
  published: "bg-green-50 text-green-700",
  draft:     "bg-paper-2 text-ink-2 ring-1 ring-line",
  sold_out:  "bg-rose-50 text-rose-700",
  cancelled: "bg-rose-50 text-rose-700",
  completed: "bg-blue-50 text-blue-700",
}

const METHOD_STYLE: Record<string, string> = {
  ecocash: "bg-green-50 text-green-700",
  card:    "bg-blue-50 text-blue-700",
  omari:   "bg-paper-2 text-ink-2 ring-1 ring-line",
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  paid:      "bg-green-50 text-green-700",
  refunded:  "bg-rose-50 text-rose-600",
  pending:   "bg-amber-50 text-amber-700",
  awaiting_verification: "bg-blue-50 text-blue-700",
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) {
    const w = 80
    const h = 28
    const color = positive ? "#0a2540" : "#dc2626"
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke={color} strokeWidth="1.5" opacity="0.25" strokeDasharray="3 3" />
      </svg>
    )
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const w = 80
  const h = 28
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  const color = positive ? "#0a2540" : "#dc2626"
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

function RevenueChart({ data }: { data: number[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No revenue data yet"
        body="Revenue will appear here once tickets are sold."
        variant="inline"
      />
    )
  }
  const min = 0
  const max = Math.max(...data, 1)
  const w = 800
  const h = 120
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * h
    return [x, y] as [number, number]
  })

  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L${w} ${h} L0 ${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-full overflow-visible" preserveAspectRatio="none" style={{ height: 120 }}>
      <defs>
        <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a2540" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0a2540" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#rev-fill)" />
      <path d={linePath} fill="none" stroke="#0a2540" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => i === pts.length - 1 && (
        <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" fill="#0a2540" />
      ))}
    </svg>
  )
}

/* ─── Data fetchers ───────────────────────────────────────────────────────── */

async function getOrganizerEvents(userId: string, isAdmin: boolean, invitedIds: string[]) {
  const whereClause = isAdmin
    ? undefined
    : invitedIds.length > 0
      ? or(eq(events.organizerId, userId), inArray(events.id, invitedIds))
      : eq(events.organizerId, userId)

  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      category: events.category,
      venue: events.venue,
      city: events.city,
      startsAt: events.startsAt,
      status: events.status,
    })
    .from(events)
    .where(whereClause)
    .orderBy(desc(events.startsAt))
    .limit(50)

  return rows
}

async function getEventSales(eventIds: string[]) {
  if (eventIds.length === 0) return { tiers: [], orders: [] }

  const tiers = await db
    .select({
      eventId: ticketTiers.eventId,
      totalQuantity: ticketTiers.totalQuantity,
      soldQuantity: ticketTiers.soldQuantity,
      price: ticketTiers.price,
      currency: ticketTiers.currency,
    })
    .from(ticketTiers)
    .where(inArray(ticketTiers.eventId, eventIds))

  const ordersRows = await db
    .select({
      eventId: orders.eventId,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      status: orders.status,
    })
    .from(orders)
    .where(and(inArray(orders.eventId, eventIds), inArray(orders.status, ["paid", "awaiting_verification"])))

  return { tiers, orders: ordersRows }
}

async function getRecentOrders(eventIds: string[], limit = 8) {
  if (eventIds.length === 0) return []
  const rows = await db
    .select({
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      createdAt: orders.createdAt,
      eventId: orders.eventId,
    })
    .from(orders)
    .where(inArray(orders.eventId, eventIds))
    .orderBy(desc(orders.createdAt))
    .limit(limit)

  return rows
}

async function getTopBuyers(eventIds: string[], limit = 5) {
  if (eventIds.length === 0) return []
  const rows = await db
    .select({
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      totalAmount: orders.totalAmount,
    })
    .from(orders)
    .where(and(inArray(orders.eventId, eventIds), inArray(orders.status, ["paid"])))

  const map = new Map<string, VipBuyer>()
  for (const r of rows) {
    const key = r.guestEmail || r.guestName || "Guest"
    const existing = map.get(key)
    if (existing) {
      existing.spent += Number(r.totalAmount ?? 0)
      existing.tickets += 1
    } else {
      map.set(key, {
        name: r.guestName || r.guestEmail || "Guest",
        spent: Number(r.totalAmount ?? 0),
        tickets: 1,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.spent - a.spent).slice(0, limit)
}

async function getRevenueByDay(eventIds: string[], days = 30) {
  if (eventIds.length === 0) return []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      createdAt: orders.createdAt,
      totalAmount: orders.totalAmount,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.eventId, eventIds),
        inArray(orders.status, ["paid", "awaiting_verification"]),
        gte(orders.createdAt, since),
      ),
    )
    .orderBy(orders.createdAt)

  // Bucket by day
  const byDay = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, 0)
  }
  for (const r of rows) {
    if (!r.createdAt) continue
    const key = new Date(r.createdAt).toISOString().slice(0, 10)
    if (byDay.has(key)) {
      byDay.set(key, byDay.get(key)! + Number(r.totalAmount ?? 0))
    }
  }
  return Array.from(byDay.values())
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default async function OrganizerPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; rev?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/organizer")

  const isAdmin = session.user.role === "admin"

  // Fetch user's commission rate for display
  const [userRow] = await db
    .select({ commissionRate: users.commissionRate })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  const commissionRate = Number(userRow?.commissionRate ?? 8)
  const isFreeListing = commissionRate === 0

  const invitedEventIds = isAdmin ? [] : await db
    .select({ eventId: eventOrganisers.eventId })
    .from(eventOrganisers)
    .where(eq(eventOrganisers.userId, session.user.id))

  const isInvitedOrganiser = invitedEventIds.length > 0

  if (!isAdmin && session.user.role !== "organizer" && !isInvitedOrganiser) {
    redirect("/dashboard")
  }

  const sp = await searchParams
  const filter = sp.filter || "all"
  const revDays = Math.min(365, Math.max(7, Number(sp.rev) || 30))

  const ownedIds = invitedEventIds.map((r) => r.eventId)
  const rawEvents = await getOrganizerEvents(session.user.id, isAdmin, ownedIds)

  const eventIds = rawEvents.map((r) => r.id)
  const { tiers: allTiers, orders: allOrders } = await getEventSales(eventIds)
  const recentOrdersRaw = await getRecentOrders(eventIds)
  const vipBuyers = await getTopBuyers(eventIds)
  const revenue30d = await getRevenueByDay(eventIds, revDays)

  // Build enriched event rows
  const ORGANIZER_EVENTS: EventRow[] = rawEvents.map((r) => {
    const eventTiers = allTiers.filter((t) => t.eventId === r.id)
    const capacity = eventTiers.reduce((s, t) => s + (t.totalQuantity ?? 0), 0)
    const sold = eventTiers.reduce((s, t) => s + (t.soldQuantity ?? 0), 0)
    const eventOrders = allOrders.filter((o) => o.eventId === r.id)
    const revenue = eventOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0)
    const currency = eventTiers[0]?.currency ?? eventOrders[0]?.currency ?? "USD"
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      venue: r.venue,
      city: r.city,
      startsAt: r.startsAt,
      status: r.status ?? "draft",
      sold,
      capacity,
      revenue,
      currency,
    }
  })

  const filteredEvents = ORGANIZER_EVENTS.filter((e) => {
    if (filter === "live") return e.status === "published"
    if (filter === "drafts") return e.status === "draft"
    return true
  })

  const totalRevenue = ORGANIZER_EVENTS.reduce((s, e) => s + (e.currency === "USD" ? e.revenue : 0), 0)
  const totalSold = ORGANIZER_EVENTS.reduce((s, e) => s + e.sold, 0)
  const liveEvents = ORGANIZER_EVENTS.filter((e) => e.status === "published").length

  const gross = totalRevenue
  const net = totalRevenue * 0.97 // rough estimate minus 3% fees
  const refunds = 0 // no refund tracking yet
  const avgOrder = totalSold > 0 ? totalRevenue / totalSold : 0

  const RECENT_ORDERS: OrderRow[] = recentOrdersRaw.map((o) => ({
    name: o.guestName || o.guestEmail || "Guest",
    event: ORGANIZER_EVENTS.find((e) => e.id === o.eventId)?.title ?? "Event",
    amount: Number(o.totalAmount ?? 0),
    currency: o.currency ?? "USD",
    method: o.paymentMethod || "—",
    status: o.status || "pending",
    ago: o.createdAt ? timeAgo(new Date(o.createdAt)) : "—",
  }))

  const SALES_BY_EVENT: SalesByEvent[] = ORGANIZER_EVENTS
    .filter((e) => e.revenue > 0)
    .map((e) => ({ id: e.id, title: e.title, revenue: e.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  // Activity
  const activity: { icon: typeof Activity; text: string; ago: string }[] = []
  for (const o of recentOrdersRaw.slice(0, 3)) {
    if (o.status === "paid") {
      activity.push({
        icon: Activity,
        text: `${o.guestName || o.guestEmail || "Someone"} purchased tickets`,
        ago: o.createdAt ? timeAgo(new Date(o.createdAt)) : "Recently",
      })
    }
  }

  // Sparkline from revenue data
  const sparkData = revenue30d.length >= 2 ? revenue30d : []
  const KPI_SPARKLINES: Record<string, number[]> = {
    "Live events":   [],
    "Tickets sold":  [],
    "Revenue (USD)": sparkData,
    "Followers":     [],
  }

  // Find best event for AI insight (first published with sales, or first published, or first)
  const insightEvent = ORGANIZER_EVENTS.find((e) => e.status === "published" && e.sold > 0)
    || ORGANIZER_EVENTS.find((e) => e.status === "published")
    || ORGANIZER_EVENTS[0]

  // Checklist state
  const hasEvents = ORGANIZER_EVENTS.length > 0
  const hasTiers = allTiers.length > 0
  const hasPublished = ORGANIZER_EVENTS.some((e) => e.status === "published")
  const hasSales = totalSold > 0
  const firstEventId = ORGANIZER_EVENTS[0]?.id

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="Your events"
        subtitle={`Welcome back, ${session.user.name?.split(" ")[0] ?? "organizer"}.`}
        width="xl"
        actions={
          <>
            <Link
              href="/organizer/scan"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <ScanLine size={15} /> Open scanner
            </Link>
            <Link
              href="/organizer/events/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 active:scale-[0.99] transition"
            >
              <Plus size={15} /> Create event
            </Link>
          </>
        }
      />

      {/* Commission rate badge */}
      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-4">
        {isFreeListing ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-[12px] font-medium text-green-700">
            <CheckCircle2 size={13} /> Free listing — no platform fee on your events
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full bg-paper-2 border border-line px-3 py-1.5 text-[12px] text-ink-2">
            <Percent size={13} className="text-ink-3" /> Platform fee: {commissionRate}% per ticket sold
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-8">

        {/* New organizer checklist */}
        <NewOrganizerChecklist
          hasEvents={hasEvents}
          hasTiers={hasTiers}
          hasPublished={hasPublished}
          hasSales={hasSales}
          firstEventId={firstEventId}
        />

        {/* Draft alert */}
        {ORGANIZER_EVENTS.some((e) => e.status === "draft") && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-amber-800">
                You have {ORGANIZER_EVENTS.filter((e) => e.status === "draft").length} draft event{ORGANIZER_EVENTS.filter((e) => e.status === "draft").length !== 1 ? "s" : ""}
              </p>
              <p className="text-[12.5px] text-amber-700 mt-0.5">
                Publish them to start selling tickets.{" "}
                <Link href={`/organizer/events/${ORGANIZER_EVENTS.find((e) => e.status === "draft")?.id}/edit`} className="underline hover:text-amber-900">
                  Open first draft
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {(
            [
              { l: "Live events",   v: liveEvents.toString(),               i: Calendar,   pos: true  },
              { l: "Tickets sold",  v: totalSold.toLocaleString(),          i: Ticket,     pos: true  },
              { l: "Revenue (USD)", v: formatCurrency(totalRevenue, "USD"), i: DollarSign, pos: true  },
              { l: "Followers",     v: "0",                                 i: Users,      pos: true  },
            ] as const
          ).map(({ l, v, i: Icon, pos }) => {
            const spark = KPI_SPARKLINES[l] ?? []
            return (
              <div key={l} className="tp-card-accent rounded-2xl border border-line bg-paper p-5 flex flex-col justify-between min-h-[120px] tp-lift">
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="inline-flex w-6 h-6 items-center justify-center rounded-md bg-paper-2 ring-1 ring-line">
                      <Icon size={13} className="text-ink-2" />
                    </span>
                    <span className="text-[11.5px] text-ink-3">{l}</span>
                  </div>
                  <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{v}</p>
                </div>
                <div className="flex justify-end mt-3">
                  <Sparkline data={spark} positive={pos} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Revenue chart */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-2">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">Revenue (last {revDays} days)</h2>
            <div className="flex items-center gap-1">
              {[
                { label: "7d", days: 7 },
                { label: "30d", days: 30 },
                { label: "90d", days: 90 },
                { label: "All", days: 365 },
              ].map((pill) => (
                <Link
                  key={pill.label}
                  href={`/organizer?filter=${filter}&rev=${pill.days}`}
                  className={`text-[11.5px] font-medium px-2.5 py-1 rounded-md cursor-pointer select-none ${
                    pill.days === revDays
                      ? "bg-paper-2 ring-1 ring-line text-ink"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {pill.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="px-5 md:px-6 pt-5 pb-4">
            <RevenueChart data={revenue30d} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-line border-t border-line">
            {[
              { label: "Gross volume",    value: formatCurrency(gross, "USD")    },
              { label: "Net revenue",     value: formatCurrency(net, "USD")      },
              { label: "Refunds",         value: formatCurrency(refunds, "USD")  },
              { label: "Avg order value", value: formatCurrency(avgOrder, "USD") },
            ].map(({ label, value }) => (
              <div key={label} className="px-5 md:px-6 py-4">
                <p className="text-[11px] text-ink-3 mb-1">{label}</p>
                <p className="text-[18px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase journey funnel */}
        <div className="tp-fade-up-3">
          <PurchaseFunnel eventIds={ORGANIZER_EVENTS.map((e) => e.id)} />
        </div>

        {/* Events table + side column */}
        <div className="grid grid-cols-12 gap-4 md:gap-6 tp-fade-up-3">

          {/* Events table */}
          <div className="col-span-12 lg:col-span-8 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">All events</h2>
              <div className="flex items-center gap-1.5">
                {[
                  { label: "All", value: "all" },
                  { label: "Live", value: "live" },
                  { label: "Drafts", value: "drafts" },
                ].map((f) => (
                  <Link
                    key={f.value}
                    href={`/organizer?filter=${f.value}`}
                    className={`text-[12.5px] font-medium px-3 py-1.5 rounded-md transition-colors ${
                      filter === f.value
                        ? "bg-paper-2 text-ink ring-1 ring-line"
                        : "text-ink-2 hover:text-ink hover:bg-paper-2"
                    }`}
                  >
                    {f.label}
                  </Link>
                ))}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <EmptyState
                icon={LayoutList}
                title={filter === "all" ? "No events yet" : `No ${filter} events`}
                body={filter === "all" ? "Create your first event to start selling tickets." : "Try a different filter."}
                ctaLabel={filter !== "all" ? undefined : "Create event"}
                ctaHref={filter !== "all" ? undefined : "/organizer/events/new"}
              />
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-line">
                  {filteredEvents.map((e) => (
                    <div key={e.id} className="p-5 hover:bg-paper-2 transition-colors">
                      <Link href={`/organizer/events/${e.id}`} className="block">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status] ?? STATUS_STYLE.draft}`}>
                            {e.status}
                          </span>
                          <ArrowUpRight size={14} className="text-ink-3" />
                        </div>
                        <p className="text-[14.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                        <p className="text-[12.5px] text-ink-2 mt-0.5">{e.venue}</p>
                      </Link>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line">
                        <Link href={`/organizer/events/${e.id}/live`} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2 hover:text-navy transition-colors">
                          <Activity size={13} /> Live
                        </Link>
                        <Link href={`/organizer/events/${e.id}/attendees`} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2 hover:text-navy transition-colors">
                          <Users size={13} /> Attendees
                        </Link>
                        <Link href={`/organizer/events/${e.id}/promos`} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2 hover:text-navy transition-colors">
                          <Tag size={13} /> Promos
                        </Link>
                        <Link href={`/organizer/events/${e.id}/email`} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2 hover:text-navy transition-colors">
                          <Mail size={13} /> Email
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <table className="hidden md:table w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-6 py-3 font-semibold">Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-right px-3 py-3 font-semibold">Sold</th>
                      <th className="text-right px-3 py-3 font-semibold">Revenue</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredEvents.map((e) => {
                      const pct = e.capacity > 0 ? Math.round((e.sold / e.capacity) * 100) : 0
                      return (
                        <tr key={e.id} className="tp-row-accent hover:bg-paper-2 transition-colors">
                          <td className="px-6 py-4 max-w-xs">
                            <Link href={`/organizer/events/${e.id}`} className="block">
                              <p className="text-[14px] font-semibold tracking-tight text-ink line-clamp-1 hover:text-navy transition-colors">{e.title}</p>
                              <p className="text-[12px] text-ink-3 mt-0.5">{e.venue}</p>
                            </Link>
                          </td>
                          <td className="px-3 py-4 text-[13px] text-ink-2 whitespace-nowrap">{e.startsAt.toLocaleDateString()}</td>
                          <td className="px-3 py-4">
                            <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[e.status] ?? STATUS_STYLE.draft}`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-right whitespace-nowrap">
                            <p className="text-[13px] font-semibold text-ink">{e.sold.toLocaleString()} <span className="text-ink-3 font-normal">/ {e.capacity.toLocaleString()}</span></p>
                            <div className="w-24 h-1 bg-paper-2 rounded-full mt-1.5 ml-auto overflow-hidden">
                              <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-4 text-right text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                            {formatCurrency(e.revenue, e.currency)}
                          </td>
                          <td className="px-3 py-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                href={`/organizer/events/${e.id}/live`}
                                className="inline-flex items-center justify-center text-ink-3 hover:text-navy p-1.5 rounded-md hover:bg-navy/5"
                                title="Live dashboard"
                              >
                                <Activity size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/attendees`}
                                className="inline-flex items-center justify-center text-ink-3 hover:text-navy p-1.5 rounded-md hover:bg-navy/5"
                                title="Attendees"
                              >
                                <Users size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/promos`}
                                className="inline-flex items-center justify-center text-ink-3 hover:text-navy p-1.5 rounded-md hover:bg-navy/5"
                                title="Promo codes"
                              >
                                <Tag size={14} />
                              </Link>
                              <Link
                                href={`/organizer/events/${e.id}/email`}
                                className="inline-flex items-center justify-center text-ink-3 hover:text-navy p-1.5 rounded-md hover:bg-navy/5"
                                title="Email attendees"
                              >
                                <Mail size={14} />
                              </Link>
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

          {/* Side column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

            {/* AI Sales Insight */}
            {insightEvent && (
              <AiInsightCard
                eventTitle={insightEvent.title}
                sold={insightEvent.sold}
                capacity={insightEvent.capacity}
                daysRemaining={Math.max(0, Math.ceil((new Date(insightEvent.startsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                category={insightEvent.category}
                city={insightEvent.city}
              />
            )}

            {/* Upcoming payout */}
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Upcoming payout</p>
              <p className="text-[32px] font-bold tracking-tight text-ink tabular-nums">{formatCurrency(0, "USD")}</p>
              <p className="text-[12px] text-ink-3 mt-0.5 mb-4">USD via EcoCash</p>
              <div className="space-y-2 text-[12.5px] text-ink-2">
                <div className="flex justify-between">
                  <span>Scheduled</span>
                  <span className="font-medium text-ink-3">0</span>
                </div>
                <div className="flex justify-between">
                  <span>From event</span>
                  <span className="font-medium text-ink-3">0</span>
                </div>
              </div>
              <button className="mt-5 w-full rounded-xl border border-line text-[13px] font-semibold text-ink py-2.5 hover:bg-paper-2 transition">
                Request earlier
              </button>
            </div>

            {/* VIP attendees */}
            <div className="rounded-2xl border border-line bg-paper p-5 flex-1">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Top buyers</p>
              {vipBuyers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No buyers yet"
                  body="Top ticket buyers will appear here."
                  variant="inline"
                />
              ) : (
                <div className="space-y-3">
                  {vipBuyers.map((b, i) => (
                    <div key={b.name} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-ink-3 w-4 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{b.name}</p>
                        <p className="text-[11px] text-ink-3">{b.tickets} order{b.tickets !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-[13px] font-bold text-ink tabular-nums shrink-0">{formatCurrency(b.spent, "USD")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sales by event + Recent orders */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Sales by event */}
          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-line bg-paper p-5">
            <p className="text-[16px] font-semibold tracking-tight text-ink mb-5">Sales by event</p>
            {SALES_BY_EVENT.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="No sales data yet"
                body="Revenue by event will appear here once orders come in."
                variant="inline"
              />
            ) : (
              <div className="space-y-4">
                {SALES_BY_EVENT.map((e) => {
                  const maxSales = Math.max(...SALES_BY_EVENT.map((s) => s.revenue))
                  const pct = Math.round((e.revenue / maxSales) * 100)
                  return (
                    <div key={e.id}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <p className="text-[13px] font-medium text-ink truncate max-w-[180px]">{e.title}</p>
                        <span className="text-[13px] font-bold text-ink tabular-nums shrink-0 ml-3">{formatCurrency(e.revenue, "USD")}</span>
                      </div>
                      <div className="h-1.5 bg-paper-2 rounded-full overflow-hidden">
                        <div className="h-full bg-navy rounded-full tp-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div className="col-span-12 lg:col-span-7 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">Recent orders</h2>
            </div>

            {RECENT_ORDERS.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No orders yet"
                body="Orders will appear here as attendees purchase tickets."
              />
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="md:hidden divide-y divide-line">
                  {RECENT_ORDERS.map((o) => (
                    <div key={`${o.name}-${o.ago}`} className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <p className="text-[13.5px] font-semibold text-ink">{o.name}</p>
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full shrink-0 ${ORDER_STATUS_STYLE[o.status]}`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-[12px] text-ink-3 truncate mb-2">{o.event}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-ink tabular-nums">{formatCurrency(o.amount, o.currency)}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${METHOD_STYLE[o.method] ?? METHOD_STYLE.ecocash}`}>{o.method}</span>
                        <span className="text-[11px] text-ink-3 ml-auto">{o.ago}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <table className="hidden md:table w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">Customer</th>
                      <th className="text-left px-3 py-3 font-semibold">Event</th>
                      <th className="text-right px-3 py-3 font-semibold">Amount</th>
                      <th className="text-center px-3 py-3 font-semibold">Method</th>
                      <th className="text-center px-3 py-3 font-semibold">Status</th>
                      <th className="text-right px-3 py-3 font-semibold">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {RECENT_ORDERS.map((o) => (
                      <tr key={`${o.name}-${o.ago}`} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-3 text-[13px] font-semibold text-ink whitespace-nowrap">{o.name}</td>
                        <td className="px-3 py-3 text-[12px] text-ink-2 max-w-[160px]">
                          <span className="line-clamp-1">{o.event}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] font-bold text-ink tabular-nums whitespace-nowrap">{formatCurrency(o.amount, o.currency)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${METHOD_STYLE[o.method] ?? METHOD_STYLE.ecocash}`}>{o.method}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${ORDER_STATUS_STYLE[o.status]}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-[11.5px] text-ink-3 whitespace-nowrap">{o.ago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Activity timeline + Quick links */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Activity timeline */}
          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-line bg-paper p-5">
            <p className="text-[16px] font-semibold tracking-tight text-ink mb-5">What&apos;s happening</p>
            {activity.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No recent activity"
                body="Activity from your events will appear here."
                variant="inline"
              />
            ) : (
              <div className="space-y-4">
                {activity.map(({ icon: Icon, text, ago }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-paper-2 p-1.5 shrink-0">
                      <Icon size={13} className="text-ink-2" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-ink leading-snug">{text}</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">{ago}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
            <p className="text-[16px] font-semibold tracking-tight text-ink sm:col-span-3">Quick links</p>

            <Link
              href="/organizer/scan"
              className="sm:col-span-3 rounded-2xl border border-navy/10 bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-5 tp-lift relative overflow-hidden"
            >
              <span className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-green-500/30 blur-3xl pointer-events-none" aria-hidden />
              <div className="relative flex items-start gap-4">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 shrink-0">
                  <ScanLine size={18} className="text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold tracking-[0.18em] text-white/70 uppercase">End-to-end · included</p>
                  <p className="text-[15.5px] font-semibold tracking-tight text-white mt-0.5">Open the gate scanner</p>
                  <p className="text-[12.5px] text-white/75 mt-1 leading-relaxed">
                    Run TicketPulse&apos;s reader app on a phone or tablet at the gate. Reads PDF, mobile QR, and wallet passes. No third-party scanner contracts.
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-white">
                    Launch scanner <ArrowUpRight size={12} />
                  </p>
                </div>
              </div>
            </Link>

            {[
              { title: "Set up payouts", body: "Add EcoCash or bank to receive payouts.",   href: "/payouts" },
              { title: "Browse vendors", body: "Find catering, sound, security and more.",  href: "/vendors" },
              { title: "Live dashboard", body: "Real-time check-in tracking and entry stats.", href: ORGANIZER_EVENTS.length > 0 ? `/organizer/events/${ORGANIZER_EVENTS[0].id}/live` : "#" },
              { title: "WhatsApp broadcast", body: "Send bulk WhatsApp messages to attendees.", href: ORGANIZER_EVENTS.length > 0 ? `/organizer/events/${ORGANIZER_EVENTS[0].id}/whatsapp` : "#" },
              { title: "Promo codes", body: "Create discount codes to boost ticket sales.",  href: ORGANIZER_EVENTS.length > 0 ? `/organizer/events/${ORGANIZER_EVENTS[0].id}/promos` : "#" },
              { title: "Attendee list", body: "View and export your full attendee roster.",  href: ORGANIZER_EVENTS.length > 0 ? `/organizer/events/${ORGANIZER_EVENTS[0].id}/attendees` : "#" },
              { title: "Read the guide", body: "Selling tips for first-time organizers.",    href: "/help" },
            ].map(({ title, body, href }) => (
              <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
                <p className="text-[14px] font-semibold tracking-tight text-ink">{title}</p>
                <p className="text-[12.5px] text-ink-2 mt-1">{body}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy">
                  Open <ArrowUpRight size={12} />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
