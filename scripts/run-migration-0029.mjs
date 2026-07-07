/**
 * Runs the 0029 migration SQL against the production DATABASE_URL.
 * Uses @neondatabase/serverless Pool (the same driver the app uses).
 */
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { Pool, neonConfig } from "@neondatabase/serverless"

// Node 18+ has global WebSocket — no separate ws package needed.
neonConfig.webSocketConstructor = WebSocket

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = resolve(__dirname, "../db/migrations/0029_payout_fixes.sql")

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not set")
    process.exit(1)
  }

  const sql = readFileSync(sqlPath, "utf8")
  console.log("Running migration: 0029_payout_fixes.sql")
  console.log(sql)

  const pool = new Pool({ connectionString: url, max: 1 })
  try {
    await pool.query(sql)
    console.log("\nMigration applied successfully.")
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message)
  process.exit(1)
})
