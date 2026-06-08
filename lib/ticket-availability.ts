import { and, eq, inArray, sql } from "drizzle-orm"

import { db } from "@/db"
import { orderItems, orders, tickets, ticketTiers } from "@/db/schema"

const DEFAULT_RESERVATION_MINUTES = 30

export type TierAvailability = {
  tierId: string
  totalQuantity: number
  confirmedTickets: number
  reservedTickets: number
  usedQuantity: number
  availableQuantity: number
}

export async function getTierAvailability(
  tierIds: string[],
  opts: { reservationMinutes?: number } = {},
): Promise<Map<string, TierAvailability>> {
  const uniqueTierIds = [...new Set(tierIds)].filter(Boolean)
  if (uniqueTierIds.length === 0) return new Map()

  const reservationMinutes = opts.reservationMinutes ?? DEFAULT_RESERVATION_MINUTES

  const [tierRows, confirmedRows, reservationRows] = await Promise.all([
    db
      .select({
        id: ticketTiers.id,
        totalQuantity: ticketTiers.totalQuantity,
      })
      .from(ticketTiers)
      .where(inArray(ticketTiers.id, uniqueTierIds)),
    db
      .select({
        tierId: tickets.tierId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(tickets)
      .where(and(
        inArray(tickets.tierId, uniqueTierIds),
        eq(tickets.isStaffTicket, false),
        sql`${tickets.status} NOT IN ('cancelled', 'refunded')`,
      ))
      .groupBy(tickets.tierId),
    db
      .select({
        tierId: orderItems.tierId,
        quantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(
        inArray(orderItems.tierId, uniqueTierIds),
        inArray(orders.status, ["pending", "awaiting_verification"]),
        sql`${orders.metadata}->>'inventoryReserved' = 'true'`,
        sql`${orders.createdAt} > now() - (${reservationMinutes} || ' minutes')::interval`,
      ))
      .groupBy(orderItems.tierId),
  ])

  const confirmedByTier = new Map(
    confirmedRows
      .filter((row) => row.tierId)
      .map((row) => [row.tierId!, Number(row.count ?? 0)]),
  )
  const reservedByTier = new Map(
    reservationRows
      .filter((row) => row.tierId)
      .map((row) => [row.tierId!, Number(row.quantity ?? 0)]),
  )

  return new Map(
    tierRows.map((tier) => {
      const confirmedTickets = confirmedByTier.get(tier.id) ?? 0
      const reservedTickets = reservedByTier.get(tier.id) ?? 0
      const totalQuantity = Number(tier.totalQuantity ?? 0)
      const usedQuantity = Math.min(totalQuantity, confirmedTickets + reservedTickets)
      return [tier.id, {
        tierId: tier.id,
        totalQuantity,
        confirmedTickets,
        reservedTickets,
        usedQuantity,
        availableQuantity: Math.max(0, totalQuantity - usedQuantity),
      }]
    }),
  )
}
