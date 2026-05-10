"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq, and, sql } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, eventGalleries, galleryPhotos } from "@/db/schema"
import { deleteByPublicUrl } from "@/lib/r2"

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
  if (row.organizerId !== session.user.id && session.user.role !== "admin") {
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
  if (row.organizerId !== session.user.id && session.user.role !== "admin") {
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

  // Atomic-ish: insert rows then bump the count by the number actually inserted.
  // Drizzle neon-http doesn't support transactions, but the count update is
  // expressed as `photoCount + N` so concurrent inserts stay correct.
  const inserted = await db
    .insert(galleryPhotos)
    .values(cleaned.map((url) => ({ galleryId, url })))
    .returning({ id: galleryPhotos.id })

  await db
    .update(eventGalleries)
    .set({
      photoCount: sql`${eventGalleries.photoCount} + ${inserted.length}`,
    })
    .where(eq(eventGalleries.id, galleryId))

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

  // Delete the row first and capture its public URL so we can also drop the
  // underlying R2 object. The row is source of truth — if R2 cleanup fails,
  // we still want the photo gone from the gallery view.
  const deleted = await db
    .delete(galleryPhotos)
    .where(and(eq(galleryPhotos.id, photoId), eq(galleryPhotos.galleryId, galleryId)))
    .returning({ id: galleryPhotos.id, url: galleryPhotos.url })

  if (deleted.length > 0) {
    await db
      .update(eventGalleries)
      .set({ photoCount: sql`GREATEST(${eventGalleries.photoCount} - 1, 0)` })
      .where(eq(eventGalleries.id, galleryId))

    // Best-effort R2 cleanup; never blocks the user-facing flow.
    deleteByPublicUrl(deleted[0].url).catch((err) =>
      console.error("[gallery] r2 cleanup failed", err),
    )
  }

  revalidatePath(`/organizer/events/${eventId}/gallery`)
}
