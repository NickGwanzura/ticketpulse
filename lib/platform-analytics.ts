import "server-only"

import { sql } from "drizzle-orm"

import { db } from "@/db"
import { DIRECT_PAYMENT_METHODS } from "@/lib/direct-sale"

export type PlatformAnalyticsOrder = {
  orderId: string
  eventId: string
  category: string
  city: string
  organizerId: string
  organizerName: string | null
  organizerEmail: string | null
  paymentMethod: string | null
  paidAt: Date | null
  completedAt: Date | null
  grossRevenue: number
  issuedTickets: number
}

/**
 * Returns one row per confirmed order with only issued buyer tickets counted.
 * This is the analytics counterpart to the payout ledger's canonical maths:
 * direct/complimentary sales are excluded from platform revenue and partial
 * delivery is prorated from the issued ticket count.
 */
export async function getPlatformAnalyticsOrders({
  since,
  until = new Date(),
}: {
  since: Date
  until?: Date
}): Promise<PlatformAnalyticsOrder[]> {
  const directMethods = [...DIRECT_PAYMENT_METHODS, "complimentary"]
  const result = await db.execute(sql`
    WITH ticket_items AS (
      SELECT
        o.id AS order_id,
        e.id AS event_id,
        e.category,
        e.city,
        e.organizer_id,
        u.name AS organizer_name,
        u.email AS organizer_email,
        o.payment_method,
        o.paid_at,
        o.completed_at,
        oi.quantity,
        oi.total,
        COUNT(t.id)::int AS issued_count
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      INNER JOIN events e ON e.id = o.event_id
      INNER JOIN users u ON u.id = e.organizer_id
      LEFT JOIN tickets t
        ON t.order_id = o.id
       AND t.tier_id = oi.tier_id
       AND t.is_staff_ticket = false
       AND t.status IN ('sold', 'used')
      WHERE o.status IN ('paid', 'completed')
        AND oi.type = 'ticket'
        AND oi.quantity > 0
        AND (o.payment_method IS NULL OR o.payment_method NOT IN (${sql.join(directMethods.map((method) => sql`${method}`), sql`, `)}))
        AND (
          (o.paid_at >= ${since} AND o.paid_at < ${until})
          OR (o.completed_at >= ${since} AND o.completed_at < ${until})
        )
      GROUP BY
        o.id, e.id, e.category, e.city, e.organizer_id, u.name, u.email,
        o.payment_method, o.paid_at, o.completed_at,
        oi.quantity, oi.total
    )
    SELECT
      order_id,
      event_id,
      category,
      city,
      organizer_id,
      organizer_name,
      organizer_email,
      payment_method,
      paid_at,
      completed_at,
      COALESCE(SUM(LEAST(issued_count, quantity) * (total::numeric / NULLIF(quantity, 0))), 0)::numeric AS gross_revenue,
      COALESCE(SUM(LEAST(issued_count, quantity)), 0)::int AS issued_tickets
    FROM ticket_items
    GROUP BY
      order_id, event_id, category, city, organizer_id, organizer_name, organizer_email,
      payment_method, paid_at, completed_at
  `)

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    orderId: String(row.order_id),
    eventId: String(row.event_id),
    category: String(row.category ?? "other"),
    city: String(row.city ?? "Unknown"),
    organizerId: String(row.organizer_id),
    organizerName: row.organizer_name ? String(row.organizer_name) : null,
    organizerEmail: row.organizer_email ? String(row.organizer_email) : null,
    paymentMethod: row.payment_method ? String(row.payment_method) : null,
    paidAt: row.paid_at ? new Date(String(row.paid_at)) : null,
    completedAt: row.completed_at ? new Date(String(row.completed_at)) : null,
    grossRevenue: Number(row.gross_revenue ?? 0),
    issuedTickets: Number(row.issued_tickets ?? 0),
  }))
}
