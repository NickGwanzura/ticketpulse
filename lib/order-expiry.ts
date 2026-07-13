import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders, orderItems, ticketTiers, tickets, promoCodes } from "@/db/schema"
import { log } from "@/lib/logger"

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
export async function expireOrderAndReleaseInventory(orderId: string): Promise<boolean> {
  const [claimed] = await db
    .update(orders)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id, metadata: orders.metadata })

  if (!claimed) return false

  const meta = (claimed.metadata ?? {}) as { inventoryReserved?: boolean; promo?: { id?: string } }

  try {
    // New orders (inventoryReserved=true): soldQuantity was incremented at
    // checkout, so decrement using orderItems quantities. Legacy orders only
    // increment soldQuantity at ticket delivery, so only decrement per
    // physically created ticket.
    const perTier = new Map<string, number>()

    if (meta.inventoryReserved === true) {
      const items = await db
        .select({ tierId: orderItems.tierId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
      for (const item of items) {
        if (item.tierId) perTier.set(item.tierId, (perTier.get(item.tierId) ?? 0) + item.quantity)
      }
    } else {
      const orderTickets = await db
        .select({ tierId: tickets.tierId })
        .from(tickets)
        .where(eq(tickets.orderId, orderId))
      for (const t of orderTickets) {
        if (t.tierId) perTier.set(t.tierId, (perTier.get(t.tierId) ?? 0) + 1)
      }
    }

    for (const [tierId, qty] of perTier) {
      await db
        .update(ticketTiers)
        .set({ soldQuantity: sql`GREATEST(0, ${ticketTiers.soldQuantity} - ${qty})` })
        .where(eq(ticketTiers.id, tierId))
    }

    if (meta.promo?.id) {
      await db
        .update(promoCodes)
        .set({ usedCount: sql`GREATEST(0, ${promoCodes.usedCount} - 1)` })
        .where(eq(promoCodes.id, meta.promo.id))
    }

    await db.update(tickets).set({ status: "cancelled" }).where(eq(tickets.orderId, orderId))
  } catch (err) {
    // Order is already expired; a failed release here leaves soldQuantity
    // inflated until the expire-orders cron... which skips non-pending orders,
    // so log loudly for manual follow-up.
    log.error("order-expiry — inventory release failed after expiring order", {
      orderId,
      error: String(err),
    })
  }

  return true
}
