import { NextResponse } from "next/server"
import { db } from "@/db"
import { events, ticketTiers, tickets } from "@/db/schema"
import { eq, and, sql, isNotNull, desc } from "drizzle-orm"
import { authenticateOrganizer, organizerEventScope, privateHeaders } from "@/lib/mobile-organizer"

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

      // Sales by ticket type for the event page.
      const [tierRows, tierSold] = await Promise.all([
        db.select({ id: ticketTiers.id, name: ticketTiers.name, price: ticketTiers.price, currency: ticketTiers.currency, totalQuantity: ticketTiers.totalQuantity })
          .from(ticketTiers).where(eq(ticketTiers.eventId, event.id)),
        db.select({ tierId: tickets.tierId, sold: sql<number>`COUNT(*)::int` })
          .from(tickets)
          .where(and(eq(tickets.eventId, event.id), eq(tickets.isStaffTicket, false), sql`${tickets.status} IN ('sold', 'used')`))
          .groupBy(tickets.tierId),
      ])
      const soldByTier = new Map(tierSold.map((row) => [row.tierId, Number(row.sold)]))

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
        totalCapacity: Number(capacityAgg?.totalCapacity ?? 0),
        totalSold: Number(soldAgg?.totalSold ?? 0),
        checkedIn: Number(checkinAgg?.checkedIn ?? 0),
        tiers: tierRows.map((tier) => ({
          id: tier.id,
          name: tier.name,
          price: Number(tier.price),
          currency: tier.currency ?? "USD",
          capacity: tier.totalQuantity,
          sold: soldByTier.get(tier.id) ?? 0,
        })),
      }
    }),
  )

  return NextResponse.json({ ok: true, events: enriched }, { headers: privateHeaders })
}
