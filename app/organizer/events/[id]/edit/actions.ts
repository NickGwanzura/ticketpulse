"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, eventStatusEnum } from "@/db/schema"
import { geocodeFromLocation } from "@/lib/geocode"
import { generateUniqueSlug, slugify } from "@/lib/slug"
import { parseHarareDateTimeLocal } from "@/lib/event-schedule"

const STATUS_VALUES = eventStatusEnum.enumValues

const UpdateSchema = z.object({
  id:            z.uuid(),
  title:         z.string().trim().min(1, "Title is required").max(160),
  category:      z.string().trim().min(1).max(60),
  status:        z.enum(STATUS_VALUES),
  venue:         z.string().trim().min(1).max(160),
  city:          z.string().trim().min(1).max(80),
  country:       z.string().trim().min(1).max(80),
  address:       z.string().trim().max(240).optional(),
  description:   z.string().trim().max(4000).optional(),
  startsAt:      z.string().min(1),
  endsAt:        z.string().optional(),
  tags:          z.string().optional(),
  coverImage:    z.string().url().optional().or(z.literal("")),
  lat:           z.string().optional(),
  lng:           z.string().optional(),
  googleMapsUrl: z.string().trim().url("Must be a valid URL").max(500).optional().or(z.literal("")),
  hideOrganizerName: z.string().optional(),
  faq:           z.string().trim().max(8000).optional(),
  promoImages:   z.string().optional(),
})

export type UpdateEventState = {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}

async function requireOwnership(eventId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, redirectTo: "/auth/signin" }
  }
  const [row] = await db
    .select({ id: events.id, organizerId: events.organizerId, slug: events.slug, title: events.title, status: events.status })
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
    id:            formData.get("id")?.toString() ?? "",
    title:         formData.get("title")?.toString() ?? "",
    category:      formData.get("category")?.toString() ?? "",
    status:        formData.get("status")?.toString() ?? "draft",
    venue:         formData.get("venue")?.toString() ?? "",
    city:          formData.get("city")?.toString() ?? "",
    country:       formData.get("country")?.toString() || "Zimbabwe",
    address:       formData.get("address")?.toString() ?? undefined,
    description:   formData.get("description")?.toString() ?? undefined,
    startsAt:      formData.get("startsAt")?.toString() ?? "",
    endsAt:        formData.get("endsAt")?.toString() ?? undefined,
    tags:          formData.get("tags")?.toString() ?? undefined,
    coverImage:    formData.get("coverImage")?.toString() ?? "",
    lat:           formData.get("lat")?.toString() ?? undefined,
    lng:           formData.get("lng")?.toString() ?? undefined,
    googleMapsUrl: formData.get("googleMapsUrl")?.toString() ?? undefined,
    hideOrganizerName: formData.get("hideOrganizerName")?.toString() ?? undefined,
    faq:           formData.get("faq")?.toString() ?? undefined,
    promoImages:   formData.get("promoImages")?.toString() ?? undefined,
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

  // Status changes go through the submit-for-review / admin-approve flow, not this form.
  // Non-admins can't move an event into or out of "published" here — keep whatever it already is.
  const status = guard.session.user.role === "admin" ? data.status : guard.event.status

  const startsAt = parseHarareDateTimeLocal(data.startsAt)
  if (!startsAt) {
    return { ok: false, error: "Invalid start date.", fieldErrors: { startsAt: "Invalid date" } }
  }
  let endsAt: Date | null = null
  if (data.endsAt) {
    endsAt = parseHarareDateTimeLocal(data.endsAt)
    if (!endsAt) {
      return { ok: false, error: "Invalid end date.", fieldErrors: { endsAt: "Invalid date" } }
    }
    if (endsAt <= startsAt) {
      return { ok: false, error: "End must be after start.", fieldErrors: { endsAt: "Must be after start" } }
    }
  }

  // Resolve lat/lng — prefer client-provided (live-geocoded), fall back to server geocode
  let lat: string | null
  let lng: string | null
  if (data.lat && data.lng && !isNaN(parseFloat(data.lat)) && !isNaN(parseFloat(data.lng))) {
    lat = data.lat
    lng = data.lng
  } else {
    const isTBA = (s: string) => s.trim().toLowerCase() === "tba"
    if (isTBA(data.venue) || isTBA(data.city)) {
      lat = null
      lng = null
    } else {
      const result = await geocodeFromLocation(data.venue, data.city, data.country, data.address)
      lat = result.lat?.toString() ?? null
      lng = result.lng?.toString() ?? null
    }
  }

  const tagList = data.tags
    ? data.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= 50).slice(0, 10)
    : []

  // Re-slug if the title changed.
  let slug = guard.event.slug
  if (slugify(data.title) !== slugify(guard.event.title)) {
    slug = await generateUniqueSlug(data.title, { excludeEventId: data.id })
  }

  let promoImagesList: string[] = []
  if (data.promoImages) {
    try {
      const parsed = JSON.parse(data.promoImages)
      if (Array.isArray(parsed)) {
        promoImagesList = parsed.slice(0, 6).filter((v) => typeof v === "string" && /^https?:\/\//.test(v))
      }
    } catch { /* ignore malformed JSON */ }
  }

  await db
    .update(events)
    .set({
      title:         data.title,
      slug,
      category:      data.category,
      status,
      venue:         data.venue,
      city:          data.city,
      country:       data.country,
      address:       data.address || null,
      description:   data.description || null,
      lat:           lat?.toString() ?? null,
      lng:           lng?.toString() ?? null,
      startsAt,
      endsAt,
      tags:          tagList,
      coverImage:    data.coverImage || null,
      googleMapsUrl: data.googleMapsUrl || null,
      hideOrganizerName: data.hideOrganizerName === "on",
      faq:           data.faq || null,
      promoImages:   promoImagesList,
      updatedAt:     new Date(),
    })
    .where(eq(events.id, data.id))

  revalidatePath("/organizer")
  revalidatePath(`/organizer/events/${data.id}/edit`)
  revalidatePath(`/events/${slug}`)

  return { ok: true, message: "Saved." }
}
