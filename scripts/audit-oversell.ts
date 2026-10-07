/**
 * Read-only audit: is any ticket tier oversold, and has its sold counter
 * drifted from the tickets that actually exist?
 *
 *   npx tsx scripts/audit-oversell.ts            # only tiers with a problem
 *   npx tsx scripts/audit-oversell.ts --all      # every tier
 *
 * expected = live buyer tickets (not cancelled/refunded/staff)
 *          + tickets held by open, reserved orders that have no tickets yet
 * OVERSOLD  expected > capacity (more tickets exist than the tier allows)
 * DRIFT     soldQuantity counter != expected (counter too low reopens sold-out tiers)
 */
import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}
const showAll = process.argv.includes("--all")

async function main() {
  const sql = neon(DATABASE_URL!)

  const rows = await sql`
    SELECT
      e.title AS event_title,
      tt.id   AS tier_id,
      tt.name AS tier_name,
      tt.total_quantity AS capacity,
      COALESCE(tt.sold_quantity, 0) AS counter,
      (
        SELECT COUNT(*) FROM tickets t
        WHERE t.tier_id = tt.id
          AND COALESCE(t.is_staff_ticket, false) = false
          AND t.status NOT IN ('cancelled', 'refunded')
      )::int AS live_tickets,
      (
        SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.tier_id = tt.id AND oi.type = 'ticket'
          AND o.status IN ('pending', 'awaiting_verification')
          AND o.metadata->>'inventoryReserved' = 'true'
          AND NOT EXISTS (SELECT 1 FROM tickets t2 WHERE t2.order_id = o.id)
      )::int AS held_open
    FROM ticket_tiers tt
    JOIN events e ON e.id = tt.event_id
    ORDER BY e.title, tt.name
  `

  let problems = 0
  for (const r of rows) {
    const capacity = Number(r.capacity)
    const counter = Number(r.counter)
    const expected = Number(r.live_tickets) + Number(r.held_open)
    const flags: string[] = []
    if (expected > capacity) flags.push(`OVERSOLD by ${expected - capacity}`)
    if (counter !== expected) flags.push(`DRIFT counter ${counter} vs ${expected} real (${counter - expected > 0 ? "+" : ""}${counter - expected})`)
    if (counter > capacity) flags.push(`counter above capacity`)
    if (flags.length) problems++
    if (flags.length || showAll) {
      console.log(
        `${flags.length ? "!!" : "ok"}  ${r.event_title} / ${r.tier_name}: capacity ${capacity}, counter ${counter}, tickets ${r.live_tickets}, held ${r.held_open}` +
          (flags.length ? `  -> ${flags.join("; ")}` : ""),
      )
    }
  }
  console.log(`\n${rows.length} tiers checked, ${problems} with problems.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
