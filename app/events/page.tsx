import type { Metadata } from "next"
import EventCard from "@/components/events/EventCard"
import HeroEventCard from "@/components/events/HeroEventCard"
import EventWaitlist from "@/components/events/EventWaitlist"
import Link from "next/link"
import { Search } from "lucide-react"

export const metadata: Metadata = {
  title: "Upcoming events in Zimbabwe",
  description: "Browse upcoming events in Zimbabwe — concerts, marathons, film premieres, exhibitions, and more. Buy tickets with EcoCash or Visa on TicketPulse.",
  alternates: {
    canonical: "/events",
  },
}

// ISR: re-generate every 60 seconds.
// The events list changes when organisers publish new events or
// update ticket counts — once a minute is fresh enough.
export const revalidate = 60

import { db } from "@/db"
import { events, ticketTiers, tickets } from "@/db/schema"
import { and, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm"

const CATEGORIES = ["All", "Concerts", "Food & Drink", "Cocktail Experience", "Marathons", "Film", "Walkathons", "Exhibitions", "Expeditions"]

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; view?: string }>
}) {
  const sp = await searchParams
  const activeCategory = sp.category ?? "all"
  const query = sp.q ?? ""
  const activeView = sp.view === "past" ? "past" : "upcoming"
  const now = new Date()
  const isPastView = activeView === "past"

  const conditions = [
    isPastView
      ? inArray(events.status, ["published", "completed"])
      : eq(events.status, "published"),
    isPastView
      ? sql`COALESCE(${events.endsAt}, ${events.startsAt}) < ${now}`
      : sql`COALESCE(${events.endsAt}, ${events.startsAt}) >= ${now}`,
  ]

  if (activeCategory && activeCategory !== "all") {
    const cat = activeCategory.toLowerCase()
    conditions.push(ilike(events.category, `%${cat}%`))
  }

  if (query) {
    const safe = `%${query.replace(/[%_\\]/g, (m) => "\\" + m)}%`
    conditions.push(
      or(
        ilike(events.title, safe),
        ilike(events.venue, safe),
        ilike(events.city, safe)
      )!
    )
  }

  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      category: events.category,
      venue: events.venue,
      city: events.city,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      coverImage: events.coverImage,
      featured: events.featured,
      sponsored: events.sponsored,
      sponsorshipExpiresAt: events.sponsorshipExpiresAt,
      status: events.status,
      tags: events.tags,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(
      isPastView
        ? desc(events.startsAt)
        : sql`CASE WHEN ${events.sponsored} = true AND (${events.sponsorshipExpiresAt} IS NULL OR ${events.sponsorshipExpiresAt} > NOW()) THEN 0 ELSE 1 END, ${events.startsAt}`,
    )
    .limit(50)

  // Fetch lowest tier price per event in one query
  const eventIds = rows.map((r) => r.id)
  const [priceRows, tierAggRows, attendingRows] = eventIds.length
    ? await Promise.all([
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
    : [[], [], []]

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

  const eventCards = rows.map((r) => {
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
      soldQuantity: attendingByEvent.get(r.id) ?? 0,
      totalQuantity: agg?.total ?? 0,
      isPast: (r.endsAt ?? r.startsAt).getTime() < now.getTime(),
    }
  })

  // A single upcoming event gets the large hero card instead of a grid.
  const isHeroView = eventCards.length === 1 && !query && activeCategory === "all"

  const firstEvent = isHeroView ? eventCards[0] : null

  return (
    <div>
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="relative isolate overflow-hidden border-b border-navy/20 bg-navy text-white">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-300/70 to-transparent" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-5 md:px-8 py-11 md:py-16">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-orange-300 uppercase mb-2">Discover Zimbabwe</p>
          <h1 className="text-[32px] md:text-[48px] font-bold tracking-[-0.03em] leading-tight text-white">
            {isPastView ? "Past events" : "Upcoming events"}
          </h1>
          <p className="mt-3 text-[15px] text-white/72 max-w-xl">
            {eventCards.length === 0
              ? isPastView ? "No past events yet." : "No upcoming events live yet. Check back soon."
              : eventCards.length === 1
              ? isPastView ? "1 past event available" : "1 event live right now"
              : isPastView ? `${eventCards.length} past events available` : `${eventCards.length} events live`} {eventCards.length > 0 && (isPastView ? "Browse recaps, media, vendors, and reviews." : "More landing as organizers come online.")}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-10">
        {/* ── Hero view (single event, no filters) ─────────────────────── */}
        {isHeroView && firstEvent && (
          <>
            <HeroEventCard
              slug={firstEvent.slug}
              title={firstEvent.title}
              category={firstEvent.category}
              venue={firstEvent.venue}
              city={firstEvent.city}
              startsAt={firstEvent.startsAt}
              coverImage={firstEvent.coverImage}
              lowestPrice={firstEvent.lowestPrice}
              currency={firstEvent.currency}
              soldQuantity={firstEvent.soldQuantity}
              totalQuantity={firstEvent.totalQuantity}
            />

            {/* Waitlist */}
            <EventWaitlist />
          </>
        )}

        {/* ── Multi-event: search, filters, grid ──────────────────────── */}
        {!isHeroView && (
          <>
            {/* Search & filters */}
            <form className="flex flex-col md:flex-row gap-3 mb-6">
              <input type="hidden" name="view" value={activeView} />
              <div className="relative flex-1 max-w-xl">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search events, venues, cities…"
                  defaultValue={query}
                  className="w-full h-12 rounded-xl border border-line bg-paper pl-11 pr-4 text-sm text-ink placeholder:text-ink-3 shadow-sm shadow-ink/[0.03] focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
                />
              </div>
            </form>

            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { label: "Upcoming", value: "upcoming" },
                { label: "Past events", value: "past" },
              ].map((view) => {
                const params = new URLSearchParams()
                if (view.value === "past") params.set("view", "past")
                if (activeCategory !== "all") params.set("category", activeCategory)
                if (query) params.set("q", query)
                const href = params.toString() ? `/events?${params.toString()}` : "/events"
                const active = activeView === view.value
                return (
                  <Link
                    key={view.value}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`text-sm px-4 py-2 rounded-full border transition-all ${
                      active
                        ? "bg-ink text-paper border-ink shadow-sm"
                        : "border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2"
                    }`}
                  >
                    {view.label}
                  </Link>
                )
              })}
            </div>

            {/* Category chips */}
            <div className="flex gap-2 mb-8 flex-wrap">
              {CATEGORIES.map((cat) => {
                const val = cat === "All" ? "all" : cat.replace(/s$/, "").toLowerCase()
                const isActive = activeCategory === val || (cat === "All" && activeCategory === "all")
                const params = new URLSearchParams()
                if (activeView === "past") params.set("view", "past")
                if (val !== "all") params.set("category", val)
                const href = params.toString() ? `/events?${params.toString()}` : "/events"
                return (
                  <Link
                    key={cat}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={`text-sm px-4 py-2 rounded-full border transition-all ${
                      isActive
                        ? "bg-navy text-white border-navy shadow-sm shadow-brand-600/20"
                        : "border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2"
                    }`}
                  >
                    {cat}
                  </Link>
                )
              })}
            </div>

            {eventCards.length > 0 ? (
              <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 md:gap-5">
                {eventCards.map((event) => (
                  <EventCard key={event.id} {...event} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-12 text-center">
                <p className="text-[15px] font-medium text-ink mb-1">
                  {query || activeCategory !== "all" ? "No events match your filters" : "No events yet"}
                </p>
                <p className="text-sm text-ink-2 mb-6">
                  {query || activeCategory !== "all"
                    ? "Try clearing the search or picking a different category."
                    : isPastView ? "Completed events will appear here after they end." : "Check back soon. Organizers are still coming online."}
                </p>
                {(query || activeCategory !== "all") && (
                  <Link
                    href={isPastView ? "/events?view=past" : "/events"}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                  >
                    Browse all events
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
