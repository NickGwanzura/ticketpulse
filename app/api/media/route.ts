import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { eventGalleries, galleryPhotos, events } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/auth"
import { z } from "zod"

const PostSchema = z.object({
  eventId: z.uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  packPrice: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  isPublic: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get("eventId")
  const galleryId = searchParams.get("galleryId")

  if (galleryId) {
    const photos = await db
      .select()
      .from(galleryPhotos)
      .where(eq(galleryPhotos.galleryId, galleryId))

    return NextResponse.json({ photos })
  }

  if (!eventId) {
    return NextResponse.json({ error: "eventId or galleryId required" }, { status: 400 })
  }

  const galleries = await db
    .select()
    .from(eventGalleries)
    .where(and(eq(eventGalleries.eventId, eventId), eq(eventGalleries.isPublic, true)))

  return NextResponse.json({ galleries })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = PostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 })
  }
  const { eventId, name, description, packPrice, currency, isPublic } = parsed.data

  const [event] = await db
    .select({ organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, eventId))
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }
  if (event.organizerId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [gallery] = await db
    .insert(eventGalleries)
    .values({
      eventId,
      photographerId: session.user.id,
      name,
      description,
      packPrice: packPrice ? String(packPrice) : null,
      currency: currency ?? "USD",
      isPublic: isPublic ?? true,
    })
    .returning()

  return NextResponse.json({ gallery }, { status: 201 })
}
