import { NextResponse } from "next/server"
import { and, eq, inArray, sql, lt } from "drizzle-orm"
import { db } from "@/db"
import { orders, paymentLedger } from "@/db/schema"
import {
  pollTransaction,
  finalizeWorkflow,
  normalizeVelocityPollResponse,
} from "@/services/velocity"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"
import type { VelocityOrderMetadata } from "@/types/velocity"

const MAX_ORDERS_PER_RUN = 50
const COOLDOWN_MS = 120_000

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError
  const startedAt = Date.now()
  log.info("cron/reconcile-payments — starting self-healing reconciliation")

  const cutoff = new Date(startedAt - COOLDOWN_MS)

  const targetOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      metadata: orders.metadata,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      eventId: orders.eventId,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
    })
    .from(orders)
    .where(
      and(
        sql`${orders.metadata}->>'velocity' IS NOT NULL`,
        inArray(orders.status, ["pending", "awaiting_verification"]),
        lt(orders.updatedAt, cutoff),
      ),
    )
    .limit(MAX_ORDERS_PER_RUN)

  if (targetOrders.length === 0) {
    log.info("cron/reconcile-payments — no stuck orders found")
    return NextResponse.json({ checked: 0, fixed: 0, errors: 0, skipped: 0 })
  }

  log.info(`cron/reconcile-payments — found ${targetOrders.length} orders to reconcile`, {
    ids: targetOrders.map((o) => o.id),
  })

  let fixedCount = 0
  let errorCount = 0
  let skippedCount = 0

  for (const order of targetOrders) {
    try {
      const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
      const velocityMeta = meta.velocity

      if (!velocityMeta?.transactionTrace || !velocityMeta?.salesOrderTrace) {
        skippedCount++
        continue
      }

      log.info("cron/reconcile-payments — polling", {
        orderId: order.id,
        transactionTrace: velocityMeta.transactionTrace,
      })

      const pollResult = await pollTransaction(velocityMeta.transactionTrace)
      const normalized = normalizeVelocityPollResponse(pollResult)

      if (normalized.localStatus !== "PAID") {
        skippedCount++
        continue
      }

      // Payment confirmed in Velocity — finalize workflow
      log.info("cron/reconcile-payments — payment confirmed, finalizing", {
        orderId: order.id,
        localStatus: normalized.localStatus,
      })

      const finalizeResult = await finalizeWorkflow(velocityMeta.salesOrderTrace)
      if (finalizeResult.body.salesOrder.status !== "PAID") {
        skippedCount++
        continue
      }

      const invoiceId = finalizeResult.body.invoice.id
      const paidAmount = finalizeResult.body.salesOrder.paidAmount

      // Update order to paid
      await db
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          paymentRef: invoiceId,
          metadata: sql`jsonb_set(
            COALESCE(${orders.metadata}, '{}'::jsonb),
            '{velocity}',
            ${JSON.stringify({
              ...velocityMeta,
              pollStatus: "SUCCESS",
              paymentStatus: normalized.velocityPaymentStatus ?? "SUCCESS",
              paymentRef: invoiceId,
              invoiceRef: invoiceId,
              finalizedAt: new Date().toISOString(),
              reconciledAt: new Date().toISOString(),
              reconciledByCron: true,
            })}::jsonb
          )`,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, order.id), inArray(orders.status, ["pending", "awaiting_verification"])))

      // Deliver tickets
      const delivery = await deliverTicketForPaidOrder(order.id)

      // Record in payment ledger
      await db.insert(paymentLedger).values({
        orderId: order.id,
        eventId: order.eventId,
        transactionTrace: velocityMeta.transactionTrace,
        salesOrderTrace: velocityMeta.salesOrderTrace,
        invoiceId,
        amount: order.totalAmount,
        currency: order.currency ?? "USD",
        processor: "velocity",
        velocityPollStatus: "SUCCESS",
        localStatus: "paid",
        source: "reconciliation",
        rawPayload: null,
        errorMessage: delivery.success ? null : delivery.error,
      })

      log.info("cron/reconcile-payments — recovered order", {
        orderId: order.id,
        deliveryStatus: delivery.status,
        ticketCount: delivery.ticketCount,
        paidAmount,
      })

      fixedCount++
    } catch (err) {
      errorCount++
      log.error("cron/reconcile-payments — error", {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const elapsed = Date.now() - startedAt
  log.info("cron/reconcile-payments — run complete", {
    checked: targetOrders.length,
    fixed: fixedCount,
    errors: errorCount,
    skipped: skippedCount,
    elapsedMs: elapsed,
  })

  return NextResponse.json({
    checked: targetOrders.length,
    fixed: fixedCount,
    errors: errorCount,
    skipped: skippedCount,
    elapsedMs: elapsed,
  })
}
