/**
 * Reconcile ticketTiers.soldQuantity for a specific event.
 *
 * soldQuantity should equal the number of tickets that have been paid for
 * (order status = "paid" or "completed").
 *
 * Background: the checkout route sets soldQuantity atomically, but some error
 * paths (e.g. VMC card payment missing redirect URL) were returning errors
 * WITHOUT calling cancelWithInventoryRelease(). The cron job eventually cleans
 * these up, but phantom counts can persist between cron runs.
 *
 * This script:
 *   1. Counts confirmed (paid) tickets from the tickets table
 *   2. Compares with the current ticketTiers.soldQuantity
 *   3. Fixes any discrepancy
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/fix-sold-quantity.ts [--event-id <uuid>] [--dry-run]
 *
 * Flags:
 *   --event-id <uuid>  Only fix one event (recommended: test first)
 *   --dry-run          Print what would happen without writing
 *   --all              Fix all events (use with caution)
 */
import "dotenv/config"
import { db } from "@/db"
import { events, ticketTiers, tickets, orders } from "@/db/schema"
import { eq, sql, and, inArray } from "drizzle-orm"

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const EVENT_ID = (() => {
  const idx = args.indexOf("--event-id")
  return idx !== -1 ? args[idx + 1] : undefined
})()
const ALL = args.includes("--all")

if (!EVENT_ID && !ALL) {
  console.error("Pass --event-id <uuid> or --all")
  process.exit(1)
}

if (DRY_RUN) console.log("⚠️  DRY-RUN — no writes\n")

async function main() {
  const targetEvents = ALL
    ? await db.select().from(events)
    : await db.select().from(events).where(eq(events.id, EVENT_ID!))

  if (targetEvents.length === 0) {
    console.error("No events found")
    process.exit(1)
  }

  for (const event of targetEvents) {
    console.log(`\n📋 Event: ${event.title} (${event.id})`)

    const tiers = await db
      .select({ id: ticketTiers.id, name: ticketTiers.name, totalQuantity: ticketTiers.totalQuantity, soldQuantity: ticketTiers.soldQuantity })
      .from(ticketTiers)
      .where(eq(ticketTiers.eventId, event.id))

    if (tiers.length === 0) {
      console.log("  No tiers — skipping")
      continue
    }

    for (const tier of tiers) {
      // Count actual paid tickets for this tier
      const [actual] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.tierId, tier.id),
            eq(tickets.eventId, event.id),
            eq(tickets.isStaffTicket, false),
            inArray(tickets.status, ["sold", "used"]),
          ),
        )

      const paidTicketCount = actual?.count ?? 0
      const currentSold = Number(tier.soldQuantity ?? 0)
      const diff = currentSold - paidTicketCount

      console.log(`  ${tier.name}: DB soldQuantity=${currentSold}, actual paid tickets=${paidTicketCount}, diff=${diff >= 0 ? "+" : ""}${diff}`)

      if (diff === 0) {
        console.log("    ✓ Correct")
        continue
      }

      if (diff > 0) {
        console.log(`    ⚠️  Phantom count: ${diff} extra`)
      } else {
        console.log(`    ⚠️  Under-counted: ${Math.abs(diff)} missing`)
      }

      if (!DRY_RUN) {
        await db
          .update(ticketTiers)
          .set({ soldQuantity: paidTicketCount })
          .where(eq(ticketTiers.id, tier.id))
        console.log(`    ✓ Fixed to ${paidTicketCount}`)
      } else {
        console.log(`    → Would set to ${paidTicketCount}`)
      }
    }
  }
}

main()
  .then(() => {
    console.log("\nDone.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Script failed:", err)
    process.exit(1)
  })
