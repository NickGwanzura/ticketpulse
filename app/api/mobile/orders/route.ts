import { NextResponse } from "next/server"
import { db } from "@/db"
import { orders, events } from "@/db/schema"
import { eq, desc, sql } from "drizzle-orm"
import { authenticateRequest } from "@/lib/mobile-auth"

export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const limit = parseInt(new URL(request.url).searchParams.get("limit") ?? "20", 10)
  const offset = parseInt(new URL(request.url).searchParams.get("offset") ?? "0", 10)

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
      eventTitle: events.title,
      eventId: orders.eventId,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(eq(orders.userId, auth.userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json({
    ok: true,
    orders: rows.map((r) => ({
      id: r.id,
      status: r.status,
      totalAmount: Number(r.totalAmount),
      currency: r.currency ?? "USD",
      createdAt: r.createdAt?.toISOString() ?? null,
      eventTitle: r.eventTitle ?? "Unknown event",
      eventId: r.eventId,
    })),
  })
}
