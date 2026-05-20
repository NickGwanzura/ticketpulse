/**
 * Quick script to check if any organizers have signed up.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/check-organizers.ts
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("❌ DATABASE_URL is not set.")
    console.error('   Usage: DATABASE_URL="postgresql://..." npx tsx scripts/check-organizers.ts')
    process.exit(1)
  }

  const { neon } = await import("@neondatabase/serverless")
  const { drizzle } = await import("drizzle-orm/neon-http")
  const { users } = await import("../db/schema")
  const { desc } = await import("drizzle-orm")

  const db = drizzle(neon(url))

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(100)

  if (allUsers.length === 0) {
    console.log("📭 No users found in the database.")
    return
  }

  const organizers = allUsers.filter((u) => u.role === "organizer")
  const admins     = allUsers.filter((u) => u.role === "admin")
  const attendees  = allUsers.filter((u) => u.role === "attendee")
  const vendors    = allUsers.filter((u) => u.role === "vendor")

  console.log("\n══════════════════════════════════════════")
  console.log("  USER SIGNUP SUMMARY")
  console.log("══════════════════════════════════════════\n")

  console.log(`  Total users:    ${allUsers.length}`)
  console.log(`  🟢 Organizers:   ${organizers.length}`)
  console.log(`  🔵 Admins:       ${admins.length}`)
  console.log(`  🟣 Vendors:      ${vendors.length}`)
  console.log(`  ⚪ Attendees:    ${attendees.length}`)

  if (organizers.length > 0) {
    console.log("\n── Organizers ───────────────────────────────")
    for (const o of organizers) {
      const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-ZW", { timeZone: "Africa/Harare" }) : "?"
      console.log(`  • ${o.name ?? "(no name)"} <${o.email}> — signed up ${date}`)
    }
  } else {
    console.log("\n  No organizers yet.")
  }

  if (admins.length > 0) {
    console.log("\n── Admins ───────────────────────────────────")
    for (const a of admins) {
      const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-ZW", { timeZone: "Africa/Harare" }) : "?"
      console.log(`  • ${a.name ?? "(no name)"} <${a.email}> — signed up ${date}`)
    }
  }

  console.log("\n══════════════════════════════════════════\n")
}

main().catch((err) => {
  console.error("Script failed:", err)
  process.exit(1)
})
