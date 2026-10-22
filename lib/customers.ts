import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/db"

export type CustomerRow = {
  email: string
  name: string | null
  phone: string | null
  orderCount: number
  eventCount: number
  totalSpent: number
  firstPurchaseAt: string | null
  lastPurchaseAt: string | null
  events: string[]
}

export type CustomerSummary = {
  uniqueBuyers: number
  repeatBuyers: number
  totalSpent: number
}

/**
 * Aggregates buyers across every order/event by guest email — nothing in the
 * app did this before (every "customer" reference was just a per-order
 * display helper). This is the whole CRM gap: no way to see repeat buyers,
 * lifetime spend, or which events someone's actually attended.
 */
export async function getCustomers(opts: { organizerId?: string; search?: string; currency?: string } = {}): Promise<CustomerRow[]> {
  const organizerCondition = opts.organizerId
    ? sql`AND e.organizer_id = ${opts.organizerId}`
    : sql``
  const searchCondition = opts.search
    ? sql`AND (o.guest_email ILIKE ${"%" + opts.search + "%"} OR o.guest_name ILIKE ${"%" + opts.search + "%"} OR o.guest_phone ILIKE ${"%" + opts.search + "%"})`
    : sql``
  const currencyCondition = opts.currency
    ? sql`AND COALESCE(o.currency, 'USD') = ${opts.currency}`
    : sql``

  const result = await db.execute(sql`
    SELECT
      lower(o.guest_email) AS email,
      (array_agg(o.guest_name ORDER BY o.created_at DESC))[1] AS name,
      (array_agg(o.guest_phone ORDER BY o.created_at DESC))[1] AS phone,
      COUNT(*)::int AS order_count,
      COUNT(DISTINCT o.event_id)::int AS event_count,
      COALESCE(SUM(o.total_amount::numeric), 0)::numeric AS total_spent,
      MIN(o.created_at) AS first_purchase_at,
      MAX(o.created_at) AS last_purchase_at,
      array_agg(DISTINCT e.title) AS events
    FROM orders o
    INNER JOIN events e ON e.id = o.event_id
    WHERE o.status IN ('paid', 'completed')
      AND o.guest_email IS NOT NULL
      ${currencyCondition}
      ${organizerCondition}
      ${searchCondition}
    GROUP BY lower(o.guest_email)
    ORDER BY total_spent DESC
    LIMIT 500
  `)

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    email: String(row.email),
    name: (row.name as string) ?? null,
    phone: (row.phone as string) ?? null,
    orderCount: Number(row.order_count ?? 0),
    eventCount: Number(row.event_count ?? 0),
    totalSpent: Number(row.total_spent ?? 0),
    firstPurchaseAt: row.first_purchase_at ? new Date(row.first_purchase_at as string).toISOString() : null,
    lastPurchaseAt: row.last_purchase_at ? new Date(row.last_purchase_at as string).toISOString() : null,
    events: (row.events as string[]) ?? [],
  }))
}

/** Full USD customer totals; the CRM table above intentionally shows at most 500 rows. */
export async function getCustomerSummary(search?: string): Promise<CustomerSummary> {
  const searchCondition = search
    ? sql`AND (o.guest_email ILIKE ${"%" + search + "%"} OR o.guest_name ILIKE ${"%" + search + "%"} OR o.guest_phone ILIKE ${"%" + search + "%"})`
    : sql``
  const result = await db.execute(sql`
    WITH buyers AS (
      SELECT LOWER(o.guest_email) AS email,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(o.total_amount::numeric), 0)::numeric AS total_spent
      FROM orders o
      WHERE o.status IN ('paid', 'completed')
        AND o.guest_email IS NOT NULL
        AND COALESCE(o.currency, 'USD') = 'USD'
        ${searchCondition}
      GROUP BY LOWER(o.guest_email)
    )
    SELECT COUNT(*)::int AS unique_buyers,
      COUNT(*) FILTER (WHERE order_count > 1)::int AS repeat_buyers,
      COALESCE(SUM(total_spent), 0)::numeric AS total_spent
    FROM buyers
  `)
  const row = result.rows[0] as Record<string, unknown> | undefined
  return {
    uniqueBuyers: Number(row?.unique_buyers ?? 0),
    repeatBuyers: Number(row?.repeat_buyers ?? 0),
    totalSpent: Number(row?.total_spent ?? 0),
  }
}
