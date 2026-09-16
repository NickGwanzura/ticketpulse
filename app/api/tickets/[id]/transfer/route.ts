import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { tickets, orders, events, users } from "@/db/schema"
import { auth } from "@/auth"
import { sendEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { rateLimit } from "@/lib/rate-limit"
import { signTicketPayload } from "@/lib/tickets"
import { randomBytes, timingSafeEqual } from "crypto"

// 3 transfer initiations per ticket per 60 minutes per IP
const transferLimiter = rateLimit({ windowMs: 60_000 * 60, max: 3 })

type Params = { id: string }

/**
 * Ownership check for a ticket's order.
 *
 * A ticket is authority-bearing (its QR is the admission credential), so
 * transferring it must be authorised by whoever owns the order. Guests have no
 * account, so ownership is proven by EITHER an authenticated session matching
 * the order's userId / buyer email, OR the signed ticket payload the buyer
 * already receives in their ticket/order links (`signTicketPayload`). An
 * unauthenticated caller who merely knows a ticket UUID must not be able to
 * redirect the ticket to their own inbox.
 */
async function authorizeTransfer(ticketId: string, ticketOrderId: string, suppliedSignature: string | null) {
  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      buyerEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, ticketOrderId))
    .limit(1)

  if (!order) return { ok: false as const, reason: "not_found" as const }

  // Path 1: signed ticket payload — proves the caller holds the buyer's link.
  if (suppliedSignature && /^[a-f0-9]{64}$/i.test(suppliedSignature)) {
    const expected = signTicketPayload(ticketId, ticketOrderId)
    const a = Buffer.from(suppliedSignature, "hex")
    const b = Buffer.from(expected, "hex")
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { ok: true as const, order }
    }
  }

  // Path 2: authenticated owner or admin.
  const session = await auth()
  const sessionUserId = session?.user?.id
  if (sessionUserId) {
    if (session?.user?.role === "admin") return { ok: true as const, order }
    if (order.userId && order.userId === sessionUserId) return { ok: true as const, order }
    const sessionEmail = session?.user?.email?.toLowerCase()
    const ownerEmails = [order.guestEmail, order.buyerEmail]
      .filter(Boolean)
      .map((e) => e!.toLowerCase())
    if (sessionEmail && ownerEmails.includes(sessionEmail)) {
      return { ok: true as const, order }
    }
  }

  return { ok: false as const, reason: "forbidden" as const }
}

// POST /api/tickets/[id]/transfer  — initiate a transfer
// DELETE /api/tickets/[id]/transfer — cancel a pending transfer
export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  const rl = transferLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many transfer attempts. Please wait before trying again." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    })
  }

  const { id } = await ctx.params

  let body: { recipientName?: string; recipientEmail?: string; orderId?: string; signature?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { recipientName, recipientEmail, orderId, signature } = body
  if (!recipientName?.trim() || !recipientEmail?.trim() || !orderId) {
    return NextResponse.json({ error: "recipientName, recipientEmail and orderId are required" }, { status: 400 })
  }

  const email = recipientEmail.trim().toLowerCase()
  const name = recipientName.trim()

  // Load ticket and verify it belongs to the stated order
  const [ticket] = await db
    .select({
      id: tickets.id,
      status: tickets.status,
      orderId: tickets.orderId,
      eventId: tickets.eventId,
      transferredAt: tickets.transferredAt,
      transferToEmail: tickets.transferToEmail,
    })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1)

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  if (ticket.orderId !== orderId) return NextResponse.json({ error: "Ticket does not belong to this order" }, { status: 403 })

  // Authorise BEFORE any state change or email.
  const authz = await authorizeTransfer(id, orderId, signature ?? req.headers.get("x-ticket-signature"))
  if (!authz.ok) {
    log.warn("ticket transfer — unauthorised attempt", { ticketId: id, orderId, reason: authz.reason })
    return NextResponse.json(
      { error: authz.reason === "not_found" ? "Order not found" : "Not authorised to transfer this ticket" },
      { status: authz.reason === "not_found" ? 404 : 403 },
    )
  }

  if (ticket.status !== "sold") return NextResponse.json({ error: "Only active tickets can be transferred" }, { status: 409 })
  if (ticket.transferredAt) return NextResponse.json({ error: "This ticket has already been transferred" }, { status: 409 })

  const order = authz.order

  const [event] = await db
    .select({ title: events.title, slug: events.slug })
    .from(events)
    .where(eq(events.id, ticket.eventId))
    .limit(1)

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

  await db.update(tickets).set({
    transferToken: token,
    transferToEmail: email,
    transferToName: name,
    transferExpiresAt: expiresAt,
  }).where(eq(tickets.id, id))

  // Send claim email to recipient
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
  const claimUrl = `${appUrl}/tickets/transfer/${token}`
  const senderName = order?.guestName ?? "Someone"
  const eventTitle = event?.title ?? "an event"

  try {
    await sendEmail({
      to: email,
      subject: `${senderName} has sent you a ticket — ${eventTitle}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="font-size:20px;font-weight:700;margin-bottom:8px">You've received a ticket</h2>
<p>Hi ${name},</p>
<p><strong>${senderName}</strong> has transferred a ticket for <strong>${eventTitle}</strong> to you.</p>
<p style="margin-top:20px">
  <a href="${claimUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">
    Claim your ticket →
  </a>
</p>
<p style="color:#6b7280;font-size:13px;margin-top:16px">This link expires in 48 hours. If you weren't expecting this, you can ignore this email.</p>
<p style="color:#6b7280;font-size:13px;margin-top:24px">TicketPulse · <a href="mailto:nick@ticketpulse.tech" style="color:#6b7280">nick@ticketpulse.tech</a></p>
</div>`,
      text: `Hi ${name},\n\n${senderName} has sent you a ticket for ${eventTitle}.\n\nClaim it here: ${claimUrl}\n\nThis link expires in 48 hours.\n\nTicketPulse`,
    })
  } catch (err) {
    log.error("ticket transfer - email send failed", { ticketId: id, error: String(err) })
  }

  log.info("ticket transfer initiated", { ticketId: id, recipientEmail: email, orderId })
  return NextResponse.json({ success: true, expiresAt })
}

export async function DELETE(req: Request, ctx: { params: Promise<Params> }) {
  const rl = transferLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many transfer attempts. Please wait before trying again." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    })
  }

  const { id } = await ctx.params

  const [ticket] = await db
    .select({ id: tickets.id, orderId: tickets.orderId, transferredAt: tickets.transferredAt })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1)

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  if (ticket.transferredAt) return NextResponse.json({ error: "Transfer already completed — cannot cancel" }, { status: 409 })
  if (!ticket.orderId) return NextResponse.json({ error: "Ticket has no order" }, { status: 409 })

  // Cancelling a pending transfer is an owner-level action — same check as POST.
  const authz = await authorizeTransfer(id, ticket.orderId, req.headers.get("x-ticket-signature"))
  if (!authz.ok) {
    log.warn("ticket transfer cancel — unauthorised attempt", { ticketId: id, reason: authz.reason })
    return NextResponse.json(
      { error: authz.reason === "not_found" ? "Order not found" : "Not authorised to cancel this transfer" },
      { status: authz.reason === "not_found" ? 404 : 403 },
    )
  }

  await db.update(tickets).set({
    transferToken: null,
    transferToEmail: null,
    transferToName: null,
    transferExpiresAt: null,
  }).where(eq(tickets.id, id))

  log.info("ticket transfer cancelled", { ticketId: id })
  return NextResponse.json({ success: true })
}
