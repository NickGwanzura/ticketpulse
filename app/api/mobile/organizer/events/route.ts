import { NextResponse } from "next/server"
import { db } from "@/db"
import { events, tickets } from "@/db/schema"
import { eq, and, sql, isNotNull, desc } from "drizzle-orm"
import { authenticateOrganizer, organizerEventScope, privateHeaders } from "@/lib/mobile-organizer"
import { getTicketTierSales } from "@/lib/ticket-tier-sales"

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
    })
    .from(events)
    .where(
      organizerEventScope(auth.userId, auth.role),
    )
    .orderBy(desc(events.startsAt))

  const tierSalesByEvent = await getTicketTierSales(rows.map(event => event.id))

  // For each event, fetch ticket & check-in counts
  const enriched = await Promise.all(
    rows.map(async (event) => {
      const tiers = tierSalesByEvent.get(event.id) ?? []

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
        totalCapacity: tiers.reduce((sum, tier) => sum + tier.capacity, 0),
        totalSold: tiers.reduce((sum, tier) => sum + tier.sold + tier.complimentary, 0),
        checkedIn: Number(checkinAgg?.checkedIn ?? 0),
        tiers,
      }
    }),
  )

  return NextResponse.json({ ok: true, events: enriched }, { headers: privateHeaders })
}
