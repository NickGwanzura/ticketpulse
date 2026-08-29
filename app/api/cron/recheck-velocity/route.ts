import { and, eq, inArray, lt, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { verifyCronSecret } from "@/lib/cron-auth"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { log } from "@/lib/logger"
import { alertRecheckHighErrorRate, alertVelocityManualReviewRequired } from "@/lib/payment-alerts"
import { reconcileVelocityOrder } from "@/lib/velocity/reconciliation"
import { sendAdminAlert } from "@/lib/whatsapp"
import { newPaymentAlert } from "@/lib/whatsapp-templates"
import type { VelocityOrderMetadata } from "@/types/velocity"

const MAX_ORDERS_PER_RUN = 30
const RECHECK_COOLDOWN_MS = 60_000

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const startedAt = Date.now()
  const cutoff = new Date(startedAt - RECHECK_COOLDOWN_MS)
  const targetOrders = await db
    .select({
      id: orders.id,
      metadata: orders.metadata,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      guestPhone: orders.guestPhone,
      paymentMethod: orders.paymentMethod,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      eventTitle: events.title,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(and(
      sql`${orders.metadata}->>'velocity' IS NOT NULL`,
      inArray(orders.status, ["pending", "awaiting_verification"]),
      lt(orders.updatedAt, cutoff),
      // Orders already flagged for manual review have a structurally
      // unpollable reference or exceeded the provider-error cap — retrying
      // them further just burns Velocity API calls for no benefit.
      sql`COALESCE((${orders.metadata}->'velocity'->>'manualReviewRequired')::boolean, false) = false`,
    ))
    .limit(MAX_ORDERS_PER_RUN)

  let fixedCount = 0
  let errorCount = 0
  let providerErrorCount = 0
  let newProviderIncidentCount = 0
  const results: Array<{ orderId: string; action: "skipped" | "fixed" | "error"; reason?: string }> = []

  for (const order of targetOrders) {
    try {
      const velocity = ((order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }).velocity
      if (!velocity?.transactionTrace || !velocity.salesOrderTrace) {
        results.push({ orderId: order.id, action: "skipped", reason: "Velocity references are missing" })
        continue
      }

      const previousProviderErrors = velocity.consecutiveProviderErrors ?? 0
      const result = await reconcileVelocityOrder({ orderId: order.id, source: "cron" })

      if (result.paid) {
        const delivery = await deliverTicketForPaidOrder(order.id)
        if (result.newlySettled) {
          fixedCount++
          sendAdminAlert(newPaymentAlert(
            order.eventTitle ?? "Unknown event",
            order.totalAmount,
            order.currency ?? "USD",
            order.guestName ?? order.guestEmail ?? "Anonymous",
            order.guestPhone ?? "—",
            order.paymentMethod ?? "velocity-card",
            order.id,
            result.invoiceId ?? "—",
          )).catch((error) => log.warn("cron/recheck-velocity - admin alert failed", { orderId: order.id, error: String(error) }))
        }
        results.push({
          orderId: order.id,
          action: result.newlySettled ? "fixed" : "skipped",
          reason: `Paid; delivery ${delivery.status}`,
        })
        continue
      }

      const providerError = result.state === "PROVIDER_ERROR" || result.state === "NETWORK_ERROR" || result.state === "UNPOLLABLE"
      const processingError = ["FINALIZE_ERROR", "FINALIZE_PENDING", "AMOUNT_MISMATCH", "CONFLICT"].includes(result.state)
      if (providerError || processingError) {
        errorCount++
        if (providerError) {
          providerErrorCount++
          if (previousProviderErrors === 0) newProviderIncidentCount++
        }
        results.push({ orderId: order.id, action: "error", reason: `${result.state}: ${result.message ?? "unknown error"}` })
      } else {
        results.push({ orderId: order.id, action: "skipped", reason: `${result.state}: ${result.message ?? "not settled"}` })
      }

      // This order just stopped being auto-retried (see the SQL exclusion
      // above) — fire the one alert an admin will get for it, since the
      // batch-level alertRecheckHighErrorRate below won't repeat per-order.
      if (result.manualReviewRequired) {
        alertVelocityManualReviewRequired(
          order.id,
          result.transactionTrace,
          result.salesOrderTrace,
          result.message ?? "Velocity payment could not be automatically reconciled.",
          order.paymentMethod ?? undefined,
        ).catch((error) => log.warn("cron/recheck-velocity - manual review alert failed", { orderId: order.id, error: String(error) }))
      }
    } catch (error) {
      errorCount++
      const reason = error instanceof Error ? error.message : String(error)
      log.error("cron/recheck-velocity - order reconciliation failed", { orderId: order.id, error: reason })
      results.push({ orderId: order.id, action: "error", reason })
    }
  }

  const failedDeliveryOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(
      inArray(orders.status, ["paid", "completed"]),
      sql`(
        ${orders.metadata}->'delivery'->>'status' IN ('EMAIL_FAILED', 'FAILED')
        OR ${orders.metadata}->'delivery' IS NULL
        OR ${orders.metadata}->>'delivery' IS NULL
      )`,
      lt(orders.updatedAt, cutoff),
    ))
    .limit(10)

  let retriedCount = 0
  for (const order of failedDeliveryOrders) {
    try {
      const delivery = await deliverTicketForPaidOrder(order.id)
      if (delivery.emailSent) retriedCount++
    } catch (error) {
      log.error("cron/recheck-velocity - delivery retry failed", { orderId: order.id, error: String(error) })
    }
  }

  const hasNonProviderProcessingErrors = errorCount > providerErrorCount
  if (targetOrders.length > 0 && (newProviderIncidentCount > 0 || hasNonProviderProcessingErrors)) {
    alertRecheckHighErrorRate(
      targetOrders.length,
      errorCount,
      fixedCount,
      results.filter((result) => result.action === "error").map((result) => ({ orderId: result.orderId, reason: result.reason })),
    ).catch(() => {})
  }

  return NextResponse.json({
    checked: targetOrders.length,
    fixed: fixedCount,
    retried: retriedCount,
    errors: errorCount,
    elapsedMs: Date.now() - startedAt,
    results,
  })
}
