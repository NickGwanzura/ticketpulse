import { NextResponse } from "next/server"
import { and, eq, or } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { events, orders, reviews } from "@/db/schema"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const Body = z.object({
  eventId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().toLowerCase().max(160),
  orderRef: z.string().trim().max(80).optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(1200),
  publicConsent: z.boolean().default(true),
})

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid review", detail: err instanceof Error ? err.message : null },
      { status: 400 },
    )
  }

  let eventId = parsed.eventId ?? null
  let orderId: string | null = null
  const orderRef = parsed.orderRef?.trim()

  if (eventId) {
    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1)
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  if (orderRef) {
    const orderWhere = UUID_RE.test(orderRef)
      ? or(eq(orders.id, orderRef), eq(orders.paymentRef, orderRef))!
      : eq(orders.paymentRef, orderRef)

    const [order] = await db
      .select({ id: orders.id, eventId: orders.eventId, guestEmail: orders.guestEmail, paymentRef: orders.paymentRef })
      .from(orders)
      .where(and(
        orderWhere,
        eq(orders.guestEmail, parsed.email),
      ))
      .limit(1)

    if (!order) {
      return NextResponse.json({ error: "Order reference does not match this email" }, { status: 400 })
    }

    if (eventId && order.eventId !== eventId) {
      return NextResponse.json({ error: "Order does not belong to this event" }, { status: 400 })
    }

    orderId = order.id
    eventId = order.eventId
  }

  await db.insert(reviews).values({
    eventId,
    orderId,
    reviewerName: parsed.name,
    reviewerEmail: parsed.email,
    rating: parsed.rating,
    title: parsed.title || null,
    body: parsed.body,
    publicConsent: parsed.publicConsent,
    source: orderId ? "order_link" : "public_link",
    status: "pending",
  })

  return NextResponse.json({ ok: true })
}
