import { neon } from "@neondatabase/serverless"

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`
    SELECT e.id as event_id, e.title, o.id as order_id, o.status, o.guest_name, o.guest_email, o.total_amount, o.created_at
    FROM events e JOIN orders o ON o.event_id = e.id
    WHERE lower(e.title) LIKE '%shen%'
    ORDER BY o.created_at DESC LIMIT 20
  `
  console.log(JSON.stringify(rows, null, 2))
}

main().catch(console.error)
