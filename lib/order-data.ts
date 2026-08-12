import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders, orderItems, events, merchItems, ticketTiers, vendorListings, vendors } from "@/db/schema"
import type { OrderRecord } from "@/lib/cart-context"

/**
 * Fetch a finalized order from the database and return it in the
 * `OrderRecord` shape that the client pages expect.
 *
 * For orders that aren't yet finalized ("pending") we still return a
 * minimal record so pages can show the correct UI instead of
 * "Order not found".
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
        totalAmount: orders.totalAmount,
        metadata: orders.metadata,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) return null

    // Map DB status to the client-side union.
    const clientStatus = order.status === "paid" ? "paid" as const
      : order.status === "pending" ? "pending" as const
      : order.status === "expired" ? "expired" as const
      : "refunded" as const

    // Fetch event details
    const [event] = await db
      .select({
        title: events.title,
        slug: events.slug,
        startsAt: events.startsAt,
        venue: events.venue,
        city: events.city,
        endsAt: events.endsAt,
      })
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
        itemTotal: orderItems.total,
        merchName: merchItems.name,
        merchDescription: merchItems.description,
        merchSizes: merchItems.sizes,
        vendorPackageName: vendorListings.packageName,
        vendorCategory: vendors.category,
        vendorBusinessName: vendors.businessName,
      })
    .from(orderItems)
    .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
    .leftJoin(merchItems, eq(merchItems.id, orderItems.merchItemId))
    .leftJoin(vendorListings, eq(vendorListings.id, orderItems.merchItemId))
    .leftJoin(vendors, eq(vendors.id, vendorListings.vendorId))
      .where(eq(orderItems.orderId, orderId))

    const cartLines: OrderRecord["items"] = []
    const totalsByCurrency: Record<string, number> = {}
    const currency = order.currency ?? "USD"
    const metadata = order.metadata as { merchSelections?: { itemId: string; size: string | null }[] } | null
    const merchSizes = new Map((metadata?.merchSelections ?? []).map((selection) => [selection.itemId, selection.size]))

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
          eventStartsAt: event?.startsAt?.toISOString(),
          eventEndsAt: event?.endsAt?.toISOString(),
          eventVenue: [event?.venue, event?.city].filter(Boolean).join(", ") || undefined,
        })
      }
      if (item.type === "merch" && item.merchItemId) {
        cartLines.push({
          kind: "merch",
          key: `merch:${item.merchItemId}:${merchSizes.get(item.merchItemId) ?? ""}`,
          eventSlug,
          eventTitle,
          price,
          currency,
          qty,
          itemId: item.merchItemId,
          name: item.merchName ?? "Merchandise",
          size: merchSizes.get(item.merchItemId) ?? undefined,
          eventStartsAt: event?.startsAt?.toISOString(),
          eventVenue: [event?.venue, event?.city].filter(Boolean).join(", ") || undefined,
        })
      }
      if (item.type === "vendor_addon" && item.merchItemId) {
        cartLines.push({
          kind: "vendor_addon",
          key: `vendor_addon:${item.merchItemId}`,
          eventSlug,
          eventTitle,
          price,
          currency,
          qty,
          listingId: item.merchItemId,
          vendorName: item.vendorBusinessName ?? "Vendor",
          packageName: item.vendorPackageName ?? "Add-on",
          category: item.vendorCategory ?? "other",
          eventStartsAt: event?.startsAt?.toISOString(),
          eventVenue: [event?.venue, event?.city].filter(Boolean).join(", ") || undefined,
        })
      }

      totalsByCurrency[currency] = Number(order.totalAmount ?? 0)
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
