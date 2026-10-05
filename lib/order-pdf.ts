import "server-only"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, tickets, ticketTiers } from "@/db/schema"
import { generateTicketQrImageDataUrl } from "@/lib/tickets"
import { formatDate } from "@/lib/utils"

export type OrderPdfResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; status: number; error: string }

/**
 * Builds the combined ticket PDF for an order's live tickets. Callers must have
 * already authorised access to the order (buyer credentials or an admin).
 */
export async function buildOrderTicketsPdf(orderId: string): Promise<OrderPdfResult> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return { ok: false, status: 404, error: "Order not found" }

  const [event] = await db
    .select({ title: events.title, startsAt: events.startsAt, venue: events.venue })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)

  const orderTickets = await db
    .select({ id: tickets.id, qrCode: tickets.qrCode, tierId: tickets.tierId })
    .from(tickets)
    .where(and(eq(tickets.orderId, orderId), notInArray(tickets.status, ["cancelled", "refunded"])))
  if (orderTickets.length === 0) return { ok: false, status: 404, error: "No tickets found for this order" }

  const tierIds = [...new Set(orderTickets.map((t) => t.tierId).filter((id): id is string => Boolean(id)))]
  const tierRows = tierIds.length > 0
    ? await db.select({ id: ticketTiers.id, name: ticketTiers.name }).from(ticketTiers).where(inArray(ticketTiers.id, tierIds))
    : []
  const tierNameMap = new Map(tierRows.map((t) => [t.id, t.name]))

  try {
    const pages = await Promise.all(orderTickets.map(async (t, idx) => ({
      eventTitle: event?.title ?? "Your Ticket",
      tierName: (t.tierId ? tierNameMap.get(t.tierId) : null) ?? "General Admission",
      buyerName: order.guestName ?? "Valued Guest",
      orderId,
      ticketId: t.id,
      qrCodeDataUrl: await generateTicketQrImageDataUrl(t.qrCode, t.id, orderId),
      humanCode: `${orderId.slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`,
      venue: event?.venue,
      eventDate: event?.startsAt ? formatDate(event.startsAt, { timeZone: "Africa/Harare" }) : null,
    })))
    const { generateTicketPdfBuffer } = await import("@/lib/pdf/generate")
    const buffer = await generateTicketPdfBuffer(pages)
    return { ok: true, buffer, filename: `tickets-${orderId.slice(0, 8)}.pdf` }
  } catch (error) {
    console.error("PDF generation failed:", error)
    return { ok: false, status: 500, error: "Failed to generate PDF" }
  }
}
