import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { events, orders, orderItems, tickets, ticketScanLogs, ticketTiers, users, supportCases, supportCaseEvents } from "@/db/schema"
import { authenticateOrganizer, organizerEventScope, privateHeaders } from "@/lib/mobile-organizer"
import { completeAndSendAction, markOrderCompleteAction } from "@/lib/order-recovery"
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
  const [items, ticketRows, scanRows, caseRows] = await Promise.all([
    db.select({ id: orderItems.id, name: ticketTiers.name, type: orderItems.type, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice, total: orderItems.total })
      .from(orderItems).leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId)).where(eq(orderItems.orderId, id)),
    db.select({ id: tickets.id, tierName: ticketTiers.name, status: tickets.status, scannedAt: tickets.scannedAt })
      .from(tickets).leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId)).where(eq(tickets.orderId, id)),
    db.select({ id: ticketScanLogs.id, outcome: ticketScanLogs.outcome, reason: ticketScanLogs.reason, source: ticketScanLogs.source, createdAt: ticketScanLogs.createdAt })
      .from(ticketScanLogs).where(eq(ticketScanLogs.orderId, id)).orderBy(desc(ticketScanLogs.createdAt)).limit(100),
    db.select({ id: supportCases.id, subject: supportCases.subject, priority: supportCases.priority, status: supportCases.status, note: supportCases.note, assignedTo: supportCases.assignedTo, openedBy: supportCases.openedBy, openedAt: supportCases.openedAt, updatedAt: supportCases.updatedAt, resolvedBy: supportCases.resolvedBy, resolvedAt: supportCases.resolvedAt, resolutionNote: supportCases.resolutionNote })
      .from(supportCases).where(eq(supportCases.orderId, id)).orderBy(desc(supportCases.updatedAt)),
  ])
  const caseHistory = caseRows[0]
    ? await db.select({ id: supportCaseEvents.id, action: supportCaseEvents.action, note: supportCaseEvents.note, actorId: supportCaseEvents.actorId, createdAt: supportCaseEvents.createdAt })
      .from(supportCaseEvents).where(eq(supportCaseEvents.caseId, caseRows[0].id)).orderBy(desc(supportCaseEvents.createdAt))
    : []
  const legacySupportCase = (order.metadata as { supportCase?: unknown } | null)?.supportCase ?? null
  return respond({ ok: true, order: { ...order, totalAmount: Number(order.totalAmount), currency: order.currency ?? "USD", buyerName: order.guestName ?? order.buyerName, buyerEmail: order.guestEmail ?? order.buyerEmail }, items, tickets: ticketRows, scanLogs: scanRows,
    supportCase: caseRows[0] ?? legacySupportCase,
    supportCaseHistory: caseHistory,
    actions: { resend: ["paid", "completed"].includes(order.status ?? "") && !!(order.guestEmail ?? order.buyerEmail),
      complete: identity.role === "admin" && ["pending", "awaiting_verification", "paid"].includes(order.status ?? ""),
      support: true } })
}

export async function POST(request: Request, context: Context) {
  const result = await access(request, context)
  if (result.response) return result.response
  const { identity, order, id } = result
  const parsed = z.object({
    action: z.enum(["resend", "complete", "complete_and_send", "support_open", "support_update", "support_resolve"]),
    confirmPayment: z.boolean().optional(),
    paymentRef: z.string().trim().max(160).optional(),
    note: z.string().trim().max(1000).optional(),
    subject: z.string().trim().max(160).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignedTo: z.string().trim().max(200).optional(),
  }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return respond({ ok: false, error: "Invalid order action" }, 400)
  if (["complete", "complete_and_send"].includes(parsed.data.action) && identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)
  if (!limiter.check(`${identity.userId}:${id}`).allowed) return respond({ ok: false, error: "Too many attempts. Please wait a minute." }, 429)
  if (parsed.data.action === "support_open") {
    if (!parsed.data.subject) return respond({ ok: false, error: "Add a short support case subject." }, 400)
    const [openCase] = await db.select({ id: supportCases.id }).from(supportCases).where(and(eq(supportCases.orderId, id), eq(supportCases.status, "open"))).limit(1)
    if (openCase) return respond({ ok: false, error: "This order already has an open support case." }, 409)
    const now = new Date()
    const [supportCase] = await db.insert(supportCases).values({
      orderId: id, eventId: order.eventId, subject: parsed.data.subject, priority: parsed.data.priority ?? "normal",
      note: parsed.data.note ?? null, assignedTo: identity.userId, openedBy: identity.userId, openedAt: now, updatedAt: now,
    }).returning()
    await db.insert(supportCaseEvents).values({ caseId: supportCase.id, actorId: identity.userId, action: "opened", note: parsed.data.note ?? null })
    return respond({ ok: true, message: "Support case opened.", supportCase })
  }
  if (parsed.data.action === "support_resolve") {
    const [existing] = await db.select().from(supportCases).where(and(eq(supportCases.orderId, id), eq(supportCases.status, "open"))).orderBy(desc(supportCases.updatedAt)).limit(1)
    if (!existing) return respond({ ok: false, error: "No open support case found." }, 409)
    const now = new Date()
    const [supportCase] = await db.update(supportCases).set({ status: "resolved", resolvedBy: identity.userId, resolvedAt: now, resolutionNote: parsed.data.note ?? null, updatedAt: now }).where(eq(supportCases.id, existing.id)).returning()
    await db.insert(supportCaseEvents).values({ caseId: existing.id, actorId: identity.userId, action: "resolved", note: parsed.data.note ?? null })
    return respond({ ok: true, message: "Support case resolved.", supportCase })
  }
  if (parsed.data.action === "support_update") {
    if (identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)
    const [existing] = await db.select().from(supportCases).where(and(eq(supportCases.orderId, id), eq(supportCases.status, "open"))).orderBy(desc(supportCases.updatedAt)).limit(1)
    if (!existing) return respond({ ok: false, error: "No open support case found." }, 409)
    const updates = {
      ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.assignedTo ? { assignedTo: parsed.data.assignedTo } : {}),
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
      updatedAt: new Date(),
    }
    const [supportCase] = await db.update(supportCases).set(updates).where(eq(supportCases.id, existing.id)).returning()
    await db.insert(supportCaseEvents).values({ caseId: existing.id, actorId: identity.userId, action: "updated", note: parsed.data.note ?? null })
    return respond({ ok: true, message: "Support case updated.", supportCase })
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
  const completed = parsed.data.action === "complete_and_send"
    ? await completeAndSendAction(id, identity.userId, identity.email, { paymentRef: parsed.data.paymentRef, note: parsed.data.note })
    : completionOptions
      ? await markOrderCompleteAction(id, identity.userId, identity.email, completionOptions)
      : await markOrderCompleteAction(id, identity.userId, identity.email)
  return respond({
    ok: completed.success,
    message: completed.message,
    error: completed.success ? undefined : completed.message,
    ...(completed.success ? { audit: { recorded: true, source: "admin_manual_complete", ...completed.details } } : {}),
  }, completed.success ? 200 : 409)
}
