import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Calendar, CheckCircle2, Clock, DollarSign, ExternalLink, HelpCircle, MapPin, Star, Ticket, Users, Wallet } from "lucide-react"

// ISR: re-generate this page at most every 30 seconds.
// Cuts DB load by ~95% for the most-hit public pages while
// keeping ticket counts reasonably fresh.
export const revalidate = 30
export const dynamicParams = true

import MerchSection from "@/components/merch/MerchSection"
import VendorSection from "@/components/vendors/VendorSection"
import MediaSection from "@/components/media/MediaSection"
import TicketSelector from "@/components/events/TicketSelector"
import EventViewTracker from "@/components/events/EventViewTracker"
import VenueMap from "@/components/events/VenueMap"
import ShareEventButton from "@/components/events/ShareEventButton"
import SaveFavoriteButton from "@/components/events/SaveFavoriteButton"
import ReviewHighlights from "@/components/reviews/ReviewHighlights"
import MobileBuyBar from "@/components/MobileBuyBar"
import { db } from "@/db"
import { eventLineup, events, merchItems, orders, reviews, ticketTiers, tickets, users, vendorListings, vendors } from "@/db/schema"
import { and, asc, desc, eq, or, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import { getTierAvailability } from "@/lib/ticket-availability"
import { getEventRevenueSummaries } from "@/lib/revenue-summary"
import type { VendorListing } from "@/types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CATEGORY_EMOJI: Record<string, string> = {
  marathon: "🏃",
  walkathon: "🚶",
  concert: "🎵",
  film: "🎬",
  exhibition: "🏢",
  expedition: "⛰️",
  "food & drink": "🍽️",
  "cocktail experience": "🍹",
}

// Public profile details captured from the linked Instagram pages. Keep this
// limited to artist-facing descriptors; booking contacts stay off the public page.
const PUBLIC_LINEUP_PROFILES: Record<string, { descriptor: string; audience: string }> = {
  "_jay_dj._": { descriptor: "House music DJ", audience: "7,022 followers" },
  reverb7: { descriptor: "Afrobeats & AfroHouse DJ · Producer", audience: "7,565 followers" },
}

function getPublicLineupProfile(socialUrl: string | null) {
  if (!socialUrl) return null
  try {
    const handle = new URL(socialUrl).pathname.split("/").filter(Boolean)[0]?.toLowerCase()
    return handle ? PUBLIC_LINEUP_PROFILES[handle] ?? null : null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

  const where = UUID_RE.test(id)
    ? or(eq(events.slug, id), eq(events.id, id))
    : eq(events.slug, id)

  const [row] = await db
    .select({
      title: events.title,
      description: events.description,
      slug: events.slug,
      coverImage: events.coverImage,
      startsAt: events.startsAt,
      venue: events.venue,
      city: events.city,
    })
    .from(events)
    .where(where)
    .limit(1)

  if (!row) {
    return { title: "Event not found" }
  }

  const title = `${row.title} — tickets, date, venue`
  const description = row.description
    ? row.description.length > 160
      ? row.description.slice(0, 157) + "..."
      : row.description
    : `Get tickets for ${row.title}${row.venue.toLowerCase() === "tba" ? "" : ` at ${row.venue}, ${row.city}`}. ${row.startsAt.toLocaleDateString("en-ZW", { dateStyle: "long" })}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: row.coverImage
        ? [{ url: row.coverImage, width: 1200, height: 630, alt: row.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: row.coverImage
        ? [{ url: row.coverImage, width: 1200, height: 630, alt: row.title }]
        : undefined,
    },
    alternates: {
      canonical: `${baseUrl}/events/${row.slug}`,
    },
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  const where = UUID_RE.test(id)
    ? or(eq(events.slug, id), eq(events.id, id))
    : eq(events.slug, id)

  const [row] = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      description: events.description,
      category: events.category,
      status: events.status,
      venue: events.venue,
      city: events.city,
      country: events.country,
      address: events.address,
      lat: events.lat,
      lng: events.lng,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      coverImage: events.coverImage,
      tags: events.tags,
      googleMapsUrl: events.googleMapsUrl,
      hideOrganizerName: events.hideOrganizerName,
      faq: events.faq,
      promoImages: events.promoImages,
      organizerId: events.organizerId,
      organizerName: users.name,
      organizerImage: users.image,
      sponsored: events.sponsored,
      sponsorName: events.sponsorName,
      sponsorLogoUrl: events.sponsorLogoUrl,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(where)
    .limit(1)

  if (!row) notFound()

  const isEventOwner = session?.user?.id === row.organizerId || session?.user?.role === "admin"
  const now = new Date()
  const eventEndedAt = row.endsAt ?? row.startsAt
  const isPastEvent = eventEndedAt.getTime() < now.getTime()

  const [tierRows, merchRows, vendorListingRows, reviewRows, lineupRows] = await Promise.all([
    db.select().from(ticketTiers).where(eq(ticketTiers.eventId, row.id)),
    db.select().from(merchItems).where(and(eq(merchItems.eventId, row.id), eq(merchItems.active, true))),
    db
      .select({
        id: vendorListings.id,
        eventId: vendorListings.eventId,
        packageName: vendorListings.packageName,
        packageDescription: vendorListings.packageDescription,
        price: vendorListings.price,
        currency: vendorListings.currency,
        available: vendorListings.available,
        booked: vendorListings.booked,
        businessName: vendors.businessName,
        category: vendors.category,
        logo: vendors.logo,
        verified: vendors.verified,
        rating: vendors.rating,
      })
      .from(vendorListings)
      .leftJoin(vendors, eq(vendorListings.vendorId, vendors.id))
      .where(and(eq(vendorListings.eventId, row.id), eq(vendorListings.available, true))),
    db
      .select({
        id: reviews.id,
        reviewerName: reviews.reviewerName,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(and(
        eq(reviews.eventId, row.id),
        eq(reviews.status, "approved"),
        eq(reviews.publicConsent, true),
      ))
      .orderBy(desc(reviews.featured), desc(reviews.createdAt))
      .limit(3),
    db
      .select({
        id: eventLineup.id,
        name: eventLineup.name,
        role: eventLineup.role,
        bio: eventLineup.bio,
        imageUrl: eventLineup.imageUrl,
        socialUrl: eventLineup.socialUrl,
      })
      .from(eventLineup)
      .where(eq(eventLineup.eventId, row.id))
      .orderBy(asc(eventLineup.displayOrder), asc(eventLineup.createdAt)),
  ])

  const availabilityByTier = await getTierAvailability(tierRows.map((t) => t.id))
  const [summaryMap, [ticketStats], [orderStats], [reviewStats]] = isPastEvent
    ? await Promise.all([
        getEventRevenueSummaries([row.id]),
        db
          .select({
            issued: sql<number>`COUNT(*) FILTER (WHERE ${tickets.isStaffTicket} = false AND ${tickets.status} IN ('sold', 'used'))::int`,
            checkedIn: sql<number>`COUNT(*) FILTER (WHERE ${tickets.isStaffTicket} = false AND ${tickets.status} IN ('sold', 'used') AND ${tickets.scannedAt} IS NOT NULL)::int`,
          })
          .from(tickets)
          .where(eq(tickets.eventId, row.id)),
        db
          .select({
            confirmed: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('paid', 'completed'))::int`,
          })
          .from(orders)
          .where(eq(orders.eventId, row.id)),
        db
          .select({
            count: sql<number>`COUNT(*) FILTER (WHERE ${reviews.status} = 'approved' AND ${reviews.publicConsent} = true)::int`,
            average: sql<string>`COALESCE(AVG(${reviews.rating}), 0)::numeric`,
          })
          .from(reviews)
          .where(eq(reviews.eventId, row.id)),
      ])
    : [new Map(), [{ issued: 0, checkedIn: 0 }], [{ confirmed: 0 }], [{ count: 0, average: "0" }]]
  const revenueSummary = summaryMap.get(row.id)

  const tiers = tierRows.map((t) => {
    const availability = availabilityByTier.get(t.id)
    return {
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    price: Number(t.price),
    currency: t.currency ?? "USD",
    totalQuantity: t.totalQuantity,
    soldQuantity: availability?.usedQuantity ?? t.soldQuantity ?? 0,
    maxPerOrder: t.maxPerOrder ?? 10,
    earlyBirdPrice: t.earlyBirdPrice ? Number(t.earlyBirdPrice) : null,
    earlyBirdUntil: t.earlyBirdUntil ?? null,
    earlyBirdQuantity: t.earlyBirdQuantity ?? null,
    groupPrice: t.groupPrice ? Number(t.groupPrice) : null,
    groupMinQty: t.groupMinQty ?? null,
    }
  })

  const vendorListingsData: VendorListing[] = vendorListingRows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    vendor: {
      businessName: r.businessName ?? "Unknown",
      category: (r.category ?? "other") as VendorListing["vendor"]["category"],
      logo: r.logo,
      verified: r.verified ?? false,
      rating: r.rating ? Number(r.rating) : null,
    },
    packageName: r.packageName,
    packageDescription: r.packageDescription,
    price: Number(r.price),
    currency: r.currency ?? "USD",
    available: r.available ?? false,
    booked: r.booked ?? false,
  }))

  const emoji = CATEGORY_EMOJI[row.category.toLowerCase()] ?? "🎫"
  const baseCurrency = tiers[0]?.currency ?? "USD"
  const lowestPrice = tiers.length ? Math.min(...tiers.map((t) => t.price)) : null

  // ── JSON-LD structured data (Schema.org Event) ────────────────────────────
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: row.title,
    description: row.description ?? undefined,
    startDate: row.startsAt.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: row.venue,
      address: {
        "@type": "PostalAddress",
        streetAddress: row.address ?? row.venue,
        addressLocality: row.city,
        addressCountry: row.country ?? "ZW",
      },
    },
    image: row.coverImage ?? undefined,
    organizer: row.organizerName && !row.hideOrganizerName
      ? {
          "@type": "Person",
          name: row.organizerName,
        }
      : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: baseCurrency,
      lowPrice: lowestPrice,
      availability: "https://schema.org/InStock",
      url: `${siteUrl}/events/${row.slug}`,
    },
  }

  // Format time range for display
  const timeDisplay = (() => {
    const start = row.startsAt
    const end = row.endsAt
    const timeZone = "Africa/Harare"
    if (!end) return formatDate(start, { timeZone })
    // Same day: "Wed 21 May 2026, 14:00 – 18:00"
    const dayKey = (date: Date) => date.toLocaleDateString("en-CA", { timeZone })
    const isSameDay = dayKey(start) === dayKey(end)
    if (isSameDay) {
      const datePart = new Intl.DateTimeFormat("en-ZW", { dateStyle: "medium", timeZone }).format(start)
      const timeFormatter = new Intl.DateTimeFormat("en-ZW", { timeStyle: "short", timeZone })
      const startTime = timeFormatter.format(start)
      const endTime = timeFormatter.format(end)
      return `${datePart}, ${startTime} – ${endTime}`
    }
    return `${formatDate(start, { timeZone })} – ${formatDate(end, { timeZone })}`
  })()

  const timeZone = "Africa/Harare"
  const dateDisplay = new Intl.DateTimeFormat("en-ZW", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(row.startsAt)
  const monthDisplay = new Intl.DateTimeFormat("en-ZW", { month: "short", timeZone }).format(row.startsAt)
  const dayDisplay = new Intl.DateTimeFormat("en-ZW", { day: "2-digit", timeZone }).format(row.startsAt)
  const timeRangeDisplay = (() => {
    const timeFormatter = new Intl.DateTimeFormat("en-ZW", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    })
    const startTime = timeFormatter.format(row.startsAt)
    return row.endsAt ? `${startTime} - ${timeFormatter.format(row.endsAt)}` : startTime
  })()

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",   item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Events", item: `${siteUrl}/events` },
      { "@type": "ListItem", position: 3, name: row.title, item: `${siteUrl}/events/${row.slug}` },
    ],
  }

  return (
    <div>
      <EventViewTracker eventId={row.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* ── Hero banner (cover image only, no title overlay) ── */}
      {row.coverImage ? (
        <div className="relative w-full h-[clamp(220px,58vw,420px)] md:h-[clamp(360px,30vw,520px)] overflow-hidden bg-ink">
          <img
            src={row.coverImage}
            alt={`${row.title} event at ${row.venue}, ${row.city}`}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-contain bg-ink"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/8 to-transparent" />
        </div>
      ) : (
        <div className="relative w-full h-40 md:h-52 bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 [background:radial-gradient(800px_circle_at_30%_20%,rgba(255,255,255,0.7),transparent_60%)] pointer-events-none" />
          <span className="text-7xl">{emoji}</span>
        </div>
      )}

      {/* Sponsor banner */}
      {row.sponsored && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-y border-amber-200">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] bg-gradient-to-r from-amber-600 to-yellow-500 text-transparent bg-clip-text">
                Sponsored
              </span>
              {row.sponsorName && (
                <span className="text-[12px] text-amber-800 font-medium">
                  Presented by {row.sponsorName}
                </span>
              )}
            </div>
            {row.sponsorLogoUrl && (
              <img src={row.sponsorLogoUrl} alt={row.sponsorName ?? "Sponsor"} className="h-6 object-contain" />
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-5 md:px-8 pb-28 lg:pb-10">
        <div className="relative -mt-4 grid grid-cols-1 gap-10 md:-mt-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-12">
            {/* ── Overview header ── */}
            <section className="overflow-hidden rounded-[28px] border border-line bg-white/95 p-5 shadow-[0_24px_80px_-44px_rgba(10,37,64,0.45)] backdrop-blur-md md:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700 ring-1 ring-orange-200/80">
                  <span aria-hidden>{emoji}</span> {row.category}
                </span>
                {row.status === "published" && !isPastEvent && (
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-200/80">
                    On sale
                  </span>
                )}
                {isPastEvent && (
                  <span className="inline-flex rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-paper">
                    Past event
                  </span>
                )}
              </div>

              <h1 className="mt-5 max-w-4xl text-[34px] font-bold leading-[0.98] tracking-tight text-ink md:text-[56px]">
                {row.title}
              </h1>

              <div className="mt-7 grid gap-4 md:grid-cols-2">
                <div className="group relative overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50 via-paper to-amber-50 p-5 shadow-sm shadow-orange-950/[0.04]">
                  <div className="absolute right-4 top-4 text-[72px] font-bold leading-none tracking-tighter text-orange-100 transition-transform duration-300 group-hover:scale-110" aria-hidden>
                    {dayDisplay}
                  </div>
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-sm shadow-orange-900/20">
                    <Calendar size={22} />
                  </span>
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700">Date</p>
                  <p className="mt-1 max-w-[16rem] text-[22px] font-bold leading-tight tracking-tight text-ink">{dateDisplay}</p>
                  <p className="mt-3 inline-flex rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-orange-700 ring-1 ring-orange-200/70">{monthDisplay}</p>
                </div>

                <div className="group relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-paper to-cyan-50 p-5 shadow-sm shadow-sky-950/[0.04]">
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-200/35 blur-2xl transition-transform duration-300 group-hover:scale-125" aria-hidden />
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-white shadow-sm shadow-navy/20">
                    <Clock size={22} />
                  </span>
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Time</p>
                  <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-ink">{timeRangeDisplay}</p>
                  <p className="mt-3 text-[12px] font-semibold text-ink-3">Africa/Harare time</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-line bg-paper-2/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 ring-1 ring-violet-200/70">
                      <MapPin size={18} />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">Venue</p>
                      <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">
                        {row.venue.trim().toLowerCase() === "tba" || row.city.trim().toLowerCase() === "tba"
                          ? "Location TBA"
                          : `${row.venue}, ${row.city}`}
                      </p>
                      {row.address && <p className="mt-1 text-[12px] text-ink-3">{row.address}</p>}
                    </div>
                  </div>
                </div>

                {row.organizerName && !row.hideOrganizerName ? (
                  <div className="rounded-2xl border border-line bg-paper-2/70 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 ring-1 ring-emerald-200/70">
                        <Users size={18} />
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">Organizer</p>
                        <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">{row.organizerName}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-line bg-paper-2/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">Full schedule</p>
                    <p className="mt-1 text-[14px] font-semibold leading-snug text-ink">{timeDisplay}</p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
                <ShareEventButton eventTitle={row.title} eventDescription={row.description} />
                <SaveFavoriteButton eventId={row.id} />
              </div>
            </section>

            {/* ── Description & tags ── */}
            <div>
              {row.description && (
                <p className="text-ink-2 leading-relaxed text-[15px]">{row.description}</p>
              )}
              {row.tags && row.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {row.tags.map((tag) => (
                    <span key={tag} className="text-[11px] font-medium bg-paper-2 border border-line text-ink-2 px-2.5 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Promo photo gallery ── */}
            {row.promoImages && (row.promoImages as string[]).length > 0 && (
              <div>
                <div
                  className={[
                    "grid gap-3",
                    (row.promoImages as string[]).length === 1
                      ? "grid-cols-1"
                      : (row.promoImages as string[]).length === 2
                        ? "grid-cols-2"
                        : "grid-cols-2 md:grid-cols-3",
                  ].join(" ")}
                >
                  {(row.promoImages as string[]).map((url, i) => (
                    <div
                      key={url}
                      className={[
                        "relative overflow-hidden rounded-2xl bg-paper-2",
                        (row.promoImages as string[]).length === 1 ? "aspect-[16/9]" : "aspect-[4/3]",
                        i === 0 && (row.promoImages as string[]).length >= 3 ? "md:col-span-2 md:row-span-2 aspect-[4/3] md:aspect-auto md:h-full" : "",
                      ].join(" ")}
                    >
                      <img
                        src={url}
                        alt={`${row.title} photo ${i + 1}`}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lineupRows.length > 0 && (
              <section className="rounded-2xl border border-line bg-paper p-6 md:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">On the lineup</p>
                    <h2 className="mt-1 text-[22px] font-bold tracking-tight text-ink">Meet the artists</h2>
                  </div>
                  <ExternalLink size={22} className="text-pink-600" aria-hidden="true" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {lineupRows.map((member) => (
                    <article key={member.id} className="rounded-2xl border border-line bg-white p-4">
                      {(() => {
                        const profile = getPublicLineupProfile(member.socialUrl)
                        return (
                      <div className="flex items-start gap-3">
                        {member.imageUrl ? (
                          <img src={member.imageUrl} alt={member.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-paper-2 text-[16px] font-bold text-ink-2">
                            {member.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate text-[15px] font-semibold text-ink">{member.name}</h3>
                          {(member.role || profile) && (
                            <p className="mt-0.5 text-[12px] text-ink-3">
                              {profile?.descriptor ?? member.role}
                              {profile?.audience && <span className="text-ink-3/75"> · {profile.audience}</span>}
                            </p>
                          )}
                        </div>
                      </div>
                        )
                      })()}
                      {member.bio && <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{member.bio}</p>}
                      {member.socialUrl && (
                        <a
                          href={member.socialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-3.5 text-[12px] font-semibold text-pink-700 transition hover:bg-pink-100"
                        >
                          <ExternalLink size={14} /> View Instagram profile
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {isPastEvent && (
              <div className="rounded-2xl border border-line bg-paper p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-1">Past event summary</p>
                    <h2 className="text-[18px] font-semibold tracking-tight text-ink">How this event finished</h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1 text-[12px] font-semibold text-ink-2 ring-1 ring-line">
                    <CheckCircle2 size={13} /> Event ended
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Tickets issued", value: Number(ticketStats?.issued ?? 0).toLocaleString(), icon: Ticket },
                    { label: "Checked in", value: Number(ticketStats?.checkedIn ?? 0).toLocaleString(), icon: CheckCircle2 },
                    { label: "Confirmed orders", value: Number(orderStats?.confirmed ?? 0).toLocaleString(), icon: Users },
                    { label: "Reviews", value: Number(reviewStats?.count ?? 0) > 0 ? `${Number(reviewStats?.average ?? 0).toFixed(1)} avg` : "None yet", icon: Star },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-xl bg-paper-2 p-3 ring-1 ring-line">
                      <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mb-2">
                        <Icon size={12} />
                        {label}
                      </div>
                      <p className="text-[18px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>

                {isEventOwner && revenueSummary && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Gross sales", value: formatCurrency(revenueSummary.grossRevenue, baseCurrency), icon: DollarSign },
                      { label: "Net earned", value: formatCurrency(revenueSummary.netRevenue, baseCurrency), icon: Wallet },
                      { label: "Paid out", value: formatCurrency(revenueSummary.paidOut, baseCurrency), icon: CheckCircle2 },
                      { label: "Available", value: formatCurrency(revenueSummary.availableBalance, baseCurrency), icon: Wallet },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-xl bg-brand-50/60 p-3 ring-1 ring-brand-200">
                        <div className="flex items-center gap-1.5 text-[11px] text-brand-700 mb-2">
                          <Icon size={12} />
                          {label}
                        </div>
                        <p className="text-[17px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Venue map ── */}
            {row.venue.trim().toLowerCase() !== "tba" && row.city.trim().toLowerCase() !== "tba" && (
              <VenueMap
                lat={row.lat}
                lng={row.lng}
                venue={row.venue}
                address={row.address}
                city={row.city}
                country={row.country}
                googleMapsUrl={row.googleMapsUrl}
              />
            )}

            {/* ── FAQ / More About ── */}
            {row.faq && (
              <div className="rounded-2xl border border-line bg-paper p-6 md:p-8">
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle size={16} className="text-navy" />
                  <h2 className="text-[16px] font-semibold text-ink">More About This Event</h2>
                </div>
                <div className="text-ink-2 leading-relaxed text-[15px] whitespace-pre-wrap">
                  {row.faq}
                </div>
              </div>
            )}

            <ReviewHighlights reviews={reviewRows} title={`Reviews for ${row.title}`} compact />

            <MerchSection
              items={merchRows.map((item) => ({
                ...item,
                price: Number(item.price),
                currency: item.currency ?? "USD",
                stockQuantity: item.stockQuantity ?? 0,
                soldQuantity: item.soldQuantity ?? 0,
                sizes: item.sizes ?? [],
                colors: item.colors ?? [],
                images: item.images ?? [],
                active: item.active ?? false,
                deliveryAvailable: item.deliveryAvailable ?? false,
                pickupAtEvent: item.pickupAtEvent ?? true,
              }))}
              eventSlug={row.slug}
              eventTitle={row.title}
              eventStartsAt={row.startsAt.toISOString()}
              eventVenue={[row.venue, row.city].filter(Boolean).join(", ")}
            />
            <VendorSection listings={vendorListingsData} eventId={row.id} eventSlug={row.slug} eventTitle={row.title} isOrganizer={isEventOwner} />
            <MediaSection galleries={[]} eventTitle={row.title} />
          </div>

          <div className="lg:col-span-1 pt-10 lg:pt-6">
            {isPastEvent ? (
              <div className="lg:sticky lg:top-24 rounded-2xl border border-line bg-paper p-7 shadow-sm shadow-ink/[0.04]">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-3 uppercase mb-2">Past event</p>
                <h2 className="text-[18px] font-semibold tracking-tight text-ink">Ticket sales have ended</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                  This event has finished. The summary, reviews, media, and vendor information remain available for reference.
                </p>
              </div>
            ) : (
              <TicketSelector
                eventSlug={row.slug}
                eventTitle={row.title}
                eventStartsAt={row.startsAt}
                eventEndsAt={row.endsAt}
                eventVenue={[row.venue, row.city].filter(Boolean).join(", ")}
                emoji={emoji}
                tiers={tiers}
              />
            )}
          </div>
        </div>
      </div>

      {!isPastEvent && lowestPrice !== null && (
        <MobileBuyBar
          label="Buy tickets"
          primary={formatCurrency(lowestPrice, baseCurrency)}
          secondary="From"
          href="#tickets"
        />
      )}
    </div>
  )
}
