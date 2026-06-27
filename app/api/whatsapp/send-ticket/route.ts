import { NextResponse } from "next/server"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { orders, events, orderItems, ticketTiers, tickets } from "@/db/schema"
import { sendText, sendDocument, formatChatId, isSessionReady } from "@/lib/whatsapp"
import { generateTicketPdfBuffer } from "@/lib/pdf/generate"
import { generateTicketQrImageDataUrl } from "@/lib/tickets"
import { formatDate } from "@/lib/utils"
import { log } from "@/lib/logger"

/**
 * POST /api/whatsapp/send-ticket
 *
 * Sends a WhatsApp notification to the buyer with their ticket details
 * and attaches the ticket PDF after a successful purchase. Called from:
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

    // ── Look up individual tickets for PDF ────────────────────────────────
    const orderTickets = await db
      .select({
        id: tickets.id,
        qrCode: tickets.qrCode,
        tierId: tickets.tierId,
      })
      .from(tickets)
      .where(and(eq(tickets.orderId, orderId), notInArray(tickets.status, ["cancelled", "refunded"])))

    // ── Build the text message ─────────────────────────────────────────────
    const eventDate = ev.startsAt
      ? new Date(ev.startsAt).toLocaleString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Harare",
        })
      : "TBA"

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
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

    const chatId = formatChatId(order.guestPhone)

    // ── Generate PDF ───────────────────────────────────────────────────────
    let pdfBase64: string | null = null
    if (orderTickets.length > 0) {
      try {
        // Load tier names for PDF pages
        const tierIds = [...new Set(orderTickets.map((t) => t.tierId).filter(Boolean))]
        const tierRows =
          tierIds.length > 0
            ? await db
                .select({ id: ticketTiers.id, name: ticketTiers.name })
                .from(ticketTiers)
                .where(inArray(ticketTiers.id, tierIds))
            : []
        const tierNameMap = new Map(tierRows.map((t) => [t.id, t.name]))

        const ticketPages = await Promise.all(
          orderTickets.map(async (t, idx) => ({
            eventTitle: ev.title,
            tierName: tierNameMap.get(t.tierId) ?? "General Admission",
            buyerName: order.guestName ?? "Valued Guest",
            orderId,
            ticketId: t.id,
            qrCodeDataUrl: await generateTicketQrImageDataUrl(t.qrCode, t.id, orderId, appUrl),
            humanCode: `${orderId.slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`,
            venue: ev.venue,
            eventDate: ev.startsAt ? formatDate(ev.startsAt, { timeZone: "Africa/Harare" }) : null,
          })),
        )

        const pdfBuffer = await generateTicketPdfBuffer(ticketPages)
        pdfBase64 = Buffer.from(pdfBuffer).toString("base64")
      } catch (pdfErr) {
        log.warn("send-ticket — PDF generation failed, sending text only", {
          orderId,
          error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        })
      }
    }

    // ── Send text confirmation first, then PDF ────────────────────────────
    const [textResult, pdfResult] = await Promise.allSettled([
      sendText(chatId, message),
      pdfBase64
        ? sendDocument({
            chatId,
            base64: pdfBase64,
            mimetype: "application/pdf",
            filename: `tickets-${orderId.slice(0, 8)}.pdf`,
            caption: "Your ticket PDF — show the QR code at the door.",
          })
        : Promise.resolve(null),
    ])

    log.info("send-ticket — WhatsApp sent", {
      orderId,
      phone: order.guestPhone,
      textSent: textResult.status === "fulfilled",
      pdfSent: pdfResult.status === "fulfilled" && pdfResult.value !== null,
      messageId: textResult.status === "fulfilled" ? textResult.value.messageId : null,
    })

    return NextResponse.json({
      ok: true,
      sentTo: order.guestPhone,
      pdfSent: pdfResult.status === "fulfilled" && pdfResult.value !== null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error("send-ticket — failed", { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
