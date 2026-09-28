import { and, asc, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/db"
import {
  events,
  orders,
  orderItems,
  refundRequests,
  refundRequestTickets,
  ticketTiers,
  tickets,
} from "@/db/schema"
import { adminEmail, sendEmail } from "@/lib/email"
import { refundRequestReceivedEmail } from "@/lib/email-templates/refunds"
import { log } from "@/lib/logger"
import { allocateTicketRefunds, isOutsideStandardRefundWindow } from "@/lib/refunds"
import { authorizeOrderAccess, orderAccessCredsFrom } from "@/lib/order-access"
import { rateLimit } from "@/lib/rate-limit"
import { lockOrderMutation } from "@/lib/velocity/idempotency"

type RouteParams = { id: string }

const refundReadLimiter = rateLimit({ windowMs: 60_000, max: 30 })
const refundRequestLimiter = rateLimit({ windowMs: 60_000, max: 5 })
const RequestBody = z.object({
  ticketIds: z.array(z.uuid()).min(1).max(50),
  reason: z.string().trim().min(5).max(1000),
})

const activeRequestStatuses = ["requested", "approved", "confirmed"] as const

function centsToAmount(value: number): string {
  return (value / 100).toFixed(2)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!)
}

export async function GET(request: Request, context: { params: Promise<RouteParams> }) {
  const rate = await refundReadLimiter.checkRequest(request)
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const { id: orderId } = await context.params
  const access = await authorizeOrderAccess(orderId, orderAccessCredsFrom(request))
  if (!access.ok) {
    return NextResponse.json({ error: "Order not found" }, { status: access.reason === "not_found" ? 404 : 403 })
  }

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      eventId: events.id,
      eventTitle: events.title,
      eventStatus: events.status,
      startsAt: events.startsAt,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.id, orderId))
    .limit(1)
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const [orderLines, orderTickets, requests] = await Promise.all([
    db.select({ id: orderItems.id, type: orderItems.type, tierId: orderItems.tierId, quantity: orderItems.quantity, total: orderItems.total })
      .from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select({
      id: tickets.id,
      tierId: tickets.tierId,
      tierName: ticketTiers.name,
      status: tickets.status,
      scannedAt: tickets.scannedAt,
      transferToEmail: tickets.transferToEmail,
      transferredAt: tickets.transferredAt,
    })
      .from(tickets)
      .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
      .where(and(eq(tickets.orderId, orderId), eq(tickets.isStaffTicket, false)))
      .orderBy(asc(tickets.createdAt), asc(tickets.id)),
    db.select({
      id: refundRequests.id,
      status: refundRequests.status,
      source: refundRequests.source,
      reason: refundRequests.reason,
      amount: refundRequests.amount,
      currency: refundRequests.currency,
      outsideStandardWindow: refundRequests.outsideStandardWindow,
      reviewNote: refundRequests.reviewNote,
      providerReference: refundRequests.providerReference,
      requestedAt: refundRequests.requestedAt,
      providerConfirmedAt: refundRequests.providerConfirmedAt,
    })
      .from(refundRequests)
      .where(eq(refundRequests.orderId, orderId))
      .orderBy(asc(refundRequests.requestedAt)),
  ])

  const ticketIds = orderTickets.map((ticket) => ticket.id)
  const activeTicketIds = ticketIds.length > 0
    ? await db.select({ ticketId: refundRequestTickets.ticketId })
        .from(refundRequestTickets)
        .innerJoin(refundRequests, eq(refundRequests.id, refundRequestTickets.refundRequestId))
        .where(and(
          inArray(refundRequestTickets.ticketId, ticketIds),
          inArray(refundRequests.status, activeRequestStatuses),
        ))
    : []
  const active = new Set(activeTicketIds.map((row) => row.ticketId))
  let allocation = new Map<string, number>()
  try {
    allocation = allocateTicketRefunds(order.totalAmount, orderLines, orderTickets)
  } catch (error) {
    log.warn("refund quote could not be calculated", { orderId, error: String(error) })
  }

  const orderIsRefundable =
    (order.status === "paid" || order.status === "completed") &&
    (order.paymentMethod ?? "").startsWith("velocity-")
  const outsideStandardWindow = order.eventStatus === "cancelled"
    ? false
    : isOutsideStandardRefundWindow(order.startsAt)

  return NextResponse.json({
    eventTitle: order.eventTitle,
    eventStatus: order.eventStatus,
    currency: order.currency ?? "USD",
    outsideStandardWindow,
    canRequest: orderIsRefundable,
    unavailableReason: !orderIsRefundable
      ? "Refund requests are available for paid Velocity orders only. Contact support for other payment methods."
      : null,
    tickets: orderTickets.map((ticket) => ({
      id: ticket.id,
      tierName: ticket.tierName ?? "Ticket",
      amount: centsToAmount(allocation.get(ticket.id) ?? 0),
      eligible: orderIsRefundable &&
        ticket.status === "sold" &&
        !ticket.scannedAt &&
        !ticket.transferredAt &&
        !ticket.transferToEmail &&
        !active.has(ticket.id) &&
        (allocation.get(ticket.id) ?? 0) > 0,
      status: active.has(ticket.id) ? "refund_requested" : ticket.status,
    })),
    requests,
  }, { headers: { "Cache-Control": "private, no-store" } })
}

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
  const rate = await refundRequestLimiter.checkRequest(request)
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
    })
  }

  const { id: orderId } = await context.params
  const access = await authorizeOrderAccess(orderId, orderAccessCredsFrom(request))
  if (!access.ok) {
    return NextResponse.json({ error: "Order not found" }, { status: access.reason === "not_found" ? 404 : 403 })
  }

  const parsed = RequestBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Select tickets and enter a short reason." }, { status: 400 })
  const ticketIds = [...new Set(parsed.data.ticketIds)]
  if (ticketIds.length !== parsed.data.ticketIds.length) {
    return NextResponse.json({ error: "A ticket was selected more than once." }, { status: 400 })
  }

  try {
    const result = await db.transaction(async (tx) => {
      await lockOrderMutation(tx, orderId)
      const [order] = await tx
        .select({
          id: orders.id,
          status: orders.status,
          paymentMethod: orders.paymentMethod,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
          guestEmail: orders.guestEmail,
          guestName: orders.guestName,
          eventId: events.id,
          eventTitle: events.title,
          eventStatus: events.status,
          startsAt: events.startsAt,
        })
        .from(orders)
        .innerJoin(events, eq(events.id, orders.eventId))
        .where(eq(orders.id, orderId))
        .limit(1)

      if (!order || !["paid", "completed"].includes(order.status ?? "")) {
        throw new Error("Only paid orders can be refunded.")
      }
      if (!(order.paymentMethod ?? "").startsWith("velocity-")) {
        throw new Error("This payment method must be reviewed by TicketPulse support.")
      }

      const selectedTickets = await tx
        .select({
          id: tickets.id,
          tierId: tickets.tierId,
          status: tickets.status,
          scannedAt: tickets.scannedAt,
          transferToEmail: tickets.transferToEmail,
          transferredAt: tickets.transferredAt,
        })
        .from(tickets)
        .where(and(
          eq(tickets.orderId, orderId),
          eq(tickets.isStaffTicket, false),
          inArray(tickets.id, ticketIds),
        ))

      if (selectedTickets.length !== ticketIds.length) {
        throw new Error("One or more selected tickets do not belong to this order.")
      }
      if (selectedTickets.some((ticket) =>
        ticket.status !== "sold" || ticket.scannedAt || ticket.transferredAt || ticket.transferToEmail,
      )) {
        throw new Error("Only unused, untransferred tickets can be requested for a refund.")
      }

      const alreadyRequested = await tx
        .select({ ticketId: refundRequestTickets.ticketId })
        .from(refundRequestTickets)
        .innerJoin(refundRequests, eq(refundRequests.id, refundRequestTickets.refundRequestId))
        .where(and(
          inArray(refundRequestTickets.ticketId, ticketIds),
          inArray(refundRequests.status, activeRequestStatuses),
        ))
      if (alreadyRequested.length > 0) {
        throw new Error("A refund request is already open for one or more selected tickets.")
      }

      const lines = await tx.select({ id: orderItems.id, type: orderItems.type, tierId: orderItems.tierId, quantity: orderItems.quantity, total: orderItems.total })
        .from(orderItems).where(eq(orderItems.orderId, orderId))
      const allTickets = await tx.select({ id: tickets.id, tierId: tickets.tierId })
        .from(tickets)
        .where(and(eq(tickets.orderId, orderId), eq(tickets.isStaffTicket, false)))
        .orderBy(asc(tickets.createdAt), asc(tickets.id))
      const allocations = allocateTicketRefunds(order.totalAmount, lines, allTickets)
      const selectedAmounts = selectedTickets.map((ticket) => ({
        ticketId: ticket.id,
        amountCents: allocations.get(ticket.id) ?? 0,
      }))
      if (selectedAmounts.some((ticket) => ticket.amountCents <= 0)) {
        throw new Error("A refund amount could not be calculated for one or more tickets.")
      }

      const totalCents = selectedAmounts.reduce((sum, ticket) => sum + ticket.amountCents, 0)
      const [refundRequest] = await tx.insert(refundRequests).values({
        orderId,
        eventId: order.eventId,
        status: "requested",
        source: order.eventStatus === "cancelled" ? "event_cancellation" : "buyer",
        requestedByEmail: access.order.guestEmail ?? access.order.buyerEmail ?? "",
        reason: parsed.data.reason,
        amount: centsToAmount(totalCents),
        currency: order.currency ?? "USD",
        outsideStandardWindow: order.eventStatus === "cancelled"
          ? false
          : isOutsideStandardRefundWindow(order.startsAt),
      }).returning({ id: refundRequests.id })

      await tx.insert(refundRequestTickets).values(selectedAmounts.map((item) => ({
        refundRequestId: refundRequest.id,
        ticketId: item.ticketId,
        amount: centsToAmount(item.amountCents),
      })))

      return {
        id: refundRequest.id,
        amount: centsToAmount(totalCents),
        currency: order.currency ?? "USD",
        eventId: order.eventId,
        eventTitle: order.eventTitle,
        buyerName: order.guestName,
        buyerEmail: order.guestEmail ?? access.order.buyerEmail,
        outsideStandardWindow: order.eventStatus === "cancelled"
          ? false
          : isOutsideStandardRefundWindow(order.startsAt),
      }
    })

    const buyerMessage = refundRequestReceivedEmail({
      buyerName: result.buyerName,
      eventTitle: result.eventTitle,
      requestId: result.id,
      amount: result.amount,
      currency: result.currency,
      outsideStandardWindow: result.outsideStandardWindow,
    })
    if (result.buyerEmail) {
      await sendEmail({ to: result.buyerEmail, subject: `Refund request received · ${result.eventTitle}`, ...buyerMessage })
        .catch((error) => log.error("refund request buyer email failed", { refundRequestId: result.id, error: String(error) }))
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
    const safeAdminOrderUrl = escapeHtml(`${appUrl}/admin/orders/${encodeURIComponent(orderId)}`)
    const safeEventTitle = escapeHtml(result.eventTitle)
    const safeCurrency = escapeHtml(result.currency)
    const safeAmount = escapeHtml(result.amount)
    await sendEmail({
      to: adminEmail,
      subject: `Refund request · ${result.eventTitle}`,
      text: `Refund request ${result.id.slice(0, 8)} for ${result.currency} ${result.amount}. Review: ${appUrl}/admin/orders/${orderId}`,
      html: `<p>A refund request was submitted for <strong>${safeEventTitle}</strong>.</p><p>Amount: ${safeCurrency} ${safeAmount}</p><p><a href="${safeAdminOrderUrl}">Review request</a></p>`,
    }).catch((error) => log.error("refund request admin email failed", { refundRequestId: result.id, error: String(error) }))

    return NextResponse.json({
      success: true,
      requestId: result.id,
      status: "requested",
      amount: result.amount,
      currency: result.currency,
      outsideStandardWindow: result.outsideStandardWindow,
    }, { status: 201, headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create refund request."
    const clientError = [
      "Only paid orders can be refunded.",
      "This payment method must be reviewed by TicketPulse support.",
      "One or more selected tickets do not belong to this order.",
      "Only unused, untransferred tickets can be requested for a refund.",
      "A refund request is already open for one or more selected tickets.",
      "A refund amount could not be calculated for one or more tickets.",
    ].includes(message)
    log.warn("refund request could not be created", { orderId, error: message })
    return NextResponse.json({ error: clientError ? message : "Unable to create refund request. Please contact support." }, {
      status: clientError ? 409 : 500,
    })
  }
}
