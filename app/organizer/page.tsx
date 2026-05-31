import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { eq, desc, or, inArray, sql, and, gte } from "drizzle-orm"
import {
  Plus, ArrowUpRight, ScanLine, AlertCircle,
  Ticket, DollarSign, TrendingUp, Users,
  Activity, Tag, Mail, HelpCircle, Zap,
  CheckCircle2,
} from "lucide-react"

import { formatCurrency } from "@/lib/utils"
import { db } from "@/db"
import { events, eventOrganisers, orders, orderItems, ticketTiers, users, platformSettings, payouts } from "@/db/schema"
import AiInsightCard from "@/components/ai/AiInsightCard"
import EmptyState from "@/components/dashboard/EmptyState"
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

function CapacityBar({ sold, capacity }: { sold: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0
  const color = pct >= 90 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-ink"
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 bg-paper-3 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10.5px] text-ink-3 tabular-nums shrink-0">{pct}%</span>
    </div>
  )
}

export default async function OrganizerPage({ searchParams }: { searchParams: Promise<{ filter?: string; rev?: string }> }) {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/organizer")
  const isAdmin = session.user.role === "admin"

  const [userRow] = await db.select({ commissionRate: users.commissionRate }).from(users).where(eq(users.id, session.user.id)).limit(1)
  const commissionRate = Number(userRow?.commissionRate ?? 8)

  const invitedEventIds = isAdmin ? [] : await db
    .select({ eventId: eventOrganisers.eventId })
    .from(eventOrganisers).where(eq(eventOrganisers.userId, session.user.id))

  if (!isAdmin && session.user.role !== "organizer" && invitedEventIds.length === 0) redirect("/dashboard")

  const sp = await searchParams
  const filter = sp.filter || "all"
  const revDays = Math.min(365, Math.max(7, Number(sp.rev) || 30))

  const ownedIds = invitedEventIds.map(r => r.eventId)
  const whereClause = isAdmin ? undefined
    : ownedIds.length > 0 ? or(eq(events.organizerId, session.user.id), inArray(events.id, ownedIds))
    : eq(events.organizerId, session.user.id)

  const rawEvents = await db
    .select({ id: events.id, slug: events.slug, title: events.title, category: events.category, venue: events.venue, city: events.city, startsAt: events.startsAt, status: events.status })
    .from(events).where(whereClause).orderBy(desc(events.startsAt)).limit(50)

  const eventIds = rawEvents.map(r => r.id)

  const [allTiers, allOrders, recentOrdersRaw, settingsRow, pendingPayoutRow, paidOutRow, pendingCountRow] = await Promise.all([
    eventIds.length > 0 ? db.select({ eventId: ticketTiers.eventId, totalQuantity: ticketTiers.totalQuantity, soldQuantity: ticketTiers.soldQuantity, price: ticketTiers.price, currency: ticketTiers.currency }).from(ticketTiers).where(inArray(ticketTiers.eventId, eventIds)) : Promise.resolve([]),
    eventIds.length > 0 ? db.select({ eventId: orders.eventId, totalAmount: orders.totalAmount, currency: orders.currency, status: orders.status }).from(orders).where(and(inArray(orders.eventId, eventIds), inArray(orders.status, ["paid", "completed"]))) : Promise.resolve([]),
    eventIds.length > 0 ? db.select({ guestName: orders.guestName, guestEmail: orders.guestEmail, totalAmount: orders.totalAmount, currency: orders.currency, paymentMethod: orders.paymentMethod, status: orders.status, createdAt: orders.createdAt, eventId: orders.eventId }).from(orders).where(and(inArray(orders.eventId, eventIds), inArray(orders.status, ["paid", "completed", "refunded"]))).orderBy(desc(orders.createdAt)).limit(8) : Promise.resolve([]),
    db.select({ value: platformSettings.value }).from(platformSettings).where(and(eq(platformSettings.key, "platform_fee_percent"), eq(platformSettings.env, "prod"))).limit(1),
    db.select({ total: sql<string>`COALESCE(SUM(${payouts.amount}), 0)` }).from(payouts).where(and(eq(payouts.userId, session.user.id), sql`${payouts.status} in ('pending', 'approved', 'processing')`)),
    db.select({ total: sql<string>`COALESCE(SUM(${payouts.amount}), 0)` }).from(payouts).where(and(eq(payouts.userId, session.user.id), eq(payouts.status, "paid"))),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(payouts).where(and(eq(payouts.userId, session.user.id), eq(payouts.status, "pending"))),
  ])

  const platformFeePercent = Number(settingsRow?.[0]?.value ?? 8)
  const pendingPayout = Number(pendingPayoutRow?.[0]?.total ?? 0)
  const totalPaidOut = Number(paidOutRow?.[0]?.total ?? 0)
  const pendingCount = pendingCountRow?.[0]?.count ?? 0

  // Enrich events
  const EVENTS = rawEvents.map(r => {
    const tiers = allTiers.filter(t => t.eventId === r.id)
    const evOrders = allOrders.filter(o => o.eventId === r.id)
    const capacity = tiers.reduce((s, t) => s + (t.totalQuantity ?? 0), 0)
    const sold = tiers.reduce((s, t) => s + (t.soldQuantity ?? 0), 0)
    const revenue = evOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0)
    const currency = tiers[0]?.currency ?? evOrders[0]?.currency ?? "USD"
    return { ...r, capacity, sold, revenue, currency, status: r.status ?? "draft" }
  })

  const filtered = EVENTS.filter(e => filter === "live" ? e.status === "published" : filter === "drafts" ? e.status === "draft" : true)
  const totalRevenue = EVENTS.reduce((s, e) => s + e.revenue, 0)
  const totalSold = EVENTS.reduce((s, e) => s + e.sold, 0)
  const liveCount = EVENTS.filter(e => e.status === "published").length
  const draftCount = EVENTS.filter(e => e.status === "draft").length
  const gross = totalRevenue
  const net = gross * (1 - platformFeePercent / 100)
  const availableBalance = Math.max(0, net - totalPaidOut - pendingPayout)

  const hasEvents = EVENTS.length > 0
  const hasTiers = allTiers.length > 0
  const hasPublished = EVENTS.some(e => e.status === "published")
  const hasSales = totalSold > 0

  const insightEvent = EVENTS.find(e => e.status === "published" && e.sold > 0) || EVENTS.find(e => e.status === "published") || EVENTS[0]
  const SALES_TOP = [...EVENTS].filter(e => e.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  const maxRevenue = Math.max(...SALES_TOP.map(e => e.revenue), 1)

  const firstName = session.user.name?.split(" ")[0] ?? "organizer"

  return (
    <div className="tp-fade-up">
      {/* Header */}
      <div className="border-b border-line bg-paper">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-1">Organizer</p>
            <h1 className="text-[26px] md:text-[30px] font-bold tracking-tight text-ink leading-none">
              {firstName}&apos;s events
            </h1>
            {commissionRate === 0 ? (
              <span className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-700">
                <CheckCircle2 size={12} /> Free listing — no platform fee
              </span>
            ) : (
              <span className="mt-2 inline-flex text-[11.5px] text-ink-3">
                {commissionRate}% platform fee per sale
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/organizer/scan" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] font-medium text-ink hover:border-line-2 transition-colors">
              <ScanLine size={14} /> Scanner
            </Link>
            <Link href="/organizer/events/new" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink/85 transition-colors">
              <Plus size={14} /> New event
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-8">

        {/* Checklist for new organizers */}
        <NewOrganizerChecklist
          hasEvents={hasEvents}
          hasTiers={hasTiers}
          hasPublished={hasPublished}
          hasSales={hasSales}
          firstEventId={EVENTS[0]?.id}
        />

        {/* Draft nudge */}
        {draftCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <p className="text-[12.5px] text-amber-800 flex-1">
              {draftCount} draft event{draftCount !== 1 ? "s" : ""} not yet published.{" "}
              <Link href={`/organizer/events/${EVENTS.find(e => e.status === "draft")?.id}/edit`} className="font-semibold underline">
                Open draft
              </Link>
            </p>
          </div>
        )}

        {/* KPI row — flat, no card borders */}
        <div className="grid grid-cols-2 md:grid-cols-4 border border-line rounded-2xl bg-paper overflow-hidden divide-y md:divide-y-0 md:divide-x divide-line tp-fade-up-1">
          {[
            { label: "Live events",    value: liveCount.toLocaleString(),            icon: Activity },
            { label: "Tickets sold",   value: totalSold.toLocaleString(),            icon: Ticket },
            { label: "Gross revenue",  value: formatCurrency(gross, "USD"),          icon: DollarSign },
            { label: "Net earnings",   value: formatCurrency(net, "USD"),            icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="px-5 py-5">
              <div className="flex items-center gap-1.5 mb-3">
                <Icon size={12} className="text-ink-3" />
                <span className="text-[11.5px] text-ink-3">{label}</span>
              </div>
              <p className="text-[22px] md:text-[24px] font-bold tracking-tight text-ink leading-none tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Events + payout */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 tp-fade-up-2">

          {/* Events table */}
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">Your events</h2>
              <div className="flex items-center gap-1">
                {[{ v: "all", l: "All" }, { v: "live", l: "Live" }, { v: "drafts", l: "Drafts" }].map(f => (
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
                    const s = STATUS[e.status] ?? STATUS.draft
                    return (
                      <div key={e.id} className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Link href={`/organizer/events/${e.id}`} className="flex-1 min-w-0">
                            <p className="text-[14.5px] font-semibold text-ink line-clamp-1">{e.title}</p>
                            <p className="text-[12px] text-ink-3 mt-0.5">{e.venue} · {e.startsAt.toLocaleDateString()}</p>
                          </Link>
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            <span className="text-[11.5px] text-ink-2">{s.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-bold text-ink tabular-nums">{formatCurrency(e.revenue, e.currency)}</p>
                          <p className="text-[12px] text-ink-3">{e.sold} / {e.capacity} tickets</p>
                        </div>
                        <CapacityBar sold={e.sold} capacity={e.capacity} />
                        <div className="mt-3 flex items-center gap-3 pt-3 border-t border-line">
                          {[
                            { icon: Activity, label: "Live", href: `/organizer/events/${e.id}/live` },
                            { icon: Users, label: "Attendees", href: `/organizer/events/${e.id}/attendees` },
                            { icon: Tag, label: "Promos", href: `/organizer/events/${e.id}/promos` },
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
                    <tr className="border-b border-line text-[10.5px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3">Event</th>
                      <th className="text-left px-3 py-3">Date</th>
                      <th className="text-right px-3 py-3">Capacity</th>
                      <th className="text-right px-3 py-3">Revenue</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map(e => {
                      const s = STATUS[e.status] ?? STATUS.draft
                      return (
                        <tr key={e.id} className="hover:bg-paper-2 transition-colors">
                          <td className="px-5 py-4 max-w-[240px]">
                            <Link href={`/organizer/events/${e.id}`} className="block">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
                                <p className="text-[14px] font-semibold text-ink line-clamp-1 hover:text-navy transition-colors">{e.title}</p>
                              </div>
                              <p className="text-[12px] text-ink-3 pl-3.5">{e.venue}</p>
                            </Link>
                          </td>
                          <td className="px-3 py-4 text-[13px] text-ink-2 whitespace-nowrap">{e.startsAt.toLocaleDateString()}</td>
                          <td className="px-3 py-4 text-right min-w-[120px]">
                            <p className="text-[13px] font-medium text-ink tabular-nums">{e.sold}<span className="text-ink-3 font-normal"> / {e.capacity}</span></p>
                            <CapacityBar sold={e.sold} capacity={e.capacity} />
                          </td>
                          <td className="px-3 py-4 text-right text-[14px] font-bold text-ink tabular-nums whitespace-nowrap">
                            {formatCurrency(e.revenue, e.currency)}
                          </td>
                          <td className="px-3 py-4 text-right">
                            <div className="flex items-center gap-0.5 justify-end">
                              {[
                                { icon: Activity, title: "Live", href: `/organizer/events/${e.id}/live` },
                                { icon: Users, title: "Attendees", href: `/organizer/events/${e.id}/attendees` },
                                { icon: Tag, title: "Promos", href: `/organizer/events/${e.id}/promos` },
                                { icon: HelpCircle, title: "Questions", href: `/organizer/events/${e.id}/questions` },
                                { icon: Mail, title: "Email", href: `/organizer/events/${e.id}/email` },
                              ].map(({ icon: Icon, title, href }) => (
                                <Link key={title} href={href} title={title}
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
              <div className="space-y-2.5 text-[12.5px] pb-5 border-b border-line mb-4">
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
                    <span className="text-ink-2">In progress ({pendingCount})</span>
                    <span className="font-semibold text-amber-700 tabular-nums">{formatCurrency(pendingPayout, "USD")}</span>
                  </div>
                )}
              </div>
              <Link href="/payouts/request"
                className="block w-full rounded-xl bg-ink text-center py-2.5 text-[13px] font-semibold text-white hover:bg-ink/85 transition-colors">
                {availableBalance > 0 ? `Request ${formatCurrency(availableBalance, "USD")}` : "Request payout"}
              </Link>
            </div>

            {/* AI insight */}
            {insightEvent && (
              <AiInsightCard
                eventTitle={insightEvent.title}
                sold={insightEvent.sold}
                capacity={insightEvent.capacity}
                daysRemaining={Math.max(0, Math.ceil((new Date(insightEvent.startsAt).getTime() - Date.now()) / 86400000))}
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
              <h2 className="text-[15px] font-semibold text-ink">Sales by event</h2>
              <Link href="/organizer/orders" className="text-[11.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                All orders <ArrowUpRight size={11} />
              </Link>
            </div>
            {SALES_TOP.length === 0 ? (
              <EmptyState icon={DollarSign} title="No sales yet" body="Revenue by event will appear here." variant="inline" />
            ) : (
              <div className="space-y-4">
                {SALES_TOP.map(e => (
                  <div key={e.id}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <Link href={`/organizer/events/${e.id}`} className="text-[13px] font-medium text-ink hover:text-navy transition-colors truncate max-w-[180px]">
                        {e.title}
                      </Link>
                      <span className="text-[13px] font-bold text-ink tabular-nums ml-2 shrink-0">{formatCurrency(e.revenue, e.currency)}</span>
                    </div>
                    <div className="h-1.5 bg-paper-3 rounded-full overflow-hidden">
                      <div className="h-full bg-ink rounded-full" style={{ width: `${Math.round((e.revenue / maxRevenue) * 100)}%` }} />
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
                {recentOrdersRaw.map((o, i) => (
                  <li key={i} className="px-5 py-3.5 flex items-center gap-3">
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${o.status === "paid" || o.status === "completed" ? "bg-emerald-500" : "bg-rose-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink truncate">{o.guestName || o.guestEmail || "Guest"}</p>
                      <p className="text-[11.5px] text-ink-3">{o.createdAt ? timeAgo(new Date(o.createdAt)) : "—"} · {o.paymentMethod?.toUpperCase() ?? "—"}</p>
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
              <p className="text-[16px] font-bold tracking-tight text-white">Open scanner</p>
              <p className="text-[12.5px] text-white/70 mt-1 leading-relaxed">
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
              <p className="text-[12.5px] text-ink-2 mt-0.5 leading-snug">{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
