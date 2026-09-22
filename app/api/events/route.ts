import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { eq, desc, and, gte, like, or } from "drizzle-orm"
import { z } from "zod"
import { log } from "@/lib/logger"
import { rateLimit } from "@/lib/rate-limit"
import { requireApprovedOrganizer } from "@/lib/organizer-eligibility"

const eventsLimiter = rateLimit({ windowMs: 60_000, max: 60 })

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
  const rl = await eventsLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

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
  const rl = await eventsLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const eligibility = await requireApprovedOrganizer()
  if (!eligibility.ok) {
    const status = eligibility.error === "You must be signed in." ? 401 : 403
    return NextResponse.json({ error: eligibility.error }, { status })
  }
  const session = eligibility.session

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
      status: "draft",
    })
    .returning()

  // WhatsApp alert to admin (fire-and-forget).
  const { sendAdminAlert } = await import("@/lib/whatsapp")
  const { newEventAlert } = await import("@/lib/whatsapp-templates")
  sendAdminAlert(
    newEventAlert(title, category, city, new Date(startsAt).toLocaleDateString("en-GB")),
  ).catch((e) => {
    console.error("[POST /api/events] admin WhatsApp alert", e)
    log.error("events API — admin WhatsApp alert failed", { error: String(e) })
  })

  return NextResponse.json({ event }, { status: 201 })
}
