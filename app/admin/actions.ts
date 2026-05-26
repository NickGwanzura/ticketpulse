"use server"

import { revalidatePath } from "next/cache"
import { eq, inArray, sql } from "drizzle-orm"

import { auth, signIn } from "@/auth"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, tickets, users } from "@/db/schema"
import {
  sendEmail,
  adminEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email"
import { eventPublishedNotificationEmail } from "@/lib/email-templates"

/**
 * Toggle an event between "draft" and "published".
 * Only admins can call this.
 */
export async function publishEventAction(eventId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [ev] = await db
    .select({
      id: events.id,
      status: events.status,
      title: events.title,
      startsAt: events.startsAt,
      slug: events.slug,
      organizerId: events.organizerId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!ev) throw new Error("Event not found")

  const newStatus = ev.status === "published" ? "draft" : "published"

  await db
    .update(events)
    .set({ status: newStatus })
    .where(eq(events.id, eventId))

  // ── Notify organiser when their event is published ──────────────────────
  if (newStatus === "published") {
    const eventUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/events/${ev.slug}`
    const eventDate = ev.startsAt
      ? new Date(ev.startsAt).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "TBA"

    // Notify the organiser
    try {
      const [org] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, ev.organizerId))
        .limit(1)

      if (org?.email) {
        const { html, text } = eventPublishedNotificationEmail({
          eventTitle: ev.title,
          eventDate,
          eventUrl,
          organizerName: org.name,
        })
        await sendEmail({
          to: org.email,
          subject: `🎉 ${ev.title} is now live`,
          html,
          text,
        })
      }
    } catch (err) {
      console.error("[publishEvent] failed to notify organiser:", err)
    }

    // Notify the admin
    try {
      const { html, text } = eventPublishedNotificationEmail({
        eventTitle: ev.title,
        eventDate,
        eventUrl,
        organizerName: session.user.name,
      })
      await sendEmail({
        to: adminEmail,
        subject: `🎉 ${ev.title} is now live`,
        html,
        text,
      })
    } catch (err) {
      console.error("[publishEvent] failed to notify admin:", err)
    }

    // WhatsApp alert to admin (fire-and-forget).
    try {
      const { sendAdminAlert } = await import("@/lib/whatsapp")
      await sendAdminAlert(
        `🎉 *Event published*\n\nTitle: ${ev.title}\nDate: ${eventDate}\nURL: ${eventUrl}\n\nView in admin: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/admin/events`,
      )
    } catch (err) {
      console.error("[publishEvent] failed to send admin WhatsApp alert:", err)
    }
  }

  revalidatePath("/admin/events")
  revalidatePath("/admin")
}

/**
 * Verify a user's email (set emailVerified to now).
 */
export async function verifyUserEmailAction(userId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, userId))

  revalidatePath("/admin/users")
  revalidatePath("/admin")
}

/**
 * Unverify a user's email (set emailVerified to null).
 */
export async function unverifyUserEmailAction(userId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  await db
    .update(users)
    .set({ emailVerified: null })
    .where(eq(users.id, userId))

  revalidatePath("/admin/users")
  revalidatePath("/admin")
}

/**
 * Resend the order confirmation or verification email for an order.
 *
 * - Paid orders: resends the branded ticket confirmation email.
 * - Awaiting-verification orders: resends the verification magic link.
 * - Other statuses: throws an error.
 */
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
export async function updateCommissionRateAction(userId: string, rate: number) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  // Clamp to 0–100, round to 2 decimals
  const clamped = Math.min(100, Math.max(0, Math.round(rate * 100) / 100))

  await db
    .update(users)
    .set({ commissionRate: String(clamped) })
    .where(eq(users.id, userId))

  revalidatePath("/admin/users")
  revalidatePath("/admin")
}

/**
 * Cancel an order and mark all its tickets as cancelled.
 * Only admins can call this. Restores ticket tier inventory by decrementing
 * soldQuantity for each affected tier.
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
