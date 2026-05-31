import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { tickets, ticketTiers, events } from "@/db/schema"
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
    expiresAt: ticket.transferExpiresAt,
  })
}

// POST — claim the transfer
export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { token } = await ctx.params

  const [ticket] = await db
    .select({
      id: tickets.id,
      transferToName: tickets.transferToName,
      transferToEmail: tickets.transferToEmail,
      transferExpiresAt: tickets.transferExpiresAt,
      transferredAt: tickets.transferredAt,
    })
    .from(tickets)
    .where(eq(tickets.transferToken, token))
    .limit(1)

  if (!ticket) return NextResponse.json({ error: "Invalid or expired transfer link" }, { status: 404 })
  if (ticket.transferredAt) return NextResponse.json({ error: "Already claimed" }, { status: 410 })
  if (ticket.transferExpiresAt && new Date(ticket.transferExpiresAt) < new Date()) {
    return NextResponse.json({ error: "Transfer link has expired" }, { status: 410 })
  }

  await db.update(tickets).set({
    holderName: ticket.transferToName,
    holderEmail: ticket.transferToEmail,
    transferredAt: new Date(),
    // Clear the token so it can't be reused
    transferToken: null,
    transferToEmail: null,
    transferToName: null,
    transferExpiresAt: null,
  }).where(eq(tickets.id, ticket.id))

  log.info("ticket transfer claimed", { ticketId: ticket.id, holderEmail: ticket.transferToEmail })
  return NextResponse.json({ success: true })
}
