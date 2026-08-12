import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { tickets, ticketTiers, events } from "@/db/schema"
import { sendEmail } from "@/lib/email"
import { generateQrDataUrlFromValue, generateTicketVerifyUrl } from "@/lib/tickets"
import { log } from "@/lib/logger"

type Params = { token: string }

// GET — return ticket info for the claim page
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { token } = await ctx.params

  const [ticket] = await db
    .select({
      id: tickets.id,
      transferToName: tickets.transferToName,
      transferToEmail: tickets.transferToEmail,
      transferExpiresAt: tickets.transferExpiresAt,
      transferredAt: tickets.transferredAt,
      tierName: ticketTiers.name,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStartsAt: events.startsAt,
      eventVenue: events.venue,
    })
    .from(tickets)
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .leftJoin(events, eq(events.id, tickets.eventId))
    .where(eq(tickets.transferToken, token))
    .limit(1)

  if (!ticket) return NextResponse.json({ error: "Invalid or expired transfer link" }, { status: 404 })
  if (ticket.transferredAt) return NextResponse.json({ error: "This ticket has already been claimed" }, { status: 410 })
  if (ticket.transferExpiresAt && new Date(ticket.transferExpiresAt) < new Date()) {
    return NextResponse.json({ error: "This transfer link has expired" }, { status: 410 })
  }

  return NextResponse.json({
    recipientName: ticket.transferToName,
    recipientEmail: ticket.transferToEmail,
    tierName: ticket.tierName,
    eventTitle: ticket.eventTitle,
    eventSlug: ticket.eventSlug,
    eventStartsAt: ticket.eventStartsAt,
    eventVenue: ticket.eventVenue,
    expiresAt: ticket.transferExpiresAt,
  })
}

// POST — claim the transfer
export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { token } = await ctx.params

  const [ticket] = await db
    .select({
      id: tickets.id,
      orderId: tickets.orderId,
      eventId: tickets.eventId,
      transferToName: tickets.transferToName,
      transferToEmail: tickets.transferToEmail,
      transferExpiresAt: tickets.transferExpiresAt,
      transferredAt: tickets.transferredAt,
      tierName: ticketTiers.name,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStartsAt: events.startsAt,
      eventVenue: events.venue,
    })
    .from(tickets)
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .leftJoin(events, eq(events.id, tickets.eventId))
    .where(eq(tickets.transferToken, token))
    .limit(1)

  if (!ticket) return NextResponse.json({ error: "Invalid or expired transfer link" }, { status: 404 })
  if (ticket.transferredAt) return NextResponse.json({ error: "Already claimed" }, { status: 410 })
  if (ticket.transferExpiresAt && new Date(ticket.transferExpiresAt) < new Date()) {
    return NextResponse.json({ error: "Transfer link has expired" }, { status: 410 })
  }

  // Regenerate QR code so the original buyer's QR is invalidated
  let newQrCode: string
  let newScanCode: string
  try {
    if (!ticket.orderId) return NextResponse.json({ error: "Ticket is missing its order reference" }, { status: 409 })
    newScanCode = generateTicketVerifyUrl(ticket.id, ticket.orderId)
    newQrCode = await generateQrDataUrlFromValue(newScanCode)
  } catch {
    // Keep the claim atomic and fail closed if QR generation is unavailable.
    return NextResponse.json({ error: "Unable to issue a secure replacement QR" }, { status: 503 })
  }

  await db.update(tickets).set({
    holderName: ticket.transferToName,
    holderEmail: ticket.transferToEmail,
    qrCode: newScanCode,
    transferredAt: new Date(),
    transferToken: null,
    transferToEmail: null,
    transferToName: null,
    transferExpiresAt: null,
  }).where(eq(tickets.id, ticket.id))

  // Email the new holder their ticket details
  const eventDate = ticket.eventStartsAt
    ? new Date(ticket.eventStartsAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "TBA"

  if (ticket.transferToEmail) {
    sendEmail({
      to: ticket.transferToEmail,
      subject: `Your ticket for ${ticket.eventTitle ?? "the event"} is confirmed`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Your ticket is confirmed</h2>
<p>Hi ${ticket.transferToName ?? "there"},</p>
<p>Your transfer for <strong>${ticket.eventTitle ?? "the event"}</strong> has been confirmed.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
  <tr><td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #e5e7eb">Event</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600">${ticket.eventTitle ?? "—"}</td></tr>
  <tr><td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #e5e7eb">Ticket</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${ticket.tierName ?? "General Admission"}</td></tr>
  <tr><td style="padding:8px 0;color:#6b7280;border-bottom:1px solid #e5e7eb">Date</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${eventDate}</td></tr>
  ${ticket.eventVenue ? `<tr><td style="padding:8px 0;color:#6b7280">Venue</td><td style="padding:8px 0">${ticket.eventVenue}</td></tr>` : ""}
</table>
<p style="color:#6b7280;font-size:13px;margin-top:8px">Holder: <strong style="color:#1a1a1a">${ticket.transferToName ?? ""}</strong></p>
<p style="color:#6b7280;font-size:13px;margin-top:24px">TicketPulse · <a href="mailto:nick@ticketpulse.tech" style="color:#6b7280">nick@ticketpulse.tech</a></p>
</div>`,
      text: `Hi ${ticket.transferToName ?? "there"},\n\nYour ticket for ${ticket.eventTitle} has been confirmed.\n\nEvent: ${ticket.eventTitle}\nTicket: ${ticket.tierName}\nDate: ${eventDate}\n${ticket.eventVenue ? `Venue: ${ticket.eventVenue}\n` : ""}\nHolder: ${ticket.transferToName}\n\nTicketPulse`,
    }).catch((err) => log.warn("transfer claim - email failed", { error: String(err) }))
  }

  log.info("ticket transfer claimed", { ticketId: ticket.id, holderEmail: ticket.transferToEmail })
  return NextResponse.json({ success: true, newQrCode })
}
