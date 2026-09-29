"use server"

import { revalidatePath } from "next/cache"
import { and, eq, desc, sql } from "drizzle-orm"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-guard"
import { db } from "@/db"
import { payouts, events, users, payoutAuditLog } from "@/db/schema"
import { log } from "@/lib/logger"
import { recordAdminAudit } from "@/lib/admin-audit"
import { transitionPayout } from "@/lib/payout-transitions"
import { sendPayoutNotice } from "@/lib/payout-notifications"
import { getEventRevenueSummaries, getOrganizerRevenueSummary } from "@/lib/revenue-summary"

const VALID_STATUSES = ["pending", "approved", "processing", "paid", "held", "rejected", "failed", "cancelled"] as const
type PayoutStatus = (typeof VALID_STATUSES)[number]

function isUsableWhatsAppNumber(value: string | null | undefined): value is string {
  const digits = value?.replace(/\D/g, "") ?? ""
  return digits.length >= 9 && digits.length <= 15
}

const ecocashPattern = /^(\+?263|0)?7[1789]\d{7}$/

function isPayoutStatus(value: string): value is PayoutStatus {
  return (VALID_STATUSES as readonly string[]).includes(value)
}

// FormData.get() returns null (not undefined) for any field that's absent —
// an unchecked checkbox, a field the form doesn't render at all, etc.
// z.string().optional()/.default() only rescue undefined, so they still
// reject null — .nullish() (or preprocessing null -> undefined) is required
// for every field that isn't guaranteed to be present in the actual <form>.
const ManualPayoutSchema = z.object({
  userId: z.string().trim().min(1, "Select the organizer who was paid."),
  eventId: z.string().trim().uuid("Choose one event for this payout."),
  amount: z.coerce.number({ error: "Enter a valid payout amount." })
    .positive("Enter a valid payout amount.")
    .max(100000, "This payout amount is above the allowed limit."),
  currency: z.string().trim().nullish().default("USD").transform((c) => (c ?? "USD").toUpperCase()).refine((c) => c === "USD", "Payouts can only be recorded in USD."),
  method: z.enum(["ecocash", "bank_usd"], { error: "Payouts can only be made by EcoCash or USD bank transfer." }),
  ecocashNumber: z.string().trim().max(32).nullish().transform((value) => value ?? ""),
  bankName: z.string().trim().max(64).nullish().transform((value) => value ?? ""),
  accountNumber: z.string().trim().max(100).nullish().transform((value) => value ?? ""),
  accountName: z.string().trim().max(128).nullish().transform((value) => value ?? ""),
  paidDate: z.string().trim().nullish().default(""),
  proofReference: z.string().trim().min(3, "Add the provider's receipt or transfer reference.").max(200),
  notes: z.string().trim().max(500).nullish().default(""),
}).superRefine((data, context) => {
  if (data.method === "ecocash") {
    if (!data.ecocashNumber || !ecocashPattern.test(data.ecocashNumber.replace(/\s/g, ""))) {
      context.addIssue({ code: "custom", path: ["ecocashNumber"], message: "Enter the EcoCash number that received the payout." })
    }
  } else {
    if (data.bankName.length < 2) context.addIssue({ code: "custom", path: ["bankName"], message: "Enter the bank name." })
    if (data.accountNumber.length < 5) context.addIssue({ code: "custom", path: ["accountNumber"], message: "Enter the bank account number." })
    if (data.accountName.length < 2) context.addIssue({ code: "custom", path: ["accountName"], message: "Enter the account holder name." })
  }
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

export async function getPayouts(status?: string) {
  // Session auth is intentionally still a throw here because this is a
  // server-data function called *during* render. The page now guards with
  // its own redirect() before calling this, so the throw is a safety net.
  await requireAdmin()

  const conditions: ReturnType<typeof eq>[] = []
  if (status && status !== "all" && isPayoutStatus(status)) {
    conditions.push(eq(payouts.status, status))
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

export type AdminPayoutRow = Awaited<ReturnType<typeof getPayouts>>["payouts"][number]

/**
 * Dispatches actions from the client-side payout table without passing
 * per-row closures through the Server/Client Component boundary.
 */
export async function handlePayoutTableAction(formData: FormData): Promise<void> {
  const action = String(formData.get("action") ?? "")
  const payoutId = String(formData.get("payoutId") ?? "").trim()
  if (!payoutId) return

  switch (action) {
    case "approve":
      await approvePayoutAction(payoutId)
      return
    case "reject":
      await rejectPayoutAction(payoutId, String(formData.get("reason") ?? ""))
      return
    case "processing":
      await markPayoutProcessingAction(payoutId)
      return
    case "paid": {
      const proofReference = String(formData.get("proofReference") ?? "").trim()
      await markPayoutPaidAction(payoutId, proofReference || undefined)
      return
    }
    default:
      log.warn("[payout-table] Unknown action", { action, payoutId })
  }
}

/**
 * Record a payout that was already made to an organiser outside the app
 * (manual EcoCash or USD bank transfer). Inserts a payout row that is
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
    ecocashNumber: formData.get("ecocashNumber"),
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
    paidDate: formData.get("paidDate"),
    proofReference: formData.get("proofReference"),
    notes: formData.get("notes"),
  })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid payout details."
    log.warn("[manual-payout] Validation failed", { issues: parsed.error.issues })
    return adminPayoutResult(false, message)
  }
  const { userId, eventId, amount, currency, method, ecocashNumber, bankName, accountNumber, accountName, paidDate: paidDateRaw, proofReference, notes } = parsed.data

  const paidDate = paidDateRaw ? new Date(paidDateRaw) : new Date()
  if (Number.isNaN(paidDate.getTime())) { log.warn("[manual-payout] Invalid date"); return adminPayoutResult(false, "Choose a valid payout date.") }

  const [organizer] = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!organizer) { log.warn("[manual-payout] Organiser not found"); return adminPayoutResult(false, "Organizer not found.") }
  const whatsappPhone = isUsableWhatsAppNumber(organizer.phone)
    ? organizer.phone
    : method === "ecocash" && isUsableWhatsAppNumber(ecocashNumber)
      ? ecocashNumber
      : ""
  if (!organizer.email || !z.string().email().safeParse(organizer.email).success || !whatsappPhone) {
    log.warn("[manual-payout] Missing payout notification contact", { userId, hasEmail: Boolean(organizer.email), hasPhone: Boolean(organizer.phone) })
    return adminPayoutResult(false, "Add a valid organiser email address and WhatsApp phone number to their profile before recording a payout.")
  }

  const [event] = await db
    .select({ id: events.id, organizerId: events.organizerId, title: events.title })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!event) { log.warn("[manual-payout] Event not found"); return adminPayoutResult(false, "Event not found.") }
  if (event.organizerId !== userId) { log.warn("[manual-payout] Event doesn't belong to organizer"); return adminPayoutResult(false, "That event belongs to a different organizer. Choose the matching organizer/event pair.") }

  const [organizerSummary, eventSummaries] = await Promise.all([
    getOrganizerRevenueSummary(userId),
    getEventRevenueSummaries([eventId]),
  ])
  const eventSummary = eventSummaries.get(eventId)
  if (!eventSummary) return adminPayoutResult(false, "We could not calculate this event's available balance. Try again.")

  const admin = session.user.email ?? session.user.id
  const cleanAmount = Number(amount.toFixed(2))

  try {
    const inserted = await db.transaction(async (tx) => {
      const [lockedOrganizer] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for("update")
        .limit(1)
      if (!lockedOrganizer) throw new Error("ORGANIZER_NOT_FOUND")

      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`payout-reference:${proofReference}`}, 0))`)
      const [duplicateReference] = await tx
        .select({ id: payouts.id })
        .from(payouts)
        .where(and(eq(payouts.method, method), eq(payouts.proofReference, proofReference)))
        .limit(1)
      if (duplicateReference) throw new Error("DUPLICATE_REFERENCE")

      const [organizerPayoutTotals] = await tx
        .select({
          paid: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} = 'paid' THEN ${payouts.amount} ELSE 0 END), 0)`,
          reserved: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} IN ('pending', 'approved', 'processing') THEN ${payouts.amount} ELSE 0 END), 0)`,
        })
        .from(payouts)
        .where(eq(payouts.userId, userId))
      const [eventPayoutTotals] = await tx
        .select({
          paid: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} = 'paid' THEN ${payouts.amount} ELSE 0 END), 0)`,
          reserved: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} IN ('pending', 'approved', 'processing') THEN ${payouts.amount} ELSE 0 END), 0)`,
        })
        .from(payouts)
        .where(eq(payouts.eventId, eventId))
      const globalAvailable = Math.max(0, organizerSummary.netRevenue - Number(organizerPayoutTotals?.paid ?? 0) - Number(organizerPayoutTotals?.reserved ?? 0) - organizerSummary.outstandingClawbacks)
      const eventAvailable = Math.max(0, eventSummary.netRevenue - Number(eventPayoutTotals?.paid ?? 0) - Number(eventPayoutTotals?.reserved ?? 0) - eventSummary.outstandingClawbacks)
      const available = Math.min(globalAvailable, eventAvailable)
      if (cleanAmount > available) throw new Error(`INSUFFICIENT_BALANCE:${available.toFixed(2)}`)

      const [result] = await tx
        .insert(payouts)
        .values({
          userId,
          eventId,
          amount: cleanAmount.toFixed(2),
          currency: "USD",
          method,
          status: "paid",
          accountNumber: method === "ecocash" ? ecocashNumber : accountNumber,
          accountName: method === "ecocash" ? organizer.name ?? undefined : accountName,
          bankName: method === "ecocash" ? "EcoCash" : bankName,
          proofReference,
          balanceSnapshot: {
            eventId,
            eventTitle: event.title,
            grossRevenue: eventSummary.grossRevenue,
            platformFeePercent: eventSummary.commissionRate,
            platformFee: eventSummary.platformFee,
            netRevenue: eventSummary.netRevenue,
            paidOut: Number(eventPayoutTotals?.paid ?? 0),
            activePending: Number(eventPayoutTotals?.reserved ?? 0),
            availableBeforeRequest: available,
            organizerAvailableBeforeRequest: globalAvailable,
            eventAvailableBeforeRequest: eventAvailable,
            confirmedOrderCount: eventSummary.confirmedOrderCount,
            confirmedTicketCount: eventSummary.confirmedTicketCount,
          },
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
        notes: `Manual payout of USD ${cleanAmount.toFixed(2)} recorded for ${event.title} (paid ${paidDate.toISOString().slice(0, 10)}). Ref: ${proofReference}`,
      }, tx)

      return result
    })

    try {
      await recordAdminAudit({
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "payout.recorded_manual",
        targetType: "payout",
        targetId: inserted.id,
        after: { status: "paid", amount: cleanAmount, currency, organizerId: userId, eventId },
        reason: notes || null,
      })
    } catch (auditError) {
      log.error("[manual-payout] Admin audit failed after payout commit", { payoutId: inserted.id, error: String(auditError) })
    }

    await sendPayoutNotice({
      payoutId: inserted.id,
      organizerName: organizer.name,
      email: organizer.email,
      phone: whatsappPhone,
      amount: cleanAmount,
      method,
      status: "paid",
      eventTitle: event.title,
      proofReference,
    })

    log.info("Manual payout recorded", { payoutId: inserted.id, userId, amount: cleanAmount, by: admin })
    revalidatePath("/admin/payouts")
    revalidatePath("/admin/reconciliation")
    revalidatePath("/payouts")
    return { ok: true, message: `Manual payout of USD ${cleanAmount.toFixed(2)} recorded for ${event.title}.`, payoutId: inserted.id }
  } catch (err) {
    log.error("[manual-payout] Failed to record", { error: String(err) })
    const message = String(err)
    if (message.includes("DUPLICATE_REFERENCE")) return adminPayoutResult(false, "That provider reference is already attached to another payout. Check the receipt and try again.")
    if (message.includes("INSUFFICIENT_BALANCE:")) {
      const available = Number(message.split("INSUFFICIENT_BALANCE:")[1])
      return adminPayoutResult(false, `The maximum available for this organiser and event is USD ${available.toFixed(2)}.`)
    }
    if (message.includes("ORGANIZER_NOT_FOUND")) return adminPayoutResult(false, "Organizer not found.")
    return adminPayoutResult(false, "The payout could not be recorded. Check the details and try again.")
  }
}

export async function approvePayoutAction(payoutId: string): Promise<void> {
  const session = await requireAdmin().catch(() => null)
  if (!session) { log.warn("[approve-payout] Unauthorized", { payoutId }); revalidatePath("/admin/payouts"); return }

  const result = await transitionPayout({
    payoutId,
    action: "approve",
    performedBy: { userId: session.user.id, email: session.user.email ?? null },
  })
  if (!result.ok) log.warn("[approve-payout] Transition was not applied", { payoutId, error: result.error })

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
  const trimmedReason = reason.trim()

  const result = await transitionPayout({
    payoutId,
    action: "reject",
    performedBy: { userId: session.user.id, email: session.user.email ?? null },
    reason: trimmedReason,
  })
  if (!result.ok) log.warn("[reject-payout] Transition was not applied", { payoutId, error: result.error })

  revalidatePath("/admin/payouts")
}

export async function markPayoutProcessingAction(payoutId: string): Promise<void> {
  const session = await requireAdmin().catch(() => null)
  if (!session) { log.warn("[process-payout] Unauthorized", { payoutId }); revalidatePath("/admin/payouts"); return }

  const result = await transitionPayout({
    payoutId,
    action: "processing",
    performedBy: { userId: session.user.id, email: session.user.email ?? null },
  })
  if (!result.ok) log.warn("[process-payout] Transition was not applied", { payoutId, error: result.error })

  revalidatePath("/admin/payouts")
}

export async function markPayoutPaidAction(payoutId: string, proofReference?: string): Promise<void> {
  const session = await requireAdmin().catch(() => null)
  if (!session) { log.warn("[mark-paid] Unauthorized", { payoutId }); revalidatePath("/admin/payouts"); return }

  const result = await transitionPayout({
    payoutId,
    action: "paid",
    performedBy: { userId: session.user.id, email: session.user.email ?? null },
    proofReference,
  })
  if (!result.ok) log.warn("[mark-paid] Transition was not applied", { payoutId, error: result.error })

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
