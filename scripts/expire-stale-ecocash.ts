import { and, eq, inArray, lt } from "drizzle-orm"
import { db, dbPool } from "../db"
import { orders } from "../db/schema"
import { expireOrderAndReleaseInventory } from "../lib/order-expiry"
import { PAYMENT_WINDOW_MS } from "../lib/velocity/poll-policy"

async function main() {
  const candidates = await db.select({ id: orders.id }).from(orders).where(and(
    eq(orders.paymentMethod, "velocity-ecocash"),
    inArray(orders.status, ["pending", "awaiting_verification"]),
    lt(orders.createdAt, new Date(Date.now() - PAYMENT_WINDOW_MS)),
  ))
  for (const order of candidates) {
    const expired = process.argv.includes("--apply")
      ? await expireOrderAndReleaseInventory(order.id, "payment_timeout")
      : false
    console.log(JSON.stringify({ id: order.id, expired, dryRun: !process.argv.includes("--apply") }))
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => dbPool?.end())
