import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { eq, count, gte, lt, desc, and, sql } from "drizzle-orm"
import {
  Calendar, Ticket, ArrowUpRight, QrCode,
  MapPin, Clock, ShoppingBag,
} from "lucide-react"

import { db } from "@/db"
import { orders, tickets, events } from "@/db/schema"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role === "admin")     redirect("/admin")
  if (session.user.role === "organizer") redirect("/organizer")
  if (session.user.role === "vendor")    redirect("/vendors/dashboard")

  const userId = session.user.id
  const attendeeName = session.user.name ?? "there"
  const firstName = attendeeName.split(" ")[0]
  const now = new Date()

  // Upcoming + past events the attendee has tickets for
  const [upcomingResult, pastResult, totalTicketsResult, recentOrders, upcomingEvents] = await Promise.all([
    db.select({ count: count(sql`DISTINCT ${events.id}`) })
      .from(tickets).innerJoin(events, eq(events.id, tickets.eventId))
      .where(and(eq(tickets.userId, userId), gte(events.startsAt, now))),

    db.select({ count: count(sql`DISTINCT ${events.id}`) })
      .from(tickets).innerJoin(events, eq(events.id, tickets.eventId))
      .where(and(eq(tickets.userId, userId), lt(events.startsAt, now))),

    db.select({ count: count() }).from(tickets).where(eq(tickets.userId, userId)),

    db.select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
      eventTitle: events.title,
    }).from(orders).leftJoin(events, eq(events.id, orders.eventId))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt)).limit(5),

    db.select({
      eventTitle: events.title,
      eventSlug: events.slug,
      eventVenue: events.venue,
      eventCity: events.city,
      eventStartsAt: events.startsAt,
      orderId: orders.id,
    }).from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .innerJoin(events, eq(events.id, tickets.eventId))
      .where(and(eq(tickets.userId, userId), gte(events.startsAt, now), eq(orders.status, "paid")))
      .orderBy(events.startsAt).limit(3),
  ])

  const upcomingCount = upcomingResult[0]?.count ?? 0
  const pastCount = pastResult[0]?.count ?? 0
  const totalTickets = totalTicketsResult[0]?.count ?? 0

  const formatEventDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })

  const daysUntil = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86400000)

  // Deduplicate upcoming events by eventSlug
  const seen = new Set<string>()
  const uniqueUpcoming = upcomingEvents.filter(e => {
    if (seen.has(e.eventSlug)) return false
    seen.add(e.eventSlug)
    return true
  })

  const hasActivity = totalTickets > 0 || recentOrders.length > 0

  return (
    <div className="tp-fade-up">
      {/* Header */}
      <div className="border-b border-line bg-paper">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-1">My account</p>
          <h1 className="text-[26px] md:text-[32px] font-bold tracking-tight text-ink leading-none">
            Hi, {firstName}
          </h1>
          {session.user.email && (
            <p className="text-[13px] text-ink-3 mt-1.5">{session.user.email}</p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-8">

        {/* Upcoming events — most important for an attendee */}
        {uniqueUpcoming.length > 0 && (
          <section className="tp-fade-up-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold text-ink">Coming up</h2>
              <Link href="/orders" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                All orders <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="space-y-3">
              {uniqueUpcoming.map((e, i) => {
                const days = daysUntil(e.eventStartsAt)
                return (
                  <Link key={i} href={`/orders/${e.orderId}`}
                    className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 hover:bg-paper-2 transition-colors">
                    <div className="shrink-0 w-12 h-12 rounded-xl border border-line bg-paper-2 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-bold tracking-widest text-ink-3 uppercase leading-none">
                        {e.eventStartsAt.toLocaleDateString("en-GB", { month: "short" })}
                      </span>
                      <span className="text-[20px] font-bold tracking-tight text-ink leading-none mt-0.5">
                        {e.eventStartsAt.getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-semibold text-ink truncate">{e.eventTitle}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {e.eventVenue && (
                          <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                            <MapPin size={11} /> {e.eventVenue}{e.eventCity ? `, ${e.eventCity}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {days <= 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2.5 py-1 text-[11px] font-bold">
                          <Clock size={11} /> Today
                        </span>
                      ) : days <= 7 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-[11px] font-semibold">
                          {days}d away
                        </span>
                      ) : (
                        <span className="text-[12px] text-ink-3">{days}d</span>
                      )}
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-navy font-semibold">
                        <QrCode size={11} /> View ticket
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 border border-line rounded-2xl bg-paper overflow-hidden divide-x divide-line tp-fade-up-1">
          {[
            { label: "Upcoming", value: upcomingCount.toString(), icon: Calendar },
            { label: "Past events", value: pastCount.toString(), icon: Ticket },
            { label: "Total tickets", value: totalTickets.toString(), icon: QrCode },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="px-4 py-4 text-center">
              <Icon size={14} className="text-ink-3 mx-auto mb-2" />
              <p className="text-[22px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
              <p className="text-[11px] text-ink-3 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        {hasActivity ? (
          <section className="tp-fade-up-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold text-ink">Recent orders</h2>
              <Link href="/orders" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                All <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="rounded-2xl border border-line bg-paper overflow-hidden">
              {recentOrders.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-ink-3">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {recentOrders.map(order => (
                    <Link key={order.id} href={`/orders/${order.id}`}
                      className="flex items-center px-5 py-4 gap-4 hover:bg-paper-2 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-ink truncate">{order.eventTitle ?? "Order"}</p>
                        <p className="text-[12px] text-ink-3 mt-0.5">
                          {order.createdAt?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}
                          <span className={order.status === "paid" ? "text-emerald-700 font-medium" : "text-amber-600"}>
                            {order.status === "paid" ? "Paid" : order.status}
                          </span>
                        </p>
                      </div>
                      <span className="text-[14px] font-bold text-ink tabular-nums">
                        {order.currency} {order.totalAmount}
                      </span>
                      <ArrowUpRight size={14} className="text-ink-3 shrink-0" />
                    </Link>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : (
          <section className="tp-fade-up-2">
            <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-10 text-center">
              <ShoppingBag size={24} className="text-ink-3 mx-auto mb-3" />
              <p className="text-[15px] font-semibold text-ink">No tickets yet</p>
              <p className="text-[13px] text-ink-2 mt-1 mb-5">Find an event and get your first ticket.</p>
              <Link href="/events"
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-ink/85 transition-colors">
                <Calendar size={14} /> Browse events
              </Link>
            </div>
          </section>
        )}

        {/* Quick actions */}
        <div className="grid sm:grid-cols-3 gap-3 tp-fade-up-3">
          {[
            { title: "Browse events", body: "Find concerts, marathons, and more.", href: "/events", icon: Calendar },
            { title: "My orders", body: "View all tickets and receipts.", href: "/orders", icon: Ticket },
            { title: "Account settings", body: "Update your name, email, and password.", href: "/settings", icon: QrCode },
          ].map(({ title, body, href, icon: Icon }) => (
            <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 hover:bg-paper-2 transition-colors">
              <Icon size={14} className="text-ink-3 mb-3" />
              <p className="text-[14px] font-semibold text-ink">{title}</p>
              <p className="text-[12.5px] text-ink-2 mt-0.5">{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
