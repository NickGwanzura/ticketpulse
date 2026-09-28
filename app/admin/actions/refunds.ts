"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import {
  events,
  orderItems,
  orders,
  paymentLedger,
  refundRequests,
  refundRequestTickets,
  ticketTiers,
  tickets,
} from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { recordAdminAction } from "@/lib/admin-audit"
import { sendEmail } from "@/lib/email"
import { refundRequestUpdateEmail } from "@/lib/email-templates/refunds"
import { log } from "@/lib/logger"
import { lockOrderMutation } from "@/lib/velocity/idempotency"

const ProviderConfirmation = z.object({
  reference: z.string().trim().min(3).max(120),
  amount: z.string().trim().regex(/^\d{1,8}(?:\.\d{1,2})?$/),
})

function toCents(value: string | number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error("Invalid refund amount")
  return Math.round(number * 100)
}

function amountText(cents: number): string {
  return (cents / 100).toFixed(2)
}

async function getCaseRows(refundRequestId: string) {
  const [refundCase] = await db
    .select({
      id: refundRequests.id,
      orderId: refundRequests.orderId,
      eventId: refundRequests.eventId,
      status: refundRequests.status,
      amount: refundRequests.amount,
      currency: refundRequests.currency,
      source: refundRequests.source,
      requestedByEmail: refundRequests.requestedByEmail,
      reason: refundRequests.reason,
      outsideStandardWindow: refundRequests.outsideStandardWindow,
      requestedAt: refundRequests.requestedAt,
      reviewNote: refundRequests.reviewNote,
      providerReference: refundRequests.providerReference,
      providerConfirmedAt: refundRequests.providerConfirmedAt,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      orderStatus: orders.status,
      paymentMethod: orders.paymentMethod,
      totalAmount: orders.totalAmount,
      eventTitle: events.title,
    })
    .from(refundRequests)
    .innerJoin(orders, eq(orders.id, refundRequests.orderId))
    .innerJoin(events, eq(events.id, refundRequests.eventId))
    .where(eq(refundRequests.id, refundRequestId))
    .limit(1)
  if (!refundCase) throw new Error("Refund request not found")
  return refundCase
}

async function notifyBuyer(input: {
  email: string | null
  name: string | null
  eventTitle: string
  requestId: string
  amount: string
  currency: string
  status: "approved" | "rejected" | "confirmed" | "failed"
  note?: string | null
  providerReference?: string | null
}) {
  if (!input.email) return
  const content = refundRequestUpdateEmail({
    buyerName: input.name,
    eventTitle: input.eventTitle,
    requestId: input.requestId,
    amount: input.amount,
    currency: input.currency,
    status: input.status,
    note: input.note,
    providerReference: input.providerReference,
  })
  await sendEmail({
    to: input.email,
    subject: input.status === "confirmed"
      ? `Refund confirmed · ${input.eventTitle}`
      : input.status === "failed"
        ? `Refund processing update · ${input.eventTitle}`
        : input.status === "approved"
          ? `Refund request approved · ${input.eventTitle}`
          : `Refund request update · ${input.eventTitle}`,
    ...content,
  }).catch((error) => log.error("refund update email failed", { refundRequestId: input.requestId, error: String(error) }))
}

function revalidateRefundPaths(orderId: string) {
  revalidatePath("/admin/refunds")
  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin/tickets")
  revalidatePath("/admin")
}

export async function approveRefundRequestAction(refundRequestId: string) {
  const session = await requireAdmin()
  const before = await getCaseRows(refundRequestId)

  await db.transaction(async (tx) => {
    await lockOrderMutation(tx, before.orderId)
    const [current] = await tx.select({ status: refundRequests.status })
      .from(refundRequests).where(eq(refundRequests.id, refundRequestId)).limit(1)
    if (current?.status !== "requested") throw new Error("Only requested refunds can be approved")

    const rows = await tx.select({
      ticketId: refundRequestTickets.ticketId,
      status: tickets.status,
      scannedAt: tickets.scannedAt,
      transferToEmail: tickets.transferToEmail,
      transferredAt: tickets.transferredAt,
    })
      .from(refundRequestTickets)
      .innerJoin(tickets, eq(tickets.id, refundRequestTickets.ticketId))
      .where(eq(refundRequestTickets.refundRequestId, refundRequestId))
    if (rows.length === 0 || rows.some((row) =>
      row.status !== "sold" || row.scannedAt ||
      (before.source !== "event_cancellation" && (row.transferToEmail || row.transferredAt)),
    )) {
      throw new Error("Tickets changed or were used; this request cannot be approved")
    }

    const ticketIds = rows.map((row) => row.ticketId)
    const held = await tx.update(tickets)
      .set({ status: "refund_pending" })
      .where(and(inArray(tickets.id, ticketIds), eq(tickets.status, "sold"), isNull(tickets.scannedAt)))
      .returning({ id: tickets.id })
    if (held.length !== ticketIds.length) throw new Error("A ticket changed while the request was being approved")

    const [updated] = await tx.update(refundRequests)
      .set({ status: "approved", reviewedBy: session.user.email ?? session.user.id, reviewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(refundRequests.id, refundRequestId), eq(refundRequests.status, "requested")))
      .returning({ id: refundRequests.id })
    if (!updated) throw new Error("Refund request changed; reload and try again")
  })

  await recordAdminAction(session, {
    action: "refund.approved",
    targetType: "refund_request",
    targetId: refundRequestId,
    before: { status: before.status },
    after: { status: "approved", amount: before.amount, ticketCount: (await db.select({ count: sql<number>`count(*)::int` }).from(refundRequestTickets).where(eq(refundRequestTickets.refundRequestId, refundRequestId)))[0]?.count ?? 0 },
  })
  await notifyBuyer({
    email: before.guestEmail,
    name: before.guestName,
    eventTitle: before.eventTitle,
    requestId: refundRequestId,
    amount: before.amount,
    currency: before.currency,
    status: "approved",
  })
  revalidateRefundPaths(before.orderId)
  return { success: true }
}

export async function rejectRefundRequestAction(refundRequestId: string, note: string) {
  const session = await requireAdmin()
  const cleanNote = z.string().trim().min(5).max(1000).parse(note)
  const before = await getCaseRows(refundRequestId)
  if (before.status !== "requested") throw new Error("Only requests not yet approved can be rejected")

  const [updated] = await db.update(refundRequests)
    .set({ status: "rejected", reviewedBy: session.user.email ?? session.user.id, reviewedAt: new Date(), reviewNote: cleanNote, updatedAt: new Date() })
    .where(and(eq(refundRequests.id, refundRequestId), eq(refundRequests.status, "requested")))
    .returning({ id: refundRequests.id })
  if (!updated) throw new Error("Refund request changed; reload and try again")

  await recordAdminAction(session, {
    action: "refund.rejected",
    targetType: "refund_request",
    targetId: refundRequestId,
    before: { status: before.status },
    after: { status: "rejected", note: cleanNote },
  })
  await notifyBuyer({
    email: before.guestEmail,
    name: before.guestName,
    eventTitle: before.eventTitle,
    requestId: refundRequestId,
    amount: before.amount,
    currency: before.currency,
    status: "rejected",
    note: cleanNote,
  })
  revalidateRefundPaths(before.orderId)
  return { success: true }
}

/** Record a confirmed provider refund. The admin has already completed it in Velocity. */
export async function confirmRefundRequestAction(refundRequestId: string, input: { reference: string; amount: string }) {
  const session = await requireAdmin()
  const parsed = ProviderConfirmation.parse(input)
  const providerAmountCents = toCents(parsed.amount)
  const before = await getCaseRows(refundRequestId)
  if (providerAmountCents !== toCents(before.amount)) {
    throw new Error("Provider-confirmed amount must exactly match the approved amount")
  }

  const result = await db.transaction(async (tx) => {
    await lockOrderMutation(tx, before.orderId)
    const [current] = await tx.select({
      id: refundRequests.id,
      status: refundRequests.status,
      amount: refundRequests.amount,
      orderId: refundRequests.orderId,
      eventId: refundRequests.eventId,
      currency: refundRequests.currency,
    }).from(refundRequests).where(eq(refundRequests.id, refundRequestId)).limit(1)
    if (!current || current.status !== "approved") throw new Error("Only approved refunds can be confirmed")
    if (providerAmountCents !== toCents(current.amount)) throw new Error("Approved amount changed; reload and verify the provider amount")

    const rows = await tx.select({
      ticketId: refundRequestTickets.ticketId,
      amount: refundRequestTickets.amount,
      tierId: tickets.tierId,
      status: tickets.status,
      scannedAt: tickets.scannedAt,
    })
      .from(refundRequestTickets)
      .innerJoin(tickets, eq(tickets.id, refundRequestTickets.ticketId))
      .where(eq(refundRequestTickets.refundRequestId, refundRequestId))
    if (rows.length === 0 || rows.some((row) => row.status !== "refund_pending" || row.scannedAt)) {
      throw new Error("Ticket state changed; refund confirmation was not recorded")
    }
    const recordedAmountCents = rows.reduce((sum, row) => sum + toCents(row.amount), 0)
    if (recordedAmountCents !== providerAmountCents) throw new Error("Ticket amounts do not match the provider-confirmed amount")

    const ticketIds = rows.map((row) => row.ticketId)
    const changed = await tx.update(tickets)
      .set({ status: "refunded" })
      .where(and(inArray(tickets.id, ticketIds), eq(tickets.status, "refund_pending"), isNull(tickets.scannedAt)))
      .returning({ id: tickets.id })
    if (changed.length !== ticketIds.length) throw new Error("A ticket changed while recording the refund")

    const tierCounts = new Map<string, number>()
    for (const row of rows) if (row.tierId) tierCounts.set(row.tierId, (tierCounts.get(row.tierId) ?? 0) + 1)
    for (const [tierId, quantity] of tierCounts) {
      await tx.update(ticketTiers)
        .set({ soldQuantity: sql`GREATEST(COALESCE(${ticketTiers.soldQuantity}, 0) - ${quantity}, 0)` })
        .where(eq(ticketTiers.id, tierId))
    }

    const confirmedAt = new Date()
    const [confirmed] = await tx.update(refundRequests)
      .set({
        status: "confirmed",
        providerReference: parsed.reference,
        providerConfirmedBy: session.user.email ?? session.user.id,
        providerConfirmedAt: confirmedAt,
        updatedAt: confirmedAt,
      })
      .where(and(eq(refundRequests.id, refundRequestId), eq(refundRequests.status, "approved")))
      .returning({ id: refundRequests.id })
    if (!confirmed) throw new Error("Refund request changed; reload and try again")

    await tx.insert(paymentLedger).values({
      orderId: current.orderId,
      eventId: current.eventId,
      transactionTrace: `refund-${refundRequestId}`,
      salesOrderTrace: `refund-${before.orderId}`,
      invoiceId: parsed.reference,
      amount: `-${amountText(providerAmountCents)}`,
      currency: current.currency,
      processor: before.paymentMethod ?? "velocity",
      velocityPollStatus: "MANUAL_REFUND_CONFIRMED",
      localStatus: "refunded",
      source: "provider_confirmed_refund",
      rawPayload: {
        refundRequestId,
        providerReference: parsed.reference,
        providerConfirmedBy: session.user.email ?? session.user.id,
        providerConfirmedAt: confirmedAt.toISOString(),
        ticketCount: ticketIds.length,
      },
    })

    const [remainingTickets] = await tx.select({ count: sql<number>`count(*)::int` }).from(tickets)
      .where(and(eq(tickets.orderId, before.orderId), eq(tickets.isStaffTicket, false), notInArray(tickets.status, ["refunded", "cancelled"])))
    const [nonTicketLines] = await tx.select({ count: sql<number>`count(*)::int` }).from(orderItems)
      .where(and(eq(orderItems.orderId, before.orderId), sql`${orderItems.type} <> 'ticket'`))
    const [confirmedRefunds] = await tx.select({ amount: sql<string>`COALESCE(SUM(${refundRequests.amount}), 0)::numeric` }).from(refundRequests)
      .where(and(eq(refundRequests.orderId, before.orderId), eq(refundRequests.status, "confirmed")))
    const fullyRefunded = Number(remainingTickets?.count ?? 0) === 0 &&
      Number(nonTicketLines?.count ?? 0) === 0 &&
      toCents(confirmedRefunds?.amount ?? 0) >= toCents(before.totalAmount)
    if (fullyRefunded) {
      await tx.update(orders).set({ status: "refunded", updatedAt: confirmedAt }).where(eq(orders.id, before.orderId))
    }

    return { confirmedAt, fullyRefunded, ticketCount: ticketIds.length }
  })

  await recordAdminAction(session, {
    action: "refund.provider_confirmed",
    targetType: "refund_request",
    targetId: refundRequestId,
    before: { status: before.status },
    after: { status: "confirmed", amount: before.amount, providerReference: parsed.reference, ...result },
  })

  try {
    const [event] = await db.select({ organizerId: events.organizerId })
      .from(events).where(eq(events.id, before.eventId)).limit(1)
    if (event) {
      const { recordRefundClawback } = await import("@/lib/revenue-summary")
      const clawback = await recordRefundClawback({
        eventId: before.eventId,
        organizerId: event.organizerId,
        orderId: before.orderId,
        reason: `Provider-confirmed refund ${refundRequestId.slice(0, 8)} reduced net revenue below amount already paid out.`,
        performedBy: session.user.email ?? session.user.id,
      })
      if (clawback.created) log.warn("refund created a payout clawback", { refundRequestId, amount: clawback.amount })
    }
  } catch (error) {
    log.error("refund clawback check failed", { refundRequestId, error: String(error) })
  }

  await notifyBuyer({
    email: before.guestEmail,
    name: before.guestName,
    eventTitle: before.eventTitle,
    requestId: refundRequestId,
    amount: before.amount,
    currency: before.currency,
    status: "confirmed",
    providerReference: parsed.reference,
  })
  revalidateRefundPaths(before.orderId)
  return { success: true }
}

/** Release tickets only when staff confirms Velocity did not complete the refund. */
export async function failRefundRequestAction(refundRequestId: string, input: { note: string; confirmedNoRefund: boolean }) {
  const session = await requireAdmin()
  const parsed = z.object({
    note: z.string().trim().min(5).max(1000),
    confirmedNoRefund: z.literal(true),
  }).parse(input)
  const cleanNote = parsed.note
  const before = await getCaseRows(refundRequestId)
  await db.transaction(async (tx) => {
    await lockOrderMutation(tx, before.orderId)
    const [current] = await tx.select({ status: refundRequests.status })
      .from(refundRequests).where(eq(refundRequests.id, refundRequestId)).limit(1)
    if (current?.status !== "approved") throw new Error("Only approved refunds can be failed")

    const ticketIds = (await tx.select({ ticketId: refundRequestTickets.ticketId })
      .from(refundRequestTickets).where(eq(refundRequestTickets.refundRequestId, refundRequestId)))
      .map((row) => row.ticketId)
    if (ticketIds.length === 0) throw new Error("Refund request has no tickets")
    const released = await tx.update(tickets)
      .set({ status: "sold" })
      .where(and(inArray(tickets.id, ticketIds), eq(tickets.status, "refund_pending"), isNull(tickets.scannedAt)))
      .returning({ id: tickets.id })
    if (released.length !== ticketIds.length) throw new Error("Ticket state changed; the request was not released")
    const [updated] = await tx.update(refundRequests)
      .set({ status: "failed", reviewedBy: session.user.email ?? session.user.id, reviewedAt: new Date(), reviewNote: cleanNote, updatedAt: new Date() })
      .where(and(eq(refundRequests.id, refundRequestId), eq(refundRequests.status, "approved")))
      .returning({ id: refundRequests.id })
    if (!updated) throw new Error("Refund request changed; reload and try again")
  })

  await recordAdminAction(session, {
    action: "refund.provider_failed",
    targetType: "refund_request",
    targetId: refundRequestId,
    before: { status: before.status },
    after: { status: "failed", note: cleanNote },
  })
  await notifyBuyer({
    email: before.guestEmail,
    name: before.guestName,
    eventTitle: before.eventTitle,
    requestId: refundRequestId,
    amount: before.amount,
    currency: before.currency,
    status: "failed",
    note: cleanNote,
  })
  revalidateRefundPaths(before.orderId)
  return { success: true }
}
