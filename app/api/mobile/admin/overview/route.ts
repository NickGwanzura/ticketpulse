import { NextResponse } from "next/server"
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, payouts, users } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"

export async function GET(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return NextResponse.json(identity, { status: identity.status, headers: privateHeaders })
  if (identity.role !== "admin") return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403, headers: privateHeaders })
  const params = new URL(request.url).searchParams
  const recentLimit = Math.min(Math.max(Number.parseInt(params.get("recentLimit") ?? "25", 10) || 25, 1), 50)
  const recentOffset = Math.max(Number.parseInt(params.get("recentOffset") ?? "0", 10) || 0, 0)
  const [eventCounts, liveEvents, orderStats, paidValues, payoutRows, organizerRows, recentOrders] = await Promise.all([
    db.select({ status: events.status, count: sql<number>`count(*)::int` }).from(events).groupBy(events.status),
    db.select({ count: sql<number>`count(*)::int` }).from(events).where(and(
      inArray(events.status, ["published", "sold_out"]),
      or(isNull(events.endsAt), gt(events.endsAt, new Date())),
    )),
    db.select({ status: orders.status, count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orders.totalAmount}), 0)` }).from(orders).groupBy(orders.status),
    db.select({ currency: orders.currency, total: sql<string>`coalesce(sum(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(inArray(orders.status, ["paid", "completed"]))
      .groupBy(orders.currency),
    db.select({ id: payouts.id, amount: payouts.amount, currency: payouts.currency, status: payouts.status, method: payouts.method, createdAt: payouts.createdAt, organizerName: users.name, organizerEmail: users.email, eventTitle: events.title }).from(payouts).leftJoin(users, eq(users.id, payouts.userId)).leftJoin(events, eq(events.id, payouts.eventId)).where(sql`${payouts.status} IN ('pending', 'approved', 'processing')`).orderBy(desc(payouts.createdAt)).limit(50),
    db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt }).from(users).where(and(eq(users.role, "organizer"), isNull(users.approvedAt))).orderBy(desc(users.createdAt)).limit(50),
    db.select({ id: orders.id, status: orders.status, totalAmount: orders.totalAmount, currency: orders.currency, createdAt: orders.createdAt, guestName: orders.guestName, guestEmail: orders.guestEmail, eventTitle: events.title, buyerName: users.name, buyerEmail: users.email }).from(orders).leftJoin(events, eq(events.id, orders.eventId)).leftJoin(users, eq(users.id, orders.userId)).orderBy(desc(orders.createdAt)).limit(recentLimit + 1).offset(recentOffset),
  ])
  const recentHasMore = recentOrders.length > recentLimit
  return NextResponse.json({ ok: true,
    eventSummary: Object.fromEntries(eventCounts.map(row => [row.status ?? "unknown", Number(row.count)])),
    liveEventCount: Number(liveEvents[0]?.count ?? 0),
    orderSummary: Object.fromEntries(orderStats.map(row => [row.status ?? "unknown", { count: Number(row.count), total: Number(row.total) }])),
    paidOrderValueByCurrency: paidValues.map(row => ({ currency: row.currency ?? "USD", total: Number(row.total) })),
    pendingPayouts: payoutRows.map(row => ({ ...row, amount: Number(row.amount), currency: row.currency ?? "USD" })),
    pendingOrganizers: organizerRows,
    recentOrders: recentOrders.slice(0, recentLimit).map(row => ({ ...row, totalAmount: Number(row.totalAmount), currency: row.currency ?? "USD", buyerName: row.buyerName ?? row.guestName, buyerEmail: row.buyerEmail ?? row.guestEmail })),
    recentOrdersHasMore: recentHasMore,
  }, { headers: privateHeaders })
}
