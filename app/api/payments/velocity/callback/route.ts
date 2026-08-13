import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { z } from "zod"
import { eq, and, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders, paymentLedger } from "@/db/schema"
import { pollTransaction, finalizeWorkflow, normalizeVelocityPollResponse } from "@/services/velocity"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"
import { log } from "@/lib/logger"
import {
  alertCallbackOrderNotFound,
  alertFinalizeNonPaid,
  alertPaymentAnomaly,
} from "@/lib/payment-alerts"
import { isValidVelocityTrace, paymentAmountsMatch } from "@/lib/velocity/validation"

/** Constant-time string comparison — avoids leaking the secret via response timing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

const CallbackBody = z.object({
  transactionTrace: z.string().min(1),
  salesOrderTrace: z.string().min(1),
  pollStatus: z.string().min(1),
})

export async function POST(req: Request) {
  // ── Webhook secret verification ────────────────────────────────────────
  const webhookSecret = process.env.VELOCITY_WEBHOOK_SECRET
  if (!webhookSecret) {
    log.error("velocity callback - VELOCITY_WEBHOOK_SECRET is not set; rejecting all callback requests")
    return NextResponse.json({ error: "webhook not configured" }, { status: 401 })
  }
  const providedSignature = req.headers.get("x-webhook-signature") ?? req.headers.get("x-api-key") ?? ""
  if (!providedSignature || !safeEqual(providedSignature, webhookSecret)) {
    log.warn("velocity callback - invalid webhook signature", {
      provided: providedSignature ? `${providedSignature.slice(0, 8)}...` : "none",
    })
    alertPaymentAnomaly({
      type: "CALLBACK_INVALID_SIGNATURE",
      severity: "critical",
      title: "Velocity callback received with an invalid signature",
      detail: "A request to the payment callback endpoint failed webhook signature verification. This could be a misconfigured integration or a forged request — investigate immediately.",
    }).catch((err) => log.warn("velocity callback - failed to send invalid-signature alert", { error: String(err) }))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = CallbackBody.safeParse(rawBody)
  if (!parsed.success) {
    log.warn("velocity callback - invalid payload", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: "invalid_payload", detail: parsed.error.flatten() }, { status: 400 })
  }

  const { transactionTrace, salesOrderTrace } = parsed.data
  if (!isValidVelocityTrace(transactionTrace) || !isValidVelocityTrace(salesOrderTrace)) {
    log.warn("velocity callback - invalid trace format", { transactionTrace, salesOrderTrace })
    return NextResponse.json({ error: "invalid_trace" }, { status: 400 })
  }
  log.info("velocity callback - received", {
    transactionTrace,
    salesOrderTrace,
    pollStatus: parsed.data.pollStatus,
    allFields: Object.keys(rawBody as Record<string, unknown>).join(", "),
  })

  const lockKey = `velocity-finalize:${salesOrderTrace}`

  if (!await acquireLock(lockKey)) {
    log.info("velocity callback - lock contended, acknowledging", { salesOrderTrace })
    return NextResponse.json({ status: "acknowledged", note: "Already processing" })
  }

  try {
    const [existing] = await db
      .select({ id: paymentLedger.id })
      .from(paymentLedger)
      .where(eq(paymentLedger.transactionTrace, transactionTrace))
      .limit(1)

    if (existing) {
      log.info("velocity callback - already processed (ledger entry exists), acknowledging", {
        salesOrderTrace,
        transactionTrace,
        existingId: existing.id,
      })
      return NextResponse.json({ status: "acknowledged", note: "Already processed" })
    }

    const pollResult = await pollTransaction(transactionTrace)
    const normalized = normalizeVelocityPollResponse(pollResult)

    log.info("velocity callback - poll result", {
      transactionTrace,
      salesOrderTrace,
      localStatus: normalized.localStatus,
      velocityPollStatus: normalized.velocityPollStatus,
      velocityPaymentStatus: normalized.velocityPaymentStatus,
      velocityWorkflowStatus: normalized.velocityWorkflowStatus,
    })

    if (normalized.localStatus === "PAID") {
      const finalizeResult = await finalizeWorkflow(salesOrderTrace)
      const salesOrderStatus = finalizeResult.body.salesOrder.status
      const invoiceId = finalizeResult.body.invoice.id

      if (salesOrderStatus !== "PAID") {
        log.error("velocity callback - finalize returned non-PAID", {
          salesOrderTrace,
          salesOrderStatus,
        })
        alertFinalizeNonPaid(
          "unknown",
          salesOrderTrace,
          salesOrderStatus,
          Number(finalizeResult.body.salesOrder.outstandingAmount),
        )
        return NextResponse.json({ status: "acknowledged", note: "Payment finalisation is not complete" })
      }

      const [order] = await db
        .select({
          id: orders.id,
          status: orders.status,
          eventId: orders.eventId,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
          paymentMethod: orders.paymentMethod,
          guestEmail: orders.guestEmail,
          guestName: orders.guestName,
          metadata: orders.metadata,
          userId: orders.userId,
        })
        .from(orders)
        .where(
          and(
            sql`${orders.metadata}->'velocity'->>'salesOrderTrace' = ${salesOrderTrace}`,
          ),
        )
        .limit(1)

      if (!order) {
        log.error("velocity callback - order not found for salesOrderTrace", { salesOrderTrace })

        // Alert: Velocity callback received for an order that doesn't exist locally
        alertCallbackOrderNotFound(
          transactionTrace,
          salesOrderTrace,
          rawBody as Record<string, unknown> | null,
        )

        return NextResponse.json({ status: "acknowledged", note: "Order not found" })
      }

      if (order.status === "paid") {
        const [settledLedger] = await db
          .select({ id: paymentLedger.id })
          .from(paymentLedger)
          .where(and(
            eq(paymentLedger.orderId, order.id),
            sql`${paymentLedger.localStatus} IN ('paid', 'completed', 'success', 'paid_success')`,
          ))
          .limit(1)

        if (!settledLedger) {
          await db.insert(paymentLedger).values({
            orderId: order.id,
            eventId: order.eventId,
            transactionTrace,
            salesOrderTrace,
            invoiceId,
            amount: order.totalAmount,
            currency: order.currency ?? "USD",
            processor: "velocity",
            velocityPollStatus: normalized.velocityPollStatus ?? "SUCCESS",
            localStatus: "paid",
            source: "callback",
            rawPayload: rawBody as Record<string, unknown>,
          }).onConflictDoNothing()
        }

        log.info("velocity callback - order already paid, recorded in ledger", { orderId: order.id })
        return NextResponse.json({ status: "acknowledged" })
      }

      const meta = (order.metadata ?? {}) as Record<string, unknown>
      const velocityMeta = (meta.velocity ?? {}) as Record<string, unknown>
      const paidAmount = Number(finalizeResult.body.salesOrder.paidAmount)
      if (!paymentAmountsMatch(order.totalAmount, paidAmount)) {
        alertPaymentAnomaly({
          type: "PAYMENT_AMOUNT_MISMATCH",
          severity: "critical",
          title: "Velocity callback amount does not match order",
          detail: `Order ${order.id} expected ${order.totalAmount} ${order.currency ?? "USD"}, but Velocity finalised ${paidAmount}.`,
          orderId: order.id,
          paymentMethod: order.paymentMethod ?? "velocity-card",
          context: { expectedAmount: order.totalAmount, paidAmount, transactionTrace, salesOrderTrace },
        }).catch(() => {})
        return NextResponse.json({ status: "acknowledged", note: "Payment amount requires review" })
      }
      const updatedMeta = {
        ...meta,
        velocity: {
          ...velocityMeta,
          pollStatus: "SUCCESS",
          paymentStatus: normalized.velocityPaymentStatus ?? "SUCCESS",
          paymentRef: invoiceId,
          invoiceRef: invoiceId,
          finalizedAt: new Date().toISOString(),
          callbackProcessedAt: new Date().toISOString(),
        },
      }

      const [updatedOrder] = await db
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          completedAt: new Date(),
          paymentRef: invoiceId,
          metadata: updatedMeta,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, order.id), inArray(orders.status, ["pending", "awaiting_verification"])))
        .returning({ id: orders.id, status: orders.status })

      if (!updatedOrder) {
        const [current] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, order.id)).limit(1)
        log.warn("velocity callback - order changed before payment claim", { orderId: order.id, currentStatus: current?.status })
        return NextResponse.json({ status: "acknowledged", note: "Order was already processed or cancelled" })
      }

      // Record in ledger before delivery so re-runs are idempotent
      try {
        await db.insert(paymentLedger).values({
          orderId: order.id,
          eventId: order.eventId,
          transactionTrace,
          salesOrderTrace,
          invoiceId,
          amount: order.totalAmount,
          currency: order.currency ?? "USD",
          processor: "velocity",
          velocityPollStatus: normalized.velocityPollStatus ?? "SUCCESS",
          localStatus: "paid",
          source: "callback",
          rawPayload: rawBody as Record<string, unknown>,
        }).onConflictDoNothing()
      } catch {
        // Duplicate — already recorded, safe to continue
      }

      // Fire-and-forget delivery — don't block the HTTP response (Velocity may
      // time out and retry). The cron recheck handles delivery retries.
      deliverTicketForPaidOrder(order.id).catch((err) =>
        log.error("velocity callback - delivery failed (callback will retry via cron)", {
          orderId: order.id,
          error: String(err),
        }),
      )

      log.info("velocity callback - order processed", {
        orderId: order.id,
      })
    } else {
      log.info("velocity callback - payment not yet confirmed", {
        localStatus: normalized.localStatus,
        salesOrderTrace,
      })
    }

    return NextResponse.json({ status: "acknowledged" })
  } catch (err) {
    log.error("velocity callback - error", {
      transactionTrace,
      salesOrderTrace,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  } finally {
    await releaseLock(lockKey).catch(() => {})
  }
}
