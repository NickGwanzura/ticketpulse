"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/db"
import { events } from "@/db/schema"
import { generateUniqueSlug } from "@/lib/slug"

const CreateSchema = z.object({
  title:       z.string().trim().min(1, "Title is required").max(160),
  category:    z.string().trim().min(1, "Category is required").max(60),
  venue:       z.string().trim().min(1, "Venue is required").max(160),
  city:        z.string().trim().min(1, "City is required").max(80),
  country:     z.string().trim().min(1).max(80).default("Zimbabwe"),
  address:     z.string().trim().max(240).optional(),
  description: z.string().trim().max(4000).optional(),
  startsAt:    z.string().min(1, "Start date and time required"),
  endsAt:      z.string().optional(),
  tags:        z.string().optional(),
})

export type CreateEventState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null
  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:MM" (no timezone).
  const d = new Date(value)
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
    title:       formData.get("title")?.toString() ?? "",
    category:    formData.get("category")?.toString() ?? "",
    venue:       formData.get("venue")?.toString() ?? "",
    city:        formData.get("city")?.toString() ?? "",
    country:     formData.get("country")?.toString() || "Zimbabwe",
    address:     formData.get("address")?.toString() ?? undefined,
    description: formData.get("description")?.toString() ?? undefined,
    startsAt:    formData.get("startsAt")?.toString() ?? "",
    endsAt:      formData.get("endsAt")?.toString() ?? undefined,
    tags:        formData.get("tags")?.toString() ?? undefined,
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

  const [created] = await db
    .insert(events)
    .values({
      organizerId:  session.user.id,
      title:        data.title,
      slug,
      description:  data.description || null,
      category:     data.category,
      status:       "draft",
      venue:        data.venue,
      city:         data.city,
      country:      data.country,
      address:      data.address || null,
      startsAt,
      endsAt,
      tags:         tagList,
    })
    .returning({ id: events.id })

  if (!created?.id) {
    return { ok: false, error: "Could not create event. Try again." }
  }

  revalidatePath("/organizer")
  redirect(`/organizer/events/${created.id}/edit?created=1`)
}
