import "server-only"

import { sql } from "drizzle-orm"
import { db } from "@/db"

export type TicketTierSales = {
  id: string
  eventId: string
  name: string
  price: number
  currency: string
  capacity: number
  sold: number
  complimentary: number
  reserved: number
  remaining: number
  /** Revenue in the tier's current currency; use the breakdown for historical currencies. */
  revenue: number
  revenueByCurrency?: { currency: string; amount: number }[]
}

/** Call only with event IDs the caller has already authorized. */
export async function getTicketTierSales(eventIds: string[]): Promise<Map<string, TicketTierSales[]>> {
  const byEvent = new Map<string, TicketTierSales[]>()
  if (eventIds.length === 0) return byEvent

  // Aggregate issued tickets separately from order items so duplicate line items
  // cannot multiply ticket counts. Inventory includes pending checkout holds.
  // Revenue uses the sold price snapshot, including order-level promo discounts,
  // and only the delivered portion of a partially issued/refunded allocation.
  const result = await db.execute(sql`
    WITH scoped_orders AS (
      SELECT id, event_id, payment_method, total_amount, currency
      FROM orders
      WHERE event_id IN (${sql.join(eventIds.map(id => sql`${id}`), sql`, `)})
        AND status IN ('paid', 'completed')
    ), issued AS (
      SELECT t.event_id, t.tier_id, t.order_id, o.payment_method,
             COUNT(*)::int AS quantity
      FROM tickets t
      INNER JOIN scoped_orders o ON o.id = t.order_id AND o.event_id = t.event_id
      WHERE t.is_staff_ticket = false AND t.status IN ('sold', 'used')
      GROUP BY t.event_id, t.tier_id, t.order_id, o.payment_method
    ), counts AS (
      SELECT event_id, tier_id,
             COALESCE(SUM(quantity) FILTER (WHERE payment_method IS DISTINCT FROM 'complimentary'), 0) AS sold,
             COALESCE(SUM(quantity) FILTER (WHERE payment_method = 'complimentary'), 0) AS complimentary
      FROM issued GROUP BY event_id, tier_id
    ), order_totals AS (
      SELECT oi.order_id, SUM(oi.total) AS total
      FROM order_items oi INNER JOIN scoped_orders o ON o.id = oi.order_id
      GROUP BY oi.order_id
    ), tier_items AS (
      SELECT oi.order_id, oi.tier_id, SUM(oi.quantity) AS quantity, SUM(oi.total) AS total
      FROM order_items oi INNER JOIN scoped_orders o ON o.id = oi.order_id
      WHERE oi.type = 'ticket' AND oi.quantity > 0
      GROUP BY oi.order_id, oi.tier_id
    ), revenue AS (
      SELECT i.event_id, i.tier_id, COALESCE(o.currency, 'USD') AS currency,
             SUM(LEAST(i.quantity, ti.quantity) * ti.total / ti.quantity
                 * LEAST(1, GREATEST(0, o.total_amount) / NULLIF(ot.total, 0))) AS amount
      FROM issued i
      INNER JOIN tier_items ti ON ti.order_id = i.order_id AND ti.tier_id = i.tier_id
      INNER JOIN scoped_orders o ON o.id = i.order_id
      INNER JOIN order_totals ot ON ot.order_id = i.order_id
      WHERE i.payment_method IS DISTINCT FROM 'complimentary'
      GROUP BY i.event_id, i.tier_id, o.currency
    )
    SELECT tt.id, tt.event_id AS "eventId", tt.name, tt.price, tt.currency,
           tt.total_quantity AS capacity, tt.sold_quantity AS allocated,
           COALESCE(c.sold, 0) AS sold, COALESCE(c.complimentary, 0) AS complimentary,
           COALESCE(r.amount, 0) AS revenue, r.currency AS "revenueCurrency"
    FROM ticket_tiers tt
    LEFT JOIN counts c ON c.event_id = tt.event_id AND c.tier_id = tt.id
    LEFT JOIN revenue r ON r.event_id = tt.event_id AND r.tier_id = tt.id
    WHERE tt.event_id IN (${sql.join(eventIds.map(id => sql`${id}`), sql`, `)})
    ORDER BY tt.created_at, tt.id, r.currency
  `)

  const byTier = new Map<string, TicketTierSales>()
  for (const row of result.rows) {
    const revenue = Number(Number(row.revenue ?? 0).toFixed(2))
    const currency = String(row.currency ?? "USD")
    const revenueCurrency = row.revenueCurrency == null ? null : String(row.revenueCurrency)
    const existing = byTier.get(String(row.id))
    if (existing) {
      if (revenueCurrency) existing.revenueByCurrency!.push({ currency: revenueCurrency, amount: revenue })
      if (revenueCurrency === currency) existing.revenue = revenue
      continue
    }
    const capacity = Number(row.capacity ?? 0)
    const sold = Number(row.sold ?? 0)
    const complimentary = Number(row.complimentary ?? 0)
    const allocated = Math.max(Number(row.allocated ?? 0), sold + complimentary)
    const tier: TicketTierSales = {
      id: String(row.id), eventId: String(row.eventId), name: String(row.name),
      price: Number(row.price ?? 0), currency,
      capacity, sold, complimentary,
      reserved: Math.max(0, allocated - sold - complimentary),
      remaining: Math.max(0, capacity - allocated),
      revenue: revenueCurrency === currency ? revenue : 0,
      revenueByCurrency: revenueCurrency ? [{ currency: revenueCurrency, amount: revenue }] : [],
    }
    const tiers = byEvent.get(tier.eventId) ?? []
    tiers.push(tier)
    byEvent.set(tier.eventId, tiers)
    byTier.set(tier.id, tier)
  }
  return byEvent
}
