import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { events, orders, orderItems, tickets, ticketScanLogs, ticketTiers, users } from "@/db/schema"
import { authenticateOrganizer, organizerEventScope, privateHeaders } from "@/lib/mobile-organizer"
import { markOrderCompleteAction } from "@/lib/order-recovery"
import { POST as resendTickets } from "@/app/api/orders/[id]/resend-tickets/route"
import { rateLimit } from "@/lib/rate-limit"

type Context = { params: Promise<{ id: string }> }
const limiter = rateLimit({ windowMs: 60_000, max: 5 })
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders })

async function access(request: Request, context: Context) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return { response: respond(identity, identity.status) }
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return { response: respond({ ok: false, error: "Invalid order ID" }, 400) }
  const [order] = await db.select({
    id: orders.id, status: orders.status, totalAmount: orders.totalAmount, currency: orders.currency,
    guestName: orders.guestName, guestEmail: orders.guestEmail, guestPhone: orders.guestPhone,
    buyerName: users.name, buyerEmail: users.email, buyerPhone: users.phone,
    createdAt: orders.createdAt, paidAt: orders.paidAt, completedAt: orders.completedAt,
    paymentMethod: orders.paymentMethod, paymentRef: orders.paymentRef, metadata: orders.metadata,
    eventId: events.id, eventTitle: events.title, eventStartsAt: events.startsAt, eventVenue: events.venue,
  }).from(orders).innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(and(eq(orders.id, id), organizerEventScope(identity.userId, identity.role))).limit(1)
  if (!order) return { response: respond({ ok: false, error: "Order not found or access unavailable" }, 404) }
  return { identity, order, id }
}

export async function GET(request: Request, context: Context) {
  const result = await access(request, context)
  if (result.response) return result.response
  const { order, identity, id } = result
  const [items, ticketRows, scanRows] = await Promise.all([
    db.select({ id: orderItems.id, name: ticketTiers.name, type: orderItems.type, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice, total: orderItems.total })
      .from(orderItems).leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId)).where(eq(orderItems.orderId, id)),
    db.select({ id: tickets.id, tierName: ticketTiers.name, status: tickets.status, scannedAt: tickets.scannedAt })
      .from(tickets).leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId)).where(eq(tickets.orderId, id)),
    db.select({ id: ticketScanLogs.id, outcome: ticketScanLogs.outcome, reason: ticketScanLogs.reason, source: ticketScanLogs.source, createdAt: ticketScanLogs.createdAt })
      .from(ticketScanLogs).where(eq(ticketScanLogs.orderId, id)).orderBy(desc(ticketScanLogs.createdAt)).limit(100),
  ])
  return respond({ ok: true, order: { ...order, totalAmount: Number(order.totalAmount), currency: order.currency ?? "USD", buyerName: order.guestName ?? order.buyerName, buyerEmail: order.guestEmail ?? order.buyerEmail }, items, tickets: ticketRows, scanLogs: scanRows,
    supportCase: (order.metadata as { supportCase?: unknown } | null)?.supportCase ?? null,
    actions: { resend: ["paid", "completed"].includes(order.status ?? "") && !!(order.guestEmail ?? order.buyerEmail),
      complete: identity.role === "admin" && ["pending", "awaiting_verification", "paid"].includes(order.status ?? ""),
      support: true } })
}

export async function POST(request: Request, context: Context) {
  const result = await access(request, context)
  if (result.response) return result.response
  const { identity, order, id } = result
  const parsed = z.object({
    action: z.enum(["resend", "complete", "support_open", "support_resolve"]),
    confirmPayment: z.boolean().optional(),
    paymentRef: z.string().trim().max(160).optional(),
    note: z.string().trim().max(1000).optional(),
    subject: z.string().trim().max(160).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return respond({ ok: false, error: "Invalid order action" }, 400)
  if (parsed.data.action === "complete" && identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)
  if (!limiter.check(`${identity.userId}:${id}`).allowed) return respond({ ok: false, error: "Too many attempts. Please wait a minute." }, 429)
  if (parsed.data.action === "support_open") {
    if (!parsed.data.subject) return respond({ ok: false, error: "Add a short support case subject." }, 400)
    const metadata = (order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)) ? order.metadata as Record<string, unknown> : {}
    const now = new Date().toISOString()
    const supportCase = {
      status: "open", subject: parsed.data.subject, priority: parsed.data.priority ?? "normal",
      note: parsed.data.note ?? null, assignedTo: identity.email, openedBy: identity.email, openedAt: now,
    }
    await db.update(orders).set({ metadata: { ...metadata, supportCase }, updatedAt: new Date() }).where(eq(orders.id, id))
    return respond({ ok: true, message: "Support case opened.", supportCase })
  }
  if (parsed.data.action === "support_resolve") {
    const metadata = (order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)) ? order.metadata as Record<string, unknown> : {}
    const existing = metadata.supportCase && typeof metadata.supportCase === "object" ? metadata.supportCase as Record<string, unknown> : {}
    if (!existing.subject) return respond({ ok: false, error: "No open support case found." }, 409)
    const supportCase = { ...existing, status: "resolved", resolvedBy: identity.email, resolvedAt: new Date().toISOString(), resolutionNote: parsed.data.note ?? null }
    await db.update(orders).set({ metadata: { ...metadata, supportCase }, updatedAt: new Date() }).where(eq(orders.id, id))
    return respond({ ok: true, message: "Support case resolved.", supportCase })
  }
  if (parsed.data.action === "resend") {
    const response = await resendTickets(request, context)
    const data = await response.json()
    return respond({ ...data, ok: response.ok, message: response.ok ? `Tickets sent to ${data.sentTo}` : undefined }, response.status)
  }
  if (!parsed.data.confirmPayment || !["pending", "awaiting_verification", "paid"].includes(order.status ?? "")) {
    return respond({ ok: false, error: "Confirm received payment for an eligible order before continuing." }, 409)
  }
  const completionOptions = parsed.data.paymentRef || parsed.data.note
    ? { paymentRef: parsed.data.paymentRef, note: parsed.data.note }
    : undefined
  const completed = completionOptions
    ? await markOrderCompleteAction(id, identity.userId, identity.email, completionOptions)
    : await markOrderCompleteAction(id, identity.userId, identity.email)
  return respond({
    ok: completed.success,
    message: completed.message,
    error: completed.success ? undefined : completed.message,
    ...(completed.success ? { audit: { recorded: true, source: "admin_manual_complete", ...completed.details } } : {}),
  }, completed.success ? 200 : 409)
}
