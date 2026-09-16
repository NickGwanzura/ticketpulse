import { NextResponse } from "next/server"
import { and, asc, eq, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { tickets, ticketTiers } from "@/db/schema"
import { generateTicketVerifyUrl } from "@/lib/tickets"
import { authorizeOrderAccess, orderAccessCredsFrom } from "@/lib/order-access"
import { log } from "@/lib/logger"

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  // A QR code is a bearer admission credential, so this endpoint requires
  // proof of ownership (see lib/order-access.ts).
  const creds = orderAccessCredsFrom(req)
  const access = await authorizeOrderAccess(id, creds)
  if (!access.ok) {
    log.warn("order tickets — unauthorised read", { orderId: id, reason: access.reason })
    return NextResponse.json(
      { error: access.reason === "not_found" ? "Order not found" : "Not authorised to view these tickets" },
      { status: access.reason === "not_found" ? 404 : 403 },
    )
  }

  const rows = await db
    .select({
      id: tickets.id,
      qrCode: tickets.qrCode,
      tierId: tickets.tierId,
      tierName: ticketTiers.name,
      scannedAt: tickets.scannedAt,
      transferToEmail: tickets.transferToEmail,
      transferToName: tickets.transferToName,
      transferExpiresAt: tickets.transferExpiresAt,
      transferredAt: tickets.transferredAt,
      holderName: tickets.holderName,
      holderEmail: tickets.holderEmail,
    })
    .from(tickets)
    .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
    .where(and(eq(tickets.orderId, id), notInArray(tickets.status, ["cancelled", "refunded"])))
    .orderBy(asc(tickets.createdAt), asc(tickets.id))
  return NextResponse.json(rows.map((row) => ({
    ...row,
    // Never hand the print view a blank/placeholder QR. A missing stored value
    // gets a signed canonical verification URL instead.
    qrCode: row.qrCode ?? generateTicketVerifyUrl(row.id, id),
  })))
}
