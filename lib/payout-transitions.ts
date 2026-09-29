import "server-only"

import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, notifications, payoutAuditLog, payouts, users } from "@/db/schema"
import { defaultNotificationPriority } from "@/lib/notification-priority"
import { recordAdminAudit } from "@/lib/admin-audit"
import { log } from "@/lib/logger"
import { sendPayoutNotice } from "@/lib/payout-notifications"

const TRANSITIONS = {
  approve: { from: ["pending"], to: "approved" },
  reject: { from: ["pending"], to: "rejected" },
  processing: { from: ["approved"], to: "processing" },
  paid: { from: ["pending", "approved", "processing"], to: "paid" },
} as const

export type PayoutTransitionAction = keyof typeof TRANSITIONS
type TransitionError = "not_found" | "wrong_status" | "db_error" | "transaction_failed" | "invalid_details"

type PayoutRow = {
  id: string
  status: string
  amount: string
  currency: string | null
  method: string
  accountNumber: string | null
  accountName: string | null
  userId: string
  organizerName: string | null
  organizerEmail: string | null
  organizerPhone: string | null
  eventId: string | null
  eventTitle: string | null
  proofReference: string | null
}

/** Internal server-only payout state machine. Callers must authenticate first. */
export async function transitionPayout(input: {
  payoutId: string
  action: PayoutTransitionAction
  performedBy: { userId: string; email: string | null }
  reason?: string
  proofReference?: string
}): Promise<{ ok: boolean; payout?: PayoutRow; error?: TransitionError }> {
  if (input.action === "reject" && (!input.reason || input.reason.trim().length < 5 || input.reason.trim().length > 500)) {
    return { ok: false, error: "invalid_details" }
  }
  if (input.action === "paid" && (!input.proofReference || input.proofReference.trim().length < 3 || input.proofReference.trim().length > 200)) {
    return { ok: false, error: "invalid_details" }
  }

  let payout: PayoutRow | undefined
  const transition = TRANSITIONS[input.action]
  const performedBy = input.performedBy.email ?? input.performedBy.userId
  const normalizedProofReference = input.proofReference?.trim()
  const normalizedReason = input.reason?.trim()
  const auditNotes = input.action === "reject"
    ? `Rejected: ${normalizedReason}`
    : normalizedProofReference ? `Proof reference: ${normalizedProofReference}` : null

  try {
    const outcome = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: payouts.id, status: payouts.status, userId: payouts.userId })
        .from(payouts)
        .where(eq(payouts.id, input.payoutId))
        .for("update")
        .limit(1)

      if (!current) return { ok: false as const, error: "not_found" as const }
      if (!(transition.from as readonly string[]).includes(current.status)) {
        return { ok: false as const, error: "wrong_status" as const }
      }

      const [lockedOrganizer] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, current.userId))
        .for("update")
        .limit(1)
      if (!lockedOrganizer) return { ok: false as const, error: "not_found" as const }

      const [row] = await tx
        .select({
          id: payouts.id,
          status: payouts.status,
          amount: payouts.amount,
          currency: payouts.currency,
          method: payouts.method,
          accountNumber: payouts.accountNumber,
          accountName: payouts.accountName,
          userId: payouts.userId,
          organizerName: users.name,
          organizerEmail: users.email,
          organizerPhone: users.phone,
          eventId: payouts.eventId,
          eventTitle: events.title,
          proofReference: payouts.proofReference,
        })
        .from(payouts)
        .leftJoin(users, eq(users.id, payouts.userId))
        .leftJoin(events, eq(events.id, payouts.eventId))
        .where(eq(payouts.id, input.payoutId))
        .limit(1)

      if (!row) return { ok: false as const, error: "not_found" as const }
      payout = row as PayoutRow

      if (input.action === "paid" && normalizedProofReference) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`payout-reference:${normalizedProofReference}`}, 0))`)
        const [duplicateReference] = await tx
          .select({ id: payouts.id })
          .from(payouts)
          .where(and(eq(payouts.method, row.method as typeof payouts.$inferSelect.method), eq(payouts.proofReference, normalizedProofReference)))
          .limit(1)
        if (duplicateReference && duplicateReference.id !== input.payoutId) {
          return { ok: false as const, error: "invalid_details" as const }
        }
      }

      const set = input.action === "approve"
        ? { status: transition.to, reviewedBy: performedBy }
        : input.action === "reject"
          ? { status: transition.to, rejectionReason: normalizedReason, reviewedBy: performedBy }
          : input.action === "paid"
            ? { status: transition.to, proofReference: normalizedProofReference, processedAt: new Date(), processedBy: performedBy }
            : { status: transition.to }

      const [updated] = await tx
        .update(payouts)
        .set(set)
        .where(and(eq(payouts.id, input.payoutId), eq(payouts.status, current.status)))
        .returning({ id: payouts.id })

      if (!updated) return { ok: false as const, error: "wrong_status" as const }

      await tx.insert(payoutAuditLog).values({
        payoutId: input.payoutId,
        action: input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : input.action,
        fromStatus: current.status,
        toStatus: transition.to,
        performedBy,
        notes: auditNotes,
      })

      const notification = input.action === "approve"
        ? { type: "payout_approved" as const, title: "Payout approved", body: `Your payout of USD ${Number(row.amount).toFixed(2)} has been approved and is being processed.` }
        : input.action === "reject"
          ? { type: "payout_rejected" as const, title: "Payout rejected", body: `Your payout of USD ${Number(row.amount).toFixed(2)} was rejected. Reason: ${normalizedReason}` }
          : input.action === "paid"
            ? { type: "payout_paid" as const, title: "Payout sent", body: `Your payout of USD ${Number(row.amount).toFixed(2)} has been sent.` }
            : null

      if (notification) {
        await tx.insert(notifications).values({
          userId: row.userId,
          type: notification.type,
          priority: defaultNotificationPriority(notification.type),
          title: notification.title,
          body: notification.body,
          link: "/payouts",
        })
      }

      return { ok: true as const, currentStatus: current.status, payout: row as PayoutRow }
    })

    if (!outcome.ok) return { ok: false, error: outcome.error }
    payout = { ...outcome.payout, status: transition.to }

    try {
      await recordAdminAudit({
        actorId: input.performedBy.userId,
        actorEmail: input.performedBy.email,
        action: `payout.${input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : input.action}`,
        targetType: "payout",
        targetId: input.payoutId,
        before: { status: outcome.currentStatus },
        after: { status: transition.to },
        reason: auditNotes,
      })
    } catch (auditError) {
      log.error("Payout transition admin audit failed after commit", {
        payoutId: payout.id,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      })
    }

    await sendPayoutNotice({
      payoutId: payout.id,
      organizerName: payout.organizerName,
      email: payout.organizerEmail,
      phone: payout.organizerPhone,
      ecocashNumber: payout.method === "ecocash" ? payout.accountNumber : null,
      amount: payout.amount,
      method: payout.method,
      status: input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : input.action,
      eventTitle: payout.eventTitle,
      proofReference: normalizedProofReference ?? payout.proofReference,
      rejectionReason: normalizedReason,
    })

    log.info(`Payout ${input.action}`, { payoutId: payout.id, by: performedBy })
    return { ok: true, payout }
  } catch (error) {
    log.error(`[payout-${input.action}] Transition failed`, { payoutId: input.payoutId, error: String(error) })
    return { ok: false, error: payout ? "transaction_failed" : "db_error", payout }
  }
}
