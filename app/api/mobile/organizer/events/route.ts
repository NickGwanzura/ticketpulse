import { NextResponse } from "next/server"
import { db } from "@/db"
import { events, ticketTiers, tickets } from "@/db/schema"
import { eq, and, sql, isNotNull, desc } from "drizzle-orm"
import { z } from "zod"
import { authenticateOrganizer, organizerEventScope, privateHeaders } from "@/lib/mobile-organizer"
import { generateUniqueSlug } from "@/lib/slug"

const EventInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  category: z.string().trim().min(1, "Category is required").max(60),
  venue: z.string().trim().min(1, "Venue is required").max(160),
  city: z.string().trim().min(1, "City is required").max(80),
  country: z.string().trim().min(1).max(80).default("Zimbabwe"),
  address: z.string().trim().max(240).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
})

function serializedEvent(event: typeof events.$inferSelect) {
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    status: event.status,
    category: event.category,
    venue: event.venue,
    city: event.city,
    country: event.country,
    address: event.address,
    description: event.description,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
  }
}

export async function GET(request: Request) {
  const auth = await authenticateOrganizer(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  // Only organizers and admins can list their events
  if (auth.role !== "organizer" && auth.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 })
  }

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venue: events.venue,
      city: events.city,
      coverImage: events.coverImage,
      category: events.category,
      country: events.country,
      address: events.address,
      description: events.description,
    })
    .from(events)
    .where(
      organizerEventScope(auth.userId, auth.role),
    )
    .orderBy(desc(events.startsAt))

  // For each event, fetch ticket & check-in counts
  const enriched = await Promise.all(
    rows.map(async (event) => {
      const [capacityAgg] = await db
        .select({
          totalCapacity: sql<number>`COALESCE(SUM(${ticketTiers.totalQuantity}), 0)`,
        })
        .from(ticketTiers)
        .where(eq(ticketTiers.eventId, event.id))

      const [soldAgg] = await db
        .select({
          totalSold: sql<number>`COUNT(*)::int`,
        })
        .from(tickets)
        .where(
          and(
            eq(tickets.eventId, event.id),
            eq(tickets.isStaffTicket, false),
            sql`${tickets.status} IN ('sold', 'used')`,
          ),
        )

      const [checkinAgg] = await db
        .select({
          checkedIn: sql<number>`COUNT(*)::int`,
        })
        .from(tickets)
        .where(and(eq(tickets.eventId, event.id), isNotNull(tickets.scannedAt)))

      return {
        id: event.id,
        title: event.title,
        slug: event.slug,
        status: event.status,
        startsAt: event.startsAt?.toISOString() ?? null,
        endsAt: event.endsAt?.toISOString() ?? null,
        venue: event.venue,
        city: event.city,
        coverImage: event.coverImage,
        category: event.category,
        country: event.country,
        address: event.address,
        description: event.description,
        totalCapacity: Number(capacityAgg?.totalCapacity ?? 0),
        totalSold: Number(soldAgg?.totalSold ?? 0),
        checkedIn: Number(checkinAgg?.checkedIn ?? 0),
        isFinished: event.endsAt != null && event.endsAt <= new Date(),
        canScan:
          (event.status === "published" || event.status === "sold_out") &&
          (event.endsAt == null || event.endsAt > new Date()),
      }
    }),
  )

  return NextResponse.json({ ok: true, events: enriched }, { headers: privateHeaders })
}

export async function POST(request: Request) {
  const auth = await authenticateOrganizer(request)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const parsed = EventInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid event details" }, { status: 400 })
  }
  const data = parsed.data
  if (data.endsAt && data.endsAt <= data.startsAt) {
    return NextResponse.json({ ok: false, error: "End time must be after start time." }, { status: 400 })
  }
  const slug = await generateUniqueSlug(data.title)
  const [created] = await db.insert(events).values({
    organizerId: auth.userId,
    title: data.title,
    slug,
    description: data.description || null,
    category: data.category,
    status: "draft",
    venue: data.venue,
    city: data.city,
    country: data.country,
    address: data.address || null,
    startsAt: data.startsAt,
    endsAt: data.endsAt || null,
  }).returning()
  if (!created) return NextResponse.json({ ok: false, error: "Could not create event. Try again." }, { status: 500 })
  return NextResponse.json({ ok: true, event: serializedEvent(created) }, { status: 201, headers: privateHeaders })
}
