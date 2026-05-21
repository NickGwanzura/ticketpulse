import { db } from "@/db"
import { events, ticketTiers } from "@/db/schema"
import { and, asc, eq, inArray, sql } from "drizzle-orm"

export interface FeaturedEvent {
  id: string
  slug: string
  title: string
  category: string
  venue: string
  city: string
  startsAt: Date
  coverImage: string | null
  featured: boolean
  lowestPrice: number | null
  currency: string
  status: string
  soldQuantity: number
  totalQuantity: number
}

/**
 * Published events starting now or later, soonest first.
 * Used by the home hero, the navbar mega menu, and other "what's on" surfaces.
 */
export async function getFeaturedEvents(limit = 3): Promise<FeaturedEvent[]> {
  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      category: events.category,
      venue: events.venue,
      city: events.city,
      startsAt: events.startsAt,
      coverImage: events.coverImage,
      featured: events.featured,
      status: events.status,
    })
    .from(events)
    // Keep events visible while they're still running, not just before they start.
    // Falls back to startsAt + 6h when no explicit endsAt is set.
    .where(and(
      eq(events.status, "published"),
      sql`COALESCE(${events.endsAt}, ${events.startsAt} + INTERVAL '6 hours') >= NOW()`,
    ))
    .orderBy(asc(events.startsAt))
    .limit(limit)

  if (rows.length === 0) return []

  const eventIds = rows.map((r) => r.id)
  const [priceRows, tierAggRows] = await Promise.all([
    db
      .select({
        eventId: ticketTiers.eventId,
        price: ticketTiers.price,
        currency: ticketTiers.currency,
      })
      .from(ticketTiers)
      .where(inArray(ticketTiers.eventId, eventIds)),
    db
      .select({
        eventId: ticketTiers.eventId,
        totalSold: sql<number>`COALESCE(SUM(${ticketTiers.soldQuantity}), 0)`,
        totalCapacity: sql<number>`COALESCE(SUM(${ticketTiers.totalQuantity}), 0)`,
      })
      .from(ticketTiers)
      .where(inArray(ticketTiers.eventId, eventIds))
      .groupBy(ticketTiers.eventId),
  ])

  const lowestByEvent = new Map<string, { price: number; currency: string }>()
  for (const t of priceRows) {
    const price = Number(t.price)
    const currency = t.currency ?? "USD"
    const cur = lowestByEvent.get(t.eventId)
    if (!cur || price < cur.price) lowestByEvent.set(t.eventId, { price, currency })
  }

  const aggByEvent = new Map<string, { sold: number; total: number }>()
  for (const a of tierAggRows) {
    aggByEvent.set(a.eventId, { sold: Number(a.totalSold), total: Number(a.totalCapacity) })
  }

  return rows.map((r) => {
    const low = lowestByEvent.get(r.id)
    const agg = aggByEvent.get(r.id)
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      venue: r.venue,
      city: r.city,
      startsAt: r.startsAt,
      coverImage: r.coverImage,
      featured: r.featured ?? false,
      lowestPrice: low?.price ?? null,
      currency: low?.currency ?? "USD",
      status: r.status ?? "published",
      soldQuantity: agg?.sold ?? 0,
      totalQuantity: agg?.total ?? 0,
    }
  })
}
