import { NextResponse } from "next/server"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { orders, events, tickets, ticketTiers } from "@/db/schema"
import { generateTicketQrImageDataUrl } from "@/lib/tickets"
import { formatDate } from "@/lib/utils"
import { authorizeOrderAccess, orderAccessCredsFrom } from "@/lib/order-access"
import { log } from "@/lib/logger"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params

  // This PDF embeds every ticket's QR image, so it needs proof of ownership.
  const access = await authorizeOrderAccess(orderId, orderAccessCredsFrom(request))
  if (!access.ok) {
    log.warn("order pdf — unauthorised read", { orderId, reason: access.reason })
    return NextResponse.json(
      { error: access.reason === "not_found" ? "Order not found" : "Not authorised to download this ticket" },
      { status: access.reason === "not_found" ? 404 : 403 },
    )
  }

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
      eventDate: event?.startsAt ? formatDate(event.startsAt, { timeZone: "Africa/Harare" }) : null,
    })))

    const { generateTicketPdfBuffer } = await import("@/lib/pdf/generate")
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
