import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, ticketTiers, users } from "@/db/schema"
import { eq, desc, and, gte, like, or } from "drizzle-orm"
import { auth } from "@/auth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const city = searchParams.get("city")
  const search = searchParams.get("q")
  const featured = searchParams.get("featured")
  const limit = parseInt(searchParams.get("limit") ?? "20")
  const offset = parseInt(searchParams.get("offset") ?? "0")

  const conditions = [
    eq(events.status, "published"),
    gte(events.startsAt, new Date()),
  ]

  if (category) conditions.push(eq(events.category, category))
  if (city) conditions.push(eq(events.city, city))
  if (featured === "true") conditions.push(eq(events.featured, true))
  if (search) {
    conditions.push(
      or(
        like(events.title, `%${search}%`),
        like(events.venue, `%${search}%`),
        like(events.city, `%${search}%`)
      )!
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
      coverImage: events.coverImage,
      featured: events.featured,
      organizerName: users.name,
      organizerImage: users.image,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(events.featured), desc(events.startsAt))
    .limit(limit)
    .offset(offset)

  return NextResponse.json({ events: rows })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "organizer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { title, slug, description, category, venue, city, address, startsAt, endsAt, tags } = body

  const [event] = await db
    .insert(events)
    .values({
      organizerId: session.user.id,
      title,
      slug,
      description,
      category,
      venue,
      city,
      address,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      tags: tags ?? [],
    })
    .returning()

  return NextResponse.json({ event }, { status: 201 })
}
