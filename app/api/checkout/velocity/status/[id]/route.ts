import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { log } from "@/lib/logger"
import { expireOrderAndReleaseInventory } from "@/lib/order-expiry"
import { alertFinalizeNonPaid, alertPollUnknownStatus } from "@/lib/payment-alerts"
import { rateLimit } from "@/lib/rate-limit"
import {
  reconcileVelocityOrder,
  reconcileVelocityOrderBeforeExpiry,
} from "@/lib/velocity/reconciliation"
import { isValidUUID, isValidVelocityTrace } from "@/lib/velocity/validation"
import { sendAdminAlert } from "@/lib/whatsapp"
import { newPaymentAlert } from "@/lib/whatsapp-templates"
import type { VelocityOrderMetadata } from "@/types/velocity"

const POLL_TIMEOUT_MS = 5 * 60 * 1000
const PAID_STATUSES = new Set(["paid", "completed"])
const statusLimiter = rateLimit({ windowMs: 60_000, max: 90 })

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const limited = statusLimiter.checkRequest(req)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } },
    )
  }

  const { id } = await ctx.params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "invalid_order_id" }, { status: 400 })
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (PAID_STATUSES.has(order.status ?? "")) {
    return NextResponse.json({ orderId: id, status: order.status, paid: true, sentTo: order.guestEmail })
  }
  if (["cancelled", "refunded"].includes(order.status ?? "")) {
    return NextResponse.json({ orderId: id, status: order.status, paid: false })
  }

  const metadata = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
  const velocity = metadata.velocity
  if (!velocity?.transactionTrace || !velocity.salesOrderTrace) {
    return NextResponse.json({ error: "missing_velocity_transaction" }, { status: 400 })
  }
  if (!isValidVelocityTrace(velocity.transactionTrace) || !isValidVelocityTrace(velocity.salesOrderTrace)) {
    log.error("velocity status - malformed provider reference", { orderId: id })
    return NextResponse.json({ error: "invalid_transaction" }, { status: 400 })
  }

  const [event] = await db
    .select({ title: events.title, startsAt: events.startsAt, endsAt: events.endsAt })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)
  const eventEndedAt = event?.endsAt ?? event?.startsAt
  const eventEnded = Boolean(eventEndedAt && new Date(eventEndedAt) <= new Date())
  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : Date.now()
  const timedOut = Date.now() - createdAt > POLL_TIMEOUT_MS

  const result = eventEnded || timedOut
    ? await reconcileVelocityOrderBeforeExpiry({ orderId: id, source: "poll_before_expiry" })
    : await reconcileVelocityOrder({ orderId: id, source: "poll" })

  if (result.paid) {
    deliverTicketForPaidOrder(id).catch((error) =>
      log.error("velocity status - delivery failed; cron will retry", { orderId: id, error: String(error) }),
    )
    if (result.newlySettled) {
      sendAdminAlert(newPaymentAlert(
        event?.title ?? "Unknown event",
        order.totalAmount,
        order.currency ?? "USD",
        order.guestName ?? order.guestEmail ?? "Anonymous",
        order.guestPhone ?? "—",
        order.paymentMethod ?? "velocity-card",
        id,
        result.invoiceId ?? "—",
      )).catch((error) => log.warn("velocity status - admin alert failed", { orderId: id, error: String(error) }))
    }
    return NextResponse.json({
      orderId: id,
      status: result.orderStatus ?? "paid",
      paid: true,
      pollStatus: "SUCCESS",
      sentTo: order.guestEmail,
      invoiceRef: result.invoiceId,
    })
  }

  if (result.state === "FAILED" && (eventEnded || timedOut) && order.status !== "expired") {
    await expireOrderAndReleaseInventory(id, eventEnded ? "event_ended_payment_failed" : "payment_timeout")
    return NextResponse.json({
      orderId: id,
      status: "expired",
      paid: false,
      pollStatus: "FAILED",
      error: eventEnded ? "The event has ended and Velocity confirmed the payment failed." : "Payment window expired",
    })
  }

  if (result.state === "UNKNOWN") {
    alertPollUnknownStatus(
      id,
      velocity.transactionTrace,
      result.pollResult?.body?.pollStatus ?? null,
      result.pollResult?.body?.paymentStatus ?? null,
      result.pollResult?.state ?? "unknown",
    )
  }
  if (result.state === "FINALIZE_PENDING") {
    alertFinalizeNonPaid(id, velocity.salesOrderTrace, "NOT_PAID", 0)
  }

  const providerUnavailable = result.state === "NETWORK_ERROR" || result.state === "PROVIDER_ERROR"
  const needsReview = ["UNKNOWN", "FINALIZE_ERROR", "FINALIZE_PENDING", "AMOUNT_MISMATCH", "CONFLICT"].includes(result.state)
  const currentStatus = order.status === "expired" ? "expired" : "pending"

  return NextResponse.json({
    orderId: id,
    status: currentStatus,
    paid: false,
    pollStatus: providerUnavailable ? "PROVIDER_ERROR" : result.state,
    providerHttpStatus: result.providerHttpStatus,
    message: eventEnded && currentStatus !== "expired"
      ? "The event has ended, but this payment is still being reconciled and was not archived."
      : needsReview
        ? "Payment requires reconciliation by an administrator."
        : result.message,
  })
}
