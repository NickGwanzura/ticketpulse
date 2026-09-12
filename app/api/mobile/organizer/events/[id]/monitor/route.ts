import { NextResponse } from "next/server"
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { events, orders, ticketScanLogs, ticketTiers, tickets } from "@/db/schema"
import { authenticateOrganizer, organizerEventScope, privateHeaders } from "@/lib/mobile-organizer"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const auth = await authenticateOrganizer(request)
  if (!auth.ok) return NextResponse.json(auth, { status: auth.status, headers: privateHeaders })
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ ok: false, error: "Invalid event ID" }, { status: 400, headers: privateHeaders })
  }

  const [event] = await db.select({
    id: events.id, title: events.title, status: events.status, startsAt: events.startsAt,
    endsAt: events.endsAt, venue: events.venue, city: events.city,
  }).from(events).where(and(eq(events.id, id), organizerEventScope(auth.userId, auth.role))).limit(1)
  if (!event) return NextResponse.json({ ok: false, error: "Event not found or access unavailable" }, { status: 404, headers: privateHeaders })

  const [capacity, sold, checkedIn, paymentRows, scanRows, recentScans] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${ticketTiers.totalQuantity}), 0)` }).from(ticketTiers).where(eq(ticketTiers.eventId, id)),
    db.select({ total: sql<number>`count(*)::int` }).from(tickets).where(and(eq(tickets.eventId, id), eq(tickets.isStaffTicket, false), sql`${tickets.status} in ('sold', 'used')`)),
    db.select({ total: sql<number>`count(*)::int` }).from(tickets).where(and(eq(tickets.eventId, id), isNotNull(tickets.scannedAt))),
    db.select({ status: orders.status, count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.eventId, id)).groupBy(orders.status),
    db.select({ outcome: ticketScanLogs.outcome, count: sql<number>`count(*)::int` }).from(ticketScanLogs).where(eq(ticketScanLogs.eventId, id)).groupBy(ticketScanLogs.outcome),
    db.select({ outcome: ticketScanLogs.outcome, reason: ticketScanLogs.reason, source: ticketScanLogs.source, createdAt: ticketScanLogs.createdAt })
      .from(ticketScanLogs).where(eq(ticketScanLogs.eventId, id)).orderBy(desc(ticketScanLogs.createdAt)).limit(20),
  ])

  const totalCapacity = Number(capacity[0]?.total ?? 0)
  const totalSold = Number(sold[0]?.total ?? 0)
  const totalCheckedIn = Number(checkedIn[0]?.total ?? 0)
  const orderSummary = Object.fromEntries(paymentRows.map(row => [row.status ?? "unknown", Number(row.count)]))
  const scanSummary = Object.fromEntries(scanRows.map(row => [row.outcome, Number(row.count)]))
  const remaining = Math.max(totalCapacity - totalSold, 0)
  const alerts: string[] = []
  if (event.endsAt && event.endsAt <= new Date()) alerts.push("Event has finished; gate scanning is closed.")
  if (totalCapacity > 0 && remaining <= Math.ceil(totalCapacity * 0.1) && remaining > 0) alerts.push(`${remaining} ticket${remaining === 1 ? "" : "s"} remaining.`)
  if ((orderSummary.awaiting_verification ?? 0) > 0) alerts.push(`${orderSummary.awaiting_verification} payment${orderSummary.awaiting_verification === 1 ? "" : "s"} awaiting verification.`)
  const expiredOrders = orderSummary.expired ?? 0
  const cancelledOrders = orderSummary.cancelled ?? 0
  if (expiredOrders + cancelledOrders > 0) alerts.push(`${expiredOrders + cancelledOrders} expired or cancelled order${expiredOrders + cancelledOrders === 1 ? "" : "s"}.`)

  return NextResponse.json({ ok: true,
    event: { ...event, startsAt: event.startsAt?.toISOString() ?? null, endsAt: event.endsAt?.toISOString() ?? null,
      totalCapacity, totalSold, checkedIn: totalCheckedIn,
      isFinished: event.endsAt != null && event.endsAt <= new Date(),
      canScan: (event.status === "published" || event.status === "sold_out") && (event.endsAt == null || event.endsAt > new Date()),
    },
    orderSummary, scanSummary, expiredOrders, cancelledOrders, alerts,
    recentScans: recentScans.map(row => ({ ...row, createdAt: row.createdAt?.toISOString() ?? null })),
  }, { headers: privateHeaders })
}
