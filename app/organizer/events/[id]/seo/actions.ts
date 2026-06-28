"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { events } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"

export type UpdateSeoState =
  | { success: true }
  | { error: string }

export async function updateSeoAction(
  eventId: string,
  formData: FormData,
): Promise<UpdateSeoState> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return { error: "Not allowed." }

  const rawTitle = (formData.get("metaTitle")?.toString() ?? "").trim()
  const rawDescription = (formData.get("metaDescription")?.toString() ?? "").trim()

  if (rawTitle.length > 60) {
    return { error: "Meta title must be 60 characters or fewer." }
  }
  if (rawDescription.length > 160) {
    return { error: "Meta description must be 160 characters or fewer." }
  }

  await db
    .update(events)
    .set({
      metaTitle: rawTitle || null,
      metaDescription: rawDescription || null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))

  revalidatePath(`/organizer/events/${eventId}/seo`)

  // Revalidate the public event page — we need the slug for that.
  // Fetch it cheaply after the update.
  const [row] = await db
    .select({ slug: events.slug })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (row?.slug) {
    revalidatePath(`/events/${row.slug}`)
  }

  return { success: true }
}
