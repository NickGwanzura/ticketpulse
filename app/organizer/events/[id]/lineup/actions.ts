"use server"

import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"

import { db } from "@/db"
import { eventLineup } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import { redirect } from "next/navigation"

function lineupPath(eventId: string) {
  return `/organizer/events/${eventId}/lineup`
}

function normalizeSocialUrl(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const handle = raw.replace(/^@/, "")
  if (/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return `https://www.instagram.com/${handle}/`
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase())) {
      const profile = url.pathname.split("/").filter(Boolean)[0]
      if (!profile || !/^[a-zA-Z0-9._]{1,30}$/.test(profile)) return null
      return `https://www.instagram.com/${profile}/`
    }
    return url.toString()
  } catch {
    return null
  }
}

export async function addLineupMemberAction(
  eventId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return { ok: false, error: "Not allowed." }

  const name = formData.get("name")?.toString().trim()
  if (!name) return { ok: false, error: "Name is required." }

  const role = formData.get("role")?.toString().trim() || null
  const bio = formData.get("bio")?.toString().trim() || null
  const imageUrl = formData.get("imageUrl")?.toString().trim() || null
  const rawSocialUrl = formData.get("socialUrl")?.toString()
  const socialUrl = normalizeSocialUrl(rawSocialUrl)
  if (rawSocialUrl?.trim() && !socialUrl) return { ok: false, error: "Enter an Instagram handle or a valid profile URL." }

  // Get next display order
  const existing = await db
    .select({ displayOrder: eventLineup.displayOrder })
    .from(eventLineup)
    .where(eq(eventLineup.eventId, eventId))

  const maxOrder = existing.reduce((max, row) => Math.max(max, row.displayOrder ?? 0), -1)

  await db.insert(eventLineup).values({
    eventId,
    name,
    role,
    bio,
    imageUrl,
    socialUrl,
    displayOrder: maxOrder + 1,
  })

  revalidatePath(lineupPath(eventId))
  return { ok: true }
}

export async function updateLineupMemberAction(
  id: string,
  eventId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return { ok: false, error: "Not allowed." }

  const name = formData.get("name")?.toString().trim()
  if (!name) return { ok: false, error: "Name is required." }

  const role = formData.get("role")?.toString().trim() || null
  const bio = formData.get("bio")?.toString().trim() || null
  const imageUrl = formData.get("imageUrl")?.toString().trim() || null
  const rawSocialUrl = formData.get("socialUrl")?.toString()
  const socialUrl = normalizeSocialUrl(rawSocialUrl)
  if (rawSocialUrl?.trim() && !socialUrl) return { ok: false, error: "Enter an Instagram handle or a valid profile URL." }

  await db
    .update(eventLineup)
    .set({ name, role, bio, imageUrl, socialUrl })
    .where(and(eq(eventLineup.id, id), eq(eventLineup.eventId, eventId)))

  revalidatePath(lineupPath(eventId))
  return { ok: true }
}

export async function deleteLineupMemberAction(
  id: string,
  eventId: string,
): Promise<void> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) redirect(access.redirectTo)

  await db
    .delete(eventLineup)
    .where(and(eq(eventLineup.id, id), eq(eventLineup.eventId, eventId)))

  revalidatePath(lineupPath(eventId))
}

export async function reorderLineupAction(
  eventId: string,
  orderedIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return { ok: false, error: "Not allowed." }

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(eventLineup)
        .set({ displayOrder: i })
        .where(
          and(
            eq(eventLineup.id, orderedIds[i]),
            eq(eventLineup.eventId, eventId),
          ),
        )
    }
  })

  revalidatePath(lineupPath(eventId))
  return { ok: true }
}
