import { NextResponse } from "next/server"
import { eq, and, inArray, desc, asc } from "drizzle-orm"

import { db } from "@/db"
import { events, orders, tickets, ticketTiers, users } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: RouteParams) {
  const { id } = await ctx.params

  const access = await requireEventAccess(id)
  if (!access.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [event] = await db
    .select({ title: events.title, venue: events.venue, startsAt: events.startsAt, organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  // Fetch one row per issued ticket
  const ticketRows = await db
    .select({
      orderId: orders.id,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      tierName: ticketTiers.name,
      scannedAt: tickets.scannedAt,
      holderName: tickets.holderName,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(
      and(
        eq(tickets.eventId, id),
        eq(tickets.isStaffTicket, false),
        inArray(tickets.status, ["sold", "used"]),
        inArray(orders.status, ["paid", "completed"]),
      ),
    )
    .orderBy(desc(orders.createdAt), asc(tickets.createdAt))

  const [organizer] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, event.organizerId))
    .limit(1)

  const { generateAttendeeListPdfBuffer } = await import("@/lib/pdf/attendee-list-document")
  const pdfBuffer = await generateAttendeeListPdfBuffer({
    eventTitle: event.title,
    organizerName: organizer?.name ?? "TicketPulse organiser",
    venue: event.venue,
    startsAt: event.startsAt,
    generatedAt: new Date(),
    attendees: ticketRows.map((r) => ({
      name: r.guestName ?? "Guest",
      email: r.guestEmail ?? "",
      phone: r.guestPhone ?? "",
      ticketType: r.tierName ?? "Ticket",
      checkedIn: Boolean(r.scannedAt),
      holderName: r.holderName ?? "",
    })),
  })

  const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}_attendees.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  })
}
