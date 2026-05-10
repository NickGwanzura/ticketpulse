import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"

type Params = { id: string }

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return email
  const masked = local.length <= 2 ? local[0] + "*" : local[0] + "***" + local.slice(-1)
  return `${masked}@${domain}`
}

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params
  const [order] = await db
    .select({
      status: orders.status,
      guestEmail: orders.guestEmail,
      verificationSentAt: orders.verificationSentAt,
      verificationExpires: orders.verificationExpires,
    })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1)

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json({
    status: order.status,
    sentTo: order.guestEmail ? maskEmail(order.guestEmail) : null,
    sentAt: order.verificationSentAt?.toISOString() ?? null,
    expiresAt: order.verificationExpires?.toISOString() ?? null,
  })
}
