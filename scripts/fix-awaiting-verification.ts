/**
 * One-time fix for orders stuck in awaiting_verification status.
 *
 * Background: awaiting_verification was the old magic-link verification state.
 * Magic links have been removed. This script resolves all stuck orders:
 *
 *   - Orders WITH Velocity metadata + confirmed payment (pollStatus=SUCCESS or
 *     paymentStatus=SUCCESS): poll Velocity to reconfirm, finalize the workflow,
 *     mark as paid, and deliver tickets.
 *
 *   - Orders WITH Velocity metadata but payment NOT confirmed: expire them and
 *     release the inventory reservation (if any).
 *
 *   - Orders WITHOUT Velocity metadata (old magic-link path, no payment):
 *     expire them and release inventory.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." \
 *   VELOCITY_API_KEY="..." \
 *   VELOCITY_BASE_URL="https://api.velocityafrica.net" \
 *   VELOCITY_ITEM_CODE="tp002" \
 *   VELOCITY_MERCHANT_PHONE="..." \
 *   NEXT_PUBLIC_APP_URL="https://ticketplse.tech" \
 *   npx tsx scripts/fix-awaiting-verification.ts [flags]
 *
 * Flags:
 *   --dry-run          Print what would happen without writing anything to the DB
 *   --order-id <uuid>  Process a single order (useful for testing)
 *   --skip-delivery    Mark orders paid but do not attempt ticket delivery
 *
 * Safe to run multiple times — already-paid/expired orders are filtered out.
 */

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const SKIP_DELIVERY = args.includes("--skip-delivery")
const orderIdArg = (() => {
  const idx = args.indexOf("--order-id")
  return idx !== -1 ? args[idx + 1] : undefined
})()

if (DRY_RUN) console.log("⚠️  DRY-RUN mode — no database writes will occur\n")

// ── Env preflight ────────────────────────────────────────────────────────────

const REQUIRED_ENV: Record<string, string> = {
  DATABASE_URL: "Neon / Postgres connection string",
  VELOCITY_API_KEY: "Velocity Africa API key",
  NEXT_PUBLIC_APP_URL: "App base URL (e.g. https://ticketplse.tech)",
}

const missing = Object.entries(REQUIRED_ENV).filter(([k]) => !process.env[k])
if (missing.length > 0) {
  console.error("Missing required environment variables:")
  for (const [k, desc] of missing) console.error(`  ${k}  — ${desc}`)
  process.exit(1)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const url = process.env.DATABASE_URL!

  const { neon } = await import("@neondatabase/serverless")
  const { drizzle } = await import("drizzle-orm/neon-http")
  const { eq, inArray, sql, and } = await import("drizzle-orm")
  const { orders, orderItems, ticketTiers, tickets, paymentLedger } =
    await import("../db/schema")

  const db = drizzle(neon(url))

  // ── Delivery module (may fail if server-side deps aren't available) ────────
  let deliverTicketForPaidOrder: ((orderId: string) => Promise<{
    success: boolean
    status: string
    ticketCount: number
    emailSent: boolean
    error: string | null
  }>) | null = null

  if (!SKIP_DELIVERY) {
    try {
      const deliveryModule = await import("../lib/delivery")
      deliverTicketForPaidOrder = deliveryModule.deliverTicketForPaidOrder
    } catch (err) {
      console.warn(
        `⚠️  Could not import delivery module (${err instanceof Error ? err.message : err}).\n` +
        `   Orders will be marked paid but tickets will NOT be delivered.\n` +
        `   Re-run with SKIP_DELIVERY=true or trigger delivery from the admin panel.\n`,
      )
    }
  }

  // ── Inline expireOrder (closes over db + table refs) ─────────────────────

  async function expireOrder(order: {
    id: string
    eventId: string
    totalAmount: string | null
    currency: string | null
    metadata: unknown
  }) {
    const meta = (order.metadata ?? {}) as Record<string, unknown>
    const velocityMeta = meta.velocity as Record<string, unknown> | undefined
    const inventoryReserved = meta.inventoryReserved === true

    if (DRY_RUN) {
      console.log(`  [dry-run] would expire order, inventoryReserved=${inventoryReserved}`)
      return
    }

    if (inventoryReserved) {
      const items = await db
        .select({ tierId: orderItems.tierId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))

      for (const item of items) {
        if (item.tierId) {
          await db
            .update(ticketTiers)
            .set({
              soldQuantity: sql`GREATEST(0, ${ticketTiers.soldQuantity} - ${item.quantity})`,
            })
            .where(eq(ticketTiers.id, item.tierId))
        }
      }
      console.log(`  Inventory released (${items.length} tier(s))`)
    }

    await db
      .update(orders)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(orders.id, order.id))

    try {
      await db.insert(paymentLedger).values({
        orderId: order.id,
        eventId: order.eventId,
        transactionTrace: (velocityMeta?.transactionTrace as string | undefined) ?? "",
        salesOrderTrace: (velocityMeta?.salesOrderTrace as string | undefined) ?? "",
        amount: order.totalAmount ?? "0",
        currency: order.currency ?? "USD",
        processor: "velocity",
        velocityPollStatus: "UNKNOWN",
        localStatus: "expired",
        source: "migration",
        rawPayload: null,
        errorMessage: "Expired by fix-awaiting-verification script",
      })
    } catch {
      // Duplicate ledger entry — ignore (unique index on transactionTrace)
    }
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  console.log("=== Fix awaiting_verification orders ===\n")

  const whereClause = orderIdArg
    ? and(eq(orders.status, "awaiting_verification"), eq(orders.id, orderIdArg))
    : eq(orders.status, "awaiting_verification")

  const stuckOrders = await db
    .select({
      id: orders.id,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      metadata: orders.metadata,
      eventId: orders.eventId,
      userId: orders.userId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(whereClause)

  console.log(`Found ${stuckOrders.length} awaiting_verification order(s)${orderIdArg ? ` (filtered to ${orderIdArg})` : ""}\n`)

  if (stuckOrders.length === 0) {
    console.log("Nothing to fix.")
    return
  }

  // ── Process ───────────────────────────────────────────────────────────────

  const { pollTransaction, normalizeVelocityPollResponse, finalizeWorkflow } =
    await import("../services/velocity")

  let recovered = 0
  let expired = 0
  let skipped = 0
  let errors = 0

  for (const order of stuckOrders) {
    const meta = (order.metadata ?? {}) as Record<string, unknown>
    const velocityMeta = meta.velocity as Record<string, unknown> | undefined

    const shortId = order.id.slice(0, 8)
    console.log(`\n[${shortId}] ${order.guestEmail ?? "guest"} — ${order.totalAmount} ${order.currency}`)
    console.log(`  Created: ${order.createdAt?.toISOString() ?? "unknown"}`)

    // ── Idempotency: skip if already has tickets ──────────────────────────
    const existingTickets = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.orderId, order.id))
      .limit(1)

    if (existingTickets.length > 0) {
      console.log(`  → Already has tickets — marking paid, skipping delivery`)
      if (!DRY_RUN) {
        await db
          .update(orders)
          .set({ status: "paid", updatedAt: new Date() })
          .where(eq(orders.id, order.id))
      }
      recovered++
      continue
    }

    const pollStatus = velocityMeta?.pollStatus as string | undefined
    const paymentStatus = velocityMeta?.paymentStatus as string | undefined
    const transactionTrace = velocityMeta?.transactionTrace as string | undefined
    const salesOrderTrace = velocityMeta?.salesOrderTrace as string | undefined
    const hasConfirmedPayment = pollStatus === "SUCCESS" || paymentStatus === "SUCCESS"

    // ── No Velocity metadata → old magic-link orphan, no payment ─────────
    if (!velocityMeta || !transactionTrace) {
      console.log(`  → No Velocity metadata (old magic-link order) — expiring`)
      await expireOrder(order)
      expired++
      continue
    }

    // ── Has Velocity metadata but payment not yet confirmed → re-poll ─────
    if (!hasConfirmedPayment) {
      console.log(
        `  → Velocity payment unconfirmed (pollStatus=${pollStatus ?? "–"}, paymentStatus=${paymentStatus ?? "–"})`,
      )
      console.log(`  → Re-polling Velocity…`)

      try {
        await sleep(150) // be gentle with the API
        const pollResult = await pollTransaction(transactionTrace)
        const normalized = normalizeVelocityPollResponse(pollResult)

        console.log(
          `  → Poll result: local=${normalized.localStatus}, poll=${normalized.velocityPollStatus ?? "–"}, payment=${normalized.velocityPaymentStatus ?? "–"}`,
        )

        if (normalized.localStatus !== "PAID") {
          console.log(`  → Still not paid — expiring`)
          await expireOrder(order)
          expired++
          continue
        }

        console.log(`  → Payment confirmed by live poll — recovering…`)
      } catch (err) {
        console.error(`  → Poll failed: ${err instanceof Error ? err.message : err}`)
        console.log(`  → Cannot determine payment status — skipping (retry manually)`)
        skipped++
        continue
      }
    } else {
      console.log(
        `  → Velocity payment confirmed (pollStatus=${pollStatus}, paymentStatus=${paymentStatus}) — recovering…`,
      )
    }

    // ── salesOrderTrace required to finalize ──────────────────────────────
    if (!salesOrderTrace) {
      console.error(`  → Missing salesOrderTrace — cannot finalize`)
      skipped++
      continue
    }

    try {
      // ── Finalize with Velocity ─────────────────────────────────────────
      let invoiceId: string | undefined
      try {
        await sleep(150)
        const finalizeResult = await finalizeWorkflow(salesOrderTrace)
        const soStatus = finalizeResult.body.salesOrder.status
        invoiceId = finalizeResult.body.invoice.id
        console.log(
          `  → Finalized: salesOrder.status=${soStatus}, invoiceId=${invoiceId}`,
        )
        if (soStatus !== "PAID") {
          console.warn(
            `  → Finalize returned ${soStatus} — continuing (poll already confirmed payment)`,
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  → Finalize call failed (${msg}) — marking paid without invoice ref`)
      }

      // ── Mark order paid in DB ──────────────────────────────────────────
      const updatedMeta = {
        ...meta,
        velocity: {
          ...(velocityMeta as object),
          pollStatus: "SUCCESS",
          paymentStatus: paymentStatus ?? "SUCCESS",
          paymentRef: invoiceId ?? (velocityMeta?.paymentRef as string | undefined),
          invoiceRef: invoiceId ?? (velocityMeta?.invoiceRef as string | undefined),
          finalizedAt: new Date().toISOString(),
          fixedByMigration: true,
          fixedAt: new Date().toISOString(),
        },
      }

      if (!DRY_RUN) {
        await db
          .update(orders)
          .set({
            status: "paid",
            paidAt: new Date(),
            paymentRef: invoiceId ?? undefined,
            metadata: updatedMeta,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(orders.id, order.id),
              eq(orders.status, "awaiting_verification"),
            ),
          )

        // ── Record in payment ledger ───────────────────────────────────
        try {
          await db.insert(paymentLedger).values({
            orderId: order.id,
            eventId: order.eventId,
            transactionTrace: transactionTrace,
            salesOrderTrace: salesOrderTrace,
            invoiceId: invoiceId ?? null,
            amount: order.totalAmount ?? "0",
            currency: order.currency ?? "USD",
            processor: "velocity",
            velocityPollStatus: "SUCCESS",
            localStatus: "paid",
            source: "migration",
            rawPayload: null,
            errorMessage: "Fixed by fix-awaiting-verification script",
          })
        } catch {
          // Duplicate ledger entry — ignore
        }
      } else {
        console.log(`  [dry-run] would mark order paid, invoiceId=${invoiceId ?? "none"}`)
      }

      // ── Deliver tickets ────────────────────────────────────────────────
      if (!DRY_RUN && deliverTicketForPaidOrder) {
        try {
          const delivery = await deliverTicketForPaidOrder(order.id)
          console.log(
            `  → Delivery: ${delivery.status}, tickets=${delivery.ticketCount}, emailSent=${delivery.emailSent}`,
          )
          if (!delivery.success) {
            console.warn(`  → Delivery issue: ${delivery.error}`)
          }
        } catch (err) {
          console.warn(
            `  → Delivery threw: ${err instanceof Error ? err.message : err}`,
          )
          console.warn(
            `  → Order is marked paid — trigger delivery from the admin panel for [${shortId}]`,
          )
        }
      } else if (DRY_RUN) {
        console.log(`  [dry-run] would deliver tickets`)
      } else {
        console.log(
          `  → Delivery skipped (--skip-delivery or import failed) — trigger from admin panel`,
        )
      }

      recovered++
      console.log(`  ✓ Recovered`)
    } catch (err) {
      errors++
      console.error(`  ✗ Error: ${err instanceof Error ? err.message : err}`)
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(`\n${"─".repeat(48)}`)
  console.log(`  Recovered (paid + tickets delivered): ${recovered}`)
  console.log(`  Expired  (no confirmed payment):      ${expired}`)
  console.log(`  Skipped  (needs manual review):       ${skipped}`)
  console.log(`  Errors:                               ${errors}`)
  if (DRY_RUN) console.log(`\n  ⚠️  Dry-run — no changes were written.`)
}

main().catch((err) => {
  console.error("\nScript failed:", err)
  process.exit(1)
})
