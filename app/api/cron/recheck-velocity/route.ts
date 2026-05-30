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
import { log } from "@/lib/logger"
import type { VelocityOrderMetadata } from "@/types/velocity"

const MAX_ORDERS_PER_RUN = 30
const RECHECK_COOLDOWN_MS = 60_000

export async function POST() {
  const startedAt = Date.now()
  log.info("cron/recheck-velocity — starting run")

  const cutoff = new Date(startedAt - RECHECK_COOLDOWN_MS)

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
    log.info("cron/recheck-velocity — no pending Velocity orders to recheck")
    return NextResponse.json({ checked: 0, fixed: 0, errors: 0 })
  }

  log.info(`cron/recheck-velocity — found ${targetOrders.length} orders to recheck`, {
    ids: targetOrders.map((o) => o.id),
  })

  let fixedCount = 0
  let errorCount = 0
  const results: Array<{
    orderId: string
    action: "skipped" | "fixed" | "error"
    reason?: string
  }> = []

  for (const order of targetOrders) {
    try {
      const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
      const velocityMeta = meta.velocity

      if (!velocityMeta?.transactionTrace || !velocityMeta?.salesOrderTrace) {
        results.push({
          orderId: order.id,
          action: "skipped",
          reason: "No Velocity transaction/sales-order trace in metadata",
        })
        continue
      }

      log.info("cron/recheck-velocity — polling transaction", {
        orderId: order.id,
        transactionTrace: velocityMeta.transactionTrace,
      })

      const pollResult = await pollTransaction(velocityMeta.transactionTrace)
      const normalized = normalizeVelocityPollResponse(pollResult)

      log.info("cron/recheck-velocity — poll result", {
        orderId: order.id,
        rawPollStatus: pollResult.body?.pollStatus,
        localStatus: normalized.localStatus,
        velocityPollStatus: normalized.velocityPollStatus,
        paymentStatus: pollResult.body?.paymentStatus,
      })

      if (normalized.localStatus === "UNKNOWN") {
        await db
          .update(orders)
          .set({
            updatedAt: new Date(),
            metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{velocity,pollStatus}', ${JSON.stringify(normalized.velocityPollStatus)}::jsonb)`,
          })
          .where(eq(orders.id, order.id))

        results.push({
          orderId: order.id,
          action: "skipped",
          reason: `Unknown payment status — pollStatus: ${normalized.velocityPollStatus ?? "missing"}, paymentStatus: ${normalized.velocityPaymentStatus ?? "missing"}. Requires admin review.`,
        })
        continue
      }

      if (normalized.localStatus !== "PAID") {
        await db
          .update(orders)
          .set({
            updatedAt: new Date(),
            metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{velocity,pollStatus}', ${JSON.stringify(normalized.velocityPollStatus)}::jsonb)`,
          })
          .where(eq(orders.id, order.id))

        results.push({
          orderId: order.id,
          action: "skipped",
          reason: `Transaction status is "${normalized.velocityPollStatus}" — not yet confirmed`,
        })
        continue
      }

      log.info("cron/recheck-velocity — finalizing workflow", {
        orderId: order.id,
        salesOrderTrace: velocityMeta.salesOrderTrace,
      })

      const finalizeResult = await finalizeWorkflow(velocityMeta.salesOrderTrace)

      const salesOrderStatus = finalizeResult.body.salesOrder.status
      log.info("cron/recheck-velocity — finalize result", {
        orderId: order.id,
        salesOrderStatus,
        invoiceId: finalizeResult.body.invoice.id,
        paidAmount: finalizeResult.body.salesOrder.paidAmount,
      })

      if (salesOrderStatus !== "PAID") {
        results.push({
          orderId: order.id,
          action: "skipped",
          reason: `Workflow finalization returned "${salesOrderStatus}" instead of PAID`,
        })
        continue
      }

      const invoiceId = finalizeResult.body.invoice.id
      const paidAmount = finalizeResult.body.salesOrder.paidAmount

      const updatedMeta: { velocity: VelocityOrderMetadata & { recheckedAt: string; finalizedByCron: boolean } } = {
        velocity: {
          ...velocityMeta,
          pollStatus: "SUCCESS",
          paymentRef: invoiceId,
          invoiceRef: invoiceId,
          finalizedAt: new Date().toISOString(),
          recheckedAt: new Date().toISOString(),
          finalizedByCron: true,
        },
      }

      await db
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          paymentRef: invoiceId,
          metadata: sql`${JSON.stringify(updatedMeta)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, order.id), inArray(orders.status, ["pending", "awaiting_verification"])))

      log.info("cron/recheck-velocity — order updated to paid", {
        orderId: order.id,
        invoiceId,
        paidAmount,
      })

      // ── Generate tickets and send confirmation ────────────────────────
      const delivery = await deliverTicketForPaidOrder(order.id)

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
        source: "cron",
        rawPayload: null,
      })

      log.info("cron/recheck-velocity — delivery result", {
        orderId: order.id,
        deliveryStatus: delivery.status,
        ticketCount: delivery.ticketCount,
      })

      fixedCount++
      results.push({ orderId: order.id, action: "fixed" })
    } catch (err) {
      errorCount++
      log.error("cron/recheck-velocity — error processing order", {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      })
      results.push({
        orderId: order.id,
        action: "error",
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const elapsed = Date.now() - startedAt
  log.info("cron/recheck-velocity — run complete", {
    checked: targetOrders.length,
    fixed: fixedCount,
    errors: errorCount,
    elapsedMs: elapsed,
  })

  return NextResponse.json({
    checked: targetOrders.length,
    fixed: fixedCount,
    errors: errorCount,
    elapsedMs: elapsed,
    results,
  })
}
