import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { tickets, orders, events } from "@/db/schema"
import { sendEmail } from "@/lib/email"
import { log } from "@/lib/logger"
import { rateLimit } from "@/lib/rate-limit"
import { randomBytes } from "crypto"

// 3 transfer initiations per ticket per 60 minutes per IP
const transferLimiter = rateLimit({ windowMs: 60_000 * 60, max: 3 })

type Params = { id: string }

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

  let body: { recipientName?: string; recipientEmail?: string; orderId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { recipientName, recipientEmail, orderId } = body
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
  if (ticket.status !== "sold") return NextResponse.json({ error: "Only active tickets can be transferred" }, { status: 409 })
  if (ticket.transferredAt) return NextResponse.json({ error: "This ticket has already been transferred" }, { status: 409 })

  // Load the event name for the email
  const [order] = await db
    .select({ guestName: orders.guestName, guestEmail: orders.guestEmail })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketplse.tech"
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
<p style="color:#6b7280;font-size:13px;margin-top:24px">TicketPulse · <a href="mailto:nick@ticketpulse.co.zw" style="color:#6b7280">nick@ticketpulse.co.zw</a></p>
</div>`,
      text: `Hi ${name},\n\n${senderName} has sent you a ticket for ${eventTitle}.\n\nClaim it here: ${claimUrl}\n\nThis link expires in 48 hours.\n\nTicketPulse`,
    })
  } catch (err) {
    log.error("ticket transfer - email send failed", { ticketId: id, error: String(err) })
  }

  log.info("ticket transfer initiated", { ticketId: id, recipientEmail: email, orderId })
  return NextResponse.json({ success: true, expiresAt })
}

export async function DELETE(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const [ticket] = await db
    .select({ id: tickets.id, transferredAt: tickets.transferredAt })
    .from(tickets)
    .where(eq(tickets.id, id))
    .limit(1)

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
  if (ticket.transferredAt) return NextResponse.json({ error: "Transfer already completed — cannot cancel" }, { status: 409 })

  await db.update(tickets).set({
    transferToken: null,
    transferToEmail: null,
    transferToName: null,
    transferExpiresAt: null,
  }).where(eq(tickets.id, id))

  log.info("ticket transfer cancelled", { ticketId: id })
  return NextResponse.json({ success: true })
}
