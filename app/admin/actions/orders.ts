"use server"

import { revalidatePath } from "next/cache"
import { eq, and, inArray, or, sql } from "drizzle-orm"

import { signIn } from "@/auth"
import { requireAdmin } from "@/lib/auth-guard"
import { recordAdminAction } from "@/lib/admin-audit"
import { db } from "@/db"
import { events, orders, orderItems, organizerFeeDues, paymentLedger, ticketTiers, tickets, users } from "@/db/schema"
import {
  sendEmail,
  adminEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email"
import { eventPublishedNotificationEmail } from "@/lib/email-templates"
import { log } from "@/lib/logger"
import { generateCombinedTicketPdf, generateOrderAccessUrl, generateTicketQrImageDataUrl } from "@/lib/tickets"
import { getBaseUrl } from "@/lib/url-config"
import type { VelocityOrderMetadata } from "@/types/velocity"

export async function resendOrderEmailAction(orderId: string) {
  const session = await requireAdmin()

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw new Error("Order not found")

  const recipient = order.guestEmail
  if (!recipient) throw new Error("Order has no guest email")

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

  if (order.status === "pending") {
    throw new Error("Cannot resend email for order with status \"pending\". Only paid or awaiting-verification orders are supported.")
  }

  // Magic links were removed. awaiting_verification orders must be recovered
  // via the admin recovery actions (completeAndSendAction) or the fix script.
  if (order.status === "awaiting_verification") {
    throw new Error(
      'Magic links have been removed. Use "Recover & Send Tickets" from the order detail page to resolve this order.',
    )
  }

  // ── Paid → resend order confirmation ────────────────────────────────────
  if (order.status === "paid") {
    const [ev] = await db
      .select({
        title: events.title,
        startsAt: events.startsAt,
        venue: events.venue,
      })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1)

    if (!ev) throw new Error("Event not found")

    const items = await db
      .select({
        qty: orderItems.quantity,
        unit: orderItems.unitPrice,
        total: orderItems.total,
        tierName: ticketTiers.name,
      })
      .from(orderItems)
      .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
      .where(eq(orderItems.orderId, orderId))

    const lines = items.map((i) => ({
      label: i.tierName ?? "Ticket",
      qty: i.qty,
      amount: `${i.total} ${order.currency ?? "USD"}`,
    }))

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

    // ── Generate PDF tickets as attachment ────────────────────────────────
    let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined
    try {
      const ticketRecords = await db
        .select({ id: tickets.id, qrCode: tickets.qrCode, tierId: tickets.tierId })
        .from(tickets)
        .where(eq(tickets.orderId, orderId))

      if (ticketRecords.length > 0) {
        const tierRows = await db
          .select({ id: ticketTiers.id, name: ticketTiers.name })
          .from(ticketTiers)
          .where(inArray(ticketTiers.id, [...new Set(ticketRecords.map((t) => t.tierId).filter(Boolean))]))

        const tierNameMap = new Map(tierRows.map((t) => [t.id, t.name]))
        const baseUrl = getBaseUrl()

        // Generate QR image data URLs for the PDF without overwriting the stored scan value.
        const qrMap = new Map<string, string>()
        for (const t of ticketRecords) {
          try {
            qrMap.set(t.id, await generateTicketQrImageDataUrl(t.qrCode, t.id, orderId, baseUrl))
          } catch {
            // Do not put a plain-text placeholder in a QR image slot. The PDF
            // must fail closed rather than render something the gate cannot verify.
          }
        }

        const pdfTickets = ticketRecords.map((t) => ({
          eventTitle: ev.title,
          eventStartsAt: ev.startsAt,
          venue: ev.venue,
          tierName: tierNameMap.get(t.tierId) ?? "General Admission",
          buyerName: order.guestName ?? "Valued Guest",
          orderId,
          ticketId: t.id,
          qrCodeData: qrMap.get(t.id) ?? "",
        }))

        const pdfBuffer = await generateCombinedTicketPdf(pdfTickets)
        attachments = [{ filename: `tickets-${orderId.slice(0, 8)}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
      }
    } catch (err) {
      log.warn("resendOrderEmailAction - PDF generation failed (email will still be sent)", {
        orderId,
        error: String(err),
      })
    }

    await sendOrderConfirmationEmail({
      to: recipient,
      buyerName: order.guestName,
      orderId: orderId,
      eventTitle: ev.title,
      eventDate,
      eventVenue: ev.venue ?? undefined,
      lines,
      total: String(order.totalAmount ?? "0"),
      currency: order.currency ?? "USD",
      ticketUrl: generateOrderAccessUrl(orderId, appUrl),
      attachments,
    })

    // Update delivery metadata with pdfVersion
    try {
      const meta = (order.metadata ?? {}) as Record<string, unknown>
      const delivery = (meta.delivery ?? {}) as Record<string, unknown>
      await db
        .update(orders)
        .set({
          metadata: {
            ...meta,
            delivery: {
              ...delivery,
              pdfVersion: "A6_V2",
              lastDeliveryAttemptAt: new Date().toISOString(),
              deliveryAttempts: ((delivery.deliveryAttempts as number) ?? 0) + 1,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
    } catch (err) {
      log.warn("resendOrderEmailAction - failed to update delivery metadata", {
        orderId,
        error: String(err),
      })
    }

    revalidatePath("/admin/orders")
    return
  }

  throw new Error(
    `Cannot resend email for order with status "${order.status}". Only paid or awaiting-verification orders are supported.`,
  )
}

/**
 * Update an organiser's commission rate (percentage).
 * Only admins can call this.
 */

export async function cancelOrderTicketsAction(orderId: string) {
  const session = await requireAdmin()

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw new Error("Order not found")
  if (order.status === "cancelled" || order.status === "refunded") {
    throw new Error("Order is already cancelled or refunded")
  }

  // Wrap all mutations in a single transaction so a failure mid-way
  // rolls everything back.
  await db.transaction(async (tx) => {
    // Update the order status
    await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    // Find all ticket records tied to this order and mark them as cancelled
    const orderTickets = await tx
      .select({ id: tickets.id, tierId: tickets.tierId })
      .from(tickets)
      .where(eq(tickets.orderId, orderId))

    if (orderTickets.length > 0) {
      const ticketIds = orderTickets.map((t) => t.id)
      const tierIds = [...new Set(orderTickets.map((t) => t.tierId).filter(Boolean))]

      await tx
        .update(tickets)
        .set({ status: "cancelled" })
        .where(inArray(tickets.id, ticketIds))

      // Restore inventory for each affected tier
      for (const tierId of tierIds) {
        const cancelledCount = orderTickets.filter((t) => t.tierId === tierId).length
        await tx
          .update(ticketTiers)
          .set({
            soldQuantity: sql`${ticketTiers.soldQuantity} - ${cancelledCount}`,
          })
          .where(eq(ticketTiers.id, tierId))
      }
    }
  })

  await recordAdminAction(session, { action: "order.cancel", targetType: "order", targetId: orderId, before: { status: order.status }, after: { status: "cancelled" } })

  revalidatePath("/admin/tickets")
  revalidatePath("/admin/orders")
  revalidatePath("/admin")
}

/**
 * Cancel individual tickets directly (not through an order).
 * Used for staff tickets, test tickets, or tickets without an order.
 * Only admins can call this. Restores ticket tier inventory.
 */
export async function cancelTicketsAction(ticketIds: string[]) {
  const session = await requireAdmin()

  // Fetch the tickets to cancel
  const targetTickets = await db
    .select({ id: tickets.id, tierId: tickets.tierId, status: tickets.status })
    .from(tickets)
    .where(inArray(tickets.id, ticketIds))

  if (targetTickets.length === 0) {
    throw new Error("No tickets found")
  }

  // Separate already-cancelled/refunded tickets
  const alreadyDone = targetTickets.filter(
    (t) => t.status === "cancelled" || t.status === "refunded",
  )
  const toCancel = targetTickets.filter(
    (t) => t.status !== "cancelled" && t.status !== "refunded",
  )

  if (toCancel.length === 0) {
    throw new Error("All selected tickets are already cancelled or refunded")
  }

  // Mark tickets as cancelled
  const toCancelIds = toCancel.map((t) => t.id)
  await db
    .update(tickets)
    .set({ status: "cancelled" })
    .where(inArray(tickets.id, toCancelIds))

  // Restore inventory for each affected tier
  const tierCounts = new Map<string, number>()
  for (const t of toCancel) {
    if (t.tierId) {
      tierCounts.set(t.tierId, (tierCounts.get(t.tierId) ?? 0) + 1)
    }
  }
  for (const [tierId, count] of tierCounts) {
    await db
      .update(ticketTiers)
      .set({ soldQuantity: sql`${ticketTiers.soldQuantity} - ${count}` })
      .where(eq(ticketTiers.id, tierId))
  }

  await recordAdminAction(session, { action: "ticket.cancel", targetType: "order", targetId: toCancelIds.join(","), before: { status: "active", count: toCancelIds.length }, after: { status: "cancelled" } })

  revalidatePath("/admin/tickets")
  revalidatePath("/admin/orders")
  revalidatePath("/admin")
}

/**
 * Deliver tickets for a paid order.
 * Wraps lib/delivery.ts for use as a server action from the admin UI.
 */

export async function markOrderCompleteAction(orderId: string) {
  const session = await requireAdmin()

  const { markOrderCompleteAction: completeAction } = await import("@/lib/order-recovery")
  const result = await completeAction(orderId, session.user.id, session.user.email ?? "admin")
  await recordAdminAction(session, { action: "order.complete_manually", targetType: "order", targetId: orderId, after: { result: typeof result === "object" ? result : String(result) } })
  return result
}

/**
 * Send tickets for an order — regenerates missing records and delivers via email.
 */
export async function sendTicketsAction(orderId: string) {
  const session = await requireAdmin()

  const { sendTicketsAction: sendAction } = await import("@/lib/order-recovery")
  return sendAction(orderId)
}

/**
 * Complete order and send tickets in one idempotent action.
 */
export async function completeAndSendAction(orderId: string) {
  const session = await requireAdmin()

  const { completeAndSendAction: combinedAction } = await import("@/lib/order-recovery")
  return combinedAction(orderId, session.user.id, session.user.email ?? "admin")
}

export type OfflineOrderInput = {
  eventId: string
  tierId: string
  quantity: number
  guestName: string
  guestEmail: string
  guestPhone?: string
  // Required by createOfflineOrderAction; ignored by createDirectPayOrderAction
  // (which always records payment method as "organizer_direct").
  paymentMethod?: string
  paymentRef?: string
}

/**
 * Shared groundwork for both manual-ticket flows below: validates input,
 * checks tier capacity, creates the order + order item, and returns the
 * created order and tier for the caller to finish (fee accounting differs
 * between the two flows, so that part is NOT shared).
 */
async function createManualTicketOrder(
  input: OfflineOrderInput,
  session: { user: { id: string; email?: string | null } },
  opts: { paymentMethod: string; paymentRef?: string; source: string },
) {
  const quantity = Math.floor(input.quantity)
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error("Quantity must be at least 1")
  }
  if (!input.guestEmail?.trim()) throw new Error("Guest email is required")
  if (!input.guestName?.trim()) throw new Error("Guest name is required")

  const [tier] = await db
    .select()
    .from(ticketTiers)
    .where(and(eq(ticketTiers.id, input.tierId), eq(ticketTiers.eventId, input.eventId)))
    .limit(1)

  if (!tier) throw new Error("Ticket tier not found for this event")

  const remaining = tier.totalQuantity - (tier.soldQuantity ?? 0)
  if (remaining < quantity) {
    throw new Error(`Only ${remaining} left in "${tier.name}"`)
  }

  const total = (Number(tier.price) * quantity).toFixed(2)

  const [order] = await db
    .insert(orders)
    .values({
      eventId: input.eventId,
      status: "pending",
      totalAmount: total,
      currency: tier.currency ?? "USD",
      paymentMethod: opts.paymentMethod,
      paymentRef: opts.paymentRef || `manual-${Date.now()}`,
      guestEmail: input.guestEmail.trim(),
      guestName: input.guestName.trim(),
      guestPhone: input.guestPhone?.trim() || null,
      metadata: { source: opts.source, issuedBy: session.user.email ?? "admin" },
    })
    .returning()

  await db.insert(orderItems).values({
    orderId: order.id,
    tierId: tier.id,
    type: "ticket",
    quantity,
    unitPrice: tier.price,
    total,
  })

  return { order, tier, total: Number(total), quantity }
}

/**
 * Create an order for a payment collected outside the app (cash, bank transfer,
 * etc.) and immediately complete it + email the ticket, reusing the same
 * completeAndSendAction pipeline paid checkout orders go through.
 */
export async function createOfflineOrderAction(input: OfflineOrderInput) {
  const session = await requireAdmin()
  const paymentMethod = input.paymentMethod?.trim()
  if (!paymentMethod) throw new Error("Payment method is required")

  const { order } = await createManualTicketOrder(input, session, {
    paymentMethod,
    paymentRef: input.paymentRef,
    source: "offline_manual_issue",
  })

  const { completeAndSendAction: combinedAction } = await import("@/lib/order-recovery")
  const result = await combinedAction(order.id, session.user.id, session.user.email ?? "admin")

  revalidatePath("/admin/orders")
  revalidatePath("/admin/tickets")
  revalidatePath("/admin")

  return { ...result, orderId: order.id }
}

/**
 * Issue a ticket for a sale where the ORGANIZER was paid directly by the
 * buyer (cash at the door, their own bank transfer, etc.) — no money passes
 * through the platform. We still issue the ticket like any other order, but
 * instead of owing the organizer a payout, they owe US our platform fee on
 * the sale. That fee is recorded in organizer_fee_dues for later collection,
 * and the sale is excluded from the organizer's payout balance
 * (see lib/revenue-summary.ts) since we never held the money.
 */
export async function createDirectPayOrderAction(input: OfflineOrderInput) {
  const session = await requireAdmin()

  const [event] = await db
    .select({ organizerId: events.organizerId, platformFeePercent: events.platformFeePercent })
    .from(events)
    .where(eq(events.id, input.eventId))
    .limit(1)
  if (!event) throw new Error("Event not found")

  const { order, total } = await createManualTicketOrder(input, session, {
    paymentMethod: "organizer_direct",
    paymentRef: input.paymentRef,
    source: "organizer_direct_payment",
  })

  const { completeAndSendAction: combinedAction } = await import("@/lib/order-recovery")
  const result = await combinedAction(order.id, session.user.id, session.user.email ?? "admin")

  // markOrderCompleteAction (called inside combinedAction) auto-creates the
  // organizer_fee_dues row for any direct-sale payment method, including
  // "organizer_direct" — read it back rather than inserting a second one.
  const { calculatePlatformFee, normalizePlatformFeePercent } = await import("@/lib/platform-fee")
  const platformFeePercent = normalizePlatformFeePercent(event.platformFeePercent)
  const feeAmount = calculatePlatformFee(total, platformFeePercent / 100)
  const [feeDue] = await db
    .select({ id: organizerFeeDues.id })
    .from(organizerFeeDues)
    .where(eq(organizerFeeDues.orderId, order.id))
    .limit(1)

  revalidatePath("/admin/orders")
  revalidatePath("/admin/tickets")
  revalidatePath("/admin/organizer-fees")
  revalidatePath("/admin")

  return { ...result, orderId: order.id, feeDueId: feeDue?.id, feeAmount, grossAmount: total }
}

export async function markFeeDueSettledAction(feeDueId: string, note?: string) {
  const session = await requireAdmin()

  await db
    .update(organizerFeeDues)
    .set({
      status: "settled",
      settledAt: new Date(),
      settledBy: session.user.email ?? "admin",
      note: note?.trim() || undefined,
    })
    .where(eq(organizerFeeDues.id, feeDueId))

  revalidatePath("/admin/organizer-fees")
  revalidatePath("/admin")

  return { success: true }
}

export async function refundOrderAction(orderId: string) {
  const session = await requireAdmin()

  const [order] = await db
    .select({ id: orders.id, status: orders.status, eventId: orders.eventId, totalAmount: orders.totalAmount })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw new Error("Order not found")
  if (order.status !== "paid") {
    throw new Error("Only paid orders can be refunded")
  }

  // Wrap all mutations in a single transaction so a failure mid-way
  // rolls everything back.
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    const orderTickets = await tx
      .select({ id: tickets.id, tierId: tickets.tierId })
      .from(tickets)
      .where(eq(tickets.orderId, orderId))

    if (orderTickets.length > 0) {
      const ticketIds = orderTickets.map((t) => t.id)
      const tierIds = [...new Set(orderTickets.map((t) => t.tierId).filter(Boolean))]

      await tx
        .update(tickets)
        .set({ status: "refunded" })
        .where(inArray(tickets.id, ticketIds))

      for (const tierId of tierIds) {
        const refundedCount = orderTickets.filter((t) => t.tierId === tierId).length
        await tx
          .update(ticketTiers)
          .set({
            soldQuantity: sql`${ticketTiers.soldQuantity} - ${refundedCount}`,
          })
          .where(eq(ticketTiers.id, tierId))
      }
    }

    await tx.insert(paymentLedger).values({
      orderId,
      eventId: order.eventId,
      transactionTrace: `refund-${orderId.slice(0, 8)}-${Date.now()}`,
      salesOrderTrace: `refund-${orderId.slice(0, 8)}`,
      invoiceId: `refund-${orderId.slice(0, 8)}`,
      amount: `-${order.totalAmount}`,
      currency: "USD",
      processor: "manual",
      velocityPollStatus: "MANUAL_REFUND",
      localStatus: "refunded",
      source: "admin_refund",
      rawPayload: { refundedBy: session.user.email ?? session.user.id, refundedAt: new Date().toISOString() },
    })
  })

  // Refunding can reveal that a payout already sent to the organiser for this
  // event now exceeds net platform revenue — track that as a clawback rather
  // than letting availableBalance silently clamp the shortfall to zero.
  try {
    const [event] = await db
      .select({ organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1)
    if (event) {
      const { recordRefundClawback } = await import("@/lib/revenue-summary")
      const result = await recordRefundClawback({
        eventId: order.eventId,
        organizerId: event.organizerId,
        orderId,
        reason: `Refund on order ${orderId.slice(0, 8)} reduced net revenue below amount already paid out.`,
        performedBy: session.user.email ?? session.user.id,
      })
      if (result.created) {
        log.warn("refund created a payout clawback", { orderId, eventId: order.eventId, amount: result.amount })
      }
    }
  } catch (err) {
    log.error("refundOrderAction - clawback check failed", { orderId, error: String(err) })
  }

  await recordAdminAction(session, { action: "order.refund", targetType: "order", targetId: orderId, before: { status: order.status, totalAmount: order.totalAmount }, after: { status: "refunded" } })

  revalidatePath("/admin/tickets")
  revalidatePath("/admin/orders")
  revalidatePath("/admin")
}

export async function deliverTicketAction(orderId: string) {
  const session = await requireAdmin()

  const { deliverTicketForPaidOrder } = await import("@/lib/delivery")
  const result = await deliverTicketForPaidOrder(orderId)
  revalidatePath("/admin/orders")
  revalidatePath("/admin/tickets")
  return result
}

/**
 * Regenerate A6 PDF tickets for an order and re-send the confirmation email.
 * Force-regenerates the combined PDF using the current A6 template,
 * regardless of existing pdfVersion. Updates delivery metadata.
 */
export async function regeneratePdfAction(orderId: string) {
  const session = await requireAdmin()

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw new Error("Order not found")
  if (order.status !== "paid" && order.status !== "completed") {
    throw new Error("Order must be paid or completed to regenerate tickets")
  }

  if (!order.guestEmail) {
    throw new Error("Order has no guest email to send to")
  }

  const baseUrl = getBaseUrl()

  // 1. Load ticket records
  const ticketRecords = await db
    .select({ id: tickets.id, qrCode: tickets.qrCode, tierId: tickets.tierId })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))

  if (ticketRecords.length === 0) {
    throw new Error("No ticket records found for this order. Use Send Tickets first.")
  }

  // 2. Load event + order details
  const [ev] = await db
    .select({ title: events.title, startsAt: events.startsAt, venue: events.venue })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)

  if (!ev) throw new Error("Event not found")

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

  // 3. Generate QR image data for all tickets (fresh A6 layout)
  const qrMap = new Map<string, string>()
  for (const t of ticketRecords) {
    try {
      qrMap.set(t.id, await generateTicketQrImageDataUrl(t.qrCode, t.id, orderId, baseUrl))
    } catch {
      // Keep the slot empty so the PDF renderer shows an unavailable QR.
    }
  }

  // 4. Build tier name map
  const tierRows = await db
    .select({ id: ticketTiers.id, name: ticketTiers.name })
    .from(ticketTiers)
    .where(inArray(ticketTiers.id, [...new Set(ticketRecords.map((t) => t.tierId).filter(Boolean))]))

  const tierNameMap = new Map(tierRows.map((t) => [t.id, t.name]))

  // 5. Generate combined A6 PDF (with fallback — send email even if PDF fails)
  let attachments: { filename: string; content: Buffer | string; contentType: string }[] | undefined
  try {
    const pdfTickets = ticketRecords.map((t) => ({
      eventTitle: ev.title,
      eventStartsAt: ev.startsAt,
      venue: ev.venue,
      tierName: tierNameMap.get(t.tierId) ?? "General Admission",
      buyerName: order.guestName ?? "Valued Guest",
      orderId,
      ticketId: t.id,
      qrCodeData: qrMap.get(t.id) ?? "",
    }))
    const pdfBuffer = await generateCombinedTicketPdf(pdfTickets)
    attachments = [{
      filename: `tickets-${orderId.slice(0, 8)}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf" as const,
    }]
  } catch (err) {
    log.warn("regeneratePdfAction - PDF generation failed (email will still be sent)", {
      orderId,
      error: String(err),
    })
  }

  // 6. Send email with regenerated PDF
  try {
    await sendOrderConfirmationEmail({
      to: order.guestEmail,
      buyerName: order.guestName,
      orderId,
      eventTitle: ev.title,
      eventDate,
      eventVenue: ev.venue ?? undefined,
      lines,
      total: String(order.totalAmount ?? "0"),
      currency: order.currency ?? "USD",
      ticketUrl: generateOrderAccessUrl(orderId, baseUrl),
      attachments,
    })
  } catch (err) {
    log.error("regeneratePdfAction - email send failed", {
      orderId,
      error: String(err),
    })
    throw new Error(`PDF regenerated but email delivery failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 7. Update delivery metadata with pdfVersion
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const delivery = (meta.delivery ?? {}) as Record<string, unknown>
  await db
    .update(orders)
    .set({
      metadata: {
        ...meta,
        delivery: {
          ...delivery,
          pdfVersion: "A6_V2",
          emailSentAt: new Date().toISOString(),
          emailSentTo: order.guestEmail,
          emailError: null,
          deliveryAttempts: ((delivery.deliveryAttempts as number) ?? 0) + 1,
          lastDeliveryAttemptAt: new Date().toISOString(),
          status: "EMAIL_SENT",
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))

  log.info("regeneratePdfAction - completed", {
    orderId,
    ticketCount: ticketRecords.length,
    pdfVersion: "A6_V2",
    emailSent: true,
  })

  revalidatePath("/admin/orders")
}

/**
 * Permanently delete an order and all associated records.
 * Only admins can call this. Irreversible.
 */
export async function deleteOrderAction(orderId: string) {
  const session = await requireAdmin()

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw new Error("Order not found")

  // Import additional table references before the transaction
  const { photoDownloads } = await import("@/db/schema")

  // Wrap all deletion in a single transaction so a failure mid-way rolls
  // everything back and leaves the database in a consistent state.
  await db.transaction(async (tx) => {
    await tx.delete(paymentLedger).where(eq(paymentLedger.orderId, orderId))

    // Break FK references that don't have ON DELETE CASCADE / SET NULL
    await tx
      .update(photoDownloads)
      .set({ orderId: null })
      .where(eq(photoDownloads.orderId, orderId))

    // Delete tickets and order items
    await tx.delete(tickets).where(eq(tickets.orderId, orderId))
    await tx.delete(orderItems).where(eq(orderItems.orderId, orderId))

    // Delete the order itself (cascades ticketQuestionResponses,
    // sets null on analyticsEvents)
    await tx.delete(orders).where(eq(orders.id, orderId))
  })

  log.info("admin - order deleted", { orderId, deletedBy: session.user.id })

  await recordAdminAction(session, { action: "order.delete", targetType: "order", targetId: orderId, before: { existed: true }, after: { deleted: true } })

  revalidatePath("/admin/orders")
  revalidatePath("/admin")
}

export async function sendWhatsAppTicketAction(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdmin()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
  const internalKey = process.env.INTERNAL_API_KEY
  try {
    const res = await fetch(`${appUrl}/api/whatsapp/send-ticket`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(internalKey ? { "x-internal-key": internalKey } : {}),
      },
      body: JSON.stringify({ orderId, mode: "manual_resend" }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) return { ok: false, error: data.error ?? "WhatsApp send failed" }
    log.info("admin - whatsapp ticket resent", { orderId, by: session.user.id })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" }
  }
}
