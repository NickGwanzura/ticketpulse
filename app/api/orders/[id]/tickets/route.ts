import { NextResponse } from "next/server"
import { and, asc, eq, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { tickets, ticketTiers } from "@/db/schema"
import { generateTicketVerifyUrl } from "@/lib/tickets"

type Params = { id: string }

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
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
