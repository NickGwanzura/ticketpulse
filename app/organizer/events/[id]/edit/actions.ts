"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, eventStatusEnum } from "@/db/schema"
import { geocodeFromLocation } from "@/lib/geocode"
import { generateUniqueSlug, slugify } from "@/lib/slug"

const STATUS_VALUES = eventStatusEnum.enumValues

const UpdateSchema = z.object({
  id:          z.uuid(),
  title:       z.string().trim().min(1, "Title is required").max(160),
  category:    z.string().trim().min(1).max(60),
  status:      z.enum(STATUS_VALUES),
  venue:       z.string().trim().min(1).max(160),
  city:        z.string().trim().min(1).max(80),
  country:     z.string().trim().min(1).max(80),
  address:     z.string().trim().max(240).optional(),
  description: z.string().trim().max(4000).optional(),
  startsAt:    z.string().min(1),
  endsAt:      z.string().optional(),
  tags:        z.string().optional(),
  coverImage:  z.string().url().optional().or(z.literal("")),
})

export type UpdateEventState = {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

async function requireOwnership(eventId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, redirectTo: "/auth/signin" }
  }
  const [row] = await db
    .select({ id: events.id, organizerId: events.organizerId, slug: events.slug, title: events.title })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!row) return { ok: false as const, redirectTo: "/organizer" }
  if (row.organizerId !== session.user.id && session.user.role !== "admin") {
    return { ok: false as const, redirectTo: "/organizer" }
  }
  return { ok: true as const, session, event: row }
}

export async function updateEventAction(
  _prev: UpdateEventState,
  formData: FormData,
): Promise<UpdateEventState> {
  const raw = {
    id:          formData.get("id")?.toString() ?? "",
    title:       formData.get("title")?.toString() ?? "",
    category:    formData.get("category")?.toString() ?? "",
    status:      formData.get("status")?.toString() ?? "draft",
    venue:       formData.get("venue")?.toString() ?? "",
    city:        formData.get("city")?.toString() ?? "",
    country:     formData.get("country")?.toString() || "Zimbabwe",
    address:     formData.get("address")?.toString() ?? undefined,
    description: formData.get("description")?.toString() ?? undefined,
    startsAt:    formData.get("startsAt")?.toString() ?? "",
    endsAt:      formData.get("endsAt")?.toString() ?? undefined,
    tags:        formData.get("tags")?.toString() ?? undefined,
    coverImage:  formData.get("coverImage")?.toString() ?? "",
  }

  const parsed = UpdateSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }

  const data = parsed.data

  const guard = await requireOwnership(data.id)
  if (!guard.ok) {
    return { ok: false, error: "Not allowed." }
  }

  const startsAt = parseDateTimeLocal(data.startsAt)
  if (!startsAt) {
    return { ok: false, error: "Invalid start date.", fieldErrors: { startsAt: "Invalid date" } }
  }
  let endsAt: Date | null = null
  if (data.endsAt) {
    endsAt = parseDateTimeLocal(data.endsAt)
    if (!endsAt) {
      return { ok: false, error: "Invalid end date.", fieldErrors: { endsAt: "Invalid date" } }
    }
    if (endsAt <= startsAt) {
      return { ok: false, error: "End must be after start.", fieldErrors: { endsAt: "Must be after start" } }
    }
  }

  // Auto-geocode from the venue/address/city/country
  const { lat, lng } = await geocodeFromLocation(
    data.venue,
    data.city,
    data.country,
    data.address,
  )

  const tagList = data.tags
    ? data.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10)
    : []

  // Re-slug if the title changed.
  let slug = guard.event.slug
  if (slugify(data.title) !== slugify(guard.event.title)) {
    slug = await generateUniqueSlug(data.title, { excludeEventId: data.id })
  }

  await db
    .update(events)
    .set({
      title:       data.title,
      slug,
      category:    data.category,
      status:      data.status,
      venue:       data.venue,
      city:        data.city,
      country:     data.country,
      address:     data.address || null,
      description: data.description || null,
      lat:         lat?.toString() ?? null,
      lng:         lng?.toString() ?? null,
      startsAt,
      endsAt,
      tags:         tagList,
      coverImage:  data.coverImage || null,
      updatedAt:   new Date(),
    })
    .where(eq(events.id, data.id))

  revalidatePath("/organizer")
  revalidatePath(`/organizer/events/${data.id}/edit`)
  revalidatePath(`/events/${slug}`)

  return { ok: true, message: "Saved." }
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const id = formData.get("id")?.toString()
  if (!id) return

  const guard = await requireOwnership(id)
  if (!guard.ok) {
    redirect(guard.redirectTo)
  }

  await db.delete(events).where(eq(events.id, id))
  revalidatePath("/organizer")
  redirect("/organizer")
}
