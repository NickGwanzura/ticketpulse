"use server"

import { revalidatePath } from "next/cache"
import { and, asc, eq, inArray, sql } from "drizzle-orm"

import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { expireOrderAndReleaseInventory } from "@/lib/order-expiry"
import { log } from "@/lib/logger"
import { reconcileVelocityOrderBeforeExpiry } from "@/lib/velocity/reconciliation"

const MAX_ARCHIVE_BATCH = 500

/**
 * Archive unresolved payments whose events have already finished.
 *
 * The shared expiry helper uses a compare-and-set status update, so concurrent
 * cron or payment completion attempts cannot release inventory twice.
 */
export async function archiveFinishedEventPendingPaymentsAction(): Promise<void> {
  const session = await requireAdmin()

  const candidates = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(and(
      inArray(orders.status, ["pending", "awaiting_verification"]),
      sql`COALESCE(${events.endsAt}, ${events.startsAt}) <= NOW()`,
    ))
    .orderBy(asc(events.startsAt), asc(orders.createdAt))
    .limit(MAX_ARCHIVE_BATCH)

  let archived = 0
  let settled = 0
  let skipped = 0
  for (const candidate of candidates) {
    const result = await reconcileVelocityOrderBeforeExpiry({
      orderId: candidate.id,
      source: "admin_finished_event_archive",
    })
    if (result.paid) {
      settled++
      await deliverTicketForPaidOrder(candidate.id)
      continue
    }
    if (result.state !== "FAILED") {
      skipped++
      continue
    }
    if (await expireOrderAndReleaseInventory(candidate.id, "event_ended_unpaid")) archived++
  }

  log.info("admin/payments — archived finished-event pending payments", {
    adminId: session.user.id,
    matched: candidates.length,
    archived,
    settled,
    skipped,
    batchLimit: MAX_ARCHIVE_BATCH,
  })

  revalidatePath("/admin/payments")
  revalidatePath("/admin/orders")
  revalidatePath("/admin/velocity")
}
