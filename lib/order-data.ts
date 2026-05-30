import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders, orderItems, events, ticketTiers } from "@/db/schema"
import type { OrderRecord } from "@/lib/cart-context"

/**
 * Fetch a finalized order from the database and return it in the
 * `OrderRecord` shape that the client pages expect.
 *
 * For orders that aren't yet finalized ("pending", "awaiting_verification")
 * we still return a minimal record so pages can show the correct UI
 * instead of "Order not found".
 */
export async function getOrderFromDb(orderId: string): Promise<OrderRecord | null> {
  try {
    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
        createdAt: orders.createdAt,
        guestEmail: orders.guestEmail,
        guestName: orders.guestName,
        guestPhone: orders.guestPhone,
        paymentMethod: orders.paymentMethod,
        currency: orders.currency,
        eventId: orders.eventId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) return null

    // Map DB status to the client-side union.
    const clientStatus = order.status === "paid" ? "paid" as const
      : order.status === "awaiting_verification" || order.status === "pending" ? "pending" as const
      : "refunded" as const

    // Fetch event details
    const [event] = await db
      .select({ title: events.title, slug: events.slug })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1)

    const eventTitle = event?.title ?? "Event"
    const eventSlug = event?.slug ?? ""

    // Fetch order items with ticket tier names
    const dbItems = await db
      .select({
        type: orderItems.type,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        tierId: orderItems.tierId,
        tierName: ticketTiers.name,
        merchItemId: orderItems.merchItemId,
        transportBookingId: orderItems.transportBookingId,
      })
      .from(orderItems)
      .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
      .where(eq(orderItems.orderId, orderId))

    const cartLines: OrderRecord["items"] = []
    const totalsByCurrency: Record<string, number> = {}
    const currency = order.currency ?? "USD"

    for (const item of dbItems) {
      const price = Number(item.unitPrice)
      const qty = item.quantity

      if (item.type === "ticket") {
        cartLines.push({
          kind: "ticket",
          key: item.tierId ?? `ticket-${cartLines.length}`,
          eventSlug,
          eventTitle,
          price,
          currency,
          qty,
          tierId: item.tierId ?? "",
          tierName: item.tierName ?? "Ticket",
          emoji: "",
        })
      }
      // Merch, shuttle, and vendor addon items aren't currently reconstructed
      // from the DB since we don't store all the display fields on order_items.
      // They could be expanded in the future by joining to the relevant tables.
      // For now, ticket items are the primary concern.

      totalsByCurrency[currency] = (totalsByCurrency[currency] ?? 0) + price * qty
    }

    return {
      id: order.id,
      createdAt: order.createdAt?.toISOString() ?? new Date().toISOString(),
      status: clientStatus,
      items: cartLines,
      totalsByCurrency,
      contact: {
        name: order.guestName ?? "",
        email: order.guestEmail ?? "",
        phone: order.guestPhone ?? "",
      },
      payment: { method: order.paymentMethod ?? "unknown" },
    }
  } catch (err) {
    console.error("[order-data] getOrderFromDb failed", {
      orderId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return null
  }
}
