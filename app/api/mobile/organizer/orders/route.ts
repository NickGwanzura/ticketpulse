import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { authenticateOrganizer, organizerEventScope, privateHeaders } from "@/lib/mobile-organizer"

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  status: z.enum(["pending", "awaiting_verification", "paid", "completed", "cancelled", "refunded", "expired"]).optional(),
})

export async function GET(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return NextResponse.json(identity, { status: identity.status, headers: privateHeaders })
  const query = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!query.success) return NextResponse.json({ ok: false, error: "Invalid order filters" }, { status: 400 })
  const { limit, offset, status } = query.data
  const rows = await db.select({
    id: orders.id, status: orders.status, totalAmount: orders.totalAmount,
    currency: orders.currency, createdAt: orders.createdAt,
    eventId: events.id, eventTitle: events.title, guestName: orders.guestName,
    paymentMethod: orders.paymentMethod,
  }).from(orders).innerJoin(events, eq(events.id, orders.eventId))
    .where(and(organizerEventScope(identity.userId, identity.role), status ? eq(orders.status, status) : undefined))
    .orderBy(desc(orders.createdAt), desc(orders.id)).limit(limit + 1).offset(offset)
  return NextResponse.json({
    ok: true, hasMore: rows.length > limit,
    orders: rows.slice(0, limit).map(row => ({ ...row, totalAmount: Number(row.totalAmount), currency: row.currency ?? "USD" })),
  }, { headers: privateHeaders })
}
