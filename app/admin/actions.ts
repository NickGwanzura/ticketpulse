"use server"

import { revalidatePath } from "next/cache"
import { eq, inArray, or, sql } from "drizzle-orm"

import { auth, signIn } from "@/auth"
import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, tickets, users } from "@/db/schema"
import {
  sendEmail,
  adminEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email"
import { eventPublishedNotificationEmail } from "@/lib/email-templates"
import type { VelocityOrderMetadata } from "@/types/velocity"

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

// ── Communication types -------------------------------------------------------

interface CommunicationResult {
  channel: "email" | "whatsapp"
  target: string
  success: boolean
  error?: string
}

/**
 * Send a blast email / WhatsApp to all users matching the target role.
 *
 * Returns an array of results (one per recipient per channel).
 */
export async function sendCommunicationAction(
  formData: FormData,
): Promise<CommunicationResult[]> {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const subject = formData.get("subject") as string
  const body = formData.get("body") as string
  const audience = formData.get("audience") as string
  const channelsRaw = formData.get("channels") as string

  if (!subject?.trim() || !body?.trim()) {
    throw new Error("Subject and body are required")
  }

  const channels = channelsRaw.split(",").filter(Boolean)
  const results: CommunicationResult[] = []

  // ── Fetch target users ──────────────────────────────────────────────────
  let targetUsers: { id: string; name: string | null; email: string | null; phone: string | null }[]

  if (audience === "attendees") {
    targetUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.role, "attendee"))
  } else if (audience === "organizers") {
    targetUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users)
      .where(
        or(eq(users.role, "organizer"), eq(users.role, "admin")),
      )
  } else {
    targetUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users)
  }

  if (targetUsers.length === 0) {
    throw new Error("No users found for the selected audience")
  }

  // ── Email ───────────────────────────────────────────────────────────────
  if (channels.includes("email")) {
    const mailRecipients = targetUsers.filter((u) => u.email)

    const personaliseBody = (name: string | null) => {
      const first = name?.split(" ")[0]?.trim()
      return body.replace(/\{name\}/g, first ?? "there").replace(/\{audience\}/g, audience)
    }

    for (const u of mailRecipients) {
      try {
        const personalised = personaliseBody(u.name)
        const { html, text } = (() => {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
          const paragraphs = personalised
            .split("\n")
            .filter(Boolean)
            .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#384151;">${p.replace(/<[^>]*>/g, "")}</p>`)
            .join("")
          const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#F6F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B1220;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F6F9FC;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
      <tr><td style="padding-bottom:8px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${appUrl}/logo.svg" alt="TicketPulse" width="32" height="32" style="display:block;outline:none;border:none;border-radius:6px;" />
          </td>
          <td style="vertical-align:middle;"><span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#0B1220;">TicketPulse</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#FFFFFF;border:1px solid #E6ECF2;border-radius:16px;padding:32px 28px;box-shadow:0 1px 2px rgba(11,18,32,0.04);">
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;line-height:1.2;letter-spacing:-0.02em;color:#0B1220;">${subject}</h1>
        <div style="font-size:15px;line-height:24px;color:#384151;">${paragraphs}</div>
      </td></tr>
      <tr><td style="padding:20px 4px 0;">
        <hr style="border:none;border-top:1px solid #E6ECF2;margin:0 0 16px;" />
        <p style="margin:0;font-size:12px;line-height:18px;color:#6B7280;">TicketPulse &middot; Harare, Zimbabwe &middot; <a href="${appUrl}" style="color:#384151;text-decoration:underline;">ticketpulse.tech</a></p>
        <p style="margin:6px 0 0;font-size:12px;line-height:18px;color:#6B7280;">You are receiving this because of activity on your TicketPulse account.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`
          return { html, text: personalised }
        })()

        await sendEmail({ to: u.email!, subject, html, text })
        results.push({ channel: "email", target: u.email!, success: true })
      } catch (err) {
        results.push({
          channel: "email",
          target: u.email ?? "unknown",
          success: false,
          error: err instanceof Error ? err.message : "unknown error",
        })
      }
    }
  }

  // ── WhatsApp ────────────────────────────────────────────────────────────
  if (channels.includes("whatsapp")) {
    const waRecipients = targetUsers.filter((u) => u.phone)

    for (const u of waRecipients) {
      try {
        const { sendText, formatChatId } = await import("@/lib/whatsapp")
        const first = u.name?.split(" ")[0]?.trim()
        const personalised = body
          .replace(/\{name\}/g, first ?? "there")
          .replace(/\{audience\}/g, audience)
        await sendText(formatChatId(u.phone!), `${subject}\n\n${personalised}`)
        results.push({ channel: "whatsapp", target: u.phone!, success: true })
      } catch (err) {
        results.push({
          channel: "whatsapp",
          target: u.phone ?? "unknown",
          success: false,
          error: err instanceof Error ? err.message : "unknown error",
        })
      }
    }
  }

  revalidatePath("/admin/communications")
  revalidatePath("/admin")

  return results
}

/**
 * Re-check a pending/awaiting_verification order against Velocity.
 * Polls the transaction and, if SUCCESS, re-finalizes the workflow.
 * If the order is already paid, returns early.
 *
 * This is the admin recovery tool for stuck transactions:
 * payments confirmed in Velocity but not reflected locally.
 */
export async function recheckPaymentAction(orderId: string): Promise<{ fixed: boolean; message: string; details?: Record<string, unknown> }> {
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

  // Already paid — nothing to do.
  if (order.status === "paid") {
    return { fixed: false, message: "Order is already paid." }
  }

  const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
  const velocityMeta = meta.velocity

  if (!velocityMeta?.transactionTrace || !velocityMeta?.salesOrderTrace) {
    return { fixed: false, message: "No Velocity transaction traces found on this order." }
  }

  const { pollTransaction, finalizeWorkflow, normalizeVelocityPollStatus } = await import("@/services/velocity")

  // ── Step 1: Poll the transaction ────────────────────────────────────────
  let pollResult
  try {
    pollResult = await pollTransaction(velocityMeta.transactionTrace)
  } catch (err) {
    return {
      fixed: false,
      message: `Failed to poll Velocity transaction: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const pollStatus = normalizeVelocityPollStatus(pollResult.body.pollStatus)

  if (pollStatus !== "SUCCESS") {
    return {
      fixed: false,
      message: `Payment status in Velocity is "${pollResult.body.pollStatus}" (normalized: "${pollStatus}"). Not confirmed yet.`,
      details: { pollStatus, paymentStatus: pollResult.body.paymentStatus, amount: pollResult.body.amount },
    }
  }

  // ── Step 2: Finalize the workflow ───────────────────────────────────────
  let finalizeResult
  try {
    finalizeResult = await finalizeWorkflow(velocityMeta.salesOrderTrace)
  } catch (err) {
    return {
      fixed: false,
      message: `Poll succeeded but workflow finalization failed: ${err instanceof Error ? err.message : String(err)}. You can retry.`,
      details: { pollStatus: "SUCCESS", salesOrderTrace: velocityMeta.salesOrderTrace },
    }
  }

  if (finalizeResult.body.salesOrder.status !== "PAID") {
    return {
      fixed: false,
      message: `Workflow finalization returned status "${finalizeResult.body.salesOrder.status}" instead of "PAID".`,
      details: {
        salesOrderStatus: finalizeResult.body.salesOrder.status,
        outstandingAmount: finalizeResult.body.salesOrder.outstandingAmount,
        paidAmount: finalizeResult.body.salesOrder.paidAmount,
      },
    }
  }

  const invoiceId = finalizeResult.body.invoice.id

  // ── Step 3: Update local DB ─────────────────────────────────────────────
  const finalMeta = {
    ...meta,
    velocity: {
      ...velocityMeta,
      pollStatus: "SUCCESS" as const,
      paymentRef: invoiceId,
      invoiceRef: invoiceId,
      finalizedAt: new Date().toISOString(),
      recheckedAt: new Date().toISOString(),
      recheckedBy: session.user.email,
    },
  }

  try {
    await db
      .update(orders)
      .set({
        status: "awaiting_verification",
        paidAt: new Date(),
        paymentRef: invoiceId,
        metadata: finalMeta,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
  } catch (err) {
    return {
      fixed: true,
      message: `Payment confirmed in Velocity and workflow finalized, but local DB update failed: ${err instanceof Error ? err.message : String(err)}. Please try again or check logs.`,
      details: { salesOrderTrace: velocityMeta.salesOrderTrace, invoiceId },
    }
  }

  // ── Step 4: Send verification email if not already done ─────────────────
  if (order.guestEmail && order.status !== "awaiting_verification") {
    try {
      const { startOrderVerification } = await import("@/lib/order-verification")
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
      await startOrderVerification({ orderId, email: order.guestEmail, origin })
    } catch {
      // Non-critical — email send failure won't block the fix.
    }
  }

  revalidatePath("/admin/orders")
  revalidatePath("/admin")

  return {
    fixed: true,
    message: `Payment confirmed, workflow finalized, order moved to awaiting_verification. Invoice: ${invoiceId}.`,
    details: { salesOrderTrace: velocityMeta.salesOrderTrace, invoiceId, pollStatus: "SUCCESS" },
  }
}

/**
 * Refund a paid order — marks order as refunded, all tickets as refunded,
 * and restores inventory for each affected tier.
 */
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
