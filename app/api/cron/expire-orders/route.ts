import { NextResponse } from "next/server"
import { lte, and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders, orderItems, ticketTiers, tickets } from "@/db/schema"
import { log } from "@/lib/logger"

/**
 * Cron job to expire stale pending orders older than 24 hours.
 *
 * Expired orders are marked "expired" and their inventory is freed.
 * Designed to be called by Railway cron or any external scheduler.
 */
export async function POST() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const staleOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lte(orders.createdAt, cutoff)))
    .limit(100)

  if (staleOrders.length === 0) {
    log.info("cron/expire-orders — no stale orders to expire")
    return NextResponse.json({ expired: 0 })
  }

  const ids = staleOrders.map((o) => o.id)

  // Free inventory for any tiers that had soldQuantity incremented
  // (shouldn't happen for pending orders, but be safe)
  for (const id of ids) {
    const items = await db
      .select({ tierId: orderItems.tierId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, id))

    const tierMap = new Map<string, number>()
    for (const item of items) {
      if (item.tierId) {
        tierMap.set(item.tierId, (tierMap.get(item.tierId) ?? 0) + item.quantity)
      }
    }

    for (const [tierId, qty] of tierMap) {
      await db
        .update(ticketTiers)
        .set({
          soldQuantity: sql`${ticketTiers.soldQuantity} - ${qty}`,
        })
        .where(eq(ticketTiers.id, tierId))
    }
  }

  await db
    .update(orders)
    .set({ status: "expired", updatedAt: new Date() })
    .where(inArray(orders.id, ids))

  // Cancel any associated tickets
  await db
    .update(tickets)
    .set({ status: "cancelled" })
    .where(inArray(tickets.orderId, ids))

  log.info(`cron/expire-orders — expired ${ids.length} stale orders`, { ids })

  return NextResponse.json({ expired: ids.length })
}
