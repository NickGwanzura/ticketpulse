"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq, and, sql } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, eventGalleries, galleryPhotos } from "@/db/schema"
import { deleteByPublicUrl } from "@/lib/r2"
import { requireEventAccessForUser } from "@/lib/event-access"

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function requireEventOwnership(eventId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, redirectTo: "/auth/signin" }
  }
  const [row] = await db
    .select({ id: events.id, organizerId: events.organizerId, slug: events.slug })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!row) return { ok: false as const, redirectTo: "/organizer" }
  // Shared rule: owner, invited co-organiser, or admin; frozen accounts blocked.
  if (!(await requireEventAccessForUser(row.id, session.user)).allowed) {
    return { ok: false as const, redirectTo: "/organizer" }
  }
  return { ok: true as const, session, event: row }
}

async function requireGalleryOwnership(galleryId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, redirectTo: "/auth/signin" }
  }
  const [row] = await db
    .select({
      galleryId: eventGalleries.id,
      eventId: eventGalleries.eventId,
      organizerId: events.organizerId,
    })
    .from(eventGalleries)
    .innerJoin(events, eq(eventGalleries.eventId, events.id))
    .where(eq(eventGalleries.id, galleryId))
    .limit(1)
  if (!row) return { ok: false as const, redirectTo: "/organizer" }
  // Shared rule: owner, invited co-organiser, or admin; frozen accounts blocked.
  if (!(await requireEventAccessForUser(row.eventId, session.user)).allowed) {
    return { ok: false as const, redirectTo: "/organizer" }
  }
  return { ok: true as const, session, gallery: row }
}

// ─── Create / update gallery ─────────────────────────────────────────────────

const GallerySchema = z.object({
  eventId:     z.uuid(),
  galleryId:   z.uuid().optional(),
  name:        z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional(),
  coverImage:  z.string().url().optional().or(z.literal("")),
  packPrice:   z.string().optional(),
  currency:    z.string().trim().min(1).max(8).default("USD"),
  isPublic:    z.string().optional(),
})

export type GalleryFormState = {
  ok: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

export async function saveGalleryAction(
  _prev: GalleryFormState,
  formData: FormData,
): Promise<GalleryFormState> {
  const raw = {
    eventId:     formData.get("eventId")?.toString() ?? "",
    galleryId:   formData.get("galleryId")?.toString() || undefined,
    name:        formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? undefined,
    coverImage:  formData.get("coverImage")?.toString() ?? "",
    packPrice:   formData.get("packPrice")?.toString() ?? undefined,
    currency:    formData.get("currency")?.toString() || "USD",
    isPublic:    formData.get("isPublic")?.toString() ?? undefined,
  }

  const parsed = GallerySchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }
  const data = parsed.data

  const guard = await requireEventOwnership(data.eventId)
  if (!guard.ok) return { ok: false, error: "Not allowed." }

  const packPrice = data.packPrice && data.packPrice.trim() !== ""
    ? Number.parseFloat(data.packPrice)
    : null
  if (packPrice !== null && (Number.isNaN(packPrice) || packPrice < 0)) {
    return { ok: false, error: "Invalid pack price.", fieldErrors: { packPrice: "Must be a positive number" } }
  }

  const isPublic = data.isPublic === "on" || data.isPublic === "true"

  if (data.galleryId) {
    // Re-verify ownership of this gallery row.
    const ownerCheck = await requireGalleryOwnership(data.galleryId)
    if (!ownerCheck.ok || ownerCheck.gallery.eventId !== data.eventId) {
      return { ok: false, error: "Not allowed." }
    }
    await db
      .update(eventGalleries)
      .set({
        name:        data.name,
        description: data.description || null,
        coverImage:  data.coverImage || null,
        packPrice:   packPrice !== null ? packPrice.toFixed(2) : null,
        currency:    data.currency,
        isPublic,
        publishedAt: isPublic ? new Date() : null,
      })
      .where(eq(eventGalleries.id, data.galleryId))
  } else {
    await db.insert(eventGalleries).values({
      eventId:     data.eventId,
      name:        data.name,
      description: data.description || null,
      coverImage:  data.coverImage || null,
      packPrice:   packPrice !== null ? packPrice.toFixed(2) : null,
      currency:    data.currency,
      isPublic,
      publishedAt: isPublic ? new Date() : null,
    })
  }

  revalidatePath(`/organizer/events/${data.eventId}/gallery`)
  return { ok: true, message: "Saved." }
}

export async function deleteGalleryAction(formData: FormData): Promise<void> {
  const galleryId = formData.get("galleryId")?.toString()
  const eventId = formData.get("eventId")?.toString()
  if (!galleryId || !eventId) return

  const guard = await requireGalleryOwnership(galleryId)
  if (!guard.ok) redirect(guard.redirectTo)

  await db.delete(eventGalleries).where(eq(eventGalleries.id, galleryId))
  revalidatePath(`/organizer/events/${eventId}/gallery`)
}

// ─── Photos ──────────────────────────────────────────────────────────────────

export async function addGalleryPhotosAction(
  galleryId: string,
  urls: string[],
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const guard = await requireGalleryOwnership(galleryId)
  if (!guard.ok) return { ok: false, inserted: 0, error: "Not allowed." }

  const cleaned = (urls ?? [])
    .filter((u) => typeof u === "string" && u.startsWith("http"))
    .slice(0, 50)

  if (cleaned.length === 0) {
    return { ok: false, inserted: 0, error: "No photos provided." }
  }

  // Insert photos and update count atomically
  const inserted = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(galleryPhotos)
      .values(cleaned.map((url) => ({ galleryId, url })))
      .returning({ id: galleryPhotos.id })

    await tx
      .update(eventGalleries)
      .set({
        photoCount: sql`${eventGalleries.photoCount} + ${rows.length}`,
      })
      .where(eq(eventGalleries.id, galleryId))

    return rows
  })

  revalidatePath(`/organizer/events/${guard.gallery.eventId}/gallery`)
  return { ok: true, inserted: inserted.length }
}

export async function deleteGalleryPhotoAction(formData: FormData): Promise<void> {
  const photoId = formData.get("photoId")?.toString()
  const galleryId = formData.get("galleryId")?.toString()
  const eventId = formData.get("eventId")?.toString()
  if (!photoId || !galleryId || !eventId) return

  const guard = await requireGalleryOwnership(galleryId)
  if (!guard.ok) redirect(guard.redirectTo)

  // Delete photo and update count atomically
  const deleted = await db.transaction(async (tx) => {
    const rows = await tx
      .delete(galleryPhotos)
      .where(and(eq(galleryPhotos.id, photoId), eq(galleryPhotos.galleryId, galleryId)))
      .returning({ id: galleryPhotos.id, url: galleryPhotos.url })

    if (rows.length > 0) {
      await tx
        .update(eventGalleries)
        .set({ photoCount: sql`GREATEST(${eventGalleries.photoCount} - 1, 0)` })
        .where(eq(eventGalleries.id, galleryId))
    }

    return rows
  })

  // Best-effort R2 cleanup; never blocks the user-facing flow.
  if (deleted.length > 0) {
    deleteByPublicUrl(deleted[0].url).catch((err) =>
      console.error("[gallery] r2 cleanup failed", err),
    )
  }

  revalidatePath(`/organizer/events/${eventId}/gallery`)
}
