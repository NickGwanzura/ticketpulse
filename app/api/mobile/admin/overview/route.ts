import { NextResponse } from "next/server"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, payouts, users } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"

export async function GET(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return NextResponse.json(identity, { status: identity.status, headers: privateHeaders })
  if (identity.role !== "admin") return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403, headers: privateHeaders })
  const [eventCounts, orderStats, payoutRows, organizerRows] = await Promise.all([
    db.select({ status: events.status, count: sql<number>`count(*)::int` }).from(events).groupBy(events.status),
    db.select({ status: orders.status, count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${orders.totalAmount}), 0)` }).from(orders).groupBy(orders.status),
    db.select({ id: payouts.id, amount: payouts.amount, currency: payouts.currency, status: payouts.status, method: payouts.method, createdAt: payouts.createdAt, organizerName: users.name, organizerEmail: users.email, eventTitle: events.title }).from(payouts).leftJoin(users, eq(users.id, payouts.userId)).leftJoin(events, eq(events.id, payouts.eventId)).where(sql`${payouts.status} IN ('pending', 'approved', 'processing')`).orderBy(desc(payouts.createdAt)).limit(50),
    db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt }).from(users).where(and(eq(users.role, "organizer"), isNull(users.approvedAt))).orderBy(desc(users.createdAt)).limit(50),
  ])
  return NextResponse.json({ ok: true,
    eventSummary: Object.fromEntries(eventCounts.map(row => [row.status ?? "unknown", Number(row.count)])),
    orderSummary: Object.fromEntries(orderStats.map(row => [row.status ?? "unknown", { count: Number(row.count), total: Number(row.total) }])),
    pendingPayouts: payoutRows.map(row => ({ ...row, amount: Number(row.amount), currency: row.currency ?? "USD" })),
    pendingOrganizers: organizerRows,
  }, { headers: privateHeaders })
}
