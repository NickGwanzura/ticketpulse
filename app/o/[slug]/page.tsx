import { notFound } from "next/navigation"
import Link from "next/link"
import { MapPin, Calendar, Tag } from "lucide-react"
import { db } from "@/db"
import { events, users, ticketTiers } from "@/db/schema"
import { eq, and, asc, inArray, gte } from "drizzle-orm"
import { formatCurrency } from "@/lib/utils"

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const [organizer] = await db
    .select({ name: users.name, organizerBio: users.organizerBio })
    .from(users)
    .where(eq(users.organizerSlug, slug))
    .limit(1)

  if (!organizer) return { title: "Organizer not found" }

  return {
    title: `Events by ${organizer.name ?? slug} — TicketPulse`,
    description: organizer.organizerBio ?? `Browse events organized by ${organizer.name}.`,
  }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatEventDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function OrganizerPublicPage({ params }: Props) {
  const { slug } = await params

  const [organizer] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      organizerBio: users.organizerBio,
      organizerSlug: users.organizerSlug,
    })
    .from(users)
    .where(eq(users.organizerSlug, slug))
    .limit(1)

  if (!organizer) notFound()

  // Fetch published events for this organizer
  const eventRows = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      coverImage: events.coverImage,
      venue: events.venue,
      city: events.city,
      startsAt: events.startsAt,
      category: events.category,
      status: events.status,
    })
    .from(events)
    .where(
      and(
        eq(events.organizerId, organizer.id),
        eq(events.status, "published"),
        gte(events.startsAt, new Date()),
      ),
    )
    .orderBy(asc(events.startsAt))

  // Fetch lowest tier price per event
  const eventIds = eventRows.map((e) => e.id)
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

  const eventCards = eventRows.map((e) => {
    const low = lowestByEvent.get(e.id)
    return {
      ...e,
      lowestPrice: low?.price ?? null,
      currency: low?.currency ?? "USD",
    }
  })

  const initials = getInitials(organizer.name)

  return (
    <main className="min-h-screen bg-paper">
      {/* ── Nav bar ── */}
      <div className="border-b border-white/10 bg-chrome">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="text-[13px] font-semibold text-white/60 hover:text-white transition-colors">
            ← TicketPulse
          </Link>
        </div>
      </div>

      {/* ── Profile header ── */}
      <div className="bg-chrome">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-12 md:py-16">
          {/* Eyebrow */}
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-6">
            Events by
          </p>

          <div className="flex items-start gap-5">
            {/* Avatar */}
            {organizer.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organizer.image}
                alt={organizer.name ?? "Organizer"}
                className="h-16 w-16 md:h-20 md:w-20 rounded-2xl object-cover ring-2 ring-white/10 shrink-0"
              />
            ) : (
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-white/10 ring-2 ring-white/10 shrink-0 flex items-center justify-center">
                <span className="text-[22px] md:text-[28px] font-bold text-white/80">
                  {initials}
                </span>
              </div>
            )}

            {/* Name + bio */}
            <div className="min-w-0">
              <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight text-white leading-[1.1]">
                {organizer.name ?? slug}
              </h1>
              {organizer.organizerBio && (
                <p className="mt-2 text-[14px] md:text-[15px] text-white/60 leading-relaxed max-w-xl">
                  {organizer.organizerBio}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Events grid ── */}
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-14">
        {eventCards.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper-2 px-8 py-16 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-paper ring-1 ring-line mb-4">
              <Calendar size={20} className="text-ink-3" />
            </div>
            <p className="text-[16px] font-semibold text-ink mb-1">No upcoming events</p>
            <p className="text-[13px] text-ink-3">
              {organizer.name ?? "This organizer"} doesn&apos;t have any published events yet.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-[18px] font-semibold text-ink mb-6">
              {eventCards.length} upcoming event{eventCards.length !== 1 ? "s" : ""}
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {eventCards.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="group rounded-2xl border border-line bg-paper overflow-hidden hover:border-line-2 hover:shadow-sm transition-all tp-lift"
                >
                  {/* Cover image */}
                  <div className="relative h-44 bg-paper-2 overflow-hidden">
                    {event.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.coverImage}
                        alt={event.title}
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Calendar size={28} className="text-ink-3" />
                      </div>
                    )}
                    {/* Category badge */}
                    {event.category && (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                        <Tag size={9} />
                        {event.category}
                      </span>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-4">
                    <p className="text-[14px] font-semibold text-ink leading-snug line-clamp-2 mb-2 group-hover:text-navy transition-colors">
                      {event.title}
                    </p>

                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
                        <Calendar size={11} className="shrink-0" />
                        <span>{formatEventDate(event.startsAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate">
                          {event.venue}{event.city ? `, ${event.city}` : ""}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="pt-3 border-t border-line">
                      {event.lowestPrice !== null ? (
                        <p className="text-[13px] font-bold text-ink">
                          From{" "}
                          <span className="text-navy">
                            {formatCurrency(event.lowestPrice, event.currency)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-[13px] font-medium text-ink-3">Free</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
