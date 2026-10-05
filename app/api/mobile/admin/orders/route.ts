import { NextResponse } from "next/server"
import { desc, eq, ilike, or, sql, type SQL } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { events, orders, users } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { rateLimit } from "@/lib/rate-limit"

const limiter = rateLimit({ windowMs: 60_000, max: 60 })
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: privateHeaders })
const Query = z.object({
  q: z.string().trim().min(2).max(80),
  status: z.enum(["pending", "awaiting_verification", "paid", "completed", "expired", "cancelled", "refunded"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
})

/** Escape LIKE wildcards so a search term is matched literally. */
const literal = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)

/** Support search: find any order by number, buyer name, email or phone. Admin only. */
export async function GET(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return respond(identity, identity.status)
  if (identity.role !== "admin") return respond({ ok: false, error: "Admin access required" }, 403)
  if (!(await limiter.checkDistributed(identity.userId)).allowed) {
    return respond({ ok: false, error: "Too many searches. Please wait a minute." }, 429)
  }

  const url = new URL(request.url)
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? "",
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) return respond({ ok: false, error: "Enter at least 2 characters to search." }, 400)
  const { q, status, limit } = parsed.data

  const term = literal(q.replace(/^#/, ""))
  const digits = q.replace(/\D/g, "")
  const matches: SQL[] = [
    sql`${orders.id}::text ILIKE ${`${term}%`}`,
    ilike(orders.guestEmail, `%${term}%`),
    ilike(orders.guestName, `%${term}%`),
    ilike(users.email, `%${term}%`),
    ilike(users.name, `%${term}%`),
  ]
  // Phone numbers are stored in different formats; compare digits only.
  if (digits.length >= 5) matches.push(sql`regexp_replace(coalesce(${orders.guestPhone}, ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`)
  const where = status ? sql`(${or(...matches)}) AND ${eq(orders.status, status)}` : or(...matches)

  const rows = await db.select({
    id: orders.id, status: orders.status, totalAmount: orders.totalAmount, currency: orders.currency,
    paymentMethod: orders.paymentMethod, createdAt: orders.createdAt,
    guestName: orders.guestName, guestEmail: orders.guestEmail, guestPhone: orders.guestPhone,
    buyerName: users.name, buyerEmail: users.email,
    eventTitle: events.title,
    deliveryStatus: sql<string | null>`${orders.metadata}->'delivery'->>'status'`,
  }).from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(limit)

  return respond({
    ok: true,
    orders: rows.map((row) => ({
      id: row.id,
      ref: row.id.slice(0, 8).toUpperCase(),
      status: row.status,
      totalAmount: Number(row.totalAmount),
      currency: row.currency ?? "USD",
      paymentMethod: row.paymentMethod,
      createdAt: row.createdAt,
      buyerName: row.guestName ?? row.buyerName,
      buyerEmail: row.guestEmail ?? row.buyerEmail,
      buyerPhone: row.guestPhone,
      eventTitle: row.eventTitle,
      deliveryStatus: row.deliveryStatus,
    })),
  })
}
