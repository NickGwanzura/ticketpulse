/**
 * Google Wallet pass generator — returns a "Save to Google Wallet" JWT link.
 *
 * Required environment variables:
 *   GOOGLE_WALLET_ISSUER_ID            — numeric issuer ID from Google Pay & Wallet Console
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL — service account email
 *   GOOGLE_WALLET_PRIVATE_KEY          — service account private key (PEM, newlines as \n)
 *
 * Setup:
 *   1. Enable Google Wallet API in Google Cloud Console
 *   2. Create an Issuer at https://pay.google.com/business/console
 *   3. Create a service account, download JSON key
 *   4. Grant the service account "Google Wallet Object Issuer" role in the console
 *   5. Set the three env vars above
 */
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders, tickets, ticketTiers, events } from "@/db/schema"
import { log } from "@/lib/logger"
import { SignJWT, importPKCS8 } from "jose"

type Params = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
  const serviceEmail = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!issuerId || !serviceEmail || !privateKey) {
    return NextResponse.json(
      { error: "Google Wallet not configured. Set GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL, GOOGLE_WALLET_PRIVATE_KEY." },
      { status: 503 },
    )
  }

  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      guestName: orders.guestName,
      eventId: orders.eventId,
    })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1)

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (order.status !== "paid" && order.status !== "completed") {
    return NextResponse.json({ error: "Order not paid" }, { status: 409 })
  }

  const [event] = await db
    .select({ title: events.title, startsAt: events.startsAt, venue: events.venue })
    .from(events)
    .where(eq(events.id, order.eventId))
    .limit(1)

  const orderTickets = await db
    .select({ id: tickets.id, qrCode: tickets.qrCode, tierName: ticketTiers.name, holderName: tickets.holderName })
    .from(tickets)
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(eq(tickets.orderId, id))

  if (orderTickets.length === 0) {
    return NextResponse.json({ error: "No tickets found" }, { status: 404 })
  }

  try {
    const classId = `${issuerId}.ticketpulse_event_ticket`
    const ticket = orderTickets[0]
    const holder = ticket.holderName ?? order.guestName ?? "Ticket Holder"
    const qrMessage = ticket.qrCode && !ticket.qrCode.startsWith("data:") ? ticket.qrCode : ticket.id

    const eventObj = {
      id: `${issuerId}.${ticket.id}`,
      classId,
      genericType: "GENERIC_TYPE_UNSPECIFIED",
      hexBackgroundColor: "#1a1a1a",
      logo: {
        sourceUri: { uri: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/logo.png` },
        contentDescription: { defaultValue: { language: "en-US", value: "TicketPulse" } },
      },
      cardTitle: { defaultValue: { language: "en-US", value: "TicketPulse" } },
      header: { defaultValue: { language: "en-US", value: event?.title ?? "Event Ticket" } },
      textModulesData: [
        { id: "ticket_type", header: "TICKET", body: ticket.tierName ?? "General Admission" },
        { id: "holder", header: "HOLDER", body: holder },
        ...(event?.venue ? [{ id: "venue", header: "VENUE", body: event.venue }] : []),
        ...(event?.startsAt ? [{ id: "date", header: "DATE", body: new Date(event.startsAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) }] : []),
      ],
      barcode: { type: "QR_CODE", value: qrMessage, alternateText: id.slice(0, 8).toUpperCase() },
      state: "ACTIVE",
    }

    const key = await importPKCS8(privateKey, "RS256")
    const jwt = await new SignJWT({
      iss: serviceEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      payload: { genericObjects: [eventObj] },
    })
      .setProtectedHeader({ alg: "RS256" })
      .sign(key)

    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`

    log.info("google wallet pass generated", { orderId: id, ticketId: ticket.id })
    return NextResponse.json({ url: saveUrl })
  } catch (err) {
    log.error("google wallet pass generation failed", { orderId: id, error: String(err) })
    return NextResponse.json({ error: "Failed to generate pass" }, { status: 500 })
  }
}
