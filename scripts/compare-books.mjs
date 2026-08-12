// Compare "books" tables between the decommissioned Neon DB (.env.local DATABASE_URL)
// and the live Dokploy postgres (/tmp/tp_live.env DOKPLOY_URL).
// Lists rows present in one DB but missing from the other, newest first.
// Usage: node --env-file=.env.local scripts/compare-books.mjs
import pg from "pg"
import { readFileSync } from "node:fs"

const NEON_URL = process.env.DATABASE_URL
const DOKPLOY_URL = readFileSync("/tmp/tp_live.env", "utf8")
  .split("\n").find((l) => l.startsWith("DOKPLOY_URL="))?.slice("DOKPLOY_URL=".length).trim()

if (!NEON_URL || !DOKPLOY_URL) {
  console.error("missing NEON_URL or DOKPLOY_URL")
  process.exit(1)
}

const neon = new pg.Client({ connectionString: NEON_URL })
const dok = new pg.Client({ connectionString: DOKPLOY_URL })
await neon.connect()
await dok.connect()

async function q(client, sql, params) {
  const r = await client.query(sql, params)
  return r.rows
}

const SINCE = "2026-06-01"

async function diff(table, selectCols, orderCol = "created_at") {
  const cols = selectCols.join(", ")
  const [a, b] = await Promise.all([
    q(neon, `select ${cols} from ${table} where ${orderCol} >= $1 order by ${orderCol} desc`, [SINCE]),
    q(dok, `select ${cols} from ${table} where ${orderCol} >= $1 order by ${orderCol} desc`, [SINCE]),
  ])
  const aIds = new Set(a.map((r) => r.id))
  const bIds = new Set(b.map((r) => r.id))
  const onlyNeon = a.filter((r) => !bIds.has(r.id))
  const onlyDok = b.filter((r) => !aIds.has(r.id))
  console.log(`\n=== ${table} (since ${SINCE}) — neon:${a.length} dokploy:${b.length} | only-neon:${onlyNeon.length} only-dokploy:${onlyDok.length}`)
  const fmt = (r) => Object.entries(r).map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : v}`).join(" ")
  for (const r of onlyNeon) console.log(`  ONLY-NEON     ${fmt(r)}`)
  for (const r of onlyDok) console.log(`  ONLY-DOKPLOY  ${fmt(r)}`)
}

// also catch rows updated recently even if created earlier (status corrections)
async function diffUpdated(table, selectCols) {
  const cols = selectCols.join(", ")
  const [a, b] = await Promise.all([
    q(neon, `select ${cols} from ${table} where updated_at >= $1 order by updated_at desc`, [SINCE]),
    q(dok, `select ${cols} from ${table} where updated_at >= $1 order by updated_at desc`, [SINCE]),
  ])
  const aMap = new Map(a.map((r) => [r.id, r]))
  const bMap = new Map(b.map((r) => [r.id, r]))
  const changed = []
  for (const [id, ra] of aMap) {
    const rb = bMap.get(id)
    if (rb && JSON.stringify(ra.status) !== JSON.stringify(rb.status)) {
      changed.push({ id, neon: ra.status, dokploy: rb.status, updated_neon: ra.updated_at, updated_dok: rb.updated_at })
    }
  }
  console.log(`\n=== ${table} status mismatches (rows updated since ${SINCE})`)
  for (const c of changed) console.log(`  ${c.id} neon=${c.neon} (${c.updated_neon?.toISOString?.()}) dokploy=${c.dokploy} (${c.updated_dok?.toISOString?.()})`)
}

// schema drift: tables present in one DB but not the other
const [neonTables, dokTables] = await Promise.all([
  q(neon, "select table_name from information_schema.tables where table_schema='public' order by 1"),
  q(dok, "select table_name from information_schema.tables where table_schema='public' order by 1"),
])
const nt = new Set(neonTables.map((r) => r.table_name))
const dt = new Set(dokTables.map((r) => r.table_name))
console.log("\n=== tables only in NEON:", [...nt].filter((t) => !dt.has(t)).join(", ") || "(none)")
console.log("=== tables only in DOKPLOY:", [...dt].filter((t) => !nt.has(t)).join(", ") || "(none)")

await diff("orders", ["id", "created_at", "status", "guest_email", "guest_name", "total_amount", "currency", "payment_method", "payment_ref"])
await diffUpdated("orders", ["id", "status", "updated_at"])

// Rukudzo deep-dive: the paid order missing from Dokploy
const RUK = "2892bde0-dbea-4404-84ce-303c861ba64f"
console.log("\n=== Rukudzo order in NEON ===")
console.log(await q(neon, "select id, status, total_amount, currency, payment_method, payment_ref, guest_email, guest_name, guest_phone, event_id, created_at from orders where id=$1", [RUK]))
console.log("order_items:", await q(neon, "select * from order_items where order_id=$1", [RUK]))
console.log("tickets:", await q(neon, "select id, status, tier_id from tickets where order_id=$1", [RUK]))
console.log("in DOKPLOY orders:", await q(dok, "select id, status from orders where id=$1", [RUK]))
console.log("in DOKPLOY tickets:", await q(dok, "select id, status from tickets where order_id=$1", [RUK]))
console.log("DOKPLOY any Rukudzo:", await q(dok, "select id, status, payment_method, created_at from orders where guest_name ilike '%rukudzo%'", []))

if (dt.has("organizer_fee_dues")) {
  await diff("organizer_fee_dues", ["id", "created_at", "order_id", "event_id", "gross_amount", "fee_amount", "status", "settled_at", "note"])
}
if (dt.has("payment_ledger")) {
  await diff("payment_ledger", ["id", "created_at", "order_id", "amount", "currency", "status", "provider", "reference"])
}
if (dt.has("payouts")) {
  await diff("payouts", ["id", "created_at", "organizer_id", "amount", "currency", "status", "method", "reference"])
}

await neon.end()
await dok.end()
process.exit(0)
