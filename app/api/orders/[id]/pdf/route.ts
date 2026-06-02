import { NextResponse } from "next/server"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { orders, events, tickets, ticketTiers } from "@/db/schema"
import { generateTicketPdfBuffer } from "@/lib/pdf/generate"
import { generateTicketQrImageDataUrl } from "@/lib/tickets"
import { formatDateShort } from "@/lib/utils"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params

  // Load order with event
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const [event] = await db
    .select({ title: events.title, startsAt: events.startsAt, venue: events.venue })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)

  // Load tickets for this order
  const orderTickets = await db
    .select({
      id: tickets.id,
      qrCode: tickets.qrCode,
      tierId: tickets.tierId,
    })
    .from(tickets)
    .where(and(eq(tickets.orderId, orderId), notInArray(tickets.status, ["cancelled", "refunded"])))

  if (orderTickets.length === 0) {
    return NextResponse.json({ error: "No tickets found for this order" }, { status: 404 })
  }

  // Load tier names
  const tierIds = [...new Set(orderTickets.map((t) => t.tierId).filter(Boolean))]
  const tierRows =
    tierIds.length > 0
      ? await db
          .select({ id: ticketTiers.id, name: ticketTiers.name })
          .from(ticketTiers)
          .where(inArray(ticketTiers.id, tierIds))
      : []

  const tierNameMap = new Map(tierRows.map((t) => [t.id, t.name]))

  // Build ticket page data
  try {
    const ticketPages = await Promise.all(orderTickets.map(async (t, idx) => ({
      eventTitle: event?.title ?? "Your Ticket",
      tierName: tierNameMap.get(t.tierId) ?? "General Admission",
      buyerName: order.guestName ?? "Valued Guest",
      orderId,
      ticketId: t.id,
      qrCodeDataUrl: await generateTicketQrImageDataUrl(t.qrCode, t.id, orderId),
      humanCode: `${orderId.slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`,
      venue: event?.venue,
      eventDate: event?.startsAt ? formatDateShort(event.startsAt) : null,
    })))

    const pdfBuffer = await generateTicketPdfBuffer(ticketPages)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tickets-${orderId.slice(0, 8)}.pdf"`,
      },
    })
  } catch (err) {
    console.error("PDF generation failed:", err)
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    )
  }
}
