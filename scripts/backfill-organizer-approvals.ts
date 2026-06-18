/**
 * One-shot migration: approve all existing organizers who have created at least
 * one published event.  These are clearly legitimate organizers, so they should
 * not be blocked when the approval gate goes live.
 *
 * Usage:
 *   npx tsx scripts/backfill-organizer-approvals.ts
 *
 * What it does:
 *   SELECT users WHERE role = 'organizer' AND approvedAt IS NULL
 *   AND id IN (SELECT DISTINCT organizer_id FROM events WHERE status = 'published')
 *   → sets approvedAt = now()
 *
 * Dry-run mode:
 *   npx tsx scripts/backfill-organizer-approvals.ts --dry-run
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const DRY_RUN = process.argv.includes("--dry-run")

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const { db } = await import("@/db")
  const { users, events } = await import("@/db/schema")
  const { eq, and, sql, inArray } = await import("drizzle-orm")

  // Find unapproved organizers who have published events
  const subquery = db
    .select({ organizerId: events.organizerId })
    .from(events)
    .where(eq(events.status, "published"))

  const unapproved = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.role, "organizer"),
        sql`${users.approvedAt} IS NULL`,
        sql`${users.id} IN (${subquery})`,
      ),
    )

  if (unapproved.length === 0) {
    console.log("✅ No unapproved organizers with published events found.")
    return
  }

  console.log(`Found ${unapproved.length} unapproved organizer(s) with published events:\n`)
  for (const u of unapproved) {
    console.log(`  • ${u.name ?? "—"} (${u.email ?? "—"})  [${u.id}]`)
  }

  if (DRY_RUN) {
    console.log("\n🧪 Dry-run — no changes made. Run without --dry-run to apply.")
    return
  }

  const ids = unapproved.map((u) => u.id)
  await db
    .update(users)
    .set({ approvedAt: new Date(), updatedAt: new Date() })
    .where(inArray(users.id, ids))

  console.log(`\n✅ Approved ${ids.length} organizer(s). New signups will still require admin approval.`)
}

main().catch((err) => { console.error(err); process.exit(1) })
