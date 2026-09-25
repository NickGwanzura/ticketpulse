import "server-only"

import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { payouts, events, payoutAuditLog, notifications } from "@/db/schema"
import { log } from "@/lib/logger"
import { defaultNotificationPriority } from "@/lib/notification-priority"
import { recordAdminAudit } from "@/lib/admin-audit"

/**
 * Payout status machinery. This lives outside `app/admin/payouts/actions.ts`
 * on purpose: every export of a "use server" file is a callable endpoint, and
 * this helper performs no authorisation of its own. Callers (admin server
 * actions, the admin mobile API) must authenticate an admin first.
 */

export const PAYOUT_STATUSES = ["pending", "approved", "processing", "paid", "held", "rejected", "failed", "cancelled"] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

export function isPayoutStatus(value: string): value is PayoutStatus {
  return (PAYOUT_STATUSES as readonly string[]).includes(value)
}

/** Money only leaves after an admin has approved the request. */
export const PAYABLE_FROM: readonly PayoutStatus[] = ["approved", "processing"]

/** The only columns a transition may set besides `status`. */
export type PayoutTransitionFields = {
  reviewedBy?: string
  rejectionReason?: string
  proofReference?: string
  processedAt?: Date
  processedBy?: string
}

export type PayoutRow = {
  id: string
  status: PayoutStatus
  amount: string
  currency: string | null
  method: string
  accountNumber: string | null
  accountName: string | null
  userId: string
  eventTitle: string | null
}

export async function createPayoutAuditLog(opts: {
  payoutId: string
  action: string
  fromStatus?: PayoutStatus | null
  toStatus: PayoutStatus
  performedBy: string
  notes?: string | null
}, tx?: typeof db) {
  const client = tx ?? db
  await client.insert(payoutAuditLog).values({
    payoutId: opts.payoutId,
    action: opts.action,
    fromStatus: opts.fromStatus,
    toStatus: opts.toStatus,
    performedBy: opts.performedBy,
    notes: opts.notes,
  })
}

export async function createPayoutNotification(opts: {
  userId: string
  type: "payout_approved" | "payout_rejected" | "payout_paid" | "payout_failed"
  title: string
  body: string
  link?: string
}, tx?: typeof db) {
  const client = tx ?? db
  await client.insert(notifications).values({
    userId: opts.userId,
    type: opts.type,
    priority: defaultNotificationPriority(opts.type),
    title: opts.title,
    body: opts.body,
    link: opts.link ?? "/payouts",
  })
}

function pickFields(fields: PayoutTransitionFields | undefined): PayoutTransitionFields {
  if (!fields) return {}
  const out: PayoutTransitionFields = {}
  if (fields.reviewedBy !== undefined) out.reviewedBy = fields.reviewedBy
  if (fields.rejectionReason !== undefined) out.rejectionReason = fields.rejectionReason
  if (fields.proofReference !== undefined) out.proofReference = fields.proofReference
  if (fields.processedAt !== undefined) out.processedAt = fields.processedAt
  if (fields.processedBy !== undefined) out.processedBy = fields.processedBy
  return out
}

/**
 * Shared status-transition machinery: fetch → validate the payout is in an
 * allowed starting state → compare-and-set update + audit log + optional
 * notification, all in one transaction.
 */
export async function transitionPayout(opts: {
  payoutId: string
  action: string
  allowedFrom: readonly PayoutStatus[]
  toStatus: PayoutStatus
  performedBy: string
  extraSet?: PayoutTransitionFields
  auditNotes?: string | null
  notify?: {
    type: "payout_approved" | "payout_rejected" | "payout_paid" | "payout_failed"
    title: string
    body: (payout: PayoutRow) => string
  }
}): Promise<{ ok: boolean; payout?: PayoutRow; error?: "not_found" | "wrong_status" | "db_error" | "transaction_failed" }> {
  let payout: PayoutRow | undefined
  try {
    const [row] = await db
      .select({
        id: payouts.id,
        status: payouts.status,
        amount: payouts.amount,
        currency: payouts.currency,
        method: payouts.method,
        accountNumber: payouts.accountNumber,
        accountName: payouts.accountName,
        userId: payouts.userId,
        eventTitle: events.title,
      })
      .from(payouts)
      .leftJoin(events, eq(events.id, payouts.eventId))
      .where(eq(payouts.id, opts.payoutId))
      .limit(1)
    payout = row as PayoutRow | undefined
  } catch (err) {
    log.error(`[${opts.action}] DB error`, { payoutId: opts.payoutId, error: String(err) })
    return { ok: false, error: "db_error" }
  }

  if (!payout) {
    log.warn(`[${opts.action}] Not found`, { payoutId: opts.payoutId })
    return { ok: false, error: "not_found" }
  }
  if (!opts.allowedFrom.includes(payout.status)) {
    log.warn(`[${opts.action}] Wrong status`, { payoutId: opts.payoutId, status: payout.status })
    return { ok: false, error: "wrong_status", payout }
  }

  const current = payout
  try {
    const changed = await db.transaction(async (tx) => {
      // Compare-and-set: a concurrent transition (double click, two admins)
      // must not apply twice.
      const updated = await tx
        .update(payouts)
        .set({ status: opts.toStatus, ...pickFields(opts.extraSet) })
        .where(and(eq(payouts.id, opts.payoutId), eq(payouts.status, current.status)))
        .returning({ id: payouts.id })
      if (updated.length === 0) return false

      await createPayoutAuditLog({
        payoutId: opts.payoutId,
        action: opts.action,
        fromStatus: current.status,
        toStatus: opts.toStatus,
        performedBy: opts.performedBy,
        notes: opts.auditNotes,
      }, tx)

      if (opts.notify) {
        await createPayoutNotification({
          userId: current.userId,
          type: opts.notify.type,
          title: opts.notify.title,
          body: opts.notify.body(current),
        }, tx)
      }
      return true
    })

    if (!changed) {
      log.warn(`[${opts.action}] Status changed concurrently`, { payoutId: opts.payoutId })
      return { ok: false, error: "wrong_status", payout }
    }

    await recordAdminAudit({
      actorId: opts.performedBy,
      actorEmail: opts.performedBy.includes("@") ? opts.performedBy : null,
      action: `payout.${opts.action}`,
      targetType: "payout",
      targetId: opts.payoutId,
      before: { status: current.status },
      after: { status: opts.toStatus },
      reason: opts.auditNotes,
    })

    log.info(`Payout ${opts.action}`, { payoutId: opts.payoutId, by: opts.performedBy })
    return { ok: true, payout }
  } catch (err) {
    log.error(`[${opts.action}] Transaction failed`, { payoutId: opts.payoutId, error: String(err) })
    return { ok: false, error: "transaction_failed", payout }
  }
}
