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
      }

      const [order] = await db
        .select({
          id: orders.id,
          status: orders.status,
          eventId: orders.eventId,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
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

        await db.insert(paymentLedger).values({
          orderId: "00000000-0000-0000-0000-000000000000",
          eventId: "00000000-0000-0000-0000-000000000000",
          transactionTrace,
          salesOrderTrace,
          invoiceId: invoiceId ?? null,
          amount: "0",
          currency: "USD",
          processor: "velocity",
          velocityPollStatus: normalized.velocityPollStatus ?? "SUCCESS",
          localStatus: "orphaned",
          source: "callback",
          rawPayload: rawBody as Record<string, unknown>,
          errorMessage: "Order not found for salesOrderTrace",
        })

        return NextResponse.json({ status: "acknowledged", note: "Order not found" })
      }

      if (order.status === "paid") {
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
        })

        log.info("velocity callback - order already paid, recorded in ledger", { orderId: order.id })
        return NextResponse.json({ status: "acknowledged" })
      }

      const meta = (order.metadata ?? {}) as Record<string, unknown>
      const velocityMeta = (meta.velocity ?? {}) as Record<string, unknown>
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

      await db
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
        })
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
      await db.insert(paymentLedger).values({
        orderId: "00000000-0000-0000-0000-000000000000",
        eventId: "00000000-0000-0000-0000-000000000000",
        transactionTrace,
        salesOrderTrace,
        amount: "0",
        currency: "USD",
        processor: "velocity",
        velocityPollStatus: normalized.velocityPollStatus ?? parsed.data.pollStatus,
        localStatus: "unconfirmed",
        source: "callback",
        rawPayload: rawBody as Record<string, unknown>,
      })

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
