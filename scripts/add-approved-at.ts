/**
 * One-shot migration: add approved_at column to users table.
 * Run with: npx tsx scripts/add-approved-at.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { db } from "@/db"
import { sql } from "drizzle-orm"

async function main() {
  console.log("Adding approved_at column to users table...")
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;`)
  console.log("✅ approved_at column added.")
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
