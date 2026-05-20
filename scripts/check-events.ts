/**
 * Check what events (if any) the organizer TOSE has created.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/check-events.ts
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error("DATABASE_URL not set"); process.exit(1) }

  const { neon } = await import("@neondatabase/serverless")
  const { drizzle } = await import("drizzle-orm/neon-http")
  const { eq, desc } = await import("drizzle-orm")
  const { events, users } = await import("../db/schema")

  const db = drizzle(neon(url))

  const [organizer] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, "afrobeyondzw@gmail.com"))
    .limit(1)

  if (!organizer) {
    console.log("❌ Organizer TOSE not found in DB.")
    return
  }
  console.log("\n✅ Organizer found:")
  console.log(`   Name:           ${organizer.name}`)
  console.log(`   Email:          ${organizer.email}`)
  console.log(`   Role:           ${organizer.role}`)
  console.log(`   Email verified: ${organizer.emailVerified ? "✅ YES" : "❌ NO"}`)

  const theirEvents = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      status: events.status,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.organizerId, organizer.id))
    .orderBy(desc(events.createdAt))

  console.log(`\n📅 Events created: ${theirEvents.length}`)
  if (theirEvents.length === 0) {
    console.log("   ❌ They haven't created any events yet.")
    console.log("\n💡 TOSE needs to:")
    console.log("   1. Sign in at /auth/signin")
    console.log("   2. Go to /organizer and create an event")
    console.log("   3. Publish it (set status to 'published')")
  } else {
    for (const e of theirEvents) {
      const created = e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-ZW", { timeZone: "Africa/Harare" }) : "?"
      console.log(`   • "${e.title}" (slug: ${e.slug})`)
      console.log(`     Status: ${e.status} | Created: ${created}`)
    }
  }

  // Also check all events in the system
  const allEvents = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      status: events.status,
      organizerId: events.organizerId,
    })
    .from(events)
    .orderBy(desc(events.createdAt))

  console.log(`\n📊 All events in database: ${allEvents.length}`)
  for (const e of allEvents) {
    const organizerName = e.organizerId === organizer.id ? " ← TOSE" : ""
    console.log(`   • "${e.title}" — status: ${e.status}${organizerName}`)
  }
}
main().catch(console.error)
