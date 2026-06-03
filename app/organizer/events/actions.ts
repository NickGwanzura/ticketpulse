"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { events, ticketTiers } from "@/db/schema"
import { requireOwnerAccess } from "@/lib/event-access"

export async function publishOrganizerEventAction(eventId: string) {
  const access = await requireOwnerAccess(eventId)
  if (!access.ok) redirect(access.redirectTo)

  const [event] = await db
    .select({
      id: events.id,
      slug: events.slug,
      status: events.status,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!event) redirect("/organizer")
  if (event.status === "published") redirect(`/organizer/events/${eventId}?published=already`)
  if (event.status === "cancelled" || event.status === "completed") {
    redirect(`/organizer/events/${eventId}?publishError=locked`)
  }

  const [tierCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, eventId))

  if ((tierCount?.count ?? 0) < 1) {
    redirect(`/organizer/events/${eventId}/tiers?error=missing_tiers`)
  }

  await db
    .update(events)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(events.id, eventId))

  revalidatePath("/events")
  revalidatePath("/organizer")
  revalidatePath(`/organizer/events/${eventId}`)
  revalidatePath(`/organizer/events/${eventId}/edit`)
  revalidatePath(`/organizer/events/${eventId}/tiers`)
  revalidatePath(`/events/${event.slug}`)

  redirect(`/organizer/events/${eventId}?published=1`)
}
