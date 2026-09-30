import "server-only"

import { and, asc, eq, inArray, lte, lt, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, payoutNotificationDeliveries, payouts, users } from "@/db/schema"
import { log } from "@/lib/logger"
import { sendEmail } from "@/lib/email"
import { formatChatId, sendText } from "@/lib/whatsapp"
import { getBaseUrl } from "@/lib/url-config"
import {
  MAX_PAYOUT_NOTIFICATION_ATTEMPTS,
  payoutNotificationMessage,
  payoutNotificationRetryDelayMs,
  type PayoutNotificationEvent,
} from "@/lib/payout-notification-content"

const DELIVERY_CHANNELS = ["email", "whatsapp"] as const
const MAX_JOBS_PER_RUN = 24
const CLAIM_STALE_AFTER_MS = 10 * 60_000
const CONCURRENCY = 8

type DeliveryJob = typeof payoutNotificationDeliveries.$inferSelect

class DeliveryError extends Error {
  constructor(readonly code: string, readonly permanent = false) {
    super(code)
  }
}

/** Enqueue both channels in the caller's transaction so committed payouts aren't silently unnotified. */
export async function queuePayoutNotificationDeliveries(
  payoutId: string,
  eventType: PayoutNotificationEvent,
  tx: typeof db = db,
) {
  await tx
    .insert(payoutNotificationDeliveries)
    .values(DELIVERY_CHANNELS.map((channel) => ({ payoutId, eventType, channel })))
    .onConflictDoNothing()
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!)
}

function recipientPhone(method: string, accountNumber: string | null, profilePhone: string | null) {
  const phone = (method === "ecocash" ? accountNumber || profilePhone : profilePhone)?.trim()
  if (!phone) throw new DeliveryError("recipient_phone_missing", true)
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 9 || digits.length > 15) throw new DeliveryError("recipient_phone_invalid", true)
  return formatChatId(phone)
}

async function sendDelivery(job: DeliveryJob) {
  const [payout] = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      method: payouts.method,
      accountNumber: payouts.accountNumber,
      rejectionReason: payouts.rejectionReason,
      proofReference: payouts.proofReference,
      balanceSnapshot: payouts.balanceSnapshot,
      organizerName: users.name,
      organizerEmail: users.email,
      organizerPhone: users.phone,
      eventTitle: events.title,
    })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.userId))
    .leftJoin(events, eq(events.id, payouts.eventId))
    .where(eq(payouts.id, job.payoutId))
    .limit(1)

  if (!payout) throw new DeliveryError("payout_record_missing", true)

  const content = payoutNotificationMessage({
    eventType: job.eventType,
    payoutId: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    method: payout.method,
    rejectionReason: payout.rejectionReason,
    proofReference: payout.proofReference,
  })
  const context = [
    `Payout: ${content.reference}`,
    payout.eventTitle ? `Event: ${payout.eventTitle}` : null,
  ].filter(Boolean).join("\n")
  const whatsappText = `${content.message}\n\n${context}\nTicketPulse organiser payouts`
  const snapshot = payout.balanceSnapshot && typeof payout.balanceSnapshot === "object"
    ? payout.balanceSnapshot as Record<string, unknown>
    : {}
  const financialSummary = job.eventType === "payout_requested"
    ? [
      typeof snapshot.grossRevenue === "number" ? `Gross ticket revenue: USD ${snapshot.grossRevenue.toFixed(2)}` : null,
      typeof snapshot.platformFee === "number" ? `TicketPulse fee: USD ${snapshot.platformFee.toFixed(2)}` : null,
      typeof snapshot.availableBeforeRequest === "number" ? `Available before request: USD ${snapshot.availableBeforeRequest.toFixed(2)}` : null,
    ].filter(Boolean).join("\n")
    : ""
  const emailText = [content.message, financialSummary, context, "TicketPulse organiser payouts"].filter(Boolean).join("\n\n")

  if (job.channel === "email") {
    if (!payout.organizerEmail) throw new DeliveryError("recipient_email_missing", true)
    const result = await sendEmail({
      to: payout.organizerEmail,
      subject: content.subject,
      text: emailText,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:24px;color:#131132;border:1px solid #e5e7eb;border-radius:14px"><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b">TicketPulse payouts</p><h1 style="font-size:22px">${escapeHtml(content.subject.replace("TicketPulse: ", ""))}</h1><p style="line-height:1.6">${escapeHtml(content.message)}</p>${financialSummary ? `<p style="font-size:13px;line-height:1.8">${escapeHtml(financialSummary).replace(/\n/g, "<br>")}</p>` : ""}<p style="font-size:13px;color:#64748b">${escapeHtml(context).replace(/\n/g, "<br>")}</p><a href="${escapeHtml(getBaseUrl())}/payouts" style="display:inline-block;margin-top:12px;padding:10px 14px;background:#131132;color:white;text-decoration:none;border-radius:8px">View payouts</a></div>`,
    })
    if ("skipped" in result) throw new DeliveryError("email_provider_unavailable")
    return result.id || null
  }

  const result = await sendText(recipientPhone(payout.method, payout.accountNumber, payout.organizerPhone), whatsappText)
  return result.messageId || null
}

async function claimDeliveries(limit: number): Promise<DeliveryJob[]> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - CLAIM_STALE_AFTER_MS)

  return db.transaction(async (tx) => {
    // Recover claims abandoned by a crashed/terminated worker.
    await tx.update(payoutNotificationDeliveries)
      .set({ status: "pending", lockedAt: null, nextAttemptAt: now })
      .where(and(
        eq(payoutNotificationDeliveries.status, "sending"),
        lt(payoutNotificationDeliveries.lockedAt, staleBefore),
      ))

    const due = await tx.select({ id: payoutNotificationDeliveries.id })
      .from(payoutNotificationDeliveries)
      .where(and(
        eq(payoutNotificationDeliveries.status, "pending"),
        lte(payoutNotificationDeliveries.nextAttemptAt, now),
      ))
      .orderBy(asc(payoutNotificationDeliveries.nextAttemptAt), asc(payoutNotificationDeliveries.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true })

    if (due.length === 0) return []
    return tx.update(payoutNotificationDeliveries)
      .set({
        status: "sending",
        attemptCount: sql`${payoutNotificationDeliveries.attemptCount} + 1`,
        lastAttemptAt: now,
        lockedAt: now,
      })
      .where(inArray(payoutNotificationDeliveries.id, due.map((row) => row.id)))
      .returning()
  })
}

async function deliverOne(job: DeliveryJob) {
  try {
    const providerMessageId = await sendDelivery(job)
    await db.update(payoutNotificationDeliveries)
      .set({ status: "sent", deliveredAt: new Date(), lockedAt: null, providerMessageId, lastErrorCode: null })
      .where(and(
        eq(payoutNotificationDeliveries.id, job.id),
        eq(payoutNotificationDeliveries.status, "sending"),
      ))
    return "sent" as const
  } catch (error) {
    const code = error instanceof DeliveryError ? error.code : "provider_send_failed"
    const terminal = (error instanceof DeliveryError && error.permanent)
      || job.attemptCount >= MAX_PAYOUT_NOTIFICATION_ATTEMPTS
    const nextAttemptAt = new Date(Date.now() + payoutNotificationRetryDelayMs(job.attemptCount))

    await db.update(payoutNotificationDeliveries)
      .set({
        status: terminal ? "failed" : "pending",
        lockedAt: null,
        nextAttemptAt,
        lastErrorCode: code,
      })
      .where(and(
        eq(payoutNotificationDeliveries.id, job.id),
        eq(payoutNotificationDeliveries.status, "sending"),
      ))

    log.warn("Payout notification delivery failed", {
      payoutId: job.payoutId,
      channel: job.channel,
      attempt: job.attemptCount,
      retryScheduled: !terminal,
      errorCode: code,
    })
    return terminal ? "failed" as const : "retrying" as const
  }
}

/** Claim and process a bounded batch; DB row locks prevent duplicate cron workers. */
export async function processPayoutNotificationDeliveries() {
  const jobs = await claimDeliveries(MAX_JOBS_PER_RUN)
  let sent = 0
  let retrying = 0
  let failed = 0

  for (let offset = 0; offset < jobs.length; offset += CONCURRENCY) {
    const outcomes = await Promise.all(jobs.slice(offset, offset + CONCURRENCY).map(deliverOne))
    sent += outcomes.filter((outcome) => outcome === "sent").length
    retrying += outcomes.filter((outcome) => outcome === "retrying").length
    failed += outcomes.filter((outcome) => outcome === "failed").length
  }

  return { claimed: jobs.length, sent, retrying, failed }
}

/** Admin-triggered retry for deliveries that exhausted attempts or lack a corrected recipient. */
export async function requeueFailedPayoutNotifications(payoutId: string) {
  const rows = await db.update(payoutNotificationDeliveries)
    .set({ status: "pending", attemptCount: 0, nextAttemptAt: new Date(), lockedAt: null, lastErrorCode: null })
    .where(and(
      eq(payoutNotificationDeliveries.payoutId, payoutId),
      eq(payoutNotificationDeliveries.status, "failed"),
    ))
    .returning({ id: payoutNotificationDeliveries.id })
  return rows.length
}
