import { notFound } from "next/navigation"
import { Calendar, MapPin, Users, Heart, Clock } from "lucide-react"
import MerchSection from "@/components/merch/MerchSection"
import TransportSection from "@/components/transport/TransportSection"
import VendorSection from "@/components/vendors/VendorSection"
import MediaSection from "@/components/media/MediaSection"
import TicketSelector from "@/components/events/TicketSelector"
import VenueMap from "@/components/events/VenueMap"
import ShareEventButton from "@/components/events/ShareEventButton"
import MobileBuyBar from "@/components/MobileBuyBar"
import { db } from "@/db"
import { events, ticketTiers, users, vendorListings, vendors } from "@/db/schema"
import { eq, or, and } from "drizzle-orm"
import { auth } from "@/auth"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { VendorListing } from "@/types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CATEGORY_EMOJI: Record<string, string> = {
  marathon: "🏃",
  walkathon: "🚶",
  concert: "🎵",
  film: "🎬",
  exhibition: "🏢",
  expedition: "⛰️",
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const isOrganizer = session?.user.role === "organizer"

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
      organizerName: users.name,
      organizerImage: users.image,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(where)
    .limit(1)

  if (!row) notFound()

  const tierRows = await db
    .select()
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, row.id))

  const tiers = tierRows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    price: Number(t.price),
    currency: t.currency ?? "USD",
    totalQuantity: t.totalQuantity,
    soldQuantity: t.soldQuantity ?? 0,
    maxPerOrder: t.maxPerOrder ?? 10,
  }))

  // ── Vendor listings (addons available to ticket buyers) ────────────
  const vendorListingRows = await db
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
    .where(and(
      eq(vendorListings.eventId, row.id),
      eq(vendorListings.available, true),
    ))

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
    organizer: row.organizerName
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
      url: `https://ticketpulse.tech/events/${row.slug}`,
    },
  }

  // Format time range for display
  const timeDisplay = (() => {
    const start = row.startsAt
    const end = row.endsAt
    if (!end) return formatDate(start)
    // Same day: "Wed 21 May 2026, 14:00 – 18:00"
    const isSameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate()
    if (isSameDay) {
      const datePart = formatDate(start, { dateStyle: "medium" })
      const startTime = formatDate(start, { timeStyle: "short" })
      const endTime = formatDate(end, { timeStyle: "short" })
      return `${datePart}, ${startTime} – ${endTime}`
    }
    return `${formatDate(start)} – ${formatDate(end)}`
  })()

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero banner ── */}
      {row.coverImage ? (
        <div className="relative w-full h-[40vh] md:h-[55vh] overflow-hidden bg-ink">
          <img
            src={row.coverImage}
            alt=""
            className="w-full h-full object-contain bg-ink"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>
      ) : (
        <div className="relative w-full h-48 md:h-64 bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 [background:radial-gradient(800px_circle_at_30%_20%,rgba(255,255,255,0.7),transparent_60%)] pointer-events-none" />
          <span className="text-8xl relative">{emoji}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-5 md:px-8 pb-28 lg:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            {/* ── Title & meta ── */}
            <div className="-mt-6 relative z-10">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">{row.category}</p>
              <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink mb-5">{row.title}</h1>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink-2 mb-6">
                <span className="flex items-center gap-2"><Calendar size={14} className="text-ink-3" />{timeDisplay}</span>
                {row.endsAt && (
                  <span className="flex items-center gap-2"><Clock size={14} className="text-ink-3" />Ends {formatDate(row.endsAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                )}
                <span className="flex items-center gap-2"><MapPin size={14} className="text-ink-3" />{row.venue}, {row.city}</span>
                {row.organizerName && (
                  <span className="flex items-center gap-2"><Users size={14} className="text-ink-3" />Organized by {row.organizerName}</span>
                )}
              </div>
              {/* Share / Save */}
              <div className="flex gap-2">
                <ShareEventButton eventTitle={row.title} eventDescription={row.description} />
                <button
                  type="button"
                  aria-label="Save to favourites"
                  className="border border-line bg-paper text-ink-2 rounded-lg p-2.5 hover:text-rose-600 hover:border-line-2 transition-colors"
                >
                  <Heart size={15} />
                </button>
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

            {/* ── Venue map ── */}
            {row.lat != null && row.lng != null && (
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

            <MerchSection items={[]} eventTitle={row.title} />
            <TransportSection routes={[]} />
            <VendorSection listings={vendorListingsData} eventId={row.id} eventSlug={row.slug} eventTitle={row.title} isOrganizer={isOrganizer} />
            <MediaSection galleries={[]} eventTitle={row.title} />
          </div>

          <div className="lg:col-span-1">
            <TicketSelector
              eventSlug={row.slug}
              eventTitle={row.title}
              emoji={emoji}
              tiers={tiers}
            />
          </div>
        </div>
      </div>

      {lowestPrice !== null && (
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
