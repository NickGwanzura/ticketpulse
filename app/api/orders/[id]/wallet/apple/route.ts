/**
 * Apple Wallet pass generator.
 *
 * Required environment variables:
 *   APPLE_PASS_TYPE_IDENTIFIER  — e.g. "pass.tech.ticketpulse.ticket"
 *   APPLE_TEAM_IDENTIFIER       — 10-char Apple Developer Team ID
 *   APPLE_CERT_BASE64           — base64-encoded .p12 certificate
 *   APPLE_KEY_PASSPHRASE        — passphrase for the .p12 (can be empty string)
 *   APPLE_WWDR_BASE64           — base64-encoded WWDR certificate
 *
 * Setup guide:
 *   1. developer.apple.com → Certificates → Pass Type ID Certificate
 *   2. Export .p12 from Keychain Access
 *   3. Download WWDR: https://www.apple.com/certificateauthority/
 *   4. base64 each: `base64 -i cert.p12 | tr -d '\n'`
 */
import { NextResponse } from "next/server"
import { and, eq, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { orders, tickets, ticketTiers, events } from "@/db/schema"
import { log } from "@/lib/logger"
import { authorizeOrderAccess, orderAccessCredsFrom } from "@/lib/order-access"

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  // The pass embeds the holder name and every ticket QR — require ownership.
  const access = await authorizeOrderAccess(id, orderAccessCredsFrom(req))
  if (!access.ok) {
    log.warn("apple wallet pass — unauthorised read", { orderId: id, reason: access.reason })
    return NextResponse.json(
      { error: access.reason === "not_found" ? "Order not found" : "Not authorised" },
      { status: access.reason === "not_found" ? 404 : 403 },
    )
  }

  const passTypeId = process.env.APPLE_PASS_TYPE_IDENTIFIER
  const teamId = process.env.APPLE_TEAM_IDENTIFIER
  const certBase64 = process.env.APPLE_CERT_BASE64
  const wwdrBase64 = process.env.APPLE_WWDR_BASE64

  if (!passTypeId || !teamId || !certBase64 || !wwdrBase64) {
    return NextResponse.json(
      { error: "Apple Wallet not configured. Set APPLE_PASS_TYPE_IDENTIFIER, APPLE_TEAM_IDENTIFIER, APPLE_CERT_BASE64, APPLE_WWDR_BASE64." },
      { status: 503 },
    )
  }

  const [order] = await db
    .select({ id: orders.id, status: orders.status, guestName: orders.guestName, eventId: orders.eventId })
    .from(orders).where(eq(orders.id, id)).limit(1)

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (order.status !== "paid" && order.status !== "completed") {
    return NextResponse.json({ error: "Order not paid" }, { status: 409 })
  }

  const [event] = await db
    .select({ title: events.title, startsAt: events.startsAt, venue: events.venue, city: events.city })
    .from(events).where(eq(events.id, order.eventId)).limit(1)

  const orderTickets = await db
    .select({ id: tickets.id, qrCode: tickets.qrCode, tierName: ticketTiers.name, holderName: tickets.holderName })
    .from(tickets)
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(and(eq(tickets.orderId, id), notInArray(tickets.status, ["cancelled", "refunded"])))

  if (orderTickets.length === 0) return NextResponse.json({ error: "No tickets found" }, { status: 404 })

  try {
    const { PKPass } = await import("passkit-generator")
    const certBuffer = Buffer.from(certBase64, "base64")
    const wwdrBuffer = Buffer.from(wwdrBase64, "base64")
    const passphrase = process.env.APPLE_KEY_PASSPHRASE ?? ""
    const ticket = orderTickets[0]
    const holder = ticket.holderName ?? order.guestName ?? "Ticket Holder"
    const qrMessage = ticket.qrCode && !ticket.qrCode.startsWith("data:") ? ticket.qrCode : ticket.id
    const eventDate = event?.startsAt
      ? new Date(event.startsAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : "TBA"

    const pass = new PKPass({}, {
      wwdr: wwdrBuffer,
      signerCert: certBuffer,
      signerKey: certBuffer,
      signerKeyPassphrase: passphrase,
    }, {
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      serialNumber: ticket.id,
      teamIdentifier: teamId,
      organizationName: "TicketPulse",
      description: event?.title ?? "Event Ticket",
      backgroundColor: "rgb(26, 26, 26)",
      foregroundColor: "rgb(255, 255, 255)",
      labelColor: "rgb(170, 170, 170)",
    })

    pass.type = "eventTicket"
    pass.primaryFields.push({ key: "event", label: "EVENT", value: event?.title ?? "Event" })
    pass.secondaryFields.push(
      { key: "tier", label: "TICKET", value: ticket.tierName ?? "General Admission" },
      { key: "date", label: "DATE", value: eventDate },
    )
    pass.auxiliaryFields.push({ key: "holder", label: "HOLDER", value: holder })
    if (event?.venue) pass.auxiliaryFields.push({ key: "venue", label: "VENUE", value: `${event.venue}${event.city ? `, ${event.city}` : ""}` })
    pass.backFields.push({ key: "order", label: "ORDER REF", value: id.slice(0, 8).toUpperCase() })
    pass.setBarcodes(qrMessage)

    const buffer = pass.getAsBuffer()
    log.info("apple wallet pass generated", { orderId: id })
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="ticket-${id.slice(0, 8)}.pkpass"`,
      },
    })
  } catch (err) {
    log.error("apple wallet pass generation failed", { orderId: id, error: String(err) })
    return NextResponse.json({ error: "Failed to generate pass" }, { status: 500 })
  }
}
