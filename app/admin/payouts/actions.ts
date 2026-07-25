"use server"

import { revalidatePath } from "next/cache"
import { eq, desc, sql } from "drizzle-orm"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-guard"
import { db } from "@/db"
import { payouts, events, users, payoutAuditLog, notifications } from "@/db/schema"
import { log } from "@/lib/logger"
import { sendPayoutNotificationEmail } from "@/lib/email"
import { defaultNotificationPriority } from "@/lib/notification-priority"

const VALID_STATUSES = ["pending", "approved", "processing", "paid", "held", "rejected", "failed", "cancelled"] as const

const ManualPayoutSchema = z.object({
  userId: z.string().trim().min(1, "Select the organizer who was paid."),
  eventId: z.string().trim().optional().default(""),
  amount: z.coerce.number({ error: "Enter a valid payout amount." })
    .positive("Enter a valid payout amount.")
    .max(100000, "This payout amount is above the allowed limit."),
  currency: z.string().trim().min(1).default("USD").transform((c) => c.toUpperCase()),
  method: z.enum(["ecocash", "bank_usd", "cash"], { error: "Choose a valid payout method." }),
  paidDate: z.string().trim().optional().default(""),
  proofReference: z.string().trim().min(3, "Add a receipt, transfer, or cash reference."),
  notes: z.string().trim().optional().default(""),
  confirmOverage: z.string().optional().transform((v) => v === "true"),
})

export type AdminPayoutActionResult = {
  ok: boolean
  message: string
  payoutId?: string
}

function adminPayoutResult(ok: boolean, message: string, payoutId?: string): AdminPayoutActionResult {
  revalidatePath("/admin/payouts")
  return { ok, message, payoutId }
}

async function createAuditLog(opts: {
  payoutId: string
  action: string
  fromStatus?: string | null
  toStatus: string
  performedBy: string
  notes?: string | null
}, tx?: typeof db) {
  const client = tx ?? db
  await client.insert(payoutAuditLog).values({
    payoutId: opts.payoutId,
    action: opts.action,
    fromStatus: opts.fromStatus as any,
    toStatus: opts.toStatus as any,
    performedBy: opts.performedBy,
    notes: opts.notes,
  })
}

async function createPayoutNotification(opts: {
  userId: string
  type: "payout_approved" | "payout_rejected" | "payout_paid" | "payout_failed"
  title: string
  body: string
  link?: string
}, tx?: typeof db) {
  const client = tx ?? db
  await client.insert(notifications).values({
    userId: opts.userId,
    type: opts.type as any,
    priority: defaultNotificationPriority(opts.type),
    title: opts.title,
    body: opts.body,
    link: opts.link ?? "/payouts",
  })
}

type PayoutRow = {
  id: string
  status: string
  amount: string
  currency: string | null
  method: string
  accountNumber: string | null
  accountName: string | null
  userId: string
  eventTitle: string | null
}

/**
 * Shared status-transition machinery: fetch → validate the payout is in an
 * allowed starting state → update + audit log + optional notification, all
 * in one transaction. This used to be copy-pasted (with small variations)
 * across five separate functions — approve/reject/processing/paid/update-status.
 */
async function transitionPayout(opts: {
  payoutId: string
  action: string
  allowedFrom: readonly string[]
  toStatus: (typeof VALID_STATUSES)[number]
  performedBy: string
  extraSet?: Record<string, unknown>
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

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(payouts)
        .set({ status: opts.toStatus, ...opts.extraSet })
        .where(eq(payouts.id, opts.payoutId))

      await createAuditLog({
        payoutId: opts.payoutId,
        action: opts.action,
        fromStatus: payout!.status,
        toStatus: opts.toStatus,
        performedBy: opts.performedBy,
        notes: opts.auditNotes,
      }, tx)

      if (opts.notify) {
        await createPayoutNotification({
          userId: payout!.userId,
          type: opts.notify.type,
          title: opts.notify.title,
          body: opts.notify.body(payout!),
        }, tx)
      }
    })

    log.info(`Payout ${opts.action}`, { payoutId: opts.payoutId, by: opts.performedBy })
    return { ok: true, payout }
  } catch (err) {
    log.error(`[${opts.action}] Transaction failed`, { payoutId: opts.payoutId, error: String(err) })
    return { ok: false, error: "transaction_failed", payout }
  }
}

export async function getPayouts(status?: string) {
  // Session auth is intentionally still a throw here because this is a
  // server-data function called *during* render. The page now guards with
  // its own redirect() before calling this, so the throw is a safety net.
  await requireAdmin()

  const conditions: ReturnType<typeof eq>[] = []
  if (status && status !== "all" && VALID_STATUSES.includes(status as any)) {
    conditions.push(eq(payouts.status, status as any))
  }

  const whereClause = conditions.length > 0 ? conditions[0] : undefined

  const payoutRows = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      method: payouts.method,
      status: payouts.status,
      accountNumber: payouts.accountNumber,
      accountName: payouts.accountName,
      bankName: payouts.bankName,
      rejectionReason: payouts.rejectionReason,
      proofReference: payouts.proofReference,
      notes: payouts.notes,
      createdAt: payouts.createdAt,
      processedAt: payouts.processedAt,
      processedBy: payouts.processedBy,
      reviewedBy: payouts.reviewedBy,
      userId: payouts.userId,
      organizerName: users.name,
      organizerEmail: users.email,
      eventTitle: events.title,
    })
    .from(payouts)
    .leftJoin(users, eq(users.id, payouts.userId))
    .leftJoin(events, eq(events.id, payouts.eventId))
    .where(whereClause)
    .orderBy(desc(payouts.createdAt))
    .limit(200)

  // Stats — count() returns bigint which the driver hands back as a string;
  // mapWith(Number) ensures correct numeric comparisons and arithmetic.
  const statsResult = await db
    .select({
      pending: sql<string>`count(case when ${payouts.status} = 'pending' then 1 end)`.mapWith(Number),
      approved: sql<string>`count(case when ${payouts.status} = 'approved' then 1 end)`.mapWith(Number),
      processing: sql<string>`count(case when ${payouts.status} = 'processing' then 1 end)`.mapWith(Number),
      paid: sql<string>`count(case when ${payouts.status} = 'paid' then 1 end)`.mapWith(Number),
      held: sql<string>`count(case when ${payouts.status} = 'held' then 1 end)`.mapWith(Number),
      rejected: sql<string>`count(case when ${payouts.status} = 'rejected' then 1 end)`.mapWith(Number),
      failed: sql<string>`count(case when ${payouts.status} = 'failed' then 1 end)`.mapWith(Number),
      cancelled: sql<string>`count(case when ${payouts.status} = 'cancelled' then 1 end)`.mapWith(Number),
      pendingTotal: sql<string>`coalesce(sum(case when ${payouts.status} = 'pending' then ${payouts.amount} else 0 end), 0)`.mapWith(Number),
    })
    .from(payouts)

  return {
    payouts: payoutRows,
    stats: statsResult[0] ?? {
      pending: 0, approved: 0, processing: 0, paid: 0,
      held: 0, rejected: 0, failed: 0, cancelled: 0, pendingTotal: 0,
    },
  }
}

/**
 * Record a payout that was already made to an organiser outside the app
 * (cash, manual EcoCash, direct bank transfer). Inserts a payout row that is
 * immediately "paid" so balances and reconciliation reflect the money that
 * has actually left TicketPulse.
 */
export async function recordManualPayoutAction(formData: FormData): Promise<AdminPayoutActionResult> {
  const session = await requireAdmin().catch(() => null)
  if (!session) {
    log.warn("[manual-payout] Unauthorized attempt")
    return adminPayoutResult(false, "You are not authorized to record payouts.")
  }

  const parsed = ManualPayoutSchema.safeParse({
    userId: formData.get("userId"),
    eventId: formData.get("eventId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    method: formData.get("method"),
    paidDate: formData.get("paidDate"),
    proofReference: formData.get("proofReference"),
    notes: formData.get("notes"),
    confirmOverage: formData.get("confirmOverage"),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payout details."
    log.warn("[manual-payout] Validation failed", { issues: parsed.error.issues })
    return adminPayoutResult(false, message)
  }
  const { userId, eventId, amount, currency, method, paidDate: paidDateRaw, proofReference, notes, confirmOverage } = parsed.data

  const paidDate = paidDateRaw ? new Date(paidDateRaw) : new Date()
  if (Number.isNaN(paidDate.getTime())) { log.warn("[manual-payout] Invalid date"); return adminPayoutResult(false, "Choose a valid payout date.") }

  const [organizer] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!organizer) { log.warn("[manual-payout] Organiser not found"); return adminPayoutResult(false, "Organizer not found.") }

  if (eventId) {
    const [event] = await db
      .select({ id: events.id, organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)
    if (!event) { log.warn("[manual-payout] Event not found"); return adminPayoutResult(false, "Event not found.") }
    if (event.organizerId !== userId) { log.warn("[manual-payout] Event doesn't belong to organizer"); return adminPayoutResult(false, "That event belongs to a different organizer. Choose the matching organizer/event pair.") }

    // Guard against recording a payout that exceeds what's actually owed for
    // this event — this is exactly how duplicate/phantom settlement payouts
    // happened before (paying out against orders with no issued ticket, or
    // paying twice for a sale the organiser already collected directly).
    if (!confirmOverage) {
      const { getEventRevenueSummaries } = await import("@/lib/revenue-summary")
      const summaries = await getEventRevenueSummaries([eventId])
      const available = summaries.get(eventId)?.availableBalance ?? 0
      if (amount > available) {
        log.warn("[manual-payout] Amount exceeds available balance", { eventId, amount, available })
        return adminPayoutResult(
          false,
          `This event's available balance is only $${available.toFixed(2)} right now — check reconciliation before recording $${amount.toFixed(2)}, or tick the override box if you're sure.`,
        )
      }
    }
  }

  const admin = session.user.email ?? session.user.id
  const cleanAmount = Number(amount.toFixed(2))

  try {
    const inserted = await db.transaction(async (tx) => {
      const [result] = await tx
        .insert(payouts)
        .values({
          userId,
          eventId: eventId || null,
          amount: cleanAmount.toFixed(2),
          currency,
          method: method as "ecocash" | "bank_usd" | "cash",
          status: "paid",
          accountName: organizer.name ?? undefined,
          proofReference,
          reviewedBy: admin,
          processedAt: paidDate,
          processedBy: admin,
          notes: ["Manual payout recorded by admin", notes].filter(Boolean).join(" — "),
        })
        .returning({ id: payouts.id })

      await createAuditLog({
        payoutId: result.id,
        action: "recorded_manual",
        toStatus: "paid",
        performedBy: admin,
        notes: `Manual payout of ${cleanAmount.toFixed(2)} ${currency} recorded (paid ${paidDate.toISOString().slice(0, 10)}). Ref: ${proofReference}`,
      }, tx)

      return result
    })

    log.info("Manual payout recorded", { payoutId: inserted.id, userId, amount: cleanAmount, by: admin })
    revalidatePath("/admin/payouts")
    revalidatePath("/admin/reconciliation")
    revalidatePath("/payouts")
    return { ok: true, message: `Manual payout of ${cleanAmount.toFixed(2)} ${currency} recorded.`, payoutId: inserted.id }
  } catch (err) {
    log.error("[manual-payout] Failed to record", { error: String(err) })
    return adminPayoutResult(false, "The payout could not be recorded. Check the details and try again.")
  }
}

export async function approvePayoutAction(payoutId: string): Promise<void> {
  const session = await requireAdmin().catch(() => null)
  if (!session) { log.warn("[approve-payout] Unauthorized", { payoutId }); revalidatePath("/admin/payouts"); return }
  const performedBy = session.user.email ?? session.user.id

  await transitionPayout({
    payoutId,
    action: "approved",
    allowedFrom: ["pending"],
    toStatus: "approved",
    performedBy,
    extraSet: { reviewedBy: performedBy },
    auditNotes: "Payout approved by admin",
    notify: {
      type: "payout_approved",
      title: "Payout approved",
      body: (payout) => `Your payout of ${Number(payout.amount).toFixed(2)} ${payout.currency ?? "USD"} has been approved and is being processed.`,
    },
  })

  revalidatePath("/admin/payouts")
}

export async function rejectPayoutAction(payoutId: string, reason: string): Promise<void> {
  const session = await requireAdmin().catch(() => null)
  if (!session) { log.warn("[reject-payout] Unauthorized", { payoutId }); revalidatePath("/admin/payouts"); return }

  if (!reason || reason.trim().length < 5) {
    log.warn("[reject-payout] Reason too short", { payoutId })
    revalidatePath("/admin/payouts")
    return
  }
  const performedBy = session.user.email ?? session.user.id
  const trimmedReason = reason.trim()

  await transitionPayout({
    payoutId,
    action: "rejected",
    allowedFrom: ["pending"],
    toStatus: "rejected",
    performedBy,
    extraSet: { rejectionReason: trimmedReason, reviewedBy: performedBy },
    auditNotes: `Rejected: ${trimmedReason}`,
    notify: {
      type: "payout_rejected",
      title: "Payout rejected",
      body: (payout) => `Your payout of ${Number(payout.amount).toFixed(2)} ${payout.currency ?? "USD"} was rejected. Reason: ${trimmedReason}`,
    },
  })

  revalidatePath("/admin/payouts")
}

export async function markPayoutProcessingAction(payoutId: string): Promise<void> {
  const session = await requireAdmin().catch(() => null)
  if (!session) { log.warn("[process-payout] Unauthorized", { payoutId }); revalidatePath("/admin/payouts"); return }

  await transitionPayout({
    payoutId,
    action: "processing",
    allowedFrom: ["approved"],
    toStatus: "processing",
    performedBy: session.user.email ?? session.user.id,
  })

  revalidatePath("/admin/payouts")
}

export async function markPayoutPaidAction(payoutId: string, proofReference?: string): Promise<void> {
  const session = await requireAdmin().catch(() => null)
  if (!session) { log.warn("[mark-paid] Unauthorized", { payoutId }); revalidatePath("/admin/payouts"); return }
  const performedBy = session.user.email ?? session.user.id

  const result = await transitionPayout({
    payoutId,
    action: "paid",
    allowedFrom: ["pending", "approved", "processing"],
    toStatus: "paid",
    performedBy,
    extraSet: {
      proofReference: proofReference?.trim() || undefined,
      processedAt: new Date(),
      processedBy: performedBy,
    },
    auditNotes: proofReference ? `Proof reference: ${proofReference}` : null,
    notify: {
      type: "payout_paid",
      title: "Payout sent",
      body: (payout) => `Your payout of ${Number(payout.amount).toFixed(2)} ${payout.currency ?? "USD"} has been sent to your ${payout.method === "ecocash" ? "EcoCash wallet" : "bank account"}.`,
    },
  })

  if (result.ok && result.payout) {
    // Email notification (non-DB — fire-and-forget even if it fails)
    try {
      const [user] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, result.payout.userId))
        .limit(1)

      if (user?.email) {
        await sendPayoutNotificationEmail({
          to: user.email,
          organizerName: user.name,
          payoutId,
          amount: String(result.payout.amount),
          currency: result.payout.currency ?? "USD",
          method: result.payout.method === "ecocash" ? "EcoCash" : "USD Bank",
          destination: result.payout.accountName ?? result.payout.accountNumber ?? "nominated account",
          eventTitle: result.payout.eventTitle ?? "Event",
        })
      }
    } catch (emailErr) {
      log.warn("Failed to send payout notification email", { payoutId, error: String(emailErr) })
    }
  }

  revalidatePath("/admin/payouts")
}

export async function updatePayoutStatusAction(payoutId: string, status: string): Promise<void> {
  const session = await requireAdmin().catch(() => null)
  if (!session) { log.warn("[update-status] Unauthorized", { payoutId }); revalidatePath("/admin/payouts"); return }

  if (!VALID_STATUSES.includes(status as any)) {
    log.warn("[update-status] Invalid status", { payoutId, status })
    revalidatePath("/admin/payouts")
    return
  }
  const performedBy = session.user.email ?? session.user.id

  await transitionPayout({
    payoutId,
    action: "status_updated",
    allowedFrom: VALID_STATUSES,
    toStatus: status as (typeof VALID_STATUSES)[number],
    performedBy,
    extraSet: {
      processedAt: status === "paid" ? new Date() : undefined,
      processedBy: status === "paid" ? performedBy : undefined,
    },
  })

  revalidatePath("/admin/payouts")
}

export async function getPayoutAuditLog(payoutId: string) {
  const session = await requireAdmin().catch(() => null)
  if (!session) return []

  const rows = await db
    .select()
    .from(payoutAuditLog)
    .where(eq(payoutAuditLog.payoutId, payoutId))
    .orderBy(desc(payoutAuditLog.createdAt))

  return rows
}
