"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { auth, signIn } from "@/auth"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, users } from "@/db/schema"
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
