import { NextResponse } from "next/server"
import { db } from "@/db"
import { orders, events, tickets, ticketTiers } from "@/db/schema"
import { eq } from "drizzle-orm"
import { authenticateRequest } from "@/lib/mobile-auth"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: RouteParams) {
  const auth = await authenticateRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await ctx.params

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      createdAt: orders.createdAt,
      eventId: orders.eventId,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStartsAt: events.startsAt,
      eventVenue: events.venue,
      eventCity: events.city,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.id, id))
    .limit(1)

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
  }

  // Only the order owner or an admin can view order details
  if (order.guestEmail !== auth.email && auth.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 })
  }

  const ticketRows = await db
    .select({
      id: tickets.id,
      qrCode: tickets.qrCode,
      tierId: tickets.tierId,
      tierName: ticketTiers.name,
      scannedAt: tickets.scannedAt,
      status: tickets.status,
      isStaffTicket: tickets.isStaffTicket,
      staffName: tickets.staffName,
      staffRole: tickets.staffRole,
    })
    .from(tickets)
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(eq(tickets.orderId, id))

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      currency: order.currency ?? "USD",
      guestName: order.guestName,
      guestEmail: order.guestEmail,
      guestPhone: order.guestPhone,
      createdAt: order.createdAt?.toISOString() ?? null,
      event: {
        id: order.eventId,
        title: order.eventTitle,
        slug: order.eventSlug,
        startsAt: order.eventStartsAt?.toISOString() ?? null,
        venue: order.eventVenue,
        city: order.eventCity,
      },
    },
    tickets: ticketRows.map((t) => ({
      id: t.id,
      qrCode: t.qrCode,
      tierName: t.tierName ?? "Ticket",
      scannedAt: t.scannedAt?.toISOString() ?? null,
      status: t.status,
      isStaffTicket: t.isStaffTicket ?? false,
      staffName: t.staffName ?? null,
      staffRole: t.staffRole ?? null,
    })),
  })
}
