import { notFound } from "next/navigation"
import { Calendar, MapPin, Users, Share2, Heart } from "lucide-react"
import MerchSection from "@/components/merch/MerchSection"
import TransportSection from "@/components/transport/TransportSection"
import VendorSection from "@/components/vendors/VendorSection"
import MediaSection from "@/components/media/MediaSection"
import TicketSelector from "@/components/events/TicketSelector"
import MobileBuyBar from "@/components/MobileBuyBar"
import { formatCurrency, formatDate } from "@/lib/utils"
import { auth } from "@/auth"
import { db } from "@/db"
import { events, ticketTiers, users } from "@/db/schema"
import { eq, or } from "drizzle-orm"

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
      startsAt: events.startsAt,
      coverImage: events.coverImage,
      tags: events.tags,
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

  const emoji = CATEGORY_EMOJI[row.category.toLowerCase()] ?? "🎫"
  const baseCurrency = tiers[0]?.currency ?? "USD"
  const lowestPrice = tiers.length ? Math.min(...tiers.map((t) => t.price)) : null

  return (
    <div>
      <div className="relative h-72 md:h-80 bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="absolute inset-0 [background:radial-gradient(800px_circle_at_30%_20%,rgba(255,255,255,0.7),transparent_60%)] pointer-events-none" />
        <span className="text-8xl relative">{emoji}</span>
        <div className="absolute top-5 right-5 flex gap-2">
          <button className="border border-line bg-paper/80 backdrop-blur text-ink-2 rounded-lg p-2.5 hover:text-ink hover:border-line-2 transition-colors">
            <Share2 size={16} />
          </button>
          <button className="border border-line bg-paper/80 backdrop-blur text-ink-2 rounded-lg p-2.5 hover:text-rose-600 hover:border-line-2 transition-colors">
            <Heart size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-10 pb-28 lg:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">{row.category}</p>
              <h1 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink mb-5">{row.title}</h1>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-ink-2 mb-6">
                <span className="flex items-center gap-2"><Calendar size={14} className="text-ink-3" />{formatDate(row.startsAt)}</span>
                <span className="flex items-center gap-2"><MapPin size={14} className="text-ink-3" />{row.venue}, {row.city}</span>
                {row.organizerName && (
                  <span className="flex items-center gap-2"><Users size={14} className="text-ink-3" />Organized by {row.organizerName}</span>
                )}
              </div>
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

            <MerchSection items={[]} eventTitle={row.title} />
            <TransportSection routes={[]} />
            <VendorSection listings={[]} isOrganizer={isOrganizer} />
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
