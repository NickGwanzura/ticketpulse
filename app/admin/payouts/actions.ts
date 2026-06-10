"use server"

import { revalidatePath } from "next/cache"
import { eq, desc, sql, and } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, orders, events, users, payoutAuditLog, notifications } from "@/db/schema"
import { log } from "@/lib/logger"
import { sendPayoutNotificationEmail } from "@/lib/email"

const VALID_STATUSES = ["pending", "approved", "processing", "paid", "held", "rejected", "failed", "cancelled"] as const

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
    title: opts.title,
    body: opts.body,
    link: opts.link ?? "/payouts",
  })
}

export async function getPayouts(status?: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

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

  // Stats
  const statsResult = await db
    .select({
      pending: sql<number>`count(case when ${payouts.status} = 'pending' then 1 end)`,
      approved: sql<number>`count(case when ${payouts.status} = 'approved' then 1 end)`,
      processing: sql<number>`count(case when ${payouts.status} = 'processing' then 1 end)`,
      paid: sql<number>`count(case when ${payouts.status} = 'paid' then 1 end)`,
      held: sql<number>`count(case when ${payouts.status} = 'held' then 1 end)`,
      rejected: sql<number>`count(case when ${payouts.status} = 'rejected' then 1 end)`,
      failed: sql<number>`count(case when ${payouts.status} = 'failed' then 1 end)`,
      cancelled: sql<number>`count(case when ${payouts.status} = 'cancelled' then 1 end)`,
      pendingTotal: sql<number>`coalesce(sum(case when ${payouts.status} = 'pending' then ${payouts.amount} else 0 end), 0)`,
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
export async function recordManualPayoutAction(formData: FormData) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const userId = ((formData.get("userId") as string) ?? "").trim()
  const eventId = ((formData.get("eventId") as string) ?? "").trim()
  const amount = parseFloat(formData.get("amount") as string)
  const currency = ((formData.get("currency") as string) || "USD").trim().toUpperCase()
  const method = ((formData.get("method") as string) ?? "").trim()
  const paidDateRaw = ((formData.get("paidDate") as string) ?? "").trim()
  const proofReference = ((formData.get("proofReference") as string) ?? "").trim()
  const notes = ((formData.get("notes") as string) ?? "").trim()

  if (!userId) throw new Error("Select the organiser who was paid")
  if (!amount || Number.isNaN(amount) || amount <= 0) throw new Error("Amount must be greater than zero")
  if (amount > 100000) throw new Error("Maximum payout amount is $100,000")
  if (!["ecocash", "bank_usd", "cash"].includes(method)) throw new Error("Choose a valid payment method")
  if (!proofReference || proofReference.length < 3) throw new Error("Enter a reference for the manual payment (receipt, transfer ref, or note)")

  const paidDate = paidDateRaw ? new Date(paidDateRaw) : new Date()
  if (Number.isNaN(paidDate.getTime())) throw new Error("Invalid payment date")

  const [organizer] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!organizer) throw new Error("Organiser not found")

  if (eventId) {
    const [event] = await db
      .select({ id: events.id, organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)
    if (!event) throw new Error("Event not found")
    if (event.organizerId !== userId) throw new Error("That event does not belong to the selected organiser")
  }

  const admin = session.user.email ?? session.user.id
  const cleanAmount = Number(amount.toFixed(2))
  const isCash = method === "cash"

  const inserted = await db.transaction(async (tx) => {
    const [result] = await tx
      .insert(payouts)
      .values({
        userId,
        eventId: eventId || null,
        amount: cleanAmount.toFixed(2),
        currency,
        method: isCash ? "bank_usd" : (method as "ecocash" | "bank_usd"),
        status: "paid",
        accountName: organizer.name ?? undefined,
        bankName: isCash ? "Manual cash payment" : undefined,
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
}

export async function approvePayoutAction(payoutId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [payout] = await db
    .select({ id: payouts.id, status: payouts.status, amount: payouts.amount, currency: payouts.currency, userId: payouts.userId })
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1)

  if (!payout) throw new Error("Payout not found")
  if (payout.status !== "pending") {
    throw new Error(`Cannot approve payout in "${payout.status}" status`)
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({
        status: "approved",
        reviewedBy: session.user.email ?? session.user.id,
      })
      .where(eq(payouts.id, payoutId))

    await createAuditLog({
      payoutId,
      action: "approved",
      fromStatus: payout.status,
      toStatus: "approved",
      performedBy: session.user.email ?? session.user.id,
      notes: "Payout approved by admin",
    }, tx)

    await createPayoutNotification({
      userId: payout.userId,
      type: "payout_approved",
      title: "Payout approved",
      body: `Your payout of ${Number(payout.amount).toFixed(2)} ${payout.currency ?? "USD"} has been approved and is being processed.`,
    }, tx)
  })

  log.info("Payout approved", { payoutId, by: session.user.email })
  revalidatePath("/admin/payouts")
  return { ok: true }
}

export async function rejectPayoutAction(payoutId: string, reason: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  if (!reason || reason.trim().length < 5) {
    throw new Error("Please provide a rejection reason (at least 5 characters)")
  }

  const [payout] = await db
    .select({ id: payouts.id, status: payouts.status, amount: payouts.amount, currency: payouts.currency, userId: payouts.userId })
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1)

  if (!payout) throw new Error("Payout not found")
  if (payout.status !== "pending") {
    throw new Error(`Cannot reject payout in "${payout.status}" status`)
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({
        status: "rejected",
        rejectionReason: reason.trim(),
        reviewedBy: session.user.email ?? session.user.id,
      })
      .where(eq(payouts.id, payoutId))

    await createAuditLog({
      payoutId,
      action: "rejected",
      fromStatus: payout.status,
      toStatus: "rejected",
      performedBy: session.user.email ?? session.user.id,
      notes: `Rejected: ${reason.trim()}`,
    }, tx)

    await createPayoutNotification({
      userId: payout.userId,
      type: "payout_rejected",
      title: "Payout rejected",
      body: `Your payout of ${Number(payout.amount).toFixed(2)} ${payout.currency ?? "USD"} was rejected. Reason: ${reason.trim()}`,
    }, tx)
  })

  log.info("Payout rejected", { payoutId, reason, by: session.user.email })
  revalidatePath("/admin/payouts")
  return { ok: true }
}

export async function markPayoutProcessingAction(payoutId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [payout] = await db
    .select({ id: payouts.id, status: payouts.status })
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1)

  if (!payout) throw new Error("Payout not found")
  if (payout.status !== "approved") {
    throw new Error(`Cannot mark payout as processing in "${payout.status}" status`)
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({ status: "processing" })
      .where(eq(payouts.id, payoutId))

    await createAuditLog({
      payoutId,
      action: "processing",
      fromStatus: payout.status,
      toStatus: "processing",
      performedBy: session.user.email ?? session.user.id,
    }, tx)
  })

  log.info("Payout marked processing", { payoutId, by: session.user.email })
  revalidatePath("/admin/payouts")
  return { ok: true }
}

export async function markPayoutPaidAction(payoutId: string, proofReference?: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [payout] = await db
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
    .where(eq(payouts.id, payoutId))
    .limit(1)

  if (!payout) throw new Error("Payout not found")
  if (payout.status !== "approved" && payout.status !== "processing") {
    throw new Error(`Cannot mark payout as paid in "${payout.status}" status. Must be approved or processing first.`)
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({
        status: "paid",
        proofReference: proofReference?.trim() || undefined,
        processedAt: new Date(),
        processedBy: session.user.email ?? session.user.id,
      })
      .where(eq(payouts.id, payoutId))

    await createAuditLog({
      payoutId,
      action: "paid",
      fromStatus: payout.status,
      toStatus: "paid",
      performedBy: session.user.email ?? session.user.id,
      notes: proofReference ? `Proof reference: ${proofReference}` : null,
    }, tx)

    await createPayoutNotification({
      userId: payout.userId,
      type: "payout_paid",
      title: "Payout sent",
      body: `Your payout of ${Number(payout.amount).toFixed(2)} ${payout.currency ?? "USD"} has been sent to your ${payout.method === "ecocash" ? "EcoCash wallet" : "bank account"}.`,
    }, tx)
  })

  // Email notification (non-DB — fire-and-forget even if it fails)
  try {
    const [user] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, payout.userId))
      .limit(1)

    if (user?.email) {
      await sendPayoutNotificationEmail({
        to: user.email,
        organizerName: user.name,
        payoutId,
        amount: String(payout.amount),
        currency: payout.currency ?? "USD",
        method: payout.method === "ecocash" ? "EcoCash" : "USD Bank",
        destination: payout.accountName ?? payout.accountNumber ?? "nominated account",
        eventTitle: payout.eventTitle ?? "Event",
      })
    }
  } catch (emailErr) {
    log.warn("Failed to send payout notification email", { payoutId, error: String(emailErr) })
  }

  log.info("Payout marked paid", { payoutId, by: session.user.email })
  revalidatePath("/admin/payouts")
  return { ok: true }
}

export async function updatePayoutStatusAction(payoutId: string, status: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  if (!VALID_STATUSES.includes(status as any)) {
    throw new Error("Invalid status")
  }

  const [existing] = await db
    .select({ id: payouts.id, status: payouts.status })
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1)

  if (!existing) throw new Error("Payout not found")

  await db.transaction(async (tx) => {
    await tx
      .update(payouts)
      .set({
        status: status as any,
        processedAt: status === "paid" ? new Date() : undefined,
        processedBy: status === "paid" ? (session.user.email ?? session.user.id) : undefined,
      })
      .where(eq(payouts.id, payoutId))

    await createAuditLog({
      payoutId,
      action: "status_updated",
      fromStatus: existing.status,
      toStatus: status,
      performedBy: session.user.email ?? session.user.id,
    }, tx)
  })

  log.info("Payout status updated", { payoutId, status, by: session.user.email })
  revalidatePath("/admin/payouts")
  return { ok: true }
}

export async function getPayoutAuditLog(payoutId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const rows = await db
    .select()
    .from(payoutAuditLog)
    .where(eq(payoutAuditLog.payoutId, payoutId))
    .orderBy(desc(payoutAuditLog.createdAt))

  return rows
}
