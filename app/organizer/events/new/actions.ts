"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events } from "@/db/schema"
import { geocodeFromLocation } from "@/lib/geocode"
import { generateUniqueSlug } from "@/lib/slug"

const CreateSchema = z.object({
  title:         z.string().trim().min(1, "Title is required").max(160),
  category:      z.string().trim().min(1, "Category is required").max(60),
  venue:         z.string().trim().min(1, "Venue is required").max(160),
  city:          z.string().trim().min(1, "City is required").max(80),
  country:       z.string().trim().min(1).max(80).default("Zimbabwe"),
  address:       z.string().trim().max(240).optional(),
  description:   z.string().trim().max(4000).optional(),
  startsAt:      z.string().min(1, "Start date and time required"),
  endsAt:        z.string().optional(),
  tags:          z.string().optional(),
  googleMapsUrl: z.string().trim().url("Must be a valid URL").max(500).optional().or(z.literal("")),
  lat:           z.string().trim().optional(),
  lng:           z.string().trim().optional(),
})

export type CreateEventState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null
  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:MM" (no timezone).
  // We treat this as Africa/Harare (CAT, UTC+2) since that's the app's timezone.
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return null
  const [_, year, month, day, hour, minute] = m
  // CAT is UTC+2. Zimbabwe does not observe DST.
  const catOffsetMs = 2 * 60 * 60 * 1000
  const utcMs = Date.UTC(+year, +month - 1, +day, +hour, +minute) - catOffsetMs
  const d = new Date(utcMs)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function createEventAction(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." }
  }
  if (session.user.role !== "organizer" && session.user.role !== "admin") {
    return { ok: false, error: "Only organizers can create events." }
  }

  const raw = {
    title:         formData.get("title")?.toString() ?? "",
    category:      formData.get("category")?.toString() ?? "",
    venue:         formData.get("venue")?.toString() ?? "",
    city:          formData.get("city")?.toString() ?? "",
    country:       formData.get("country")?.toString() || "Zimbabwe",
    address:       formData.get("address")?.toString() ?? undefined,
    description:   formData.get("description")?.toString() ?? undefined,
    startsAt:      formData.get("startsAt")?.toString() ?? "",
    endsAt:        formData.get("endsAt")?.toString() ?? undefined,
    tags:          formData.get("tags")?.toString() ?? undefined,
    googleMapsUrl: formData.get("googleMapsUrl")?.toString() ?? undefined,
    lat:           formData.get("lat")?.toString() ?? undefined,
    lng:           formData.get("lng")?.toString() ?? undefined,
  }

  const parsed = CreateSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }

  const data = parsed.data
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

  const tagList = data.tags
    ? data.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10)
    : []

  const slug = await generateUniqueSlug(data.title)

  // Prefer client-provided coords; fall back to server-side geocode
  let lat: string | null = null
  let lng: string | null = null
  if (
    data.lat && data.lng &&
    !isNaN(parseFloat(data.lat)) &&
    !isNaN(parseFloat(data.lng))
  ) {
    lat = data.lat
    lng = data.lng
  } else {
    const result = await geocodeFromLocation(
      data.venue,
      data.city,
      data.country,
      data.address,
    )
    lat = result.lat?.toString() ?? null
    lng = result.lng?.toString() ?? null
  }

  const [created] = await db
    .insert(events)
    .values({
      organizerId:   session.user.id,
      title:         data.title,
      slug,
      description:   data.description || null,
      category:      data.category,
      status:        "draft",
      venue:         data.venue,
      city:          data.city,
      country:       data.country,
      address:       data.address || null,
      lat,
      lng,
      startsAt,
      endsAt,
      tags:          tagList,
      googleMapsUrl: data.googleMapsUrl || null,
    })
    .returning({ id: events.id })

  if (!created?.id) {
    return { ok: false, error: "Could not create event. Try again." }
  }

  // WhatsApp alert to admin (fire-and-forget).
  const { sendAdminAlert } = await import("@/lib/whatsapp")
  sendAdminAlert(
    `📅 *New event created*\n\nTitle: ${data.title}\nCategory: ${data.category}\nCity: ${data.city}\nStarts: ${startsAt.toLocaleDateString("en-GB")}\n\nView in admin: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/admin/events`,
  ).catch((e) => console.error("[createEvent] admin WhatsApp alert", e))

  revalidatePath("/organizer")
  redirect(`/organizer/events/${created.id}/tiers?created=1`)
}
