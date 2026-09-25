import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { and, desc, eq, inArray, or } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, orders } from "@/db/schema"
import { rateLimit } from "@/lib/rate-limit"
import { orderAccessSignature } from "@/lib/tickets"

// Powers the buyer's "My tickets" list: refreshes the orders saved on this
// device (each proven by its access signature) and, for signed-in buyers,
// adds the orders on their account.
const summaryLimiter = rateLimit({ windowMs: 60_000, max: 20 })

const Body = z.object({
  orders: z.array(z.object({ id: z.string().uuid(), sig: z.string().regex(/^[a-f0-9]{64}$/i) })).max(50).default([]),
})

const LISTED_STATUSES = ["pending", "awaiting_verification", "paid", "completed", "refunded", "expired", "cancelled"] as const

function clientStatus(status: string | null) {
  if (status === "paid" || status === "completed" || status === "refunded") return status
  if (status === "pending" || status === "awaiting_verification") return "pending"
  return "expired"
}

function signatureMatches(orderId: string, sig: string) {
  const a = Buffer.from(sig, "hex")
  const b = Buffer.from(orderAccessSignature(orderId), "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const rl = await summaryLimiter.checkRequest(req)
  if (!rl.allowed) return NextResponse.json({ error: "too_many_requests" }, { status: 429 })

  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const provenIds = parsed.orders.filter((o) => signatureMatches(o.id, o.sig)).map((o) => o.id)

  const session = await auth()
  const userId = session?.user?.id
  const email = session?.user?.email?.toLowerCase()

  const ownership = [
    provenIds.length > 0 ? inArray(orders.id, provenIds) : undefined,
    userId ? eq(orders.userId, userId) : undefined,
    email ? eq(orders.guestEmail, email) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined)

  if (ownership.length === 0) return NextResponse.json({ orders: [] })

  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
      eventTitle: events.title,
      eventSlug: events.slug,
      eventStartsAt: events.startsAt,
    })
    .from(orders)
    .leftJoin(events, eq(events.id, orders.eventId))
    .where(and(or(...ownership), inArray(orders.status, [...LISTED_STATUSES])))
    .orderBy(desc(orders.createdAt))
    .limit(50)

  return NextResponse.json({
    orders: rows.map((row) => ({
      id: row.id,
      status: clientStatus(row.status),
      total: Number(row.totalAmount ?? 0),
      currency: row.currency ?? "USD",
      createdAt: row.createdAt?.toISOString() ?? null,
      eventTitle: row.eventTitle ?? "Event",
      eventSlug: row.eventSlug ?? "",
      eventStartsAt: row.eventStartsAt?.toISOString() ?? null,
    })),
  })
}
