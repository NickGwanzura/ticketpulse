import { db } from "@/db"
import { events, ticketTiers, tickets } from "@/db/schema"
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm"

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
  sponsored: boolean
  lowestPrice: number | null
  currency: string
  status: string
  soldQuantity: number
  totalQuantity: number
  tags: string[]
}

/**
 * Published events starting now or later, soonest first.
 * Used by the home hero, the navbar mega menu, and other "what's on" surfaces.
 * Sponsored events are sorted to the top.
 */
export async function getFeaturedEvents(limit = 3): Promise<FeaturedEvent[]> {
  return (await getFeaturedEventsShared()).slice(0, limit)
}

// Every page render calls this (the root layout needs it for the navbar), so
// under heavy traffic it must not hit the database per request. One shared
// copy is reused for FEATURED_TTL_MS, concurrent misses share one load, and a
// failed refresh serves the previous copy instead of breaking every page.
// Checkout validates real inventory separately, so slightly stale counts here
// only affect browsing.
const FEATURED_TTL_MS = 30_000
const FEATURED_STALE_MS = 10 * 60_000
const FEATURED_MAX = 100
let featuredCache: { at: number; value: FeaturedEvent[] } | null = null
let featuredInflight: Promise<FeaturedEvent[]> | null = null

async function getFeaturedEventsShared(): Promise<FeaturedEvent[]> {
  const now = Date.now()
  if (featuredCache && now - featuredCache.at < FEATURED_TTL_MS) return featuredCache.value
  if (!featuredInflight) {
    featuredInflight = loadFeaturedEvents(FEATURED_MAX)
      .then((value) => {
        featuredCache = { at: Date.now(), value }
        return value
      })
      .catch((error) => {
        if (featuredCache && Date.now() - featuredCache.at < FEATURED_STALE_MS) return featuredCache.value
        throw error
      })
      .finally(() => {
        featuredInflight = null
      })
  }
  return featuredInflight
}

async function loadFeaturedEvents(limit: number): Promise<FeaturedEvent[]> {
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
      sponsored: events.sponsored,
      status: events.status,
      tags: events.tags,
    })
    .from(events)
    .where(and(
      eq(events.status, "published"),
      sql`COALESCE(${events.endsAt}, ${events.startsAt} + INTERVAL '6 hours') >= NOW()`,
    ))
    // Sponsord events first, then by start date
    .orderBy(
      sql`CASE WHEN ${events.sponsored} = true AND (${events.sponsorshipExpiresAt} IS NULL OR ${events.sponsorshipExpiresAt} > NOW()) THEN 0 ELSE 1 END`,
      asc(events.startsAt),
    )
    .limit(limit)

  if (rows.length === 0) return []

  const eventIds = rows.map((r) => r.id)
  const [priceRows, tierAggRows, attendingRows] = await Promise.all([
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
        totalCapacity: sql<number>`COALESCE(SUM(${ticketTiers.totalQuantity}), 0)`,
      })
      .from(ticketTiers)
      .where(inArray(ticketTiers.eventId, eventIds))
      .groupBy(ticketTiers.eventId),
    db
      .select({
        eventId: tickets.eventId,
        attending: sql<number>`COUNT(*)::int`,
      })
      .from(tickets)
      .where(and(
        inArray(tickets.eventId, eventIds),
        eq(tickets.isStaffTicket, false),
        notInArray(tickets.status, ["cancelled", "refunded"]),
      ))
      .groupBy(tickets.eventId),
  ])

  const lowestByEvent = new Map<string, { price: number; currency: string }>()
  for (const t of priceRows) {
    const price = Number(t.price)
    const currency = t.currency ?? "USD"
    const cur = lowestByEvent.get(t.eventId)
    if (!cur || price < cur.price) lowestByEvent.set(t.eventId, { price, currency })
  }

  const attendingByEvent = new Map<string, number>()
  for (const a of attendingRows) {
    attendingByEvent.set(a.eventId, Number(a.attending))
  }

  const aggByEvent = new Map<string, { total: number }>()
  for (const a of tierAggRows) {
    aggByEvent.set(a.eventId, { total: Number(a.totalCapacity) })
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
      sponsored: r.sponsored ?? false,
      lowestPrice: low?.price ?? null,
      currency: low?.currency ?? "USD",
      status: r.status ?? "published",
      soldQuantity: attendingByEvent.get(r.id) ?? 0,
      totalQuantity: agg?.total ?? 0,
      tags: r.tags ?? [],
    }
  })
}
