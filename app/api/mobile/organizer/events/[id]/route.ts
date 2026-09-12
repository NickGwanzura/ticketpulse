import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { events } from "@/db/schema"
import { authenticateOrganizer, organizerEventScope, privateHeaders } from "@/lib/mobile-organizer"
import { generateUniqueSlug } from "@/lib/slug"

type Context = { params: Promise<{ id: string }> }

const EventInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  category: z.string().trim().min(1, "Category is required").max(60),
  venue: z.string().trim().min(1, "Venue is required").max(160),
  city: z.string().trim().min(1, "City is required").max(80),
  country: z.string().trim().min(1).max(80).default("Zimbabwe"),
  address: z.string().trim().max(240).optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
})

export async function PATCH(request: Request, context: Context) {
  const auth = await authenticateOrganizer(request)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ ok: false, error: "Invalid event ID" }, { status: 400 })

  const parsed = EventInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid event details" }, { status: 400 })
  const data = parsed.data
  if (data.endsAt && data.endsAt <= data.startsAt) {
    return NextResponse.json({ ok: false, error: "End time must be after start time." }, { status: 400 })
  }

  const [current] = await db.select({ id: events.id, title: events.title, slug: events.slug })
    .from(events)
    .where(and(eq(events.id, id), organizerEventScope(auth.userId, auth.role)))
    .limit(1)
  if (!current) return NextResponse.json({ ok: false, error: "Event not found or access unavailable" }, { status: 404 })

  const slug = current.title === data.title ? current.slug : await generateUniqueSlug(data.title, { excludeEventId: id })
  const [updated] = await db.update(events).set({
    title: data.title,
    slug,
    category: data.category,
    venue: data.venue,
    city: data.city,
    country: data.country,
    address: data.address || null,
    description: data.description || null,
    startsAt: data.startsAt,
    endsAt: data.endsAt || null,
    updatedAt: new Date(),
  }).where(eq(events.id, id)).returning()
  if (!updated) return NextResponse.json({ ok: false, error: "Could not save event. Try again." }, { status: 500 })
  return NextResponse.json({ ok: true, event: {
    id: updated.id, title: updated.title, slug: updated.slug, status: updated.status,
    category: updated.category, venue: updated.venue, city: updated.city, country: updated.country,
    address: updated.address, description: updated.description,
    startsAt: updated.startsAt?.toISOString() ?? null, endsAt: updated.endsAt?.toISOString() ?? null,
  } }, { headers: privateHeaders })
}

export async function POST(request: Request, context: Context) {
  const auth = await authenticateOrganizer(request)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ ok: false, error: "Invalid event ID" }, { status: 400 })
  const parsed = z.object({ action: z.literal("submit_review") }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid event action" }, { status: 400 })
  const [current] = await db.select({ id: events.id, status: events.status }).from(events)
    .where(and(eq(events.id, id), organizerEventScope(auth.userId, auth.role))).limit(1)
  if (!current) return NextResponse.json({ ok: false, error: "Event not found or access unavailable" }, { status: 404 })
  if (auth.role !== "admin" && !["draft", "cancelled"].includes(current.status ?? "")) {
    return NextResponse.json({ ok: false, error: "Only draft events can be submitted for review." }, { status: 409 })
  }
  const [updated] = await db.update(events).set({ status: "pending_review", updatedAt: new Date() }).where(eq(events.id, id)).returning({ id: events.id, status: events.status })
  return NextResponse.json({ ok: true, event: updated, message: "Event submitted for review." }, { headers: privateHeaders })
}
