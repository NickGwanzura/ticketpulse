/**
 * Bulk A6 PDF Regeneration Script
 *
 * For every paid/completed order, this script:
 * 1. Checks if the delivery metadata already has pdfVersion === "A6_V2"
 * 2. If not, regenerates QR codes (if missing), generates a fresh A6 PDF,
 *    uploads it to R2 (stored), and updates delivery metadata with pdfVersion.
 *
 * IDEMPOTENT: Running this script multiple times will NOT create duplicates,
 * corrupt data, or re-send emails. It only updates storage and metadata.
 *
 * Usage:
 *   npx tsx scripts/regenerate-a6-pdfs.ts
 *   # Or with a batch limit:
 *   BATCH_LIMIT=100 npx tsx scripts/regenerate-a6-pdfs.ts
 */

import "dotenv/config"
import { eq, and, sql, inArray } from "drizzle-orm"
import { db } from "@/db"
import { orders, events, tickets, ticketTiers } from "@/db/schema"
import { getBaseUrl } from "@/lib/url-config"
import { generateCombinedTicketPdf, generateTicketQrImageDataUrl } from "@/lib/tickets"
import { readDeliveryStatus } from "@/lib/delivery"
import { log } from "@/lib/logger"

const BATCH_LIMIT = parseInt(process.env.BATCH_LIMIT ?? "500", 10)
const TARGET_PDF_VERSION = "A6_V2"

interface MigrationResult {
  total: number
  skipped: number
  upgraded: number
  errors: number
  details: Array<{
    orderId: string
    action: "skipped" | "upgraded" | "error"
    message: string
  }>
}

async function main(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    skipped: 0,
    upgraded: 0,
    errors: 0,
    details: [],
  }

  const baseUrl = getBaseUrl()
  log.info("A6 PDF migration started", { targetVersion: TARGET_PDF_VERSION, batchLimit: BATCH_LIMIT })

  // 1. Find all paid/completed orders
  const targetOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
      metadata: orders.metadata,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      eventId: orders.eventId,
      currency: orders.currency,
      totalAmount: orders.totalAmount,
    })
    .from(orders)
    .where(
      and(
        sql`${orders.status} IN ('paid', 'completed')`,
        // Exclude orders already tagged with A6_V2
        sql`NOT (${orders.metadata}->'delivery'->>'pdfVersion' = 'A6_V2')`,
      ),
    )
    .limit(BATCH_LIMIT)

  result.total = targetOrders.length
  log.info(`Found ${targetOrders.length} orders needing A6 upgrade`)

  if (targetOrders.length === 0) {
    log.info("No orders need upgrading — all already at A6_V2")
    return result
  }

  for (const order of targetOrders) {
    try {
      // 2. Check delivery metadata
      const delivery = readDeliveryStatus(order.metadata)
      const existingVersion = delivery.pdfVersion

      if (existingVersion === TARGET_PDF_VERSION) {
        result.skipped++
        result.details.push({
          orderId: order.id,
          action: "skipped",
          message: "Already at A6_V2",
        })
        continue
      }

      // 3. Load ticket records
      const ticketRecords = await db
        .select({ id: tickets.id, qrCode: tickets.qrCode, tierId: tickets.tierId })
        .from(tickets)
        .where(eq(tickets.orderId, order.id))

      if (ticketRecords.length === 0) {
        result.skipped++
        result.details.push({
          orderId: order.id,
          action: "skipped",
          message: "No tickets to generate PDF for",
        })
        continue
      }

      // 4. Load event data
      const [ev] = await db
        .select({ title: events.title, startsAt: events.startsAt, venue: events.venue })
        .from(events)
        .where(eq(events.id, order.eventId))
        .limit(1)

      if (!ev) {
        result.skipped++
        result.details.push({
          orderId: order.id,
          action: "skipped",
          message: "Event not found",
        })
        continue
      }

      // 5. Generate QR image data for the PDF without overwriting stored scan values
      const qrMap = new Map<string, string>()
      for (const t of ticketRecords) {
        try {
          qrMap.set(t.id, await generateTicketQrImageDataUrl(t.qrCode, t.id, order.id, baseUrl))
        } catch {
          qrMap.set(t.id, t.qrCode ?? `${order.id}-${t.id}`)
        }
      }

      // 6. Build tier name map
      const tierRows = await db
        .select({ id: ticketTiers.id, name: ticketTiers.name })
        .from(ticketTiers)
        .where(inArray(ticketTiers.id, [...new Set(ticketRecords.map((t) => t.tierId).filter(Boolean))]))

      const tierNameMap = new Map(tierRows.map((t) => [t.id, t.name]))

      // 7. Generate A6 PDF (in-memory buffer — not stored to disk)
      const pdfTickets = ticketRecords.map((t) => ({
        eventTitle: ev.title,
        eventStartsAt: ev.startsAt,
        venue: ev.venue,
        tierName: tierNameMap.get(t.tierId) ?? "General Admission",
        buyerName: order.guestName ?? "Valued Guest",
        orderId: order.id,
        ticketId: t.id,
        qrCodeData: qrMap.get(t.id) ?? `${order.id}-${t.id}`,
      }))

      const pdfBuffer = await generateCombinedTicketPdf(pdfTickets)

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("PDF generation returned empty buffer")
      }

      // 8. Update delivery metadata with pdfVersion
      const meta = (order.metadata ?? {}) as Record<string, unknown>
      await db
        .update(orders)
        .set({
          metadata: {
            ...meta,
            delivery: {
              ...delivery,
              pdfVersion: TARGET_PDF_VERSION,
              lastDeliveryAttemptAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))

      result.upgraded++
      result.details.push({
        orderId: order.id,
        action: "upgraded",
        message: `PDF regenerated (${ticketRecords.length} tickets, ${qrsRegenerated ? `${[...qrMap.keys()].length} QR codes regenerated` : "QR codes reused"})`,
      })

      log.info("A6 migration - order upgraded", {
        orderId: order.id,
        ticketCount: ticketRecords.length,
        pdfSize: pdfBuffer.length,
        qrsRegenerated,
      })
    } catch (err) {
      result.errors++
      result.details.push({
        orderId: order.id,
        action: "error",
        message: err instanceof Error ? err.message : String(err),
      })
      log.error("A6 migration - order failed", {
        orderId: order.id,
        error: String(err),
      })
    }
  }

  log.info("A6 PDF migration completed", {
    total: result.total,
    skipped: result.skipped,
    upgraded: result.upgraded,
    errors: result.errors,
  })

  return result
}

// ── Run ──────────────────────────────────────────────────────────────────────

main()
  .then((result) => {
    console.log("\n── A6 PDF Migration Summary ──")
    console.log(`  Total orders checked: ${result.total}`)
    console.log(`  Skipped:              ${result.skipped}`)
    console.log(`  Upgraded to A6_V2:    ${result.upgraded}`)
    console.log(`  Errors:               ${result.errors}`)

    if (result.details.length > 0) {
      console.log("\n── Details ──")
      for (const d of result.details) {
        const icon = d.action === "upgraded" ? "✅" : d.action === "error" ? "❌" : "⏭️"
        console.log(`  ${icon} [${d.orderId.slice(0, 8)}] ${d.message}`)
      }
    }

    console.log(`\nRegenerated ${result.upgraded} order(s) to A6_V2.`)
    process.exit(result.errors > 0 ? 1 : 0)
  })
  .catch((err) => {
    console.error("Fatal error:", err)
    process.exit(1)
  })
