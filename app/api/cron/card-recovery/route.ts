import { NextResponse } from "next/server"
import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders, events } from "@/db/schema"
import { verifyCronSecret } from "@/lib/cron-auth"
import { sendEmail } from "@/lib/email"
import { log } from "@/lib/logger"

/**
 * Sends a recovery email to buyers whose card-redirect payment has been pending
 * for 15+ min. Marks orders so the email is only sent once. In practice the
 * window is 15–30 min, since expire-orders expires pending orders after 30 min.
 */
export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const now = Date.now()
  const minAge = new Date(now - 15 * 60 * 1000)      // > 15 min old
  const maxAge = new Date(now - 23 * 60 * 60 * 1000) // < 23 h old (expire-orders gets the rest)

  const stale = await db
    .select({
      id: orders.id,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      eventId: orders.eventId,
      metadata: orders.metadata,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.paymentMethod, "velocity-card"),
        isNotNull(orders.guestEmail),
        lte(orders.createdAt, minAge),
        gte(orders.createdAt, maxAge),
      ),
    )
    .limit(50)

  if (stale.length === 0) return NextResponse.json({ sent: 0 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
  const eventIds = [...new Set(stale.map((o) => o.eventId))]
  const eventRows = await db
    .select({ id: events.id, title: events.title, slug: events.slug })
    .from(events)
    .where(inArray(events.id, eventIds))
  const eventMap = new Map(eventRows.map((e) => [e.id, e]))

  let sent = 0
  const toMark: string[] = []

  for (const order of stale) {
    const meta = (order.metadata ?? {}) as Record<string, unknown>
    if (meta.cardRecoveryEmailSent) continue

    const ev = eventMap.get(order.eventId)
    const eventTitle = ev?.title ?? "your event"
    const name = order.guestName ?? "there"
    const orderUrl = `${appUrl}/orders/${order.id}`
    const eventUrl = ev?.slug ? `${appUrl}/events/${ev.slug}` : null

    try {
      await sendEmail({
        to: order.guestEmail!,
        subject: `Still processing your payment — ${eventTitle}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Your payment is still being processed</h2>
<p>Hi ${name},</p>
<p>We noticed you started checkout for <strong>${eventTitle}</strong> but haven't received payment confirmation yet.</p>
<p>If your card was charged, your tickets will be delivered automatically once the payment clears. You can check your order status here:</p>
<p style="margin:16px 0">
  <a href="${orderUrl}" style="display:inline-block;background:#0a2540;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Check order status →</a>
</p>
<p>If the payment failed and you'd like to try again${eventUrl ? `:` : "."}</p>
${eventUrl ? `<p><a href="${eventUrl}" style="color:#0a2540;font-weight:600">Get tickets for ${eventTitle} →</a></p>` : ""}
<p style="color:#6b7280;font-size:13px;margin-top:24px">Reference: <code style="background:#f4f4f5;padding:2px 6px;border-radius:4px">${order.id.slice(0, 8).toUpperCase()}</code></p>
<p style="color:#6b7280;font-size:13px">TicketPulse &middot; <a href="mailto:nick@ticketpulse.tech" style="color:#6b7280">nick@ticketpulse.tech</a></p>
</div>`,
        text: `Hi ${name},\n\nWe noticed you started checkout for ${eventTitle} but haven't received payment confirmation.\n\nIf your card was charged, tickets will be delivered once payment clears.\n\nCheck your order: ${orderUrl}\n\nReference: ${order.id.slice(0, 8).toUpperCase()}\n\nTicketPulse`,
      })
      sent++
      toMark.push(order.id)
    } catch (err) {
      log.warn("cron/card-recovery — email failed", { orderId: order.id, error: String(err) })
    }
  }

  // Mark sent so we don't re-send on the next tick
  if (toMark.length > 0) {
    await Promise.all(
      toMark.map((id) =>
        db.execute(
          sql`UPDATE orders SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{cardRecoveryEmailSent}', 'true') WHERE id = ${id}`,
        ).catch((err) => log.warn("cron/card-recovery — metadata update failed", { id, error: String(err) })),
      ),
    )
  }

  log.info("cron/card-recovery — done", { sent, total: stale.length })
  return NextResponse.json({ sent, total: stale.length })
}
