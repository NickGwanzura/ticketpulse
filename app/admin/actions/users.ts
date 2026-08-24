"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { signIn } from "@/auth"
import { requireAdmin } from "@/lib/auth-guard"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, users } from "@/db/schema"
import { sendOrderConfirmationEmail } from "@/lib/email"
import { PLATFORM_FEE_PERCENT } from "@/lib/platform-fee"

export async function verifyUserEmailAction(userId: string) {
  await requireAdmin()

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, userId))

  revalidatePath("/admin/users")
  revalidatePath("/admin")
}

/**
 * Update a user's role. Admins can set any role except "admin" itself
 * (admin accounts must be created via the database directly).
 */
export async function updateUserRoleAction(userId: string, newRole: string) {
  await requireAdmin()

  const allowedRoles = ["attendee", "organizer", "vendor"] as const
  if (!allowedRoles.includes(newRole as typeof allowedRoles[number])) {
    throw new Error(`Invalid role: "${newRole}"`)
  }

  await db
    .update(users)
    .set({ role: newRole as typeof users.$inferInsert.role, updatedAt: new Date() })
    .where(eq(users.id, userId))

  revalidatePath("/admin/users")
  revalidatePath("/admin")
}

/**
 * Unverify a user's email (set emailVerified to null).
 */
export async function unverifyUserEmailAction(userId: string) {
  await requireAdmin()

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
  await requireAdmin()

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
export async function updateCommissionRateAction(userId: string, rate: number) {
  await requireAdmin()

  if (rate !== PLATFORM_FEE_PERCENT) {
    throw new Error(`TicketPulse commission is fixed at ${PLATFORM_FEE_PERCENT}%`)
  }

  await db
    .update(users)
    .set({ commissionRate: PLATFORM_FEE_PERCENT.toFixed(2) })
    .where(eq(users.id, userId))

  revalidatePath("/admin/users")
  revalidatePath("/admin")
}

/**
 * Approve an organizer account, allowing them to create events.
 * Sets approvedAt to the current time. No-op if already approved.
 */
export async function approveOrganizerAction(userId: string) {
  await requireAdmin()

  const [organizer] = await db
    .select({ email: users.email, name: users.name, approvedAt: users.approvedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  await db
    .update(users)
    .set({ approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId))

  // Send approval email (fire-and-forget — don't block the admin action)
  if (organizer?.email && !organizer.approvedAt) {
    const { sendEmail } = await import("@/lib/email")
    const { organizerApprovedEmail } = await import("@/lib/email-templates")
    const tpl = organizerApprovedEmail({ name: organizer.name })
    sendEmail({
      to: organizer.email,
      subject: "You're approved — start creating events on TicketPulse",
      html: tpl.html,
      text: tpl.text,
    }).catch((e) => {
      console.error("[admin] organizer approval email failed", e)
    })
  }

  revalidatePath("/admin/users")
  revalidatePath("/admin/organizers")
  revalidatePath("/admin")
}

/**
 * Reject/unapprove an organizer account (sets approvedAt to null).
 */
export async function rejectOrganizerAction(userId: string) {
  await requireAdmin()

  const [organizer] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  await db
    .update(users)
    .set({ approvedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId))

  if (organizer?.email) {
    const { sendEmail } = await import("@/lib/email")
    const { organizerRejectedEmail } = await import("@/lib/email-templates")
    const tpl = organizerRejectedEmail({ name: organizer.name })
    sendEmail({
      to: organizer.email,
      subject: "Update on your TicketPulse organizer application",
      html: tpl.html,
      text: tpl.text,
    }).catch((e) => {
      console.error("[admin] organizer rejection email failed", e)
    })
  }

  revalidatePath("/admin/users")
  revalidatePath("/admin/organizers")
  revalidatePath("/admin")
}

/**
 * Cancel an order and mark all its tickets as cancelled.
 * Only admins can call this. Restores ticket tier inventory by decrementing
 * soldQuantity for each affected tier.
 */
