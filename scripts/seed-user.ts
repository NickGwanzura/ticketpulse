import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

type Role = "attendee" | "organizer" | "vendor" | "admin"

async function main() {
  const email    = (process.env.SEED_EMAIL    ?? process.argv[2])?.toLowerCase().trim()
  const password = process.env.SEED_PASSWORD ?? process.argv[3]
  const name     = process.env.SEED_NAME     ?? process.argv[4] ?? null
  const role     = (process.env.SEED_ROLE   ?? process.argv[5] ?? "admin") as Role

  if (!email || !password) {
    console.error("usage: tsx scripts/seed-user.ts <email> <password> [name] [role]")
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  // dynamic-import db AFTER dotenv has populated process.env, so the
  // module-level neon() call sees DATABASE_URL.
  const { db } = await import("@/db")
  const { users } = await import("@/db/schema")
  const { eq } = await import("drizzle-orm")
  const { hashPassword } = await import("@/lib/password")

  const passwordHash = hashPassword(password)
  const now = new Date()

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existing) {
    await db.update(users)
      .set({
        passwordHash,
        role,
        name: name ?? existing.name,
        emailVerified: existing.emailVerified ?? now,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id))
    console.log(`updated user ${email} (${existing.id}) role=${role}`)
  } else {
    const [created] = await db.insert(users)
      .values({
        email,
        passwordHash,
        role,
        name,
        emailVerified: now,
      })
      .returning()
    console.log(`created user ${email} (${created.id}) role=${role}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
