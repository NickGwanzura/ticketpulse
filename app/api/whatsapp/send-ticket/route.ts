import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders, events, orderItems, ticketTiers } from "@/db/schema"
import { sendText, formatChatId, isSessionReady } from "@/lib/whatsapp"
import { log } from "@/lib/logger"

/**
 * POST /api/whatsapp/send-ticket
 *
 * Sends a WhatsApp notification to the buyer with their ticket details
 * after a successful purchase. This can be called from:
 *   - The order finalize flow (after payment + verification)
 *   - The resend-tickets endpoint
 *   - Manually by an admin
 *
 * Body: { orderId: string }
 * Response: { ok: boolean, sentTo?: string, error?: string }
 */
export async function POST(req: Request) {
  try {
    const { orderId } = await req.json()
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }

    // ── Look up the order ─────────────────────────────────────────────────
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (!order.guestPhone) {
      return NextResponse.json(
        { error: "Order has no guest phone number" },
        { status: 400 },
      )
    }

    // ── Check WhatsApp session is ready ────────────────────────────────────
    const ready = await isSessionReady()
    if (!ready) {
      log.warn("send-ticket — WhatsApp session not ready", { orderId })
      return NextResponse.json(
        { error: "WhatsApp session is not connected" },
        { status: 503 },
      )
    }

    // ── Look up event details ──────────────────────────────────────────────
    const [ev] = await db
      .select({
        title: events.title,
        startsAt: events.startsAt,
        venue: events.venue,
      })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1)

    if (!ev) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // ── Look up order items ────────────────────────────────────────────────
    const items = await db
      .select({
        qty: orderItems.quantity,
        tierName: ticketTiers.name,
      })
      .from(orderItems)
      .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
      .where(eq(orderItems.orderId, orderId))

    // ── Build the message ──────────────────────────────────────────────────
    const eventDate = ev.startsAt
      ? new Date(ev.startsAt).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "TBA"

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
    const ticketUrl = `${appUrl}/orders/${orderId}`

    const summary = items
      .map((i) => `  • ${i.qty}× ${i.tierName ?? "Ticket"}`)
      .join("\n")

    const buyerName = order.guestName ?? "there"

    const { ticketConfirmationMessage } = await import("@/lib/whatsapp-templates")
    const message = ticketConfirmationMessage(
      ev.title,
      buyerName,
      eventDate,
      ev.venue,
      orderId,
      summary,
      ticketUrl,
    )

    // ── Send via WhatsApp ──────────────────────────────────────────────────
    const chatId = formatChatId(order.guestPhone)
    const result = await sendText(chatId, message)

    log.info("send-ticket — WhatsApp sent", {
      orderId,
      phone: order.guestPhone,
      messageId: result.messageId,
    })

    return NextResponse.json({
      ok: true,
      sentTo: order.guestPhone,
      messageId: result.messageId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error("send-ticket — failed", { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
