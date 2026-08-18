import { NextResponse } from "next/server"
import { and, eq, inArray, sql, lt } from "drizzle-orm"
import { db } from "@/db"
import { orders, paymentLedger, events } from "@/db/schema"
import {
  pollTransaction,
  finalizeWorkflow,
  normalizeVelocityPollResponse,
} from "@/services/velocity"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"
import { alertRecheckHighErrorRate } from "@/lib/payment-alerts"
import { sendAdminAlert } from "@/lib/whatsapp"
import { newPaymentAlert } from "@/lib/whatsapp-templates"
import type { VelocityOrderMetadata } from "@/types/velocity"
import { paymentAmountsMatch } from "@/lib/velocity/validation"

const MAX_ORDERS_PER_RUN = 30
const RECHECK_COOLDOWN_MS = 60_000

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError
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
      guestPhone: orders.guestPhone,
      paymentMethod: orders.paymentMethod,
      eventId: orders.eventId,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      eventTitle: events.title,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(
      and(
        sql`${orders.metadata}->>'velocity' IS NOT NULL`,
        inArray(orders.status, ["pending", "awaiting_verification"]),
        lt(orders.updatedAt, cutoff),
        sql`COALESCE(${events.endsAt}, ${events.startsAt}) > now()`,
      ),
    )
    .limit(MAX_ORDERS_PER_RUN)

  if (targetOrders.length === 0) {
    log.info("cron/recheck-velocity — no pending Velocity orders to recheck; continuing with delivery retries")
  } else {
    log.info(`cron/recheck-velocity — found ${targetOrders.length} orders to recheck`, {
      ids: targetOrders.map((o) => o.id),
    })
  }

  let fixedCount = 0
  let errorCount = 0
  let providerErrorCount = 0
  let newProviderIncidentCount = 0
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
      const polledAt = new Date().toISOString()
      const providerError = typeof pollResult.httpStatus === "number" && pollResult.httpStatus >= 400
      const consecutiveProviderErrors = providerError
        ? (velocityMeta.consecutiveProviderErrors ?? 0) + 1
        : 0
      if (providerError) {
        providerErrorCount++
        if (consecutiveProviderErrors === 1) newProviderIncidentCount++
      }
      const updatedVelocity = {
        ...velocityMeta,
        pollStatus: (normalized.velocityPollStatus as VelocityOrderMetadata["pollStatus"]) ?? "UNKNOWN",
        paymentStatus: normalized.velocityPaymentStatus ?? null,
        lastPolledAt: polledAt,
        lastProviderHttpStatus: pollResult.httpStatus ?? null,
        lastProviderError: pollResult.errorMessage ?? null,
        consecutiveProviderErrors,
      }
      const updatedOrderMetadata = {
        ...((order.metadata ?? {}) as Record<string, unknown>),
        velocity: updatedVelocity,
      }

      log.info("cron/recheck-velocity — poll result", {
        orderId: order.id,
        rawPollStatus: pollResult.body?.pollStatus,
        localStatus: normalized.localStatus,
        velocityPollStatus: normalized.velocityPollStatus,
        paymentStatus: pollResult.body?.paymentStatus,
      })

      if (normalized.localStatus === "UNKNOWN") {
        if (providerError) {
          await db
            .update(orders)
            .set({ updatedAt: new Date(), metadata: updatedOrderMetadata })
            .where(eq(orders.id, order.id))
          errorCount++
          results.push({
            orderId: order.id,
            action: "error",
            reason: `Velocity HTTP ${pollResult.httpStatus}: ${pollResult.errorMessage ?? "provider error"}`,
          })
          continue
        }

        await db
          .update(orders)
          .set({
            updatedAt: new Date(),
            metadata: updatedOrderMetadata,
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
            metadata: updatedOrderMetadata,
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
        await db
          .update(orders)
          .set({ updatedAt: new Date(), metadata: updatedOrderMetadata })
          .where(eq(orders.id, order.id))
        results.push({
          orderId: order.id,
          action: "skipped",
          reason: `Workflow finalization returned "${salesOrderStatus}" instead of PAID`,
        })
        continue
      }

      const invoiceId = finalizeResult.body.invoice.id
      const paidAmount = finalizeResult.body.salesOrder.paidAmount

      if (!paymentAmountsMatch(order.totalAmount, paidAmount)) {
        await db
          .update(orders)
          .set({ updatedAt: new Date(), metadata: updatedOrderMetadata })
          .where(eq(orders.id, order.id))
        results.push({
          orderId: order.id,
          action: "skipped",
          reason: `Velocity paid amount ${paidAmount} does not match order total ${order.totalAmount}`,
        })
        continue
      }

      const updatedMeta: { velocity: VelocityOrderMetadata & { recheckedAt: string; finalizedByCron: boolean } } = {
        velocity: {
          ...updatedVelocity,
          pollStatus: "SUCCESS",
          paymentStatus: normalized.velocityPaymentStatus ?? "SUCCESS",
          paymentRef: invoiceId,
          invoiceRef: invoiceId,
          finalizedAt: new Date().toISOString(),
          recheckedAt: new Date().toISOString(),
          finalizedByCron: true,
        },
      }

      const [claimed] = await db
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          completedAt: new Date(),
          paymentRef: invoiceId,
          // Merge only the velocity key — preserves promo, inventoryReserved,
          // questionResponses, and delivery metadata set by other parts of the system.
          metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{velocity}', ${JSON.stringify(updatedMeta.velocity)}::jsonb)`,
          updatedAt: new Date(),
        })
        .where(and(eq(orders.id, order.id), inArray(orders.status, ["pending", "awaiting_verification"])))
        .returning({ id: orders.id })

      if (!claimed) {
        results.push({ orderId: order.id, action: "skipped", reason: "Order was already processed by another payment worker" })
        continue
      }

      log.info("cron/recheck-velocity — order updated to paid", {
        orderId: order.id,
        invoiceId,
        paidAmount,
      })

      // ── Record in ledger first so re-runs are idempotent ─────────────
      try {
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
        }).onConflictDoNothing()
      } catch {
        // Duplicate — already recorded, safe to continue
      }

      // ── Generate tickets and send confirmation ────────────────────────
      const delivery = await deliverTicketForPaidOrder(order.id)

      log.info("cron/recheck-velocity — delivery result", {
        orderId: order.id,
        deliveryStatus: delivery.status,
        ticketCount: delivery.ticketCount,
      })

      fixedCount++
      results.push({ orderId: order.id, action: "fixed" })

      // WhatsApp admin alert — fire-and-forget, same as the real-time poll path
      sendAdminAlert(
        newPaymentAlert(
          order.eventTitle ?? "Unknown event",
          order.totalAmount,
          order.currency ?? "USD",
          order.guestName ?? order.guestEmail ?? "Anonymous",
          order.guestPhone ?? "—",
          order.paymentMethod ?? "velocity-card",
          order.id,
          invoiceId,
        ),
      ).catch((err) =>
        log.error("cron/recheck-velocity — whatsapp alert failed", {
          orderId: order.id,
          error: String(err),
        }),
      )
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

  // ── Retry failed deliveries ───────────────────────────────────────────────
  // Covers EMAIL_FAILED (email bounced), FAILED (delivery threw), and null
  // (free/promo orders where delivery was killed before writing status).
  const failedDeliveryOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        inArray(orders.status, ["paid", "completed"]),
        sql`(
          ${orders.metadata}->'delivery'->>'status' IN ('EMAIL_FAILED', 'FAILED')
          OR ${orders.metadata}->'delivery' IS NULL
          OR ${orders.metadata}->>'delivery' IS NULL
        )`,
        lt(orders.updatedAt, cutoff),
      ),
    )
    .limit(10)

  let retriedCount = 0
  for (const order of failedDeliveryOrders) {
    try {
      const delivery = await deliverTicketForPaidOrder(order.id)
      if (delivery.emailSent) {
        retriedCount++
        log.info("cron/recheck-velocity — retried failed delivery", { orderId: order.id, status: delivery.status })
      }
    } catch (err) {
      log.error("cron/recheck-velocity — retry delivery failed", {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const elapsed = Date.now() - startedAt
  log.info("cron/recheck-velocity — run complete", {
    checked: targetOrders.length,
    fixed: fixedCount,
    retried: retriedCount,
    errors: errorCount,
    elapsedMs: elapsed,
  })

  // Alert on high error rates — indicates systemic issue with Velocity API
  // Provider errors are persisted per order. Only alert when an order enters
  // a new provider-error streak; otherwise every five-minute cron run would
  // send the same email again from a fresh serverless process.
  const hasNonProviderProcessingErrors = errorCount > providerErrorCount
  if (targetOrders.length > 0 && (newProviderIncidentCount > 0 || hasNonProviderProcessingErrors)) {
    alertRecheckHighErrorRate(
      targetOrders.length,
      errorCount,
      fixedCount,
      results.filter((r) => r.action === "error").map((r) => ({ orderId: r.orderId, reason: r.reason })),
    ).catch(() => {})
  }

  return NextResponse.json({
    checked: targetOrders.length,
    fixed: fixedCount,
    retried: retriedCount,
    errors: errorCount,
    elapsedMs: elapsed,
    results,
  })
}
