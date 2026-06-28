"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { db } from "@/db"
import { events } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"

export async function updateAbsorbFeeAction(
  eventId: string,
  absorb: boolean,
): Promise<{ success: boolean; error?: string }> {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) redirect(access.redirectTo)

  try {
    await db
      .update(events)
      .set({ absorbFee: absorb })
      .where(eq(events.id, eventId))

    revalidatePath(`/organizer/events/${eventId}/platform-fees`)
    return { success: true }
  } catch {
    return { success: false, error: "Failed to update fee setting. Please try again." }
  }
}
