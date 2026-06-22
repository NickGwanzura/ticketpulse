import { eq, inArray, sql, and } from "drizzle-orm"

import { db } from "@/db"
import { ticketTiers } from "@/db/schema"

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

  // soldQuantity is atomically maintained by the checkout lock:
  //   - incremented during Phase 1 (order creation under advisory lock)
  //   - decremented on cancel (cancelWithInventoryRelease)
  //   - COALESCEd with 0 to handle NULL
  // We only need to read it directly instead of summing from pending orders.
  const tierRows = await db
    .select({
      id: ticketTiers.id,
      totalQuantity: ticketTiers.totalQuantity,
      soldQuantity: ticketTiers.soldQuantity,
    })
    .from(ticketTiers)
    .where(inArray(ticketTiers.id, uniqueTierIds))

  return new Map(
    tierRows.map((tier) => {
      const totalQuantity = Number(tier.totalQuantity ?? 0)
      const usedQuantity = Number(tier.soldQuantity ?? 0)
      return [tier.id, {
        tierId: tier.id,
        totalQuantity,
        confirmedTickets: usedQuantity, // soldQuantity IS the authoritative count
        reservedTickets: 0,             // already baked into soldQuantity
        usedQuantity: Math.min(totalQuantity, usedQuantity),
        availableQuantity: Math.max(0, totalQuantity - usedQuantity),
      }]
    }),
  )
}
