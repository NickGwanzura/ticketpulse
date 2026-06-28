import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, users, ticketTiers } from "@/db/schema"
import { eq, desc, and, gte, like, or, sql } from "drizzle-orm"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const city = searchParams.get("city")
  const search = searchParams.get("q")
  const limit = parseInt(searchParams.get("limit") ?? "20", 10)
  const offset = parseInt(searchParams.get("offset") ?? "0", 10)

  const conditions = [
    eq(events.status, "published"),
    gte(events.startsAt, new Date()),
  ]

  if (category) conditions.push(eq(events.category, category))
  if (city) conditions.push(eq(events.city, city))
  if (search) {
    const safe = search.replace(/[%_\\]/g, (m) => "\\" + m)
    conditions.push(
      or(
        like(events.title, `%${safe}%`),
        like(events.venue, `%${safe}%`),
        like(events.city, `%${safe}%`),
      )!,
    )
  }

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      category: events.category,
      status: events.status,
      venue: events.venue,
      city: events.city,
      country: events.country,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      coverImage: events.coverImage,
      featured: events.featured,
      organizerName: users.name,
      organizerImage: users.image,
      lowestPrice: sql<number>`MIN(${ticketTiers.price})`,
      currency: sql<string>`MIN(${ticketTiers.currency})`,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .leftJoin(ticketTiers, eq(ticketTiers.eventId, events.id))
    .where(and(...conditions))
    .groupBy(events.id, users.name, users.image)
    .orderBy(desc(events.featured), desc(events.startsAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json({ ok: true, events: rows })
}
