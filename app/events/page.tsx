import EventCard from "@/components/events/EventCard"
import Link from "next/link"
import { Search, SlidersHorizontal } from "lucide-react"
import { db } from "@/db"
import { events, ticketTiers } from "@/db/schema"
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm"

const CATEGORIES = ["All", "Concerts", "Marathons", "Film", "Walkathons", "Exhibitions", "Expeditions"]

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const sp = await searchParams
  const activeCategory = sp.category ?? "all"
  const query = sp.q ?? ""

  const conditions = [eq(events.status, "published")]

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
      coverImage: events.coverImage,
      featured: events.featured,
      status: events.status,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.startsAt))
    .limit(50)

  // Fetch lowest tier price per event in one query
  const eventIds = rows.map((r) => r.id)
  const priceRows = eventIds.length
    ? await db
        .select({
          eventId: ticketTiers.eventId,
          price: ticketTiers.price,
          currency: ticketTiers.currency,
        })
        .from(ticketTiers)
        .where(inArray(ticketTiers.eventId, eventIds))
    : []

  const lowestByEvent = new Map<string, { price: number; currency: string }>()
  for (const t of priceRows) {
    const price = Number(t.price)
    const currency = t.currency ?? "USD"
    const cur = lowestByEvent.get(t.eventId)
    if (!cur || price < cur.price) lowestByEvent.set(t.eventId, { price, currency })
  }

  const eventCards = rows.map((r) => {
    const low = lowestByEvent.get(r.id)
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
    }
  })

  return (
    <div>
      {/* Page header */}
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Discover</p>
          <h1 className="text-[32px] md:text-[44px] font-bold tracking-tight leading-tight text-ink">All events</h1>
          <p className="mt-3 text-[15px] text-ink-2 max-w-xl">
            {eventCards.length === 0
              ? "No events live yet — check back soon."
              : eventCards.length === 1
              ? "1 event live right now"
              : `${eventCards.length} events live`} {eventCards.length > 0 && "— more landing as organizers come online."}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* Search & filters */}
        <form className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-xl">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            <input
              type="text"
              name="q"
              placeholder="Search events, venues, cities…"
              defaultValue={query}
              className="w-full h-12 rounded-xl border border-line bg-paper pl-11 pr-4 text-sm text-ink placeholder:text-ink-3 shadow-sm shadow-ink/[0.03] focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 h-12 rounded-xl border border-line bg-paper px-4 text-sm font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors"
          >
            <SlidersHorizontal size={15} /> Filters
          </button>
        </form>

        {/* Category chips */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {CATEGORIES.map((cat) => {
            const val = cat === "All" ? "all" : cat.replace(/s$/, "").toLowerCase()
            const isActive = activeCategory === val || (cat === "All" && activeCategory === "all")
            return (
              <Link
                key={cat}
                href={`/events${val === "all" ? "" : `?category=${val}`}`}
                className={`text-sm px-4 py-2 rounded-full border transition-all ${
                  isActive
                    ? "bg-navy text-white border-navy shadow-sm shadow-navy/20"
                    : "border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2"
                }`}
              >
                {cat}
              </Link>
            )
          })}
        </div>

        {eventCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
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
                : "Check back soon — organizers are still coming online."}
            </p>
            {(query || activeCategory !== "all") && (
              <Link
                href="/events"
                className="inline-flex items-center justify-center rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition-colors"
              >
                Browse all events
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
