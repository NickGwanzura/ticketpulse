import { and, eq, gt, inArray, lte, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { events, orders, paymentLedger } from "@/db/schema"
import { verifyCronSecret } from "@/lib/cron-auth"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { sendEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { expireOrderAndReleaseInventory } from "@/lib/order-expiry"
import { reconcileVelocityOrderBeforeExpiry } from "@/lib/velocity/reconciliation"
import type { VelocityOrderMetadata } from "@/types/velocity"

type ExpiryCandidate = {
  id: string
  status: string | null
  metadata: unknown
  eventId: string
  totalAmount: string
  currency: string | null
  guestEmail: string | null
  guestName: string | null
  createdAt: Date | null
}

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const pendingCutoff = new Date(Date.now() - 30 * 60 * 1000)
  const awaitingCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const columns = {
    id: orders.id,
    status: orders.status,
    metadata: orders.metadata,
    eventId: orders.eventId,
    totalAmount: orders.totalAmount,
    currency: orders.currency,
    guestEmail: orders.guestEmail,
    guestName: orders.guestName,
    createdAt: orders.createdAt,
  }

  const [pendingStale, awaitingStale, eventEndedPending] = await Promise.all([
    db.select(columns).from(orders).where(and(eq(orders.status, "pending"), lte(orders.createdAt, pendingCutoff))).limit(50),
    db.select(columns).from(orders).where(and(eq(orders.status, "awaiting_verification"), lte(orders.createdAt, awaitingCutoff))).limit(50),
    db
      .select(columns)
      .from(orders)
      .innerJoin(events, eq(events.id, orders.eventId))
      .where(and(
        inArray(orders.status, ["pending", "awaiting_verification"]),
        sql`COALESCE(${events.endsAt}, ${events.startsAt}) <= now()`,
      ))
      .limit(50),
  ])

  const candidates = Array.from(new Map(
    [...eventEndedPending, ...pendingStale, ...awaitingStale].map((order) => [order.id, order]),
  ).values()) as ExpiryCandidate[]
  const eventEndedIds = new Set(eventEndedPending.map((order) => order.id))
  const expiredIds: string[] = []
  const skippedIds: string[] = []

  for (const order of candidates) {
    const velocity = ((order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }).velocity
    let reconciliationState = "NO_VELOCITY_REFERENCE"
    let reconciliationPayload: Record<string, unknown> | null = null

    if (velocity) {
      const result = await reconcileVelocityOrderBeforeExpiry({ orderId: order.id, source: "expiry_cron" })
      reconciliationState = result.state
      reconciliationPayload = result.pollResult as unknown as Record<string, unknown> | null

      if (result.paid) {
        deliverTicketForPaidOrder(order.id).catch((error) =>
          log.error("cron/expire-orders - paid-order delivery failed", { orderId: order.id, error: String(error) }),
        )
        skippedIds.push(order.id)
        continue
      }

      // Only a definitive failure across every known provider attempt is safe
      // to archive. Missing, pending, unknown, and transport states stay open.
      if (result.state !== "FAILED") {
        skippedIds.push(order.id)
        continue
      }
    } else {
      // Missing references are not proof of non-payment: checkout may have
      // created a remote transaction immediately before persisting metadata.
      skippedIds.push(order.id)
      continue
    }

    const reason = eventEndedIds.has(order.id) ? "event_ended_unpaid" : "payment_timeout"
    if (!await expireOrderAndReleaseInventory(order.id, reason)) continue
    expiredIds.push(order.id)

    await db.insert(paymentLedger).values({
      orderId: order.id,
      eventId: order.eventId,
      transactionTrace: `system-expiry:${order.id}`,
      salesOrderTrace: velocity?.salesOrderTrace ?? `system-expiry:${order.id}`,
      amount: order.totalAmount,
      currency: order.currency ?? "USD",
      processor: velocity ? "velocity" : "system",
      velocityPollStatus: reconciliationState,
      localStatus: "expired",
      source: "cron",
      rawPayload: reconciliationPayload,
      errorMessage: `Order archived after ${reconciliationState}`,
    }).onConflictDoNothing()
  }

  const expiredOrders = candidates.filter((order) => expiredIds.includes(order.id) && order.guestEmail)
  if (expiredOrders.length > 0) {
    const notifyable: ExpiryCandidate[] = []
    for (const order of expiredOrders) {
      const [replacement] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(
          eq(orders.eventId, order.eventId),
          eq(orders.guestEmail, order.guestEmail!),
          inArray(orders.status, ["paid", "completed"]),
          gt(orders.createdAt, order.createdAt ?? new Date(0)),
        ))
        .limit(1)
      if (!replacement) notifyable.push(order)
    }

    const eventIds = [...new Set(notifyable.map((order) => order.eventId))]
    const eventRows = eventIds.length > 0
      ? await db.select({ id: events.id, title: events.title, slug: events.slug }).from(events).where(inArray(events.id, eventIds))
      : []
    const eventMap = new Map(eventRows.map((event) => [event.id, event]))
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

    await Promise.allSettled(notifyable.map((order) => {
      const event = eventMap.get(order.eventId)
      const eventTitle = event?.title ?? "your event"
      const eventUrl = event?.slug ? `${appUrl}/events/${event.slug}` : null
      const name = order.guestName ?? "there"
      const reference = order.id.slice(0, 8).toUpperCase()
      return sendEmail({
        to: order.guestEmail!,
        subject: `Your order has expired — ${eventTitle}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a"><h2>Your order has expired</h2><p>Hi ${name},</p><p>Your order for <strong>${eventTitle}</strong> expired after the payment provider confirmed it was unpaid.</p><p>If money was deducted, contact us with reference <code>${reference}</code>.</p>${eventUrl ? `<p><a href="${eventUrl}">Try again</a></p>` : ""}</div>`,
        text: `Hi ${name},\n\nYour order for ${eventTitle} expired after the payment provider confirmed it was unpaid. If money was deducted, contact us with reference ${reference}.${eventUrl ? `\n\nTry again: ${eventUrl}` : ""}`,
      })
    }))
  }

  return NextResponse.json({ expired: expiredIds.length, skipped: skippedIds.length })
}
