import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { merchItems, orders, orderItems, ticketTiers, tickets, promoCodes } from "@/db/schema"
import { log } from "@/lib/logger"
import { lockOrderMutation, type DbTx } from "@/lib/velocity/idempotency"

type ExpirableOrderMetadata = Record<string, unknown> & {
  inventoryReserved?: boolean
  promo?: { id?: string }
  archive?: Record<string, unknown> & {
    inventoryReleased?: boolean
    releasedMerchInventory?: boolean
  }
}

/** Restore reservations released by expiry before an expired order is paid. */
export async function restoreExpiredOrderInventory(
  tx: DbTx,
  order: typeof orders.$inferSelect,
  metadata: ExpirableOrderMetadata,
): Promise<void> {
  const items = await tx
    .select({
      tierId: orderItems.tierId,
      merchItemId: orderItems.merchItemId,
      type: orderItems.type,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))

  if (metadata.inventoryReserved === true) {
    for (const item of items) {
      if (item.type === "ticket" && item.tierId) {
        await tx
          .update(ticketTiers)
          .set({ soldQuantity: sql`COALESCE(${ticketTiers.soldQuantity}, 0) + ${item.quantity}` })
          .where(eq(ticketTiers.id, item.tierId))
      }
      if (
        item.type === "merch" &&
        item.merchItemId &&
        metadata.archive?.releasedMerchInventory === true
      ) {
        await tx
          .update(merchItems)
          .set({ soldQuantity: sql`COALESCE(${merchItems.soldQuantity}, 0) + ${item.quantity}` })
          .where(eq(merchItems.id, item.merchItemId))
      }
    }
  } else {
    const cancelledTickets = await tx
      .select({ tierId: tickets.tierId })
      .from(tickets)
      .where(eq(tickets.orderId, order.id))
    const perTier = new Map<string, number>()
    for (const ticket of cancelledTickets) {
      if (ticket.tierId) perTier.set(ticket.tierId, (perTier.get(ticket.tierId) ?? 0) + 1)
    }
    for (const [tierId, quantity] of perTier) {
      await tx
        .update(ticketTiers)
        .set({ soldQuantity: sql`COALESCE(${ticketTiers.soldQuantity}, 0) + ${quantity}` })
        .where(eq(ticketTiers.id, tierId))
    }
  }

  if (metadata.promo?.id) {
    await tx
      .update(promoCodes)
      .set({ usedCount: sql`COALESCE(${promoCodes.usedCount}, 0) + 1` })
      .where(eq(promoCodes.id, metadata.promo.id))
  }

  await tx.update(tickets).set({ status: "sold" }).where(eq(tickets.orderId, order.id))
}

/**
 * Expire a pending order and release its inventory reservation.
 *
 * The CAS update (WHERE status = 'pending') is the idempotency guard: only the
 * caller that flips the row to 'expired' performs the inventory release, so a
 * concurrent poll and cron run can't double-decrement soldQuantity.
 *
 * Returns true if this call expired the order, false if another process
 * already moved it out of 'pending' (paid, cancelled, or expired).
 */
export async function expireOrderAndReleaseInventory(orderId: string, reason = "payment_timeout"): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      await lockOrderMutation(tx, orderId)

      const [claimed] = await tx
        .update(orders)
        .set({ status: "expired", updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "awaiting_verification"])))
        .returning({ id: orders.id, metadata: orders.metadata })

      if (!claimed) return false

      const meta = (claimed.metadata ?? {}) as ExpirableOrderMetadata
      const items = await tx
        .select({
          tierId: orderItems.tierId,
          merchItemId: orderItems.merchItemId,
          type: orderItems.type,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))

      // New orders reserve inventory at checkout. Legacy orders only consume
      // ticket-tier inventory when ticket rows are created.
      const perTier = new Map<string, number>()
      if (meta.inventoryReserved === true) {
        for (const item of items) {
          if (item.type === "ticket" && item.tierId) {
            perTier.set(item.tierId, (perTier.get(item.tierId) ?? 0) + item.quantity)
          }
        }
      } else {
        const orderTickets = await tx
          .select({ tierId: tickets.tierId })
          .from(tickets)
          .where(eq(tickets.orderId, orderId))
        for (const ticket of orderTickets) {
          if (ticket.tierId) perTier.set(ticket.tierId, (perTier.get(ticket.tierId) ?? 0) + 1)
        }
      }

      for (const [tierId, quantity] of perTier) {
        await tx
          .update(ticketTiers)
          .set({ soldQuantity: sql`GREATEST(0, COALESCE(${ticketTiers.soldQuantity}, 0) - ${quantity})` })
          .where(eq(ticketTiers.id, tierId))
      }

      let releasedMerchInventory = false
      if (meta.inventoryReserved === true) {
        for (const item of items) {
          if (item.type === "merch" && item.merchItemId) {
            await tx
              .update(merchItems)
              .set({ soldQuantity: sql`GREATEST(0, COALESCE(${merchItems.soldQuantity}, 0) - ${item.quantity})` })
              .where(eq(merchItems.id, item.merchItemId))
            releasedMerchInventory = true
          }
        }
      }

      if (meta.promo?.id) {
        await tx
          .update(promoCodes)
          .set({ usedCount: sql`GREATEST(0, COALESCE(${promoCodes.usedCount}, 0) - 1)` })
          .where(eq(promoCodes.id, meta.promo.id))
      }

      await tx.update(tickets).set({ status: "cancelled" }).where(eq(tickets.orderId, orderId))

      const archivedAt = new Date().toISOString()
      await tx
        .update(orders)
        .set({
          metadata: {
            ...meta,
            archive: {
              ...(meta.archive ?? {}),
              status: "archived",
              reason,
              inventoryReleased: true,
              releasedMerchInventory,
              archivedAt,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))

      return true
    })
  } catch (err) {
    log.error("order-expiry — atomic expiry and inventory release failed", {
      orderId,
      error: String(err),
    })
    throw err
  }
}
