// Deep-check Rukudzo + Darlene-correction orders across Neon and Dokploy.
// Usage: node --env-file=.env.local scripts/check-corrections.mjs
import pg from "pg"
import { readFileSync } from "node:fs"

const NEON_URL = process.env.DATABASE_URL
const DOKPLOY_URL = readFileSync("/tmp/tp_live.env", "utf8")
  .split("\n").find((l) => l.startsWith("DOKPLOY_URL="))?.slice("DOKPLOY_URL=".length).trim()

const neon = new pg.Client({ connectionString: NEON_URL })
const dok = new pg.Client({ connectionString: DOKPLOY_URL })
await neon.connect()
await dok.connect()

const q = async (c, sql, p = []) => (await c.query(sql, p)).rows
const show = (label, rows) => {
  console.log(`\n--- ${label} (${rows.length})`)
  for (const r of rows) console.log(" ", JSON.stringify(r))
}

// 1. Velocity payment ref from Neon's paid Rukudzo order — real money?
show("NEON payment_ledger for ref b273c160", await q(neon, "select id,order_id,transaction_trace,amount,currency,processor,local_status,source,created_at from payment_ledger where transaction_trace='b273c160-2075-4e13-901b-805c6e1af601' or order_id='2892bde0-dbea-4404-84ce-303c861ba64f'"))
show("DOKPLOY payment_ledger for ref b273c160", await q(dok, "select id,order_id,transaction_trace,amount,currency,processor,local_status,source,created_at from payment_ledger where transaction_trace='b273c160-2075-4e13-901b-805c6e1af601' or order_id='2892bde0-dbea-4404-84ce-303c861ba64f'"))

// 2. Dokploy manual-cash Rukudzo order — full picture
show("DOKPLOY order b8e4ae8f", await q(dok, "select id,status,total_amount,currency,payment_method,payment_ref,guest_name,guest_email,guest_phone,metadata,created_at,updated_at from orders where id='b8e4ae8f-32ad-48b8-902a-5e898cacc963'"))
show("DOKPLOY tickets for b8e4ae8f", await q(dok, "select id,status,tier_id,created_at from tickets where order_id='b8e4ae8f-32ad-48b8-902a-5e898cacc963'"))
show("DOKPLOY ledger for b8e4ae8f", await q(dok, "select id,order_id,transaction_trace,amount,processor,local_status,source,created_at from payment_ledger where order_id='b8e4ae8f-32ad-48b8-902a-5e898cacc963'"))

// 3. Neon Rukudzo paid order metadata (how was it marked paid?)
show("NEON order 2892bde0 metadata", await q(neon, "select metadata, updated_at from orders where id='2892bde0-dbea-4404-84ce-303c861ba64f'"))

// 4. The two Darlene corrections in Dokploy (Jorum, Bvumai) — confirm completed + tickets exist
for (const id of ["edb94569-88e6-45b0-8bff-d5bce020a5a1", "66aea9c0-3af5-4880-8ba9-9de78f02c500"]) {
  show(`DOKPLOY order ${id.slice(0, 8)}`, await q(dok, "select id,status,payment_method,payment_ref,guest_name,total_amount,created_at from orders where id=$1", [id]))
  show(`DOKPLOY tickets for ${id.slice(0, 8)}`, await q(dok, "select id,status from tickets where order_id=$1", [id]))
}

// 5. Tier sold sanity for Olive Hour GA tier in both DBs vs actual sold tickets
const TIER = "63d98809-0a57-417a-8da6-8c74f6044404"
show("NEON tier", await q(neon, "select name,sold_quantity,total_quantity from ticket_tiers where id=$1", [TIER]))
show("NEON actual non-cancelled tickets", await q(neon, "select status,count(*) from tickets where tier_id=$1 group by status", [TIER]))
show("DOKPLOY tier", await q(dok, "select name,sold_quantity,total_quantity from ticket_tiers where id=$1", [TIER]))
show("DOKPLOY actual non-cancelled tickets", await q(dok, "select status,count(*) from tickets where tier_id=$1 group by status", [TIER]))

// 6. organizer_fee_dues contents (Dokploy only)
show("DOKPLOY organizer_fee_dues", await q(dok, "select id,order_id,gross_amount,fee_amount,status,note,created_at from organizer_fee_dues order by created_at desc limit 20"))

await neon.end()
await dok.end()
process.exit(0)
