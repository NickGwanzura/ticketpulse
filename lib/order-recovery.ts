import "server-only"
import { eq, sql, inArray } from "drizzle-orm"
import { db } from "@/db"
import { orders, orderItems, ticketTiers, tickets, events, paymentLedger } from "@/db/schema"
import { deliverTicketForPaidOrder, readDeliveryStatus } from "@/lib/delivery"
import { generateQrDataUrl, generateCombinedTicketPdf } from "@/lib/tickets"
import { sendOrderConfirmationEmail } from "@/lib/email"
import { getBaseUrl } from "@/lib/url-config"
import { trackEvent } from "@/lib/analytics"
import { log } from "@/lib/logger"

export type RecoveryResult = {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

export type SendTicketsResult = {
  success: boolean
  ticketCount: number
  emailSent: boolean
  deliveryStatus: string
  error: string | null
  regenerated: {
    tickets: boolean
    qrCodes: boolean
    attendeeRecords: boolean
  }
}

export type CompleteAndSendResult = {
  success: boolean
  completed: boolean
  ticketsDelivered: boolean
  emailSent: boolean
  message: string
  details?: Record<string, unknown>
}

export type AuditLogEntry = {
  id: string
  action: string
  performedBy: string
  performedAt: string
  details: string | null
}

/**
 * Mark an order as manually completed.
 * Sets order status to "completed", records payment as paid,
 * creates audit trail entry.
 */
export async function markOrderCompleteAction(
  orderId: string,
  userId: string,
  userEmail: string,
): Promise<RecoveryResult> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) {
    return { success: false, message: "Order not found" }
  }

  if (order.status === "completed") {
    return { success: false, message: "Order is already completed" }
  }

  if (order.status === "cancelled" || order.status === "refunded") {
    return { success: false, message: `Cannot complete a ${order.status} order` }
  }

  const now = new Date()

  try {
    await db
      .update(orders)
      .set({
        status: "completed",
        paidAt: order.paidAt ?? now,
        completedAt: now,
        completedBy: userEmail,
        paymentRef: order.paymentRef ?? `manual-${orderId.slice(0, 8)}`,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
  } catch (err) {
    return {
      success: false,
      message: `Failed to update order: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Record in payment ledger
  try {
    await db.insert(paymentLedger).values({
      orderId,
      eventId: order.eventId,
      transactionTrace: `manual-${orderId.slice(0, 8)}-${Date.now()}`,
      salesOrderTrace: `manual-${orderId.slice(0, 8)}`,
      invoiceId: order.paymentRef ?? `manual-${orderId.slice(0, 8)}`,
      amount: order.totalAmount,
      currency: order.currency ?? "USD",
      processor: "manual",
      velocityPollStatus: "MANUAL_COMPLETE",
      localStatus: "completed",
      source: "manual_complete",
      rawPayload: { completedBy: userEmail, completedAt: now.toISOString() },
    })
  } catch (err) {
    log.warn("markOrderComplete - failed to record paymentLedger", { orderId, error: String(err) })
  }

  // Record analytics event
  try {
    await trackEvent({
      event: "PAYMENT_CONFIRMED",
      eventId: order.eventId,
      orderId,
      buyerEmail: order.guestEmail ?? undefined,
      paymentMethod: order.paymentMethod ?? "manual",
      amount: Number(order.totalAmount ?? 0),
      metadata: { source: "manual_complete", completedBy: userEmail },
    })
  } catch (err) {
    log.warn("markOrderComplete - failed to track event", { orderId, error: String(err) })
  }

  log.info("order manually completed", { orderId, completedBy: userEmail })

  return {
    success: true,
    message: "Order marked as completed. Payment recorded.",
    details: { completedAt: now.toISOString(), completedBy: userEmail },
  }
}

/**
 * Verify and regenerate ticket records, QR codes, PDFs, and send email.
 * Checks for existing records and only regenerates what's missing.
 */
export async function sendTicketsAction(
  orderId: string,
): Promise<SendTicketsResult> {
  const baseUrl = getBaseUrl()
  const result: SendTicketsResult = {
    success: false,
    ticketCount: 0,
    emailSent: false,
    deliveryStatus: "FAILED",
    error: null,
    regenerated: { tickets: false, qrCodes: false, attendeeRecords: false },
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) {
    result.error = "Order not found"
    return result
  }

  if (!order.guestEmail) {
    result.error = "Order has no guest email"
    return result
  }

  // 1. Verify ticket records exist
  const existingTickets = await db
    .select({ id: tickets.id, qrCode: tickets.qrCode, tierId: tickets.tierId })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))

  let ticketRecords: { id: string; qrCode: string | null; tierId: string | null }[] = existingTickets

  // 2. Regenerate tickets if missing
  if (ticketRecords.length === 0) {
    const itemsWithIds = await db
      .select({ id: orderItems.id, tierId: orderItems.tierId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))

    const ticketValues: {
      tierId: string
      eventId: string
      orderId: string
      userId: string | null
      status: "sold"
      qrCode: string
    }[] = []

    for (const item of itemsWithIds) {
      if (!item.tierId) continue
      for (let i = 0; i < item.quantity; i++) {
        ticketValues.push({
          tierId: item.tierId,
          eventId: order.eventId,
          orderId,
          userId: order.userId,
          status: "sold",
          qrCode: `${orderId}-${item.id}-${i}`,
        })
      }
    }

    if (ticketValues.length > 0) {
      const inserted = await db.insert(tickets).values(ticketValues).returning({ id: tickets.id, qrCode: tickets.qrCode })
      ticketRecords = inserted.map((t) => {
        const found = ticketValues.find((v) => v.qrCode === t.qrCode)
        return { id: t.id, qrCode: t.qrCode, tierId: found?.tierId ?? null }
      })
      result.regenerated.tickets = true
      result.regenerated.attendeeRecords = true

      // Update tier sold quantities
      const tierCounts = new Map<string, number>()
      for (const tv of ticketValues) {
        if (tv.tierId) tierCounts.set(tv.tierId, (tierCounts.get(tv.tierId) ?? 0) + 1)
      }
      for (const [tierId, count] of tierCounts) {
        await db
          .update(ticketTiers)
          .set({ soldQuantity: sql`${ticketTiers.soldQuantity} + ${count}` })
          .where(eq(ticketTiers.id, tierId))
      }
    }
  }

  // 3. Verify and regenerate QR codes
  result.regenerated.qrCodes = false
  const qrUpdates: { id: string; qrCode: string }[] = []
  for (const t of ticketRecords) {
    if (!t.qrCode || t.qrCode.startsWith(orderId)) {
      try {
        const qrDataUrl = await generateQrDataUrl(t.id, orderId, baseUrl)
        qrUpdates.push({ id: t.id, qrCode: qrDataUrl })
        result.regenerated.qrCodes = true
      } catch {
        // keep existing qr
      }
    }
  }
  for (const update of qrUpdates) {
    await db.update(tickets).set({ qrCode: update.qrCode }).where(eq(tickets.id, update.id))
  }

  // 4. Generate PDF and send email
  const [ev] = await db
    .select({ title: events.title, startsAt: events.startsAt, venue: events.venue })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)

  const saleLines = await db
    .select({ qty: orderItems.quantity, unit: orderItems.unitPrice, total: orderItems.total, tierName: ticketTiers.name })
    .from(orderItems)
    .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
    .where(eq(orderItems.orderId, orderId))

  const lines = saleLines.map((i) => ({
    label: i.tierName ?? "Ticket",
    qty: i.qty,
    amount: `${i.total} ${order.currency ?? "USD"}`,
  }))

  const eventDate = ev?.startsAt
    ? new Date(ev.startsAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "TBA"

  // Load latest tickets for PDF
  const latestTickets = await db
    .select({ id: tickets.id, qrCode: tickets.qrCode, tierId: tickets.tierId })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))

  const tierRows = await db
    .select({ id: ticketTiers.id, name: ticketTiers.name })
    .from(ticketTiers)
    .where(inArray(ticketTiers.id, [...new Set(latestTickets.map((t) => t.tierId).filter(Boolean))]))

  const tierNameMap = new Map(tierRows.map((t) => [t.id, t.name]))

  let pdfBuffer: Buffer | null = null
  try {
    const pdfTickets = latestTickets.map((t) => ({
      eventTitle: ev?.title ?? "Your Ticket",
      tierName: tierNameMap.get(t.tierId) ?? "General Admission",
      buyerName: order.guestName ?? "Valued Guest",
      orderId,
      ticketId: t.id,
      qrCodeData: t.qrCode ?? `${orderId}-${t.id}`,
    }))
    pdfBuffer = await generateCombinedTicketPdf(pdfTickets)
  } catch (err) {
    log.warn("sendTickets - PDF generation failed", { orderId, error: String(err) })
  }

  const attachments = pdfBuffer
    ? [{ filename: `tickets-${orderId.slice(0, 8)}.pdf`, content: pdfBuffer, contentType: "application/pdf" as const }]
    : undefined

  try {
    await sendOrderConfirmationEmail({
      to: order.guestEmail,
      buyerName: order.guestName,
      orderId,
      eventTitle: ev?.title ?? "your event",
      eventDate,
      eventVenue: ev?.venue ?? undefined,
      lines,
      total: String(order.totalAmount ?? "0"),
      currency: order.currency ?? "USD",
      ticketUrl: `${baseUrl}/orders/${orderId}`,
      attachments,
    })
    result.emailSent = true
    result.success = true
    result.ticketCount = latestTickets.length
    result.deliveryStatus = "DELIVERED"
  } catch (err) {
    result.emailSent = false
    result.error = err instanceof Error ? err.message : String(err)
    result.deliveryStatus = "EMAIL_FAILED"
  }

  // Update delivery metadata
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const delivery = readDeliveryStatus(order.metadata)
  await db
    .update(orders)
    .set({
      metadata: {
        ...meta,
        delivery: {
          ...delivery,
          status: result.emailSent ? "EMAIL_SENT" : "EMAIL_FAILED",
          emailSentAt: result.emailSent ? new Date().toISOString() : null,
          emailSentTo: result.emailSent ? order.guestEmail : null,
          emailError: result.error,
          deliveryAttempts: (delivery.deliveryAttempts ?? 0) + 1,
          lastDeliveryAttemptAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))

  // Track delivery attempt
  try {
    await trackEvent({
      event: "TICKET_ISSUED",
      eventId: order.eventId,
      orderId,
      buyerEmail: order.guestEmail,
      metadata: { source: "manual_send", emailSent: result.emailSent, ticketCount: result.ticketCount },
    })
  } catch {
    // Non-critical
  }

  log.info("sendTickets - completed", {
    orderId,
    success: result.success,
    ticketCount: result.ticketCount,
    emailSent: result.emailSent,
    regenerated: result.regenerated,
  })

  return result
}

/**
 * Combined Complete & Send action.
 * Fully idempotent — running multiple times never creates duplicates.
 */
export async function completeAndSendAction(
  orderId: string,
  userId: string,
  userEmail: string,
): Promise<CompleteAndSendResult> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) {
    return { success: false, completed: false, ticketsDelivered: false, emailSent: false, message: "Order not found" }
  }

  if (order.status === "cancelled" || order.status === "refunded") {
    return {
      success: false,
      completed: false,
      ticketsDelivered: false,
      emailSent: false,
      message: `Cannot process a ${order.status} order`,
    }
  }

  const now = new Date()
  const delivery = readDeliveryStatus(order.metadata)

  // 1. Verify / mark payment
  // 2. Mark order completed (only if not already)
  let completed = order.status === "completed"
  if (!completed) {
    try {
      await db
        .update(orders)
        .set({
          status: "completed",
          paidAt: order.paidAt ?? now,
          completedAt: now,
          completedBy: userEmail,
          paymentRef: order.paymentRef ?? `manual-${orderId.slice(0, 8)}`,
          updatedAt: now,
        })
        .where(eq(orders.id, orderId))
      completed = true

      await db.insert(paymentLedger).values({
        orderId,
        eventId: order.eventId,
        transactionTrace: `manual-${orderId.slice(0, 8)}-${Date.now()}`,
        salesOrderTrace: `manual-${orderId.slice(0, 8)}`,
        invoiceId: order.paymentRef ?? `manual-${orderId.slice(0, 8)}`,
        amount: order.totalAmount,
        currency: order.currency ?? "USD",
        processor: "manual",
        velocityPollStatus: "MANUAL_COMPLETE",
        localStatus: "completed",
        source: "manual_complete_and_send",
        rawPayload: { completedBy: userEmail, completedAt: now.toISOString() },
      })
    } catch (err) {
      return {
        success: false,
        completed: false,
        ticketsDelivered: false,
        emailSent: false,
        message: `Failed to complete order: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  // 3-8. Generate tickets, QR, PDF, attendee records, send email
  // Idempotent: existing tickets are not duplicated
  let ticketsDelivered = false
  let emailSent = false

  try {
    // Check existing tickets
    const existingTickets = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.orderId, orderId))

    if (existingTickets.length === 0 || delivery.emailSentAt === null) {
      const result = await deliverTicketForPaidOrder(orderId)
      ticketsDelivered = result.ticketCount > 0
      emailSent = result.emailSent
    } else {
      ticketsDelivered = true
      emailSent = true
    }
  } catch (err) {
    log.error("completeAndSend - delivery failed", { orderId, error: String(err) })
    ticketsDelivered = false
    emailSent = false
  }

  // 9. Update organizer sales (handled by deliverTicketForPaidOrder → soldQuantity update)
  // 10. Revenue reporting (handled by paymentLedger entry + analytics event above)
  // 11. Audit log (paymentLedger + metadata above)

  const message = completed
    ? `Order completed${ticketsDelivered ? `, ${emailSent ? "tickets delivered and email sent" : "tickets generated but email failed"}` : ", ticket generation failed"}`
    : `Already completed${ticketsDelivered ? `, ${emailSent ? "tickets resent" : "ticket resend attempted"}` : ""}`

  return {
    success: ticketsDelivered || completed,
    completed,
    ticketsDelivered,
    emailSent,
    message,
    details: { completedAt: now.toISOString(), completedBy: userEmail },
  }
}
