import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, ImageIcon } from "lucide-react"

import { db } from "@/db"
import { events, eventGalleries, galleryPhotos } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import GalleryCard from "./GalleryCard"
import NewGalleryPanel from "./NewGalleryPanel"

export const metadata = {
  title: "Photo gallery",
}

type RouteParams = { id: string }

export default async function GalleryPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { id } = await params

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
    })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  const galleries = await db
    .select()
    .from(eventGalleries)
    .where(eq(eventGalleries.eventId, id))
    .orderBy(asc(eventGalleries.createdAt))

  // Fetch photos for all galleries up front. For 99% of events this is small.
  const galleryIds = galleries.map((g) => g.id)
  const photoRows = galleryIds.length
    ? await db
        .select({
          id: galleryPhotos.id,
          galleryId: galleryPhotos.galleryId,
          url: galleryPhotos.url,
          caption: galleryPhotos.caption,
        })
        .from(galleryPhotos)
        .orderBy(asc(galleryPhotos.createdAt))
    : []

  const photosByGallery = new Map<string, typeof photoRows>()
  for (const p of photoRows) {
    if (!galleryIds.includes(p.galleryId)) continue
    const arr = photosByGallery.get(p.galleryId) ?? []
    arr.push(p)
    photosByGallery.set(p.galleryId, arr)
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Photo galleries: ${event.title}`}
        subtitle="Group event photos into packs. Each gallery has its own cover, price, and visibility."
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} /> Back to event
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">

        <NewGalleryPanel eventId={id} />

        {galleries.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="No galleries yet"
            body="Create a gallery above to start uploading event photos."
            variant="card"
          />
        ) : (
          <div className="space-y-5">
            {galleries.map((g) => (
              <GalleryCard
                key={g.id}
                eventId={id}
                gallery={{
                  id: g.id,
                  name: g.name,
                  description: g.description,
                  coverImage: g.coverImage,
                  packPrice: g.packPrice,
                  currency: g.currency,
                  isPublic: g.isPublic,
                  photoCount: g.photoCount,
                }}
                photos={(photosByGallery.get(g.id) ?? []).map((p) => ({
                  id: p.id,
                  url: p.url,
                  caption: p.caption,
                }))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
