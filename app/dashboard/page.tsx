import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Calendar, Ticket, ArrowUpRight,
  CheckCircle2, ClipboardList,
  HelpCircle, Activity,
} from "lucide-react"
import { eq, count, gte, lt, desc, and, sql } from "drizzle-orm"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { db } from "@/db"
import { orders, tickets, events } from "@/db/schema"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")
  if (session.user.role === "admin")     redirect("/admin")
  if (session.user.role === "organizer") redirect("/organizer")
  if (session.user.role === "vendor")    redirect("/vendors")

  const userId = session.user.id
  const attendeeName = session.user.name ?? "Attendee"
  const now = new Date()

  // Fetch real stats for the attendee
  const upcomingEventsResult = await db
    .select({ count: count(sql`DISTINCT ${events.id}`) })
    .from(tickets)
    .innerJoin(events, eq(events.id, tickets.eventId))
    .where(and(eq(tickets.userId, userId), gte(events.startsAt, now)))

  const pastEventsResult = await db
    .select({ count: count(sql`DISTINCT ${events.id}`) })
    .from(tickets)
    .innerJoin(events, eq(events.id, tickets.eventId))
    .where(and(eq(tickets.userId, userId), lt(events.startsAt, now)))

  const totalTicketsResult = await db
    .select({ count: count() })
    .from(tickets)
    .where(eq(tickets.userId, userId))

  const upcomingEventsCount = upcomingEventsResult[0]?.count ?? 0
  const pastEventsCount = pastEventsResult[0]?.count ?? 0
  const totalTicketsCount = totalTicketsResult[0]?.count ?? 0

  // Fetch recent orders
  const recentOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
      eventTitle: events.title,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(5)

  const hasActivity = upcomingEventsCount > 0 || totalTicketsCount > 0 || recentOrders.length > 0

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${attendeeName.split(" ")[0]}`}
        subtitle={session.user.email ?? undefined}
        width="xl"
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-12 space-y-8">

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {[
            { l: "Upcoming events", v: String(upcomingEventsCount), i: Calendar, trend: "" },
            { l: "Total tickets",   v: String(totalTicketsCount), i: Ticket, trend: "All time" },
            { l: "Past events",     v: String(pastEventsCount), i: CheckCircle2, trend: "Completed" },
            { l: "Orders placed",   v: String(recentOrders.length), i: ClipboardList, trend: "Recent" },
          ].map(({ l, v, i: Icon, trend }) => (
            <div key={l} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon size={15} className="text-ink-3" />
                <span className="text-[13px] text-ink-3">{l}</span>
              </div>
              <p className="text-[28px] md:text-[30px] font-bold tracking-tight text-ink leading-none tabular-nums">{v}</p>
              {trend && <p className="text-[13px] text-ink-3 mt-2">{trend}</p>}
            </div>
          ))}
        </div>

        {/* Recent orders + quick links */}
        <div className="grid grid-cols-12 gap-4 md:gap-6 tp-fade-up-2">
          {/* Recent orders */}
          <div className="col-span-12 md:col-span-8 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-[18px] font-semibold tracking-tight text-ink">Recent orders</h2>
              <Link href="/orders" className="text-[13px] font-medium text-navy hover:underline">View all</Link>
            </div>
            {recentOrders.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No orders yet"
                body="Your ticket purchases will appear here."
                ctaLabel="Browse events"
                ctaHref="/events"
              />
            ) : (
              <div className="divide-y divide-line">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between px-5 md:px-6 py-4 hover:bg-paper-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink truncate">{order.eventTitle ?? "Order"}</p>
                      <p className="text-[12px] text-ink-3 mt-0.5">
                        {order.status} · {order.createdAt?.toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-[14px] font-semibold text-ink tabular-nums shrink-0 ml-4">
                      {order.currency} {order.totalAmount}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
            {[
              {
                title: "Browse events",
                body: "Find marathons, concerts, and more across Zimbabwe.",
                href: "/events",
                icon: Calendar,
              },
              {
                title: "Order history",
                body: "View all past tickets, merch, shuttles, and photo packs.",
                href: "/orders",
                icon: ClipboardList,
              },
              {
                title: "Get help",
                body: "FAQs, refund policy, and live support.",
                href: "/help",
                icon: HelpCircle,
              },
            ].map(({ title, body, href, icon: Icon }) => (
              <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 tp-lift group">
                <div className="w-8 h-8 rounded-lg bg-paper-2 border border-line flex items-center justify-center mb-3">
                  <Icon size={15} className="text-ink-2" />
                </div>
                <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
                <p className="text-[13.5px] text-ink-2 mt-1">{body}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-navy group-hover:gap-1.5 transition-all">
                  Open <ArrowUpRight size={12} />
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        {hasActivity && (
          <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[18px] font-semibold tracking-tight text-ink">Activity</h2>
            </div>
            <div className="px-5 md:px-6 py-4 space-y-4">
              {recentOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-paper-2 border border-line flex items-center justify-center shrink-0">
                    <Activity size={14} className="text-ink-3" />
                  </div>
                  <div>
                    <p className="text-[14px] text-ink">
                      <span className="font-medium">Order placed</span> for {order.eventTitle ?? "an event"}
                    </p>
                    <p className="text-[12px] text-ink-3 mt-0.5">
                      {order.createdAt?.toLocaleDateString()} · {order.currency} {order.totalAmount}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
