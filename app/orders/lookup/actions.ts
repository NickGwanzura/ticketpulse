"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { events, orderItems, orders, ticketTiers } from "@/db/schema"
import { sendOrderConfirmationEmail } from "@/lib/email"
import { generateOrderAccessUrl } from "@/lib/tickets"

export async function resendLookupTicketsAction(orderId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const redirectTo = (params: Record<string, string>) => {
    const search = new URLSearchParams({ email: normalizedEmail, ...params })
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
