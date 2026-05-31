"use server"

import { revalidatePath } from "next/cache"
import { eq, and, inArray, or, sql } from "drizzle-orm"

import { auth, signIn } from "@/auth"
import { db } from "@/db"
import { events, orders, orderItems, paymentLedger, ticketTiers, tickets, users } from "@/db/schema"
import {
  sendEmail,
  adminEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email"
import { eventPublishedNotificationEmail } from "@/lib/email-templates"
import { log } from "@/lib/logger"
import { generateQrDataUrl, generateCombinedTicketPdf } from "@/lib/tickets"
import { getBaseUrl } from "@/lib/url-config"
import type { VelocityOrderMetadata } from "@/types/velocity"

export async function resendOrderEmailAction(orderId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

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
      "Magic links have been removed. Use "Recover & Send Tickets" from the order detail page to resolve this order.",
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
      ? new Date(ev.startsAt).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
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

        // Regenerate QR data URLs
        const qrMap = new Map<string, string>()
        for (const t of ticketRecords) {
          let qrCode = t.qrCode
          if (!qrCode || !qrCode.startsWith("data:image")) {
            try {
              qrCode = await generateQrDataUrl(t.id, orderId, baseUrl)
            } catch {
              qrCode = `${orderId}-${t.id}`
            }
          }
          qrMap.set(t.id, qrCode)
        }

        const pdfTickets = ticketRecords.map((t) => ({
          eventTitle: ev.title,
          tierName: tierNameMap.get(t.tierId) ?? "General Admission",
          buyerName: order.guestName ?? "Valued Guest",
          orderId,
          ticketId: t.id,
          qrCodeData: qrMap.get(t.id) ?? `${orderId}-${t.id}`,
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
      ticketUrl: `${appUrl}/orders/${orderId}`,
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
              pdfVersion: "A6_V1",
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
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

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
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

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

  revalidatePath("/admin/tickets")
  revalidatePath("/admin/orders")
  revalidatePath("/admin")
}

/**
 * Deliver tickets for a paid order.
 * Wraps lib/delivery.ts for use as a server action from the admin UI.
 */

export async function markOrderCompleteAction(orderId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const { markOrderCompleteAction: completeAction } = await import("@/lib/order-recovery")
  return completeAction(orderId, session.user.id, session.user.email ?? "admin")
}

/**
 * Send tickets for an order — regenerates missing records and delivers via email.
 */
export async function sendTicketsAction(orderId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const { sendTicketsAction: sendAction } = await import("@/lib/order-recovery")
  return sendAction(orderId)
}

/**
 * Complete order and send tickets in one idempotent action.
 */
export async function completeAndSendAction(orderId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const { completeAndSendAction: combinedAction } = await import("@/lib/order-recovery")
  return combinedAction(orderId, session.user.id, session.user.email ?? "admin")
}

export async function refundOrderAction(orderId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
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
  })

  revalidatePath("/admin/tickets")
  revalidatePath("/admin/orders")
  revalidatePath("/admin")
}

export async function deliverTicketAction(orderId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

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
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

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
    ? new Date(ev.startsAt).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "TBA"

  // 3. Regenerate QR codes for all tickets (fresh A6 layout)
  const qrMap = new Map<string, string>()
  let qrCodesRegenerated = false
  for (const t of ticketRecords) {
    let qrCode = t.qrCode
    if (!qrCode || !qrCode.startsWith("data:image")) {
      try {
        qrCode = await generateQrDataUrl(t.id, orderId, baseUrl)
        qrCodesRegenerated = true
      } catch {
        qrCode = `${orderId}-${t.id}`
      }
    }
    qrMap.set(t.id, qrCode)
  }

  // Save regenerated QR codes
  if (qrCodesRegenerated) {
    for (const t of ticketRecords) {
      const qr = qrMap.get(t.id)
      if (qr && qr !== t.qrCode && qr.startsWith("data:image")) {
        await db.update(tickets).set({ qrCode: qr }).where(eq(tickets.id, t.id))
      }
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
      tierName: tierNameMap.get(t.tierId) ?? "General Admission",
      buyerName: order.guestName ?? "Valued Guest",
      orderId,
      ticketId: t.id,
      qrCodeData: qrMap.get(t.id) ?? `${orderId}-${t.id}`,
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
      ticketUrl: `${baseUrl}/orders/${orderId}`,
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
          pdfVersion: "A6_V1",
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
    pdfVersion: "A6_V1",
    emailSent: true,
  })

  revalidatePath("/admin/orders")
}

/**
 * Permanently delete an order and all associated records.
 * Only admins can call this. Irreversible.
 */
export async function deleteOrderAction(orderId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw new Error("Order not found")

  // Import additional table references before the transaction
  const { transportBookings, photoDownloads } = await import("@/db/schema")

  // Wrap all deletion in a single transaction so a failure mid-way rolls
  // everything back and leaves the database in a consistent state.
  await db.transaction(async (tx) => {
    await tx.delete(paymentLedger).where(eq(paymentLedger.orderId, orderId))

    // Break FK references that don't have ON DELETE CASCADE / SET NULL
    await tx
      .update(transportBookings)
      .set({ orderId: null })
      .where(eq(transportBookings.orderId, orderId))
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

  revalidatePath("/admin/orders")
  revalidatePath("/admin")
}
