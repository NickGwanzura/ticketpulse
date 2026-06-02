import { NextResponse } from "next/server"
import { and, eq, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { tickets, ticketTiers } from "@/db/schema"

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
  return NextResponse.json(rows)
}
