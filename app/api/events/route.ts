import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { eq, desc, and, gte, like, or } from "drizzle-orm"
import { auth } from "@/auth"
import { z } from "zod"

const PostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  category: z.string().min(1),
  venue: z.string().min(1),
  city: z.string().min(1),
  address: z.string().optional(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const city = searchParams.get("city")
  const search = searchParams.get("q")
  const featured = searchParams.get("featured")
  const limit = parseInt(searchParams.get("limit") ?? "20", 10)
  const offset = parseInt(searchParams.get("offset") ?? "0", 10)

  const conditions = [
    eq(events.status, "published"),
    gte(events.startsAt, new Date()),
  ]

  if (category) conditions.push(eq(events.category, category))
  if (city) conditions.push(eq(events.city, city))
  if (featured === "true") conditions.push(eq(events.featured, true))
  if (search) {
    const safe = search.replace(/[%_\\]/g, (m) => "\\" + m)
    conditions.push(
      or(
        like(events.title, `%${safe}%`),
        like(events.venue, `%${safe}%`),
        like(events.city, `%${safe}%`)
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

  const parsed = PostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }
  const { title, slug, description, category, venue, city, address, startsAt, endsAt, tags } = parsed.data

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

  // WhatsApp alert to admin (fire-and-forget).
  const { sendAdminAlert } = await import("@/lib/whatsapp")
  sendAdminAlert(
    `📅 *New event created*\n\nTitle: ${title}\nCategory: ${category}\nCity: ${city}\nStarts: ${new Date(startsAt).toLocaleDateString("en-GB")}\n\nView in admin: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/admin/events`,
  ).catch((e) => console.error("[POST /api/events] admin WhatsApp alert", e))

  return NextResponse.json({ event }, { status: 201 })
}
