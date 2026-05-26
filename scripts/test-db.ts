import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL
if (!url) { console.error("No DATABASE_URL"); process.exit(1) }

const sql = neon(url)
sql`SELECT COUNT(*) as count FROM users`.then(rows => {
  console.log("OK! Users:", rows[0].count)
}).catch(err => {
  console.error("FAIL:", err.message)
})
