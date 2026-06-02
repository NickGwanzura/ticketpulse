import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const args = process.argv.slice(2)
const EMAIL = (() => {
  const idx = args.indexOf("--email")
  return idx === -1 ? "tendaigraciousmoyo@gmail.com" : args[idx + 1]
})()

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.")
  process.exit(1)
}

async function main() {
  const sql = neon(DATABASE_URL)

  const rows = await sql`
    SELECT
      t.id AS ticket_id,
      t.status AS ticket_status,
      t.qr_code,
      t.created_at AS ticket_created_at,
      t.holder_email,
      t.transfer_to_email,
      o.id AS order_id,
      o.status AS order_status,
      o.guest_email,
      o.guest_name,
      o.payment_ref,
      o.total_amount,
      o.currency,
      e.title AS event_title,
      tt.name AS tier_name
    FROM tickets t
    LEFT JOIN orders o ON o.id = t.order_id
    LEFT JOIN events e ON e.id = t.event_id
    LEFT JOIN ticket_tiers tt ON tt.id = t.tier_id
    WHERE lower(COALESCE(o.guest_email, '')) = lower(${EMAIL})
       OR lower(COALESCE(t.holder_email, '')) = lower(${EMAIL})
       OR lower(COALESCE(t.transfer_to_email, '')) = lower(${EMAIL})
    ORDER BY o.created_at DESC NULLS LAST, t.created_at ASC
  `

  const ledgers = await sql`
    SELECT
      pl.order_id,
      pl.transaction_trace,
      pl.sales_order_trace,
      pl.invoice_id,
      pl.local_status,
      pl.source,
      pl.created_at,
      o.guest_email,
      o.status AS order_status
    FROM payment_ledger pl
    LEFT JOIN orders o ON o.id = pl.order_id
    WHERE lower(COALESCE(o.guest_email, '')) = lower(${EMAIL})
    ORDER BY pl.created_at DESC
  `

  console.log(JSON.stringify({ tickets: rows, paymentLedger: ledgers }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
