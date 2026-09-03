import "server-only"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, eventOrganisers } from "@/db/schema"
import { eq, and } from "drizzle-orm"

export type EventAccess =
  | { allowed: false; redirectTo: string }
  | { allowed: true; role: "owner" | "editor"; userId: string; eventId: string }

/**
 * Checks whether the current user can access (read or write) the given event.
 *
 * - **owner** — the event's `organizerId` matches the current user, or the user
 *   is an admin. Full access.
 * - **editor** — the user was invited as an event organiser. Restricted access
 *   (cannot delete the event, change payout details, or remove the owner).
 *
 * Redirects to sign-in if unauthenticated, or to /organizer if the user has
 * no relation to the event.
 */
export async function requireEventAccess(eventId: string): Promise<EventAccess> {
  const session = await auth()
  if (!session?.user?.id) {
    return { allowed: false, redirectTo: `/auth/signin?callbackUrl=/organizer/events/${eventId}/edit` }
  }

  return requireEventAccessForUser(eventId, session.user)
}

/** Server-only: identity must come from a verified session or bearer token. */
export async function requireEventAccessForUser(
  eventId: string,
  user: { id: string; role?: string | null },
): Promise<EventAccess> {
  const [event] = await db
    .select({ id: events.id, organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!event) {
    return { allowed: false, redirectTo: "/organizer" }
  }

  // Owner or admin — full access
  if (event.organizerId === user.id) {
    return { allowed: true, role: "owner", userId: user.id, eventId }
  }

  if (user.role === "admin") {
    return { allowed: true, role: "owner", userId: user.id, eventId }
  }

  // Check if the user is an invited organiser for this event
  const [invited] = await db
    .select({ id: eventOrganisers.id })
    .from(eventOrganisers)
    .where(
      and(
        eq(eventOrganisers.eventId, eventId),
        eq(eventOrganisers.userId, user.id),
      ),
    )
    .limit(1)

  if (invited) {
    return { allowed: true, role: "editor", userId: user.id, eventId }
  }

  return { allowed: false, redirectTo: "/organizer" }
}

/**
 * Quick guard that returns the session + event slug for pages that only the
 * event *owner* (not an invited editor) should access (e.g. delete, payout,
 * invites management).
 *
 * Editors get redirected to /organizer.
 */
export async function requireOwnerAccess(eventId: string) {
  const access = await requireEventAccess(eventId)
  if (!access.allowed) return { ok: false as const, redirectTo: access.redirectTo }
  if (access.role !== "owner") return { ok: false as const, redirectTo: "/organizer" }
  return { ok: true as const, userId: access.userId, eventId }
}
