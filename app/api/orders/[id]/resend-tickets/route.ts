import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders, events, orderItems, ticketTiers } from "@/db/schema"
import { sendOrderConfirmationEmail } from "@/lib/email"

type Params = { id: string }

const RESEND_COOLDOWN_MS = 60 * 1000 // 1 minute between resends per order

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1)

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.status !== "paid" && order.status !== "completed") {
    return NextResponse.json(
      { error: `Cannot resend tickets for order with status "${order.status}".` },
      { status: 409 },
    )
  }

  if (!order.guestEmail) {
    return NextResponse.json(
      { error: "Order has no guest email on file." },
      { status: 400 },
    )
  }

  // Simple cooldown to prevent spam
  if (
    order.updatedAt &&
    Date.now() - order.updatedAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return NextResponse.json(
      { error: "Please wait a moment before resending." },
      { status: 429 },
    )
  }

  const [ev] = await db
    .select({
      title: events.title,
      startsAt: events.startsAt,
      venue: events.venue,
    })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)

  if (!ev) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const items = await db
    .select({
      qty: orderItems.quantity,
      total: orderItems.total,
      tierName: ticketTiers.name,
    })
    .from(orderItems)
    .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
    .where(eq(orderItems.orderId, id))

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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

  try {
    await sendOrderConfirmationEmail({
      to: order.guestEmail,
      buyerName: order.guestName,
      orderId: id,
      eventTitle: ev.title,
      eventDate,
      eventVenue: ev.venue ?? undefined,
      lines,
      total: String(order.totalAmount ?? "0"),
      currency: order.currency ?? "USD",
      ticketUrl: `${appUrl}/orders/${id}`,
    })

    // ── WhatsApp ticket resend (non-blocking) ──────────────────────────
    if (order.guestPhone) {
      const origin = new URL(req.url).origin
      fetch(`${origin}/api/whatsapp/send-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      }).catch((err) =>
        console.error("[resend-tickets] failed to send WhatsApp:", err),
      )
    }

    // Update updatedAt to enforce cooldown on subsequent resends
    await db
      .update(orders)
      .set({ updatedAt: new Date() })
      .where(eq(orders.id, id))
  } catch (err) {
    console.error("[resend-tickets] failed to send:", err)
    return NextResponse.json(
      { error: "Failed to send email. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, sentTo: order.guestEmail })
}
