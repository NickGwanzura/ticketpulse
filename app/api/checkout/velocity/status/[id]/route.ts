import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { orders, paymentLedger, events } from "@/db/schema"
import { pollTransaction, finalizeWorkflow, normalizeVelocityPollResponse } from "@/services/velocity"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { expireOrderAndReleaseInventory } from "@/lib/order-expiry"
import { isValidUUID } from "@/lib/velocity/validation"
import { log } from "@/lib/logger"
import { trackEvent } from "@/lib/analytics"
import { sendAdminAlert } from "@/lib/whatsapp"
import { newPaymentAlert } from "@/lib/whatsapp-templates"
import {
  alertPollUnknownStatus,
  alertFinalizeNonPaid,
  alertVelocityUnexpectedResponse,
} from "@/lib/payment-alerts"
import type { VelocityOrderMetadata, VelocityPollStatus } from "@/types/velocity"

// Must match POLL_TIMEOUT_MS in app/checkout/page.tsx.
const POLL_TIMEOUT_MS = 5 * 60 * 1000

const PAID_STATUSES = new Set(["paid"])

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  // Validate the order ID is a UUID before querying to avoid Postgres type errors.
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "invalid_order_id" }, { status: 400 })
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (PAID_STATUSES.has(order.status ?? "")) {
    return NextResponse.json({
      orderId: id,
      status: order.status,
      paid: true,
      sentTo: order.guestEmail,
    })
  }

  if (order.status !== "pending") {
    return NextResponse.json({
      orderId: id,
      status: order.status,
      paid: false,
    })
  }

  const [event] = await db
    .select({ startsAt: events.startsAt, endsAt: events.endsAt })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)
  const eventEndedAt = event?.endsAt ?? event?.startsAt
  if (eventEndedAt && new Date(eventEndedAt) <= new Date()) {
    await expireOrderAndReleaseInventory(id, "event_ended")
    return NextResponse.json({
      orderId: id,
      status: "expired",
      paid: false,
      pollStatus: "EVENT_ENDED",
      error: "This event has ended; the pending payment order was archived.",
    })
  }

  const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
  const velocityMeta = meta.velocity

  if (!velocityMeta?.transactionTrace) {
    return NextResponse.json({ error: "missing_velocity_transaction" }, { status: 400 })
  }

  // Reject malformed traces before they can be interpolated into the Velocity URL path.
  if (!isValidUUID(velocityMeta.transactionTrace)) {
    log.error("velocity status - transactionTrace is not a valid UUID", {
      localOrderId: id,
      transactionTrace: velocityMeta.transactionTrace,
    })
    return NextResponse.json({ error: "invalid_transaction" }, { status: 400 })
  }

  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : Date.now()
  if (Date.now() - createdAt > POLL_TIMEOUT_MS) {
    // Payment window is over. Do one final poll so a payment that landed at
    // the buzzer still gets finalized; otherwise expire the order and release
    // the inventory reservation NOW instead of leaving the seats locked until
    // the expire-orders cron picks it up.
    try {
      const pollResult = await pollTransaction(velocityMeta.transactionTrace)
      const normalized = normalizeVelocityPollResponse(pollResult)
      if (normalized.localStatus === "PAID") {
        return await handlePollSuccess(order, meta, velocityMeta, id)
      }
      // A network error means the poll is inconclusive — leave the order
      // pending so the cron's live-poll safety net decides.
      if (pollResult.state !== "network_error") {
        await expireOrderAndReleaseInventory(id)
      }
    } catch (err) {
      log.warn("velocity status - final poll before expiry failed, leaving order for cron", {
        localOrderId: id,
        error: String(err),
      })
    }
    return NextResponse.json({
      orderId: id,
      status: "expired",
      paid: false,
      pollStatus: "TIMEOUT",
      error: "Payment window expired",
    })
  }

  try {
    // ── 1. Poll Velocity ──────────────────────────────────────────────────
    log.info("velocity status - polling transaction", {
      localOrderId: id,
      localPaymentMethod: order.paymentMethod,
      velocityTransactionTrace: velocityMeta.transactionTrace,
      velocitySalesOrderTrace: velocityMeta.salesOrderTrace,
    })

    const pollResult = await pollTransaction(velocityMeta.transactionTrace)

    log.info("velocity status - poll response received", {
      transactionTrace: velocityMeta.transactionTrace,
      velocityState: pollResult.state,
      velocityStatus: pollResult.status,
      paymentStatus: pollResult.body?.paymentStatus,
      pollStatus: pollResult.body?.pollStatus,
      amount: pollResult.body?.amount,
      fullBody: JSON.stringify(pollResult).slice(0, 5000),
    })

    // ── 2. Normalize the poll response ────────────────────────────────────
    const normalized = normalizeVelocityPollResponse(pollResult)

    log.info("velocity status - normalized", {
      localOrderId: id,
      localStatus: normalized.localStatus,
      velocityPollStatus: normalized.velocityPollStatus,
      velocityPaymentStatus: normalized.velocityPaymentStatus,
    })

    const isNetworkError = pollResult.state === "network_error"

    // ── 3. Build updated metadata ─────────────────────────────────────────
    // Don't persist failedAt/failureReason for transient network errors —
    // those may auto-resolve on the next poll.
    const updatedMeta = {
      ...meta,
      velocity: {
        ...velocityMeta,
        pollStatus: (normalized.velocityPollStatus as VelocityPollStatus | null) ?? "PENDING",
        ...(!isNetworkError && (normalized.localStatus === "FAILED" || normalized.localStatus === "UNKNOWN")
          ? {
              failedAt: new Date().toISOString(),
              failureReason: normalized.localStatus === "FAILED"
                ? `Velocity returned pollStatus: ${normalized.velocityPollStatus}, paymentStatus: ${normalized.velocityPaymentStatus}`
                : `Unknown payment status – Velocity pollStatus: ${normalized.velocityPollStatus ?? "missing"}, paymentStatus: ${normalized.velocityPaymentStatus ?? "missing"}`,
              velocityRawPollResponse: {
                state: pollResult.state,
                status: pollResult.status,
                body: {
                  trace: pollResult.body?.trace,
                  amount: pollResult.body?.amount,
                  paymentStatus: pollResult.body?.paymentStatus,
                  pollStatus: pollResult.body?.pollStatus,
                },
              },
            }
          : {}),
      },
    }

    await db
      .update(orders)
      .set({ metadata: updatedMeta, updatedAt: new Date() })
      .where(eq(orders.id, id))

    // ── 4. Network error — keep polling, don't alarm the user ────────────
    if (isNetworkError) {
      log.warn("velocity status - network error polling Velocity, will retry", {
        localOrderId: id,
        transactionTrace: velocityMeta.transactionTrace,
      })
      return NextResponse.json({
        orderId: id,
        status: "pending",
        paid: false,
        pollStatus: "PENDING",
      })
    }

    // ── 5. Payment confirmed → finalize workflow ──────────────────────────
    if (normalized.localStatus === "PAID") {
      return await handlePollSuccess(order, meta, velocityMeta, id)
    }

    // ── 6. Payment failed ─────────────────────────────────────────────────
    if (normalized.localStatus === "FAILED") {
      log.warn("velocity status - payment failed", {
        localOrderId: id,
        velocityTransactionTrace: velocityMeta.transactionTrace,
        pollStatus: normalized.velocityPollStatus,
        paymentStatus: normalized.velocityPaymentStatus,
      })
      trackEvent({
        event: "PAYMENT_FAILED",
        eventId: order.eventId,
        orderId: id,
        paymentMethod: order.paymentMethod,
        amount: Number(order.totalAmount),
      })
      return NextResponse.json({
        orderId: id,
        status: "pending",
        paid: false,
        pollStatus: "FAILED",
        failureReason: updatedMeta.velocity.failureReason,
      })
    }

    // ── 7. Unknown status — admin recheck required ───────────────────────
    if (normalized.localStatus === "UNKNOWN") {
      log.warn("velocity status - unknown payment status", {
        localOrderId: id,
        velocityTransactionTrace: velocityMeta.transactionTrace,
        pollStatus: normalized.velocityPollStatus,
        paymentStatus: normalized.velocityPaymentStatus,
        state: pollResult.state,
        status: pollResult.status,
      })

      // Alert admin that a payment poll returned an unrecognized status
      alertPollUnknownStatus(
        id,
        velocityMeta.transactionTrace,
        normalized.velocityPollStatus,
        normalized.velocityPaymentStatus,
        pollResult.state,
      )

      return NextResponse.json({
        orderId: id,
        status: "pending",
        paid: false,
        pollStatus: "UNKNOWN",
        message: "Payment status could not be determined. An admin can recheck using the dashboard.",
      })
    }

    // ── 8. Still pending ──────────────────────────────────────────────────
    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      pollStatus: "PENDING",
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Polling failed"
    log.error("velocity status polling error", {
      localOrderId: id,
      velocityTransactionTrace: velocityMeta?.transactionTrace,
      error: errorMessage,
    })
    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      pollStatus: "ERROR",
      message: errorMessage,
    })
  }
}

/**
 * Handle a SUCCESS poll: finalize the Velocity workflow, update local DB to paid,
 * deliver tickets, and write to the payment ledger.
 *
 * Concurrency guard: the CAS update (WHERE status = 'pending') is the sole idempotency
 * guard. If two concurrent polls both see SUCCESS, only one claims the row; the other
 * re-reads the actual status and returns it. No advisory lock needed here — the advisory
 * lock was removed in favour of the cheaper CAS, which is already atomic at DB level.
 */
async function handlePollSuccess(
  order: typeof orders.$inferSelect,
  meta: Record<string, unknown>,
  velocityMeta: VelocityOrderMetadata,
  id: string,
) {
  log.info("velocity status - poll success, finalizing workflow", {
    localOrderId: id,
    velocitySalesOrderTrace: velocityMeta.salesOrderTrace,
  })

  // ── Re-check if another process (callback, cron, concurrent poll) already
  // finalized this order. If the order status is no longer "pending", skip
  // the finalizeWorkflow call to avoid a redundant (and possibly failing)
  // API call to Velocity.
  const [currentOrder] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1)

  if (currentOrder && currentOrder.status !== "pending") {
    log.info("velocity status - order already processed (status changed), skipping finalizeWorkflow", {
      localOrderId: id,
      currentStatus: currentOrder.status,
    })
    const isPaid = PAID_STATUSES.has(currentOrder.status ?? "")
    return NextResponse.json({
      orderId: id,
      status: currentOrder.status,
      paid: isPaid,
      pollStatus: "SUCCESS",
      note: isPaid ? "Already confirmed by another process" : "Already processed, status unchanged",
    })
  }

  const finalizeResult = await finalizeWorkflow(velocityMeta.salesOrderTrace)

  log.info("velocity status - finalize workflow response", {
    localOrderId: id,
    velocitySalesOrderTrace: velocityMeta.salesOrderTrace,
    finalizeState: finalizeResult.state,
    finalizeStatus: finalizeResult.status,
    finalizeSalesOrderStatus: finalizeResult.body.salesOrder.status,
    finalizeInvoiceId: finalizeResult.body.invoice.id,
    finalizeSalesOrderId: finalizeResult.body.salesOrder.id,
  })

  const salesOrderStatus = finalizeResult.body.salesOrder.status
  if (salesOrderStatus !== "PAID") {
    log.error("velocity status - finalize returned non-PAID status", {
      localOrderId: id,
      velocitySalesOrderTrace: velocityMeta.salesOrderTrace,
      salesOrderStatus,
      outstandingAmount: finalizeResult.body.salesOrder.outstandingAmount,
      paidAmount: finalizeResult.body.salesOrder.paidAmount,
    })

    // Alert: poll confirmed payment but workflow finalization disagrees
    alertFinalizeNonPaid(
      id,
      velocityMeta.salesOrderTrace,
      salesOrderStatus,
      Number(finalizeResult.body.salesOrder.outstandingAmount),
    )

    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      pollStatus: "SUCCESS",
      message: `Workflow finalization returned status "${salesOrderStatus}" instead of "PAID"`,
    })
  }

  const invoiceId = finalizeResult.body.invoice.id

  trackEvent({ event: "PAYMENT_CONFIRMED", eventId: order.eventId, orderId: id, paymentMethod: order.paymentMethod, amount: Number(order.totalAmount) })

  const finalMeta = {
    ...meta,
    velocity: {
      ...velocityMeta,
      pollStatus: "SUCCESS" as VelocityPollStatus,
      paymentRef: invoiceId,
      invoiceRef: invoiceId,
      finalizedAt: new Date().toISOString(),
    },
  }

  // ── CAS update: WHERE status = 'pending' prevents double-finalization ──
  const [claimed] = await db
    .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          completedAt: new Date(),
      paymentRef: invoiceId,
      metadata: finalMeta,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, id), eq(orders.status, "pending")))
    .returning({ id: orders.id, status: orders.status })

  log.info("velocity status - DB update result", {
    localOrderId: id,
    claimed: !!claimed,
    claimedId: claimed?.id ?? null,
    claimedStatus: claimed?.status ?? null,
  })

  // CAS missed — another poll already finalized. Re-read and return the actual status.
  if (!claimed) {
    const [reRead] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1)

    log.warn("velocity status - DB update skipped (status no longer pending)", {
      localOrderId: id,
      actualStatus: reRead?.status ?? "unknown",
    })

    if (reRead) {
      const isPaid = PAID_STATUSES.has(reRead.status ?? "")
      return NextResponse.json({
        orderId: id,
        status: reRead.status,
        paid: isPaid,
        pollStatus: "SUCCESS",
        invoiceRef: invoiceId,
        note: isPaid ? "Already confirmed" : "Already processed, status unchanged",
      })
    }
  }

  // ── Deliver tickets (fire-and-forget — delivery failure does NOT negate paid status) ──
  // The order IS paid. Cron jobs handle delivery retries. Always return paid: true.
  deliverTicketForPaidOrder(id).catch((err) =>
    log.error("velocity status - delivery failed (order is paid, cron will retry)", {
      localOrderId: id,
      error: String(err),
    }),
  )

  // ── Record in payment_ledger — onConflictDoNothing makes it idempotent ────
  await db
    .insert(paymentLedger)
    .values({
      orderId: id,
      eventId: order.eventId,
      transactionTrace: velocityMeta.transactionTrace ?? "",
      salesOrderTrace: velocityMeta.salesOrderTrace ?? "",
      invoiceId,
      amount: order.totalAmount,
      currency: order.currency ?? "USD",
      processor: "velocity",
      velocityPollStatus: "SUCCESS",
      localStatus: "paid",
      source: "poll",
      rawPayload: null,
    })
    .onConflictDoNothing()

  // ── WhatsApp admin alert for new payment (fire-and-forget) ─────────────────
  const eventTitle =
    db
      .select({ title: events.title })
      .from(events)
      .where(eq(events.id, order.eventId))
      .limit(1)
      .then((rows) => rows[0]?.title ?? "Unknown event")
      .catch(() => "Unknown event")

  sendAdminAlert(
    newPaymentAlert(
      await eventTitle,
      order.totalAmount,
      order.currency ?? "USD",
      order.guestName ?? order.guestEmail ?? "Anonymous",
      order.guestPhone ?? "—",
      order.paymentMethod ?? "card",
      id,
      invoiceId,
    ),
  ).catch((err) =>
    log.error("whatsapp admin alert failed after payment confirmation", {
      orderId: id,
      error: String(err),
    }),
  )

  return NextResponse.json({
    orderId: id,
    status: "paid",
    paid: true,
    pollStatus: "SUCCESS",
    sentTo: order.guestEmail,
    invoiceRef: invoiceId,
  })
}
