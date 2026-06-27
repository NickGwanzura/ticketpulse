import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Calendar, CheckCircle2, DollarSign, HelpCircle, MapPin, Star, Ticket, Users, Wallet } from "lucide-react"

// ISR: re-generate this page at most every 30 seconds.
// Cuts DB load by ~95% for the most-hit public pages while
// keeping ticket counts reasonably fresh.
export const revalidate = 30
export const dynamicParams = true

import MerchSection from "@/components/merch/MerchSection"
import VendorSection from "@/components/vendors/VendorSection"
import MediaSection from "@/components/media/MediaSection"
import TicketSelector from "@/components/events/TicketSelector"
import VenueMap from "@/components/events/VenueMap"
import ShareEventButton from "@/components/events/ShareEventButton"
import SaveFavoriteButton from "@/components/events/SaveFavoriteButton"
import ReviewHighlights from "@/components/reviews/ReviewHighlights"
import MobileBuyBar from "@/components/MobileBuyBar"
import { db } from "@/db"
import { events, orders, reviews, ticketTiers, tickets, users, vendorListings, vendors } from "@/db/schema"
import { and, desc, eq, or, sql } from "drizzle-orm"
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

  const [tierRows, vendorListingRows, reviewRows] = await Promise.all([
    db.select().from(ticketTiers).where(eq(ticketTiers.eventId, row.id)),
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
        <div className="relative w-full h-[32vh] md:h-[44vh] overflow-hidden bg-ink">
          <img
            src={row.coverImage}
            alt={`${row.title} event at ${row.venue}, ${row.city}`}
            className="w-full h-full object-cover bg-ink"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            {/* ── Category & title ── */}
            <div className="pt-6 md:pt-8">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-3">{row.category}</p>
              <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">{row.title}</h1>
            </div>

            {/* ── Meta & actions ── */}
            <div>
              <div className="grid max-w-2xl gap-3 text-ink-2 mb-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue ring-1 ring-blue/10">
                    <Calendar size={14} />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Date &amp; time</p>
                    <p className="mt-0.5 text-[14px] font-medium text-ink-2">{timeDisplay}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-200/60">
                    <MapPin size={14} />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Venue</p>
                    <p className="mt-0.5 text-[14px] font-medium text-ink-2">
                      {row.venue.trim().toLowerCase() === "tba" || row.city.trim().toLowerCase() === "tba"
                        ? "Location TBA"
                        : `${row.venue}, ${row.city}`}
                    </p>
                  </div>
                </div>
                {row.organizerName && !row.hideOrganizerName && (
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700 ring-1 ring-green-200/60">
                      <Users size={14} />
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Organizer</p>
                      <p className="mt-0.5 text-[14px] font-medium text-ink-2">{row.organizerName}</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Share / Save */}
              <div className="flex gap-2">
                <ShareEventButton eventTitle={row.title} eventDescription={row.description} />
                <SaveFavoriteButton eventId={row.id} />
              </div>
            </div>

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

            <MerchSection items={[]} eventTitle={row.title} />
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
