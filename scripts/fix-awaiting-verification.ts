/**
 * Reconcile legacy awaiting_verification orders through the same atomic VMC
 * settlement path used by callbacks, cron, status polling, and admin repair.
 *
 * Usage:
 *   npx tsx scripts/fix-awaiting-verification.ts --dry-run
 *   npx tsx scripts/fix-awaiting-verification.ts --order=<uuid>
 */

import "dotenv/config"

const DRY_RUN = process.argv.includes("--dry-run")
const orderIdArg = process.argv.find((arg) => arg.startsWith("--order="))?.slice("--order=".length)

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

async function main() {
  const [{ db }, { orders, paymentLedger }, { and, eq }, { deliverTicketForPaidOrder }, { expireOrderAndReleaseInventory }, { reconcileVelocityOrderBeforeExpiry }] = await Promise.all([
    import("../db"),
    import("../db/schema"),
    import("drizzle-orm"),
    import("../lib/delivery"),
    import("../lib/order-expiry"),
    import("../lib/velocity/reconciliation"),
  ])

  const where = orderIdArg
    ? and(eq(orders.status, "awaiting_verification"), eq(orders.id, orderIdArg))
    : eq(orders.status, "awaiting_verification")
  const stuckOrders = await db.select().from(orders).where(where)

  let recovered = 0
  let expired = 0
  let skipped = 0

  for (const order of stuckOrders) {
    const velocity = ((order.metadata ?? {}) as { velocity?: { transactionTrace?: string; salesOrderTrace?: string } }).velocity
    console.log(`[${order.id.slice(0, 8)}] ${order.guestEmail ?? "guest"} — ${order.totalAmount} ${order.currency ?? "USD"}`)

    if (DRY_RUN) {
      console.log(velocity?.transactionTrace && velocity.salesOrderTrace
        ? "  would poll, finalize, atomically settle, and deliver when paid"
        : "  would skip for manual reconciliation because provider references are missing")
      continue
    }

    if (!velocity?.transactionTrace || !velocity.salesOrderTrace) {
      console.log("  skipped without expiry: missing provider references require manual reconciliation")
      skipped++
      continue
    }

    const result = await reconcileVelocityOrderBeforeExpiry({ orderId: order.id, source: "migration_recovery" })
    if (result.paid) {
      const delivery = await deliverTicketForPaidOrder(order.id)
      console.log(`  recovered as paid; invoice=${result.invoiceId}; delivery=${delivery.status}`)
      recovered++
      continue
    }

    if (result.state === "FAILED") {
      if (await expireOrderAndReleaseInventory(order.id, "velocity_payment_failed")) {
        await db.insert(paymentLedger).values({
          orderId: order.id,
          eventId: order.eventId,
          transactionTrace: `system-expiry:${order.id}`,
          salesOrderTrace: velocity.salesOrderTrace,
          amount: order.totalAmount,
          currency: order.currency ?? "USD",
          processor: "velocity",
          velocityPollStatus: "FAILED",
          localStatus: "expired",
          source: "migration",
          rawPayload: result.pollResult,
          errorMessage: "Velocity definitively confirmed payment failure",
        }).onConflictDoNothing()
        expired++
      }
      continue
    }

    console.log(`  skipped without expiry: ${result.state} — ${result.message ?? "inconclusive"}`)
    skipped++
  }

  console.log(JSON.stringify({ checked: stuckOrders.length, recovered, expired, skipped, dryRun: DRY_RUN }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
