/**
 * Audit ticket_tiers.sold_quantity against real active tickets plus live reservations.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/audit-tier-availability.ts
 *   DATABASE_URL="postgresql://..." npx tsx scripts/audit-tier-availability.ts --event "Sunday Table" --fix
 *   DATABASE_URL="postgresql://..." npx tsx scripts/audit-tier-availability.ts --event "Sunday Table" --fix --clear-ended-sales
 */

import "dotenv/config"
import { neon } from "@neondatabase/serverless"

type TierAuditRow = {
  event_id: string
  event_title: string
  event_slug: string
  tier_id: string
  tier_name: string
  total_quantity: number
  sold_quantity: number
  sales_start: string | null
  sales_end: string | null
  starts_at: string
  confirmed_tickets: number
  live_reserved: number
  true_used: number
  true_available: number
  stale_delta: number
}

const DATABASE_URL = process.env.DATABASE_URL
const FIX = process.argv.includes("--fix")
const CLEAR_ENDED_SALES = process.argv.includes("--clear-ended-sales")
const eventArgIndex = process.argv.indexOf("--event")
const EVENT_QUERY = eventArgIndex >= 0 ? process.argv[eventArgIndex + 1] : null

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

async function main() {
  const sql = neon(DATABASE_URL)
  const eventSearch = EVENT_QUERY ? `%${EVENT_QUERY}%` : "%"

  const rows = await sql<TierAuditRow[]>`
    WITH confirmed AS (
      SELECT
        tier_id,
        COUNT(*)::int AS confirmed_tickets
      FROM tickets
      WHERE is_staff_ticket = false
        AND status NOT IN ('cancelled', 'refunded')
      GROUP BY tier_id
    ),
    reservations AS (
      SELECT
        oi.tier_id,
        COALESCE(SUM(oi.quantity), 0)::int AS live_reserved
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE oi.tier_id IS NOT NULL
        AND o.status IN ('pending', 'awaiting_verification')
        AND o.metadata->>'inventoryReserved' = 'true'
        AND o.created_at > now() - interval '30 minutes'
      GROUP BY oi.tier_id
    )
    SELECT
      e.id AS event_id,
      e.title AS event_title,
      e.slug AS event_slug,
      tt.id AS tier_id,
      tt.name AS tier_name,
      tt.total_quantity,
      COALESCE(tt.sold_quantity, 0)::int AS sold_quantity,
      tt.sales_start::text AS sales_start,
      tt.sales_end::text AS sales_end,
      e.starts_at::text AS starts_at,
      COALESCE(c.confirmed_tickets, 0)::int AS confirmed_tickets,
      COALESCE(r.live_reserved, 0)::int AS live_reserved,
      LEAST(tt.total_quantity, COALESCE(c.confirmed_tickets, 0) + COALESCE(r.live_reserved, 0))::int AS true_used,
      GREATEST(0, tt.total_quantity - COALESCE(c.confirmed_tickets, 0) - COALESCE(r.live_reserved, 0))::int AS true_available,
      (COALESCE(tt.sold_quantity, 0) - LEAST(tt.total_quantity, COALESCE(c.confirmed_tickets, 0) + COALESCE(r.live_reserved, 0)))::int AS stale_delta
    FROM ticket_tiers tt
    INNER JOIN events e ON e.id = tt.event_id
    LEFT JOIN confirmed c ON c.tier_id = tt.id
    LEFT JOIN reservations r ON r.tier_id = tt.id
    WHERE e.title ILIKE ${eventSearch}
       OR e.slug ILIKE ${eventSearch}
    ORDER BY ABS(COALESCE(tt.sold_quantity, 0) - LEAST(tt.total_quantity, COALESCE(c.confirmed_tickets, 0) + COALESCE(r.live_reserved, 0))) DESC,
      e.starts_at DESC,
      tt.name
  `

  console.table(rows.map((row) => ({
    event: row.event_title,
    tier: row.tier_name,
    total: row.total_quantity,
    storedSold: row.sold_quantity,
    confirmed: row.confirmed_tickets,
    liveReserved: row.live_reserved,
    trueUsed: row.true_used,
    trueLeft: row.true_available,
    staleDelta: row.stale_delta,
    salesEnd: row.sales_end ?? "",
  })))

  if (!FIX) return

  const staleRows = rows.filter((row) => row.sold_quantity !== row.true_used)
  for (const row of staleRows) {
    await sql`
      UPDATE ticket_tiers
      SET sold_quantity = ${row.true_used}
      WHERE id = ${row.tier_id}
    `
  }

  console.log(`Synced ${staleRows.length} tier counter${staleRows.length === 1 ? "" : "s"}.`)

  if (CLEAR_ENDED_SALES) {
    const salesWindowRows = rows.filter((row) => {
      if (!row.sales_end) return false
      return new Date(row.sales_end) < new Date() && new Date(row.starts_at) > new Date()
    })

    for (const row of salesWindowRows) {
      await sql`
        UPDATE ticket_tiers
        SET sales_end = NULL
        WHERE id = ${row.tier_id}
      `
    }

    console.log(`Cleared past sales_end for ${salesWindowRows.length} future-event tier${salesWindowRows.length === 1 ? "" : "s"}.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
