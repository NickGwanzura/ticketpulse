import "server-only"
import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders, paymentLedger } from "@/db/schema"
import { restoreExpiredOrderInventory } from "@/lib/order-expiry"
import { lockOrderMutation } from "@/lib/velocity/idempotency"
import { getSalesOrderById } from "@/services/velocity"
import type { VelocitySalesOrderLookup } from "@/types/velocity"

export function confirmedSalesOrder(remote: VelocitySalesOrderLookup, id: string, trace: string, total: string, currency: string): boolean {
  const expected = Number(total)
  return remote.id === id && remote.trace === trace && remote.currencyCodeString === currency && remote.status === "PAID" &&
    Number.isFinite(expected) && expected > 0 &&
    Number(remote.grandTotal) === expected && Number(remote.paidAmount) === expected &&
    Number(remote.outstandingAmount) === 0
}

export function protectedFromRecovery(order: { status: string | null; metadata: unknown }): boolean {
  const meta = (order.metadata ?? {}) as { manualCompletion?: unknown; velocity?: { manualCompletionAt?: unknown } }
  return ["paid", "completed", "cancelled", "refunded"].includes(order.status ?? "") ||
    Boolean(meta.manualCompletion || meta.velocity?.manualCompletionAt)
}

/** Read-only provider lookup; never advances a workflow or invents a transaction/invoice. */
export async function recoverPaidSalesOrder(orderId: string, source: string, options: { bypassCooldown?: boolean } = {}) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) throw new Error("Order not found")
  if (protectedFromRecovery(order)) return { paid: ["paid", "completed"].includes(order.status ?? ""), newlySettled: false, status: order.status, safeToExpire: false }
  const metadata = (order.metadata ?? {}) as Record<string, unknown>
  const velocity = metadata.velocity as { salesOrderId?: string; salesOrderTrace?: string } | undefined
  if (!velocity) return { paid: false, newlySettled: false, status: order.status, safeToExpire: true }
  if (!velocity.salesOrderId || !velocity.salesOrderTrace) return { paid: false, newlySettled: false, status: order.status, safeToExpire: false }
  if (!options.bypassCooldown) {
    const now = new Date()
    const [claim] = await db.update(orders).set({
      metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{salesOrderCheckRequestedAt}', ${JSON.stringify(now.toISOString())}::jsonb)`,
    }).where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "awaiting_verification", "expired"]),
      sql`COALESCE(${orders.metadata}->>'salesOrderCheckRequestedAt', '') < ${new Date(now.getTime() - 60_000).toISOString()}`,
    )).returning({ id: orders.id })
    if (!claim) {
      const cached = metadata.unpaidSalesOrderCheck as { verifiedAt?: string; id?: string; trace?: string; total?: string; currency?: string } | undefined
      const fresh = cached?.verifiedAt && Date.now() - Date.parse(cached.verifiedAt) < 60_000
      return { paid: false, newlySettled: false, status: order.status, safeToExpire: Boolean(fresh && cached?.id === velocity.salesOrderId && cached.trace === velocity.salesOrderTrace && cached.total === order.totalAmount && cached.currency === order.currency) }
    }
  }
  const remote = await getSalesOrderById(velocity.salesOrderId)
  if (!confirmedSalesOrder(remote, velocity.salesOrderId, velocity.salesOrderTrace, order.totalAmount, order.currency ?? "USD")) {
    const safeToExpire =
      remote.id === velocity.salesOrderId && remote.trace === velocity.salesOrderTrace &&
      remote.currencyCodeString === (order.currency ?? "USD") && remote.status === "UNPAID" && Number(remote.paidAmount) === 0 &&
      Number(remote.grandTotal) === Number(order.totalAmount) && Number(remote.outstandingAmount) === Number(order.totalAmount)
    if (safeToExpire) await db.update(orders).set({ metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{unpaidSalesOrderCheck}', ${JSON.stringify({ verifiedAt: new Date().toISOString(), id: remote.id, trace: remote.trace, total: order.totalAmount, currency: order.currency })}::jsonb)` }).where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "awaiting_verification", "expired"])))
    return { paid: false, newlySettled: false, status: order.status, safeToExpire }
  }
  return db.transaction(async (tx) => {
    if (order.status === "expired") await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`recovery-buyer:${order.eventId}:${(order.guestEmail ?? order.guestPhone ?? order.id).toLowerCase()}`}))`)
    await lockOrderMutation(tx, orderId)
    const [current] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!current) throw new Error("Order disappeared")
    if (protectedFromRecovery(current)) return { paid: ["paid", "completed"].includes(current.status ?? ""), newlySettled: false, status: current.status, safeToExpire: false }
    const meta = (current.metadata ?? {}) as Record<string, unknown>
    const active = meta.velocity as typeof velocity
    if (current.currency !== order.currency || current.totalAmount !== order.totalAmount || active?.salesOrderId !== remote.id || active.salesOrderTrace !== remote.trace) throw new Error("Order changed during sales-order verification")
    const [existing] = await tx.select({ id: paymentLedger.id }).from(paymentLedger).where(and(
      eq(paymentLedger.orderId, orderId), inArray(paymentLedger.localStatus, ["paid", "completed", "success", "paid_success"]),
    )).limit(1)
    if (existing) throw new Error("Order already has a settled ledger entry; requires review")
    if (current.status === "expired") {
      const replacements = await tx.select({ id: orders.id }).from(orders).where(and(
        eq(orders.eventId, current.eventId), inArray(orders.status, ["paid", "completed"]),
        sql`${orders.id} <> ${orderId}`,
        sql`(${current.guestEmail ?? ""} <> '' AND lower(${orders.guestEmail}) = lower(${current.guestEmail ?? ""}) OR ${current.guestPhone ?? ""} <> '' AND regexp_replace(${orders.guestPhone}, '[^0-9]', '', 'g') = regexp_replace(${current.guestPhone ?? ""}, '[^0-9]', '', 'g'))`,
      )).limit(5)
      if (replacements.length || (!current.guestEmail && !current.guestPhone)) {
        await tx.update(orders).set({ metadata: { ...meta, recoveryReview: { reason: "possible_replacement_fulfillment", relatedOrderIds: replacements.map((row) => row.id), checkedAt: new Date().toISOString() } } }).where(eq(orders.id, orderId))
        return { paid: false, newlySettled: false, status: current.status, safeToExpire: false }
      }
    }
    if (current.status === "expired") await restoreExpiredOrderInventory(tx, current, meta)
    const now = new Date()
    await tx.update(orders).set({ status: "paid", paidAt: current.paidAt ?? now, completedAt: current.completedAt ?? now, updatedAt: now,
      metadata: { ...meta, velocity: { ...active, outstandingAmount: 0, manualReviewRequired: false, manualReviewReason: null, failedAt: null, failureReason: null,
        salesOrderVerifiedAt: now.toISOString(), salesOrderStatus: "PAID", recoverySource: source },
        ...(current.status === "expired" ? { archive: { ...(meta.archive as object ?? {}), status: "recovered", recoveredAt: now.toISOString(), recoveredBy: source } } : {}) },
    }).where(eq(orders.id, orderId))
    await tx.insert(paymentLedger).values({ orderId, eventId: current.eventId, transactionTrace: `sales-order:${remote.id}`, salesOrderTrace: remote.trace,
      amount: current.totalAmount, currency: current.currency ?? "USD", processor: "velocity", localStatus: "paid", source,
      rawPayload: { verification: "sales_order_lookup", salesOrder: remote },
    })
    return { paid: true, newlySettled: true, status: "paid", safeToExpire: false }
  })
}
