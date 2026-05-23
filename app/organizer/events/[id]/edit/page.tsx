import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { db } from "@/db"
import { events, ticketTiers } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EditEventForm from "./EditEventForm"

export const metadata = {
  title: "Edit event",
}

type RouteParams = { id: string }

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [row] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!row) notFound()

  const tiers = await db
    .select({
      id: ticketTiers.id,
      name: ticketTiers.name,
      price: ticketTiers.price,
      currency: ticketTiers.currency,
      totalQuantity: ticketTiers.totalQuantity,
      soldQuantity: ticketTiers.soldQuantity,
      description: ticketTiers.description,
    })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, id))
    .orderBy(asc(ticketTiers.createdAt))

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={row.title || "Untitled event"}
        subtitle="Edit the basics, upload a cover image, and manage gallery and merch."
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} /> Back to event
          </Link>
        }
      />

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-4">
        <div className="rounded-2xl border border-line bg-paper p-6 md:p-8 tp-fade-up-1">
          <EditEventForm
            event={{
              id: row.id,
              title: row.title,
              description: row.description,
              category: row.category,
              status: (row.status ?? "draft") as "draft" | "published" | "sold_out" | "cancelled" | "completed",
              venue: row.venue,
              city: row.city,
              country: row.country,
              address: row.address,
              lat: row.lat,
              lng: row.lng,
              startsAt: row.startsAt,
              endsAt: row.endsAt,
              coverImage: row.coverImage,
              tags: row.tags ?? [],
              googleMapsUrl: row.googleMapsUrl,
            }}
            tiers={tiers}
            showCreatedToast={sp.created === "1"}
          />
        </div>
      </div>
    </div>
  )
}
