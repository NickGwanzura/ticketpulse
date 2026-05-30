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

  // ── Awaiting verification → resend magic link ───────────────────────────
  if (order.status === "awaiting_verification") {
    const finalizeUrl = `${appUrl}/api/orders/${orderId}/finalize`

    await signIn("resend", {
      email: recipient,
      redirectTo: finalizeUrl,
      redirect: false,
    })

    await db
      .update(orders)
      .set({ verificationSentAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    revalidatePath("/admin/orders")
    return
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
    })

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

  // Update the order status
  await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(orders.id, orderId))

  // Find all ticket records tied to this order and mark them as cancelled
  const orderTickets = await db
    .select({ id: tickets.id, tierId: tickets.tierId })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))

  if (orderTickets.length > 0) {
    const ticketIds = orderTickets.map((t) => t.id)
    const tierIds = [...new Set(orderTickets.map((t) => t.tierId).filter(Boolean))]

    await db
      .update(tickets)
      .set({ status: "cancelled" })
      .where(inArray(tickets.id, ticketIds))

    // Restore inventory for each affected tier
    for (const tierId of tierIds) {
      const cancelledCount = orderTickets.filter((t) => t.tierId === tierId).length
      await db
        .update(ticketTiers)
        .set({
          soldQuantity: sql`${ticketTiers.soldQuantity} - ${cancelledCount}`,
        })
        .where(eq(ticketTiers.id, tierId))
    }
  }

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

  await db
    .update(orders)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(eq(orders.id, orderId))

  const orderTickets = await db
    .select({ id: tickets.id, tierId: tickets.tierId })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))

  if (orderTickets.length > 0) {
    const ticketIds = orderTickets.map((t) => t.id)
    const tierIds = [...new Set(orderTickets.map((t) => t.tierId).filter(Boolean))]

    await db
      .update(tickets)
      .set({ status: "refunded" })
      .where(inArray(tickets.id, ticketIds))

    for (const tierId of tierIds) {
      const refundedCount = orderTickets.filter((t) => t.tierId === tierId).length
      await db
        .update(ticketTiers)
        .set({
          soldQuantity: sql`${ticketTiers.soldQuantity} - ${refundedCount}`,
        })
        .where(eq(ticketTiers.id, tierId))
    }
  }

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

  // Clean up related records in dependency order
  await db.delete(paymentLedger).where(eq(paymentLedger.orderId, orderId))

  // Break FK references that don't have ON DELETE CASCADE
  const { transportBookings, photoDownloads, analyticsEvents } = await import("@/db/schema")
  await db
    .update(transportBookings)
    .set({ orderId: null })
    .where(eq(transportBookings.orderId, orderId))
  await db
    .update(photoDownloads)
    .set({ orderId: null })
    .where(eq(photoDownloads.orderId, orderId))

  // Delete tickets and order items
  await db.delete(tickets).where(eq(tickets.orderId, orderId))
  await db.delete(orderItems).where(eq(orderItems.orderId, orderId))

  // Delete the order itself (cascades ticketQuestionResponses, sets null on analyticsEvents)
  await db.delete(orders).where(eq(orders.id, orderId))

  log.info("admin - order deleted", { orderId, deletedBy: session.user.id })

  revalidatePath("/admin/orders")
  revalidatePath("/admin")
}
