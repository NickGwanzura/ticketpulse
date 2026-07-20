import "server-only"
import { eq, sql, inArray } from "drizzle-orm"
import { db } from "@/db"
import { orders, orderItems, ticketTiers, tickets, events, users } from "@/db/schema"
import { sendOrderConfirmationEmail, sendEmail, adminEmail } from "@/lib/email"
import { saleNotificationEmail } from "@/lib/email-templates"
import { sendText, sendImage, formatChatId } from "@/lib/whatsapp"
import { sendTicketConfirmationSms } from "@/lib/sms"
import { getBaseUrl } from "@/lib/url-config"
import { trackEvent } from "@/lib/analytics"
import { log } from "@/lib/logger"
import {
  deterministicTicketId,
  generateCombinedTicketPdf,
  generateTicketQrImageDataUrl,
  generateTicketVerifyUrl,
} from "@/lib/tickets"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"

export type DeliveryStatus =
  | "NOT_STARTED"
  | "TICKETS_CREATED"
  | "INVENTORY_UPDATED"
  | "EMAIL_SENT"
  | "EMAIL_FAILED"
  | "WHATSAPP_SENT"
  | "DELIVERED"
  | "FAILED"
  | "IN_PROGRESS"

export type DeliveryMetadata = {
  status: DeliveryStatus
  ticketIssuedAt: string | null
  emailSentAt: string | null
  emailSentTo: string | null
  emailId: string | null
  emailError: string | null
  pdfVersion: string | null
  whatsappSent: boolean
  smsSent: boolean
  deliveryAttempts: number
  lastDeliveryError: string | null
  lastDeliveryAttemptAt: string | null
}

const DEFAULT_DELIVERY: DeliveryMetadata = {
  status: "NOT_STARTED",
  ticketIssuedAt: null,
  emailSentAt: null,
  emailSentTo: null,
  emailId: null,
  emailError: null,
  pdfVersion: null,
  whatsappSent: false,
  smsSent: false,
  deliveryAttempts: 0,
  lastDeliveryError: null,
  lastDeliveryAttemptAt: null,
}

function getDeliveryMeta(meta: Record<string, unknown>): DeliveryMetadata {
  return (meta.delivery ?? DEFAULT_DELIVERY) as DeliveryMetadata
}

/**
 * Atomically issue tickets for a confirmed paid order.
 *
 * Safe to call multiple times — checks for existing tickets before creating.
 * Returns a summary of what was done.
 */
export async function deliverTicketForPaidOrder(orderId: string): Promise<{
  success: boolean
  status: DeliveryStatus
  ticketCount: number
  emailSent: boolean
  error: string | null
}> {
  // Prevent concurrent delivery for the same order (e.g. cron + admin click at the same time).
  // If the lock is already held another process is mid-delivery — return early.
  const lockKey = `delivery:${orderId}`
  const locked = await acquireLock(lockKey)
  if (!locked) {
    log.info("delivery - lock contended, another process is delivering", { orderId })
    return { success: true, status: "IN_PROGRESS", ticketCount: 0, emailSent: false, error: null }
  }

  try {
    return await _deliver(orderId)
  } finally {
    await releaseLock(lockKey).catch(() => {})
  }
}

async function _deliver(orderId: string): Promise<{
  success: boolean
  status: DeliveryStatus
  ticketCount: number
  emailSent: boolean
  error: string | null
}> {
  const baseUrl = getBaseUrl()

  // 1. Load the order
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) {
    return { success: false, status: "FAILED", ticketCount: 0, emailSent: false, error: "Order not found" }
  }

  if (order.status !== "paid" && order.status !== "completed") {
    return {
      success: false,
      status: "FAILED",
      ticketCount: 0,
      emailSent: false,
      error: `Order status is "${order.status}", expected "paid" or "completed"`,
    }
  }

  // 2. Check if tickets already exist (idempotency)
  const existingTickets = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))
    .limit(1)

  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const delivery = getDeliveryMeta(meta)
  const alreadyDelivered = existingTickets.length > 0

  // ── Guard: if tickets exist and email was sent, skip everything ─────────
  if (alreadyDelivered && delivery.emailSentAt) {
    log.info("delivery - already delivered, skipping", { orderId, ticketCount: existingTickets.length })
    return {
      success: true,
      status: "DELIVERED",
      ticketCount: existingTickets.length,
      emailSent: true,
      error: null,
    }
  }

  const attemptMeta = {
    ...delivery,
    deliveryAttempts: delivery.deliveryAttempts + 1,
    lastDeliveryAttemptAt: new Date().toISOString(),
  }

  try {
    let ticketCount = 0

    // ── 3. Create tickets if they don't exist ──────────────────────────────
    // Ticket metadata is built here and reused for PDF/email — no re-query needed.
    let pdfTicketData: { id: string; tierId: string | null; qrCode: string; tierName: string }[] = []
    let saleLines: { label: string; qty: number; amount: string }[] = []
    let ev: { title: string; startsAt: Date | null; venue: string | null; organizerId: string } | undefined

    if (!alreadyDelivered) {
      // Fetch items + tier names in one query (used for ticket creation AND email lines)
      const itemsWithTiers = await db
        .select({
          id: orderItems.id,
          tierId: orderItems.tierId,
          tierName: ticketTiers.name,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          total: orderItems.total,
        })
        .from(orderItems)
        .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
        .where(eq(orderItems.orderId, orderId))

      saleLines = itemsWithTiers.map((i) => ({
        label: i.tierName ?? "Ticket",
        qty: i.quantity,
        amount: `${i.total} ${order.currency ?? "USD"}`,
      }))

      const ticketValues: {
        id: string
        tierId: string
        tierName: string
        eventId: string
        orderId: string
        userId: string | null
        status: "sold"
        qrCode: string
      }[] = []

      for (const item of itemsWithTiers) {
        if (!item.tierId) continue
        for (let i = 0; i < item.quantity; i++) {
          const ticketId = deterministicTicketId(orderId, item.id, i)
          ticketValues.push({
            id: ticketId,
            tierId: item.tierId,
            tierName: item.tierName ?? "General Admission",
            eventId: order.eventId,
            orderId,
            userId: order.userId,
            status: "sold",
            qrCode: generateTicketVerifyUrl(ticketId, orderId, baseUrl),
          })
        }
      }

      if (ticketValues.length > 0) {
        await db
          .insert(tickets)
          .values(ticketValues.map((t) => ({
            id: t.id,
            tierId: t.tierId,
            eventId: t.eventId,
            orderId: t.orderId,
            userId: t.userId,
            status: t.status,
            qrCode: t.qrCode,
          })))
          .onConflictDoNothing({ target: tickets.id })

        const expectedTicketIds = ticketValues.map((t) => t.id)
        const orderTickets = await db
          .select({ id: tickets.id, qrCode: tickets.qrCode, tierId: tickets.tierId, tierName: ticketTiers.name })
          .from(tickets)
          .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
          .where(inArray(tickets.id, expectedTicketIds))

        const qrResults = await Promise.all(
          orderTickets.map((t) =>
            generateTicketQrImageDataUrl(t.qrCode, t.id, orderId, baseUrl).catch(
              () => t.qrCode ?? `${orderId}-${t.id}`,
            ),
          ),
        )

        // Build PDF ticket data directly — no re-query of the tickets table
        pdfTicketData = orderTickets.map((t, i) => ({
          id: t.id,
          tierId: t.tierId,
          qrCode: qrResults[i],
          tierName: t.tierName ?? "General Admission",
        }))

        // Only increment soldQuantity for orders that did NOT reserve inventory
        // at checkout time. New orders set metadata.inventoryReserved = true and
        // already incremented soldQuantity atomically in the checkout transaction.
        const inventoryReserved = meta.inventoryReserved === true
        if (!inventoryReserved) {
          const tierCounts = new Map<string, number>()
          for (const t of ticketValues) {
            tierCounts.set(t.tierId, (tierCounts.get(t.tierId) ?? 0) + 1)
          }
          await Promise.all(
            Array.from(tierCounts).map(([tierId, count]) =>
              db
                .update(ticketTiers)
                .set({ soldQuantity: sql`${ticketTiers.soldQuantity} + ${count}` })
                .where(eq(ticketTiers.id, tierId)),
            ),
          )
        }

        ticketCount = orderTickets.length

        await trackEvent({
          event: "TICKET_ISSUED",
          eventId: order.eventId,
          orderId,
          ticketType: [...new Set(ticketValues.map((t) => t.tierId))].join(","),
          buyerEmail: order.guestEmail ?? undefined,
        })
      }

      attemptMeta.status = "TICKETS_CREATED"
      attemptMeta.ticketIssuedAt = new Date().toISOString()
      attemptMeta.pdfVersion = "A6_V2"
    } else {
      ticketCount = existingTickets.length
    }

    // ── 4. Update delivery metadata ───────────────────────────────────────
    await db
      .update(orders)
      .set({
        metadata: { ...meta, delivery: { ...attemptMeta, status: "TICKETS_CREATED" } },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))

    // ── 5. Send confirmation email with PDF tickets attached ──────────────
    if (order.guestEmail) {
      try {
        const isResume = pdfTicketData.length === 0
        const [[evRow], existingPdfData, resumeSaleLines] = await Promise.all([
          db
            .select({ title: events.title, startsAt: events.startsAt, venue: events.venue, organizerId: events.organizerId })
            .from(events)
            .where(eq(events.id, order.eventId))
            .limit(1),
          isResume
            ? db
                .select({ id: tickets.id, qrCode: tickets.qrCode, tierId: tickets.tierId, tierName: ticketTiers.name })
                .from(tickets)
                .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
                .where(eq(tickets.orderId, orderId))
            : Promise.resolve([] as { id: string; qrCode: string | null; tierId: string | null; tierName: string | null }[]),
          isResume
            ? db
                .select({ qty: orderItems.quantity, total: orderItems.total, tierName: ticketTiers.name })
                .from(orderItems)
                .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
                .where(eq(orderItems.orderId, orderId))
            : Promise.resolve([] as { qty: number; total: unknown; tierName: string | null }[]),
        ])

        ev = evRow
        if (existingPdfData.length > 0) {
          pdfTicketData = await Promise.all(
            existingPdfData.map(async (t) => ({
              id: t.id,
              tierId: t.tierId,
              qrCode: await generateTicketQrImageDataUrl(t.qrCode ?? `${orderId}-${t.id}`, t.id, orderId, baseUrl),
              tierName: t.tierName ?? "General Admission",
            })),
          )
          saleLines = resumeSaleLines.map((i) => ({ label: i.tierName ?? "Ticket", qty: i.qty, amount: `${i.total} ${order.currency ?? "USD"}` }))
        }

        const eventDate = ev?.startsAt
          ? new Date(ev.startsAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Harare" })
          : "TBA"

        // Generate combined PDF of all tickets
        let pdfBuffer: Buffer | null = null
        try {
          const pdfTickets = pdfTicketData.map((t) => ({
            eventTitle: ev?.title ?? "Your Ticket",
            eventStartsAt: ev?.startsAt,
            venue: ev?.venue,
            tierName: t.tierName,
            buyerName: order.guestName ?? "Valued Guest",
            orderId,
            ticketId: t.id,
            qrCodeData: t.qrCode,
          }))
          pdfBuffer = await generateCombinedTicketPdf(pdfTickets)
        } catch (err) {
          log.warn("delivery - PDF generation failed (email will still be sent)", {
            orderId,
            error: String(err),
          })
        }

        const attachments = pdfBuffer
          ? [{ filename: `tickets-${orderId.slice(0, 8)}.pdf`, content: pdfBuffer, contentType: "application/pdf" as const }]
          : undefined

        const result = await sendOrderConfirmationEmail({
          to: order.guestEmail,
          buyerName: order.guestName,
          orderId,
          eventTitle: ev?.title ?? "your event",
          eventDate,
          eventVenue: ev?.venue ?? undefined,
          lines: saleLines,
          total: String(order.totalAmount ?? "0"),
          currency: order.currency ?? "USD",
          ticketUrl: `${baseUrl}/orders/${orderId}`,
          attachments,
        })

        attemptMeta.status = "EMAIL_SENT"
        attemptMeta.emailSentAt = new Date().toISOString()
        attemptMeta.emailSentTo = order.guestEmail
        attemptMeta.emailId = "id" in result ? result.id : null
        attemptMeta.emailError = null
        attemptMeta.pdfVersion = "A6_V2"

        // ── Notify organizer and admin about the sale ─────────────────────
        if (ev) {
          notifyOrganizerSale(order, ev, saleLines, baseUrl).catch((err) =>
            log.warn("delivery - organizer notification failed", { orderId, error: String(err) }),
          )
        }
      } catch (err) {
        attemptMeta.status = "EMAIL_FAILED"
        attemptMeta.emailError = err instanceof Error ? err.message : String(err)
        log.error("delivery - email send failed", { orderId, error: attemptMeta.emailError })
      }
    }

    // ── 6. Send WhatsApp ticket (non-blocking, idempotent) ─────────────────
    if (order.guestPhone && !delivery.whatsappSent) {
      const internalKey = process.env.INTERNAL_API_KEY
      // Self-call via loopback, not the public URL: container-to-own-host-IP
      // traffic (hairpin NAT) hangs on this deployment.
      const selfUrl = `http://127.0.0.1:${process.env.PORT ?? 3000}`
      fetch(`${selfUrl}/api/whatsapp/send-ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(internalKey ? { "X-Internal-Key": internalKey } : {}),
        },
        body: JSON.stringify({ orderId }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`WhatsApp API returned ${res.status}`)
          return res.json()
        })
        .then(() => {
          log.info("delivery - WhatsApp ticket sent", { orderId })
        })
        .catch((err) => log.warn("delivery - WhatsApp send failed (non-blocking)", { orderId, error: String(err) }))
    }

    // ── 6b. Send SMS ticket confirmation (non-blocking, idempotent) ────────
    if (order.guestPhone && !delivery.smsSent) {
      sendTicketConfirmationSms(order.guestPhone)
        .then((result) => {
          log.info("delivery - SMS ticket sent", { orderId, batchResult: result })
        })
        .catch((err: unknown) => log.warn("delivery - SMS send failed (non-blocking)", { orderId, error: String(err) }))
    }

    // ── 7. Final status ───────────────────────────────────────────────────
    const finalStatus: DeliveryStatus = attemptMeta.status === "EMAIL_FAILED" ? "EMAIL_FAILED" : "DELIVERED"
    attemptMeta.status = finalStatus
    attemptMeta.lastDeliveryError = finalStatus === "DELIVERED" ? null : attemptMeta.emailError

    await db
      .update(orders)
      .set({
        metadata: { ...meta, delivery: attemptMeta },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))

    return {
      success: finalStatus !== "EMAIL_FAILED",
      status: finalStatus,
      ticketCount,
      emailSent: finalStatus === "DELIVERED",
      error: attemptMeta.lastDeliveryError,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    attemptMeta.status = "FAILED"
    attemptMeta.lastDeliveryError = errorMsg

    await db
      .update(orders)
      .set({
        metadata: { ...meta, delivery: attemptMeta },
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .catch((updateErr) => {
        log.error("delivery - failed to record delivery failure in metadata", {
          orderId,
          error: String(updateErr),
        })
      })

    log.error("delivery - failed", { orderId, error: errorMsg })
    return { success: false, status: "FAILED", ticketCount: 0, emailSent: false, error: errorMsg }
  }
}

// ── Organizer / Admin sale notifications ────────────────────────────────────

async function notifyOrganizerSale(
  order: typeof orders.$inferSelect,
  ev: { title: string; startsAt: Date | null; venue: string | null; organizerId: string },
  lines: { label: string; qty: number; amount: string }[],
  baseUrl: string,
) {
  const [org] = await db
    .select({ name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, ev.organizerId))
    .limit(1)

  if (org?.email) {
    const { html, text } = saleNotificationEmail({
      role: "organizer",
      eventTitle: ev.title,
      buyerName: order.guestName ?? "A buyer",
      orderId: order.id,
      items: lines,
      total: String(order.totalAmount),
      currency: order.currency ?? "USD",
      organizerName: org.name,
    })
    await sendEmail({ to: org.email, subject: `🎟️ New ticket sale — ${ev.title}`, html, text }).catch((err) =>
      log.warn("delivery - organizer email notification failed", { error: String(err) }),
    )
  }

  if (org?.phone) {
    const { organizerSaleNotification } = await import("@/lib/whatsapp-templates")
    const chatId = formatChatId(org.phone)
    // Send brand image + sale notification
    sendImage({ chatId, url: `${baseUrl}/favicon.jpg`, caption: "New sale" }).catch(() => {})
    sendText(
      chatId,
      organizerSaleNotification(
        ev.title,
        order.guestName ?? "Someone",
        order.id,
        lines.map((l) => `${l.qty}× ${l.label} — ${l.amount}`),
        order.totalAmount,
        order.currency ?? "USD",
        `${baseUrl}/organizer/events/${order.eventId}/attendees`,
      ),
    ).catch((e) => log.warn("delivery - WhatsApp to organizer failed", { orderId: order.id, error: String(e) }))
  }

  // Admin sale notification
  try {
    const { html, text } = saleNotificationEmail({
      role: "admin",
      eventTitle: ev.title,
      buyerName: order.guestName ?? "A buyer",
      orderId: order.id,
      items: lines,
      total: String(order.totalAmount),
      currency: order.currency ?? "USD",
    })
    await sendEmail({ to: adminEmail, subject: `🎟️ Sale alert — ${ev.title}`, html, text }).catch((err) =>
      log.warn("delivery - admin email notification failed", { error: String(err) }),
    )
  } catch {
    // Non-critical
  }
}

// ── Delivery status helpers ─────────────────────────────────────────────────

export function readDeliveryStatus(metadata: unknown): DeliveryMetadata {
  const meta = (metadata ?? {}) as Record<string, unknown>
  return (meta.delivery ?? DEFAULT_DELIVERY) as DeliveryMetadata
}

export function hasActiveTickets(_orderId: string, status: string): boolean {
  return status === "paid" || status === "completed"
}
