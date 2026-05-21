import { NextResponse } from "next/server"
import { eq, and, isNotNull, sql, desc } from "drizzle-orm"
import { db } from "@/db"
import { events, ticketTiers, tickets, orders } from "@/db/schema"
import { auth } from "@/auth"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: RouteParams) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify ownership
  const [event] = await db
    .select({ organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }
  if (event.organizerId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [tierAgg] = await db
    .select({
      totalSold: sql<number>`COALESCE(SUM(${ticketTiers.soldQuantity}), 0)`,
      totalCapacity: sql<number>`COALESCE(SUM(${ticketTiers.totalQuantity}), 0)`,
    })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, id))

  const [checkinAgg] = await db
    .select({
      checkedIn: sql<number>`COUNT(*)::int`,
    })
    .from(tickets)
    .where(and(eq(tickets.eventId, id), isNotNull(tickets.scannedAt)))

  const totalSold = Number(tierAgg?.totalSold ?? 0)
  const totalCapacity = Number(tierAgg?.totalCapacity ?? 0)
  const checkedIn = Number(checkinAgg?.checkedIn ?? 0)
  const capacityPct = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0
  const checkinPct = totalSold > 0 ? Math.round((checkedIn / totalSold) * 100) : 0

  // ── Recent check-ins (last 20) ─────────────────────────────────────────────
  const recentRows = await db
    .select({
      code: tickets.qrCode,
      tierName: ticketTiers.name,
      orderId: tickets.orderId,
      scannedAt: tickets.scannedAt,
    })
    .from(tickets)
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(and(eq(tickets.eventId, id), isNotNull(tickets.scannedAt)))
    .orderBy(desc(tickets.scannedAt))
    .limit(20)

  // Enrich with holder names from orders
  const orderIds = recentRows.map((r) => r.orderId).filter(Boolean) as string[]
  const orderMap = new Map<string, string | null>()
  if (orderIds.length > 0) {
    const orderRows = await db
      .select({ id: orders.id, guestName: orders.guestName, guestEmail: orders.guestEmail })
      .from(orders)
      .where(sql`${orders.id} IN (${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})`)
    for (const o of orderRows) {
      orderMap.set(o.id, o.guestName ?? o.guestEmail ?? null)
    }
  }

  const recent = recentRows.map((r) => ({
    code: r.code ?? "unknown",
    tierName: r.tierName ?? "Ticket",
    holder: r.orderId ? (orderMap.get(r.orderId) ?? null) : null,
    scannedAt: r.scannedAt?.toISOString() ?? new Date().toISOString(),
  }))

  return NextResponse.json({
    stats: { totalSold, totalCapacity, checkedIn, capacityPct, checkinPct },
    recent,
  })
}
