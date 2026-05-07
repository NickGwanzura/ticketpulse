import EventCard from "@/components/events/EventCard"
import Link from "next/link"
import { Search, SlidersHorizontal } from "lucide-react"

const MOCK_EVENTS = [
  {
    id: "1", slug: "rumble-in-sa-pretoria-2026", title: "Rumble in SA 2026 — Pretoria",
    category: "concert", venue: "Propaganda", city: "Pretoria", startsAt: new Date("2026-05-17T12:00:00"),
    featured: true, lowestPrice: 350, currency: "ZAR", status: "published",
  },
  {
    id: "2", slug: "nyuki-marathon-2026", title: "Nyuki Marathon 2026: One Bee, Million Futures",
    category: "marathon", venue: "National Sports Stadium", city: "Harare", startsAt: new Date("2026-05-17T06:00:00"),
    featured: true, lowestPrice: 5, currency: "USD", status: "published",
  },
  {
    id: "3", slug: "becoming-madam-boss-harare", title: "Becoming Madam Boss: Film Premiere — Harare",
    category: "film", venue: "Ster-Kinekor", city: "Harare", startsAt: new Date("2026-05-30T18:00:00"),
    featured: true, lowestPrice: 15, currency: "USD", status: "published",
  },
  {
    id: "4", slug: "rumble-in-sa-durban-2026", title: "Rumble in SA 2026 — Durban",
    category: "concert", venue: "The Station", city: "Durban", startsAt: new Date("2026-05-16T12:00:00"),
    featured: false, lowestPrice: 350, currency: "ZAR", status: "published",
  },
  {
    id: "5", slug: "becoming-madam-boss-london", title: "Becoming Madam Boss: Film Premiere — London",
    category: "film", venue: "Vue Cinema", city: "London", startsAt: new Date("2026-06-19T18:00:00"),
    featured: true, lowestPrice: 20, currency: "GBP", status: "published",
  },
  {
    id: "6", slug: "nyuki-marathon-exhibition-stands", title: "Nyuki Marathon: Corporate Exhibition Stands",
    category: "exhibition", venue: "National Sports Stadium", city: "Harare", startsAt: new Date("2026-05-17T06:00:00"),
    featured: false, lowestPrice: 200, currency: "USD", status: "published",
  },
]

const CATEGORIES = ["All", "Concerts", "Marathons", "Film", "Walkathons", "Exhibitions", "Expeditions"]

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const sp = await searchParams
  const activeCategory = sp.category ?? "all"
  const query = sp.q ?? ""

  const filtered = MOCK_EVENTS.filter((e) => {
    if (activeCategory && activeCategory !== "all") {
      const cat = activeCategory.replace(/s$/, "").toLowerCase()
      if (!e.category.toLowerCase().includes(cat)) return false
    }
    if (query) {
      return e.title.toLowerCase().includes(query.toLowerCase()) ||
        e.venue.toLowerCase().includes(query.toLowerCase()) ||
        e.city.toLowerCase().includes(query.toLowerCase())
    }
    return true
  })

  return (
    <div>
      {/* Page header */}
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Discover</p>
          <h1 className="text-[32px] md:text-[44px] font-bold tracking-tight leading-tight text-ink">All events</h1>
          <p className="mt-3 text-[15px] text-ink-2 max-w-xl">
            {filtered.length} live across Zimbabwe and the region. Filter by category or search by venue and city.
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

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {filtered.map((event) => (
              <EventCard key={event.id} {...event} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-12 text-center">
            <p className="text-[15px] font-medium text-ink mb-1">No events match your filters</p>
            <p className="text-sm text-ink-2 mb-6">Try clearing the search or picking a different category.</p>
            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition-colors"
            >
              Browse events
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
