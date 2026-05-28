import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { pollTransaction, finalizeWorkflow, normalizeVelocityPollResponse } from "@/services/velocity"
import { startOrderVerification } from "@/lib/order-verification"
import { notifyPaymentSuccess } from "@/lib/payment-notifications"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"
import { isValidUUID } from "@/lib/velocity/validation"
import { log } from "@/lib/logger"
import { trackEvent } from "@/lib/analytics"
import type { VelocityOrderMetadata, VelocityPollStatus, LocalPaymentStatus } from "@/types/velocity"

const POLL_TIMEOUT_MS = 5 * 60 * 1000
const PAID_STATUSES = new Set(["paid", "awaiting_verification"])

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

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

  const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
  const velocityMeta = meta.velocity

  if (!velocityMeta?.transactionTrace) {
    return NextResponse.json({ error: "missing_velocity_transaction" }, { status: 400 })
  }

  // ── Validate transactionTrace is a UUID ──────────────────────────────────
  if (!isValidUUID(velocityMeta.transactionTrace)) {
    log.error("velocity status - transactionTrace is not a valid UUID", {
      localOrderId: id,
      transactionTrace: velocityMeta.transactionTrace,
    })
  }

  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : Date.now()
  if (Date.now() - createdAt > POLL_TIMEOUT_MS) {
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
      pollUrl: `/transactions/poll/${velocityMeta.transactionTrace}`,
    })

    const pollResult = await pollTransaction(velocityMeta.transactionTrace)

    // ── Log full sanitized response ───────────────────────────────────────
    log.info("velocity status - poll response received", {
      transactionTrace: velocityMeta.transactionTrace,
      httpStatus: pollResult.state === "network_error" ? 0 : undefined,
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

    // ── 3. Build updated metadata ─────────────────────────────────────────
    const updatedMeta = {
      ...meta,
      velocity: {
        ...velocityMeta,
        pollStatus: normalized.velocityPollStatus as VelocityPollStatus | null ?? "PENDING",
        ...(normalized.localStatus === "FAILED" || normalized.localStatus === "UNKNOWN"
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

    // ── 4. Payment confirmed → finalize workflow ──────────────────────────
    if (normalized.localStatus === "PAID") {
      return await handlePollSuccess(req, order, meta, velocityMeta, id, pollResult)
    }

    // ── 5. Payment failed ─────────────────────────────────────────────────
    if (normalized.localStatus === "FAILED") {
      log.warn("velocity status - payment failed", {
        localOrderId: id,
        velocityTransactionTrace: velocityMeta.transactionTrace,
        pollStatus: normalized.velocityPollStatus,
        paymentStatus: normalized.velocityPaymentStatus,
        failureReason: updatedMeta.velocity.failureReason,
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

    // ── 6. Unknown status – requires admin recheck ───────────────────────
    if (normalized.localStatus === "UNKNOWN") {
      log.warn("velocity status - unknown payment status", {
        localOrderId: id,
        velocityTransactionTrace: velocityMeta.transactionTrace,
        pollStatus: normalized.velocityPollStatus,
        paymentStatus: normalized.velocityPaymentStatus,
        state: pollResult.state,
        status: pollResult.status,
      })
      return NextResponse.json({
        orderId: id,
        status: "pending",
        paid: false,
        pollStatus: "UNKNOWN",
        message: "Payment status could not be determined. An admin can recheck using the dashboard.",
      })
    }

    // ── 7. Still pending ──────────────────────────────────────────────────
    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      pollStatus: "PENDING",
    })
  } catch (err) {
    log.error("velocity status polling error", {
      localOrderId: id,
      velocityTransactionTrace: velocityMeta?.transactionTrace,
      error: String(err),
    })
    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      pollStatus: "PENDING",
      message: err instanceof Error ? err.message : "Polling failed",
    })
  }
}

/**
 * Handle the SUCCESS poll status: finalize workflow, update DB, send verification.
 * Extracted into a separate function for clarity and to keep GET() readable.
 */
async function handlePollSuccess(
  req: Request,
  order: typeof orders.$inferSelect,
  meta: Record<string, unknown>,
  velocityMeta: VelocityOrderMetadata,
  id: string,
  pollResult: Awaited<ReturnType<typeof pollTransaction>>,
) {
  const lockKey = `velocity-finalize:${velocityMeta.salesOrderTrace}`
  if (!acquireLock(lockKey)) {
    log.info("velocity status - finalization lock contended", {
      localOrderId: id,
      salesOrderTrace: velocityMeta.salesOrderTrace,
    })
    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      pollStatus: "PENDING",
      message: "Finalization in progress",
    })
  }

  try {
    log.info("velocity status - poll success, finalizing workflow", {
      localOrderId: id,
      velocitySalesOrderTrace: velocityMeta.salesOrderTrace,
      updateWorkflowUrl: `/sales-orders/update-workflow/${velocityMeta.salesOrderTrace}`,
    })

    // ── Finalize workflow ─────────────────────────────────────────────────
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

    // Validate that Velocity actually marked the sales order as PAID.
    const salesOrderStatus = finalizeResult.body.salesOrder.status
    if (salesOrderStatus !== "PAID") {
      log.error("velocity status - finalize returned non-PAID status", {
        localOrderId: id,
        velocitySalesOrderTrace: velocityMeta.salesOrderTrace,
        salesOrderStatus,
        outstandingAmount: finalizeResult.body.salesOrder.outstandingAmount,
        paidAmount: finalizeResult.body.salesOrder.paidAmount,
      })
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

    // ── Update local DB ───────────────────────────────────────────────────
    const [claimed] = await db
      .update(orders)
      .set({
        status: "awaiting_verification",
        paidAt: new Date(),
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

    // If the WHERE clause didn't match (race condition), re-read the actual status.
    if (!claimed) {
      const [reRead] = await db
        .select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1)

      log.warn("velocity status - DB update skipped (status no longer pending), actual status", {
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

    // ── Send verification email ──────────────────────────────────────────
    if (order.guestEmail) {
      const origin = new URL(req.url).origin
      try {
        await startOrderVerification({
          orderId: id,
          email: order.guestEmail,
          origin,
        })
      } catch (err) {
        // Verification email failed — order stays at awaiting_verification.
        // Admin can resend via the admin panel.
        log.warn("velocity status - verification email send failed, payment confirmed but email pending", {
          localOrderId: id,
          error: String(err),
        })
      }
      // Fire-and-forget the payment notification (non-critical)
      notifyPaymentSuccess(id).catch((err) => {
        log.warn("velocity status - notifyPaymentSuccess failed", { localOrderId: id, error: String(err) })
      })
    }

    return NextResponse.json({
      orderId: id,
      status: "awaiting_verification",
      paid: true,
      pollStatus: "SUCCESS",
      sentTo: order.guestEmail,
      invoiceRef: invoiceId,
    })
  } finally {
    releaseLock(lockKey)
  }
}
