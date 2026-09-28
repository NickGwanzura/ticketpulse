import "server-only"

import { and, asc, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { events, orders, orderItems, refundRequests, refundRequestTickets, tickets } from "@/db/schema"
import { sendEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { allocateTicketRefunds } from "@/lib/refunds"
import { generateOrderAccessUrl } from "@/lib/tickets"
import { lockOrderMutation } from "@/lib/velocity/idempotency"

function centsToAmount(value: number): string {
  return (value / 100).toFixed(2)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!)
}

/**
 * Queue one idempotent case per paid Velocity order when an admin cancels an
 * event. This records work for the refund queue; it does not move money.
 */
export async function queueCancelledEventRefunds(eventId: string): Promise<number> {
  const [event] = await db.select({ id: events.id, title: events.title, status: events.status })
    .from(events).where(eq(events.id, eventId)).limit(1)
  if (!event || event.status !== "cancelled") return 0

  const paidOrders = await db.select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.eventId, eventId), inArray(orders.status, ["paid", "completed"])))
  let queued = 0

  for (const candidate of paidOrders) {
    try {
      const result = await db.transaction(async (tx) => {
        await lockOrderMutation(tx, candidate.id)
        const [order] = await tx.select({
          id: orders.id,
          status: orders.status,
          paymentMethod: orders.paymentMethod,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
          guestEmail: orders.guestEmail,
          guestName: orders.guestName,
        }).from(orders).where(eq(orders.id, candidate.id)).limit(1)
        if (!order || !["paid", "completed"].includes(order.status ?? "") || !(order.paymentMethod ?? "").startsWith("velocity-")) {
          return null
        }

        const externalKey = `event-cancel:${eventId}:${order.id}`
        const [existing] = await tx.select({ id: refundRequests.id })
          .from(refundRequests).where(eq(refundRequests.externalKey, externalKey)).limit(1)
        if (existing) return null

        const allTickets = await tx.select({ id: tickets.id, tierId: tickets.tierId, status: tickets.status, scannedAt: tickets.scannedAt })
          .from(tickets)
          .where(and(eq(tickets.orderId, order.id), eq(tickets.isStaffTicket, false)))
          .orderBy(asc(tickets.createdAt), asc(tickets.id))
        const lines = await tx.select({ id: orderItems.id, type: orderItems.type, tierId: orderItems.tierId, quantity: orderItems.quantity, total: orderItems.total })
          .from(orderItems).where(eq(orderItems.orderId, order.id))
        const activeTicketIds = allTickets.length > 0
          ? await tx.select({ ticketId: refundRequestTickets.ticketId })
              .from(refundRequestTickets)
              .innerJoin(refundRequests, eq(refundRequests.id, refundRequestTickets.refundRequestId))
              .where(and(
                inArray(refundRequestTickets.ticketId, allTickets.map((ticket) => ticket.id)),
                inArray(refundRequests.status, ["requested", "approved", "confirmed"]),
              ))
          : []
        const activeIds = new Set(activeTicketIds.map((row) => row.ticketId))
        const refundableTickets = allTickets.filter((ticket) =>
          ticket.status === "sold" && !ticket.scannedAt && !activeIds.has(ticket.id),
        )
        if (refundableTickets.length === 0) return null

        const allocations = allocateTicketRefunds(order.totalAmount, lines, allTickets)
        const rows = refundableTickets.map((ticket) => ({
          ticketId: ticket.id,
          amountCents: allocations.get(ticket.id) ?? 0,
        })).filter((ticket) => ticket.amountCents > 0)
        if (rows.length === 0) return null

        const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0)
        const [refundCase] = await tx.insert(refundRequests).values({
          orderId: order.id,
          eventId,
          status: "requested",
          source: "event_cancellation",
          requestedByEmail: "system@ticketpulse.tech",
          reason: `Event cancelled: ${event.title}`,
          amount: centsToAmount(totalCents),
          currency: order.currency ?? "USD",
          outsideStandardWindow: false,
          externalKey,
        }).returning({ id: refundRequests.id })

        await tx.insert(refundRequestTickets).values(rows.map((row) => ({
          refundRequestId: refundCase.id,
          ticketId: row.ticketId,
          amount: centsToAmount(row.amountCents),
        })))

        return {
          id: refundCase.id,
          orderId: order.id,
          email: order.guestEmail,
          name: order.guestName,
          currency: order.currency ?? "USD",
          amount: centsToAmount(totalCents),
        }
      })

      if (!result) continue
      queued += 1
      if (result.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
        const orderUrl = generateOrderAccessUrl(result.orderId, appUrl)
        const safeOrderUrl = escapeHtml(orderUrl)
        const safeName = escapeHtml(result.name?.trim() || "there")
        const safeTitle = escapeHtml(event.title)
        const safeCurrency = escapeHtml(result.currency)
        const safeAmount = escapeHtml(result.amount)
        await sendEmail({
          to: result.email,
          subject: `Event cancelled · refund queued · ${event.title}`,
          text: `Hi ${result.name?.trim() || "there"}, ${event.title} has been cancelled. TicketPulse has queued a refund request for ${result.currency} ${result.amount} for your unused tickets. This is not a completed refund; we will confirm it after Velocity confirms the payment provider refund. Track your tickets and request at ${orderUrl}.`,
          html: `<p>Hi ${safeName},</p><p><strong>${safeTitle}</strong> has been cancelled.</p><p>TicketPulse has queued a refund request for <strong>${safeCurrency} ${safeAmount}</strong> for your unused tickets. This is not a completed refund; we will confirm it after Velocity confirms the payment provider refund.</p><p><a href="${safeOrderUrl}">View your order</a></p>`,
        }).catch((error) => log.error("event cancellation refund email failed", { refundRequestId: result.id, error: String(error) }))
      }
    } catch (error) {
      log.error("could not queue cancelled-event refund", { eventId, orderId: candidate.id, error: String(error) })
    }
  }

  return queued
}
