"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { events, orderItems, orders, ticketTiers } from "@/db/schema"
import { sendEmail, sendOrderConfirmationEmail } from "@/lib/email"
import { generateOrderAccessUrl } from "@/lib/tickets"
import { createOrderRecoveryToken, verifyOrderRecoveryToken } from "@/lib/order-recovery-token"
import { rateLimit } from "@/lib/rate-limit"
import { headers } from "next/headers"
import { getBaseUrl } from "@/lib/url-config"
import { log } from "@/lib/logger"
import { z } from "zod"
const recoveryLimiter = rateLimit({ windowMs: 15 * 60_000, max: 3 })
export async function requestOrderRecoveryAction(formData: FormData) {
  const parsed = z.string().trim().email().max(254).safeParse(formData.get("email"))
  if (!parsed.success) redirect("/orders/lookup?error=missing_email")
  const email = parsed.data.toLowerCase()
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const [addressLimit, ipLimit] = await Promise.all([
    recoveryLimiter.checkDistributed("recovery-email:" + email), recoveryLimiter.checkDistributed("recovery-ip:" + ip),
  ])
  if (addressLimit.allowed && ipLimit.allowed) {
    try {
      const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.guestEmail, email)).limit(1)
      if (order) {
        const url = getBaseUrl() + "/orders/lookup?token=" + encodeURIComponent(createOrderRecoveryToken(email))
        await sendEmail({ to: email, subject: "Your secure TicketPulse order link", text: "View your orders: " + url + "\nThis link expires in 15 minutes. If you did not request it, ignore this email.", html: '<p>View your TicketPulse orders using this secure link:</p><p><a href="' + url + '">View my orders</a></p><p>This link expires in 15 minutes. If you did not request it, ignore this email.</p>' })
      }
    } catch (error) { log.error("Order recovery email failed", { error: String(error) }) }
  }
  redirect("/orders/lookup?requested=1")
}

export async function resendLookupTicketsAction(orderId: string, token: string) {
  const normalizedEmail = verifyOrderRecoveryToken(token)
  if (!normalizedEmail) redirect("/orders/lookup?error=expired_link")
  const limited = await recoveryLimiter.checkDistributed("resend:" + normalizedEmail + ":" + orderId)
  if (!limited.allowed) redirect("/orders/lookup?error=too_many_requests")
  const redirectTo = (params: Record<string, string>) => {
    const search = new URLSearchParams({ token, ...params })
    redirect(`/orders/lookup?${search.toString()}`)
  }

  if (!normalizedEmail) redirectTo({ error: "missing_email" })

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order || order.guestEmail?.toLowerCase() !== normalizedEmail) {
    redirectTo({ error: "not_found" })
  }

  if (order.status !== "paid" && order.status !== "completed") {
    redirectTo({ error: "not_ready" })
  }

  const [event] = await db
    .select({
      title: events.title,
      startsAt: events.startsAt,
      venue: events.venue,
    })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)

  if (!event) redirectTo({ error: "event_missing" })

  const items = await db
    .select({
      qty: orderItems.quantity,
      total: orderItems.total,
      tierName: ticketTiers.name,
    })
    .from(orderItems)
    .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
    .where(eq(orderItems.orderId, orderId))

  const eventDate = event.startsAt
    ? new Date(event.startsAt).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "TBA"

  await sendOrderConfirmationEmail({
    to: order.guestEmail!,
    buyerName: order.guestName,
    orderId,
    eventTitle: event.title,
    eventDate,
    eventVenue: event.venue ?? undefined,
    lines: items.map((item) => ({
      label: item.tierName ?? "Ticket",
      qty: item.qty,
      amount: `${item.total} ${order.currency ?? "USD"}`,
    })),
    total: String(order.totalAmount ?? "0"),
    currency: order.currency ?? "USD",
    ticketUrl: generateOrderAccessUrl(orderId),
  })

  redirectTo({ sent: orderId.slice(0, 8) })
}
