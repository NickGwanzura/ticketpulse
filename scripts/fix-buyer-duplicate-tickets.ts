/**
 * One-off cleanup for duplicate tickets created from a single paid order.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/fix-buyer-duplicate-tickets.ts
 *   DATABASE_URL="postgresql://..." npx tsx scripts/fix-buyer-duplicate-tickets.ts --apply
 *   DATABASE_URL="postgresql://..." npx tsx scripts/fix-buyer-duplicate-tickets.ts --email buyer@example.com --apply
 *
 * Dry-run is the default. The script compares each order's paid ticket item
 * quantity against the ticket rows attached to that order, then removes only
 * surplus rows. It keeps scanned/transferred/oldest tickets first.
 */

import "dotenv/config"
import { neon } from "@neondatabase/serverless"

type OrderRow = {
  id: string
  status: string | null
  guest_email: string | null
  guest_name: string | null
  total_amount: string
  currency: string | null
  payment_ref: string | null
  created_at: Date | string | null
  event_title: string | null
  inventory_reserved: boolean
  expected_tickets: number
}

type TicketRow = {
  id: string
  tier_id: string
  status: string | null
  qr_code: string | null
  scanned_at: Date | string | null
  transfer_to_email: string | null
  transferred_at: Date | string | null
  holder_email: string | null
  created_at: Date | string | null
}

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const EMAIL = (() => {
  const idx = args.indexOf("--email")
  return idx === -1 ? "tendaigraciousmoyo@gmail.com" : args[idx + 1]
})()

if (!EMAIL) {
  console.error("Missing email after --email")
  process.exit(1)
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

function ticketSortScore(ticket: TicketRow): number {
  let score = 0
  if (ticket.scanned_at) score += 100
  if (ticket.transferred_at || ticket.transfer_to_email || ticket.holder_email) score += 50
  if (ticket.status === "cancelled" || ticket.status === "refunded") score -= 100
  return score
}

function byKeepPriority(a: TicketRow, b: TicketRow): number {
  const scoreDiff = ticketSortScore(b) - ticketSortScore(a)
  if (scoreDiff !== 0) return scoreDiff
  const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
  const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
  return aTime - bTime
}

async function main() {
  const sql = neon(DATABASE_URL)

  const orders = await sql`
    SELECT
      o.id,
      o.status,
      o.guest_email,
      o.guest_name,
      o.total_amount,
      o.currency,
      o.payment_ref,
      o.created_at,
      e.title AS event_title,
      COALESCE((o.metadata->>'inventoryReserved')::boolean, false) AS inventory_reserved,
      COALESCE(SUM(
        CASE
          WHEN oi.type = 'ticket' AND oi.tier_id IS NOT NULL THEN oi.quantity
          ELSE 0
        END
      ), 0)::int AS expected_tickets
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN events e ON e.id = o.event_id
    WHERE lower(o.guest_email) = lower(${EMAIL})
      AND o.status IN ('paid', 'completed')
    GROUP BY o.id, e.title
    ORDER BY o.created_at DESC
  ` as OrderRow[]

  if (orders.length === 0) {
    console.log(`No paid/completed orders found for ${EMAIL}.`)
    return
  }

  console.log(`${APPLY ? "APPLY" : "DRY-RUN"} duplicate-ticket cleanup for ${EMAIL}`)
  console.log(`Found ${orders.length} paid/completed order(s).\n`)

  let deletedTotal = 0

  for (const order of orders) {
    const ticketRows = await sql`
      SELECT
        id,
        tier_id,
        status,
        qr_code,
        scanned_at,
        transfer_to_email,
        transferred_at,
        holder_email,
        created_at
      FROM tickets
      WHERE order_id = ${order.id}
      ORDER BY created_at ASC, id ASC
    ` as TicketRow[]

    const expected = Number(order.expected_tickets ?? 0)
    const activeTickets = ticketRows.filter((t) => t.status !== "cancelled" && t.status !== "refunded")
    const surplusCount = activeTickets.length - expected

    console.log(`Order ${order.id}`)
    console.log(`  Event: ${order.event_title ?? "Unknown event"}`)
    console.log(`  Status/payment: ${order.status} / ${order.payment_ref ?? "no ref"}`)
    console.log(`  Expected tickets: ${expected}`)
    console.log(`  Total ticket rows: ${ticketRows.length}`)
    console.log(`  Active ticket rows: ${activeTickets.length}`)
    console.log(`  Ticket rows: ${ticketRows.map((t) => `${t.id}:${t.status ?? "unknown"}`).join(", ")}`)

    if (expected <= 0) {
      console.log("  Skipped: order has no ticket items.\n")
      continue
    }

    if (surplusCount <= 0) {
      console.log("  OK: no surplus tickets.\n")
      continue
    }

    const sorted = [...activeTickets].sort(byKeepPriority)
    const keep = sorted.slice(0, expected)
    const remove = sorted.slice(expected)
    const removeIds = remove.map((t) => t.id)

    console.log(`  Surplus tickets to delete: ${surplusCount}`)
    console.log(`  Keeping: ${keep.map((t) => t.id).join(", ")}`)
    console.log(`  Removing: ${removeIds.join(", ")}`)

    if (APPLY) {
      for (const ticket of remove) {
        await sql`DELETE FROM tickets WHERE id = ${ticket.id}`
        if (!order.inventory_reserved) {
          await sql`
            UPDATE ticket_tiers
            SET sold_quantity = GREATEST(0, sold_quantity - 1)
            WHERE id = ${ticket.tier_id}
          `
        }
      }
      deletedTotal += remove.length
      console.log(`  Deleted ${remove.length} surplus ticket row(s).`)
      if (!order.inventory_reserved) {
        console.log("  Adjusted sold_quantity for deleted ticket tier(s).")
      }
    } else {
      console.log("  Dry-run only. Re-run with --apply to delete the surplus rows.")
    }

    console.log("")
  }

  console.log(`${APPLY ? "Done" : "Dry-run complete"}. Surplus tickets deleted: ${deletedTotal}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
