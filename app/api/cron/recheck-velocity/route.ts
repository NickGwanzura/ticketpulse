import { NextResponse } from "next/server"
import { and, eq, inArray, sql, lt } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import {
  pollTransaction,
  finalizeWorkflow,
  normalizeVelocityPollStatus,
} from "@/services/velocity"
import { log } from "@/lib/logger"
import type { VelocityOrderMetadata } from "@/types/velocity"

const MAX_ORDERS_PER_RUN = 30
const RECHECK_COOLDOWN_MS = 60_000 // skip orders checked in the last 60s

/**
 * Cron job to re-check pending/awaiting_verification Velocity orders.
 *
 * For each order:
 *   1. Poll the Velocity transaction using the stored transactionTrace
 *   2. If pollStatus === "SUCCESS", finalize the workflow via update-workflow
 *   3. If the sales order returns PAID, update the local DB
 *   4. Send verification email if not already sent
 *
 * Catches orders where the frontend polling stopped (browser close, tab switch,
 * serverless timeout) or where the email send failure left the order stuck.
 *
 * Designed to be called by Railway cron (every 1–5 minutes) or an external
 * scheduler like cron-job.org, GitHub Actions, or Vercel Cron Jobs.
 */
export async function POST() {
  const startedAt = Date.now()
  log.info("cron/recheck-velocity — starting run")

  // ── 1. Find pending / awaiting-verification Velocity orders ─────────────
  // Only pick up orders that haven't been rechecked in the last 60s.
  const cutoff = new Date(startedAt - RECHECK_COOLDOWN_MS)

  const targetOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      metadata: orders.metadata,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
    })
    .from(orders)
    .where(
      and(
        // Must have Velocity metadata
        sql`${orders.metadata}->>'velocity' IS NOT NULL`,
        // Must be in a re-checkable state
        inArray(orders.status, ["pending", "awaiting_verification"]),
        // Skip orders rechecked within the cooldown window
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

  // ── 2. Process each order ──────────────────────────────────────────────
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

      // ── 2a. Poll ──────────────────────────────────────────────────────
      log.info("cron/recheck-velocity — polling transaction", {
        orderId: order.id,
        transactionTrace: velocityMeta.transactionTrace,
      })

      const pollResult = await pollTransaction(velocityMeta.transactionTrace)
      const pollStatus = normalizeVelocityPollStatus(pollResult.body.pollStatus)

      log.info("cron/recheck-velocity — poll result", {
        orderId: order.id,
        rawPollStatus: pollResult.body.pollStatus,
        normalizedPollStatus: pollStatus,
        paymentStatus: pollResult.body.paymentStatus,
      })

      if (pollStatus !== "SUCCESS") {
        // Update the metadata with latest poll status so admin UIs show fresh data
        await db
          .update(orders)
          .set({
            updatedAt: new Date(),
            metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{velocity,pollStatus}', ${JSON.stringify(pollResult.body.pollStatus)}::jsonb)`,
          })
          .where(eq(orders.id, order.id))

        results.push({
          orderId: order.id,
          action: "skipped",
          reason: `Transaction status is "${pollResult.body.pollStatus}" — not yet confirmed`,
        })
        continue
      }

      // ── 2b. Finalize workflow ─────────────────────────────────────────
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

      // ── 2c. Update local DB ─────────────────────────────────────────────
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
          status: "awaiting_verification",
          paidAt: new Date(),
          paymentRef: invoiceId,
          metadata: sql`${JSON.stringify(updatedMeta)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))

      log.info("cron/recheck-velocity — order updated locally", {
        orderId: order.id,
        invoiceId,
        paidAmount,
      })

      // ── 2d. Send verification email (fire-and-forget on failure) ──────
      if (order.guestEmail && order.status !== "awaiting_verification") {
        try {
          const { startOrderVerification } = await import("@/lib/order-verification")
          const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
          await startOrderVerification({ orderId: order.id, email: order.guestEmail, origin })
          log.info("cron/recheck-velocity — verification email sent", { orderId: order.id })
        } catch (err) {
          // Non-critical — the order is already at awaiting_verification.
          // Admin can resend from the panel.
          log.warn("cron/recheck-velocity — verification email failed (order already fixed)", {
            orderId: order.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

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
