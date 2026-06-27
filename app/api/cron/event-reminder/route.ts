import { NextResponse } from "next/server"
import { and, eq, gte, lt, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, orders, users } from "@/db/schema"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"
import { sendEventReminderEmail } from "@/lib/email"
import { formatChatId } from "@/lib/whatsapp"

const MAX_EVENTS_PER_RUN = 20
const REMINDER_WINDOW_HOURS = 1 // run every hour, look 23-25h ahead

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const now = new Date()
  const twentyThreeHoursFromNow = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  log.info("cron/event-reminder — starting run", {
    windowStart: twentyThreeHoursFromNow.toISOString(),
    windowEnd: twentyFiveHoursFromNow.toISOString(),
  })

  // ── 1. Find published events starting in ~24 hours ────────────────────────
  const upcomingEvents = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      startsAt: events.startsAt,
      venue: events.venue,
      organizerId: events.organizerId,
    })
    .from(events)
    .where(
      and(
        inArray(events.status, ["published", "sold_out"]),
        gte(events.startsAt, twentyThreeHoursFromNow),
        lt(events.startsAt, twentyFiveHoursFromNow),
      ),
    )
    .limit(MAX_EVENTS_PER_RUN)

  if (upcomingEvents.length === 0) {
    log.info("cron/event-reminder — no upcoming events in reminder window")
    return NextResponse.json({ checked: 0, sent: 0, errors: 0 })
  }

  log.info("cron/event-reminder — found upcoming events", {
    count: upcomingEvents.length,
    events: upcomingEvents.map((e) => ({ id: e.id, title: e.title })),
  })

  // ── 2. For each event, find paid orders and send reminders ────────────────
  let totalSent = 0
  let totalErrors = 0
  const results: Array<{ eventId: string; eventTitle: string; sent: number; errors: number }> = []

  for (const ev of upcomingEvents) {
    const eventDate = ev.startsAt.toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Harare",
    })

    // Find paid orders with phone or email that haven't been reminded yet
    const paidOrders = await db
      .select({
        id: orders.id,
        guestName: orders.guestName,
        guestEmail: orders.guestEmail,
        guestPhone: orders.guestPhone,
        metadata: orders.metadata,
      })
      .from(orders)
      .where(
        and(
          eq(orders.eventId, ev.id),
          inArray(orders.status, ["paid", "completed"]),
          // Skip orders that have already been sent a reminder
          sql`${orders.metadata}->>'reminderSent' IS DISTINCT FROM 'true'`,
        ),
      )

    if (paidOrders.length === 0) continue

    let eventSent = 0
    let eventErrors = 0

    for (const order of paidOrders) {
      const buyerName = order.guestName ?? undefined
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
      const ticketUrl = `${appUrl}/orders/${order.id}`
      let orderSent = 0
      let orderErrors = 0

      // WhatsApp reminder
      if (order.guestPhone) {
        try {
          const { sendText } = await import("@/lib/whatsapp")
          const { ticketConfirmationMessage } = await import("@/lib/whatsapp-templates")
          const message = ticketConfirmationMessage(
            ev.title,
            buyerName ?? "there",
            eventDate,
            ev.venue,
            order.id,
            "", // no item summary — this is a reminder
            ticketUrl,
          )
          await sendText(formatChatId(order.guestPhone), message)
          orderSent++
        } catch (err) {
          log.warn("cron/event-reminder — WhatsApp send failed", {
            orderId: order.id,
            eventId: ev.id,
            error: String(err),
          })
          orderErrors++
        }

        // SMS reminder (non-blocking — failure doesn't affect WhatsApp/email counts)
        try {
          const { sendEventReminderSms } = await import("@/lib/sms")
          await sendEventReminderSms(order.guestPhone)
        } catch (err) {
          log.warn("cron/event-reminder — SMS send failed", {
            orderId: order.id,
            eventId: ev.id,
            error: String(err),
          })
        }
      }

      // Email reminder
      if (order.guestEmail) {
        try {
          await sendEventReminderEmail({
            to: order.guestEmail,
            buyerName,
            eventTitle: ev.title,
            eventDate,
            eventVenue: ev.venue ?? undefined,
            ticketUrl,
          })
          orderSent++
        } catch (err) {
          log.warn("cron/event-reminder — email send failed", {
            orderId: order.id,
            eventId: ev.id,
            error: String(err),
          })
          orderErrors++
        }
      }

      // Mark order as reminded so it won't be picked up by future ticks
      if (orderSent > 0) {
        const meta = (order.metadata ?? {}) as Record<string, unknown>
        await db
          .update(orders)
          .set({ metadata: { ...meta, reminderSent: true }, updatedAt: new Date() })
          .where(eq(orders.id, order.id))
          .catch((err) => {
            log.warn("cron/event-reminder — failed to mark reminder sent", {
              orderId: order.id,
              error: String(err),
            })
          })
      }

      eventSent += orderSent
      eventErrors += orderErrors
    }

    totalSent += eventSent
    totalErrors += eventErrors
    results.push({
      eventId: ev.id,
      eventTitle: ev.title,
      sent: eventSent,
      errors: eventErrors,
    })

    log.info("cron/event-reminder — event processed", {
      eventId: ev.id,
      title: ev.title,
      orders: paidOrders.length,
      sent: eventSent,
      errors: eventErrors,
    })
  }

  log.info("cron/event-reminder — run complete", {
    events: upcomingEvents.length,
    totalSent,
    totalErrors,
  })

  return NextResponse.json({
    ok: true,
    checked: upcomingEvents.length,
    sent: totalSent,
    errors: totalErrors,
    results,
  })
}
