import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders, events, orderItems, ticketTiers } from "@/db/schema"
import { sendOrderConfirmationEmail } from "@/lib/email"
import { rateLimit } from "@/lib/rate-limit"

type Params = { id: string }

// 3 resends per order per hour — keyed by orderId so cron/admin updates
// don't interfere with the buyer's cooldown window
const resendLimiter = rateLimit({ windowMs: 60_000 * 60, max: 3 })

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const rl = resendLimiter.check(id)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many resend requests for this order. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

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

  } catch (err) {
    console.error("[resend-tickets] failed to send:", err)
    return NextResponse.json(
      { error: "Failed to send email. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, sentTo: order.guestEmail })
}
