import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "../db"
import { events, ticketTiers } from "../db/schema"
import { desc, eq, sql } from "drizzle-orm"

async function main() {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      status: events.status,
      startsAt: events.startsAt,
      organizerId: events.organizerId,
      tierCount: sql<number>`COALESCE(COUNT(${ticketTiers.id}), 0)::int`,
    })
    .from(events)
    .leftJoin(ticketTiers, eq(ticketTiers.eventId, events.id))
    .groupBy(events.id)
    .orderBy(desc(events.createdAt))
    .limit(30)

  const now = new Date()
  console.log(`Now: ${now.toISOString()}\n`)
  console.log("All events (newest first):")
  for (const r of rows) {
    const inFuture = r.startsAt >= now
    const wouldShow = r.status === "published" && inFuture
    console.log(
      `  [${r.status?.padEnd(9)}] ${r.startsAt.toISOString()}  tiers=${r.tierCount}  ${wouldShow ? "✓ would show" : "✗ won't show"}  ${r.title}`,
    )
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
