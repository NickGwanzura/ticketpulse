import { NextResponse } from "next/server"
import { lte, and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders, orderItems, ticketTiers, tickets, paymentLedger } from "@/db/schema"
import { verifyCronSecret } from "@/lib/cron-auth"
import { log } from "@/lib/logger"
import { pollTransaction, normalizeVelocityPollResponse } from "@/services/velocity"
import type { VelocityOrderMetadata } from "@/types/velocity"

export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError
  const pendingCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const awaitingCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)

  const pendingStale = await db
    .select({ id: orders.id, status: orders.status, metadata: orders.metadata, eventId: orders.eventId, totalAmount: orders.totalAmount, currency: orders.currency })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lte(orders.createdAt, pendingCutoff)))
    .limit(50)

  const awaitingStale = await db
    .select({ id: orders.id, status: orders.status, metadata: orders.metadata, eventId: orders.eventId, totalAmount: orders.totalAmount, currency: orders.currency })
    .from(orders)
    .where(and(eq(orders.status, "awaiting_verification"), lte(orders.createdAt, awaitingCutoff)))
    .limit(50)

  const staleOrders = [...pendingStale, ...awaitingStale]

  if (staleOrders.length === 0) {
    log.info("cron/expire-orders — no stale orders to expire")
    return NextResponse.json({ expired: 0 })
  }

  const ids = staleOrders.map((o) => o.id)

  const skippedVelocity: string[] = []

  for (const order of staleOrders) {
    const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const velocityMeta = meta.velocity

    if (velocityMeta?.pollStatus === "SUCCESS" || velocityMeta?.paymentRef) {
      log.warn("cron/expire-orders — skipping order with confirmed Velocity payment", {
        orderId: order.id,
        status: order.status,
        pollStatus: velocityMeta.pollStatus,
        paymentRef: velocityMeta.paymentRef,
      })

      await db.insert(paymentLedger).values({
        orderId: order.id,
        eventId: order.eventId,
        transactionTrace: velocityMeta.transactionTrace ?? "",
        salesOrderTrace: velocityMeta.salesOrderTrace,
        amount: order.totalAmount,
        currency: order.currency ?? "USD",
        processor: "velocity",
        velocityPollStatus: velocityMeta.pollStatus ?? "UNKNOWN",
        localStatus: order.status ?? "unknown",
        source: "cron",
        rawPayload: null,
        errorMessage: "Cron attempted to expire but order has confirmed Velocity payment",
      })

      skippedVelocity.push(order.id)
      continue
    }

    // Live-poll any order with a Velocity transaction trace that hasn't been
    // confirmed yet. This acts as a last-resort safety net in case
    // recheck-velocity missed it. On poll failure we skip (safer than expiring
    // a potentially paid order).
    if (velocityMeta?.transactionTrace) {
      try {
        const pollResult = await pollTransaction(velocityMeta.transactionTrace)
        const normalized = normalizeVelocityPollResponse(pollResult)

        if (normalized.localStatus === "PAID") {
          log.warn("cron/expire-orders — live poll shows PAID, skipping expiry (recheck-velocity will finalize)", {
            orderId: order.id,
            transactionTrace: velocityMeta.transactionTrace,
            pollStatus: normalized.velocityPollStatus,
          })
          skippedVelocity.push(order.id)
          continue
        }

        log.info("cron/expire-orders — live poll confirmed not paid, proceeding with expiry", {
          orderId: order.id,
          localStatus: normalized.localStatus,
          pollStatus: normalized.velocityPollStatus,
        })
      } catch (pollErr) {
        log.warn("cron/expire-orders — live poll failed, skipping expiry to be safe", {
          orderId: order.id,
          transactionTrace: velocityMeta.transactionTrace,
          error: String(pollErr),
        })
        skippedVelocity.push(order.id)
        continue
      }
    }

    // Determine whether inventory was reserved for this order.
    // New orders (inventoryReserved=true): soldQuantity was incremented at checkout,
    //   so we always decrement using orderItems quantities.
    // Legacy orders: soldQuantity is only incremented at ticket delivery,
    //   so we only decrement if tickets were actually created.
    const orderMeta = (order.metadata ?? {}) as Record<string, unknown>
    const inventoryReserved = orderMeta.inventoryReserved === true

    let tierDecrement: Map<string, number> | null = null

    if (inventoryReserved) {
      const items = await db
        .select({ tierId: orderItems.tierId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
      tierDecrement = new Map()
      for (const item of items) {
        if (item.tierId) tierDecrement.set(item.tierId, (tierDecrement.get(item.tierId) ?? 0) + item.quantity)
      }
    } else {
      // Legacy: only decrement if tickets were physically created
      const orderTickets = await db
        .select({ tierId: tickets.tierId })
        .from(tickets)
        .where(eq(tickets.orderId, order.id))
      if (orderTickets.length > 0) {
        tierDecrement = new Map()
        for (const t of orderTickets) {
          if (t.tierId) tierDecrement.set(t.tierId, (tierDecrement.get(t.tierId) ?? 0) + 1)
        }
      }
    }

    if (tierDecrement && tierDecrement.size > 0) {
      await Promise.all(
        Array.from(tierDecrement).map(([tierId, qty]) =>
          db
            .update(ticketTiers)
            .set({ soldQuantity: sql`GREATEST(0, ${ticketTiers.soldQuantity} - ${qty})` })
            .where(eq(ticketTiers.id, tierId)),
        ),
      )
    }

    await db.insert(paymentLedger).values({
      orderId: order.id,
      eventId: order.eventId,
      transactionTrace: velocityMeta?.transactionTrace ?? "",
      salesOrderTrace: velocityMeta?.salesOrderTrace ?? "",
      amount: order.totalAmount,
      currency: order.currency ?? "USD",
      processor: "velocity",
      velocityPollStatus: velocityMeta?.pollStatus ?? "UNKNOWN",
      localStatus: "expired",
      source: "cron",
      errorMessage: "Order expired by cron",
    })
  }

  const expireIds = ids.filter((id) => !skippedVelocity.includes(id))

  if (expireIds.length > 0) {
    await db
      .update(orders)
      .set({ status: "expired", updatedAt: new Date() })
      .where(inArray(orders.id, expireIds))

    await db
      .update(tickets)
      .set({ status: "cancelled" })
      .where(inArray(tickets.orderId, expireIds))

    log.info(`cron/expire-orders — expired ${expireIds.length} orders, skipped ${skippedVelocity.length} with confirmed payments`, {
      expired: expireIds,
      skippedVelocity,
    })
  }

  return NextResponse.json({
    expired: expireIds.length,
    skipped: skippedVelocity.length,
  })
}
