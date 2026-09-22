import "server-only"

import { db } from "@/db"
import { events, organizerLifecycleEvents } from "@/db/schema"
import { log } from "@/lib/logger"
import { eq } from "drizzle-orm"

export type OrganizerLifecycleStep =
  | "SIGNUP_COMPLETED"
  | "EMAIL_VERIFIED"
  | "PROFILE_COMPLETED"
  | "ORGANIZER_APPROVED"
  | "EVENT_CREATED"
  | "TICKET_TIER_ADDED"
  | "EVENT_SUBMITTED"
  | "EVENT_PUBLISHED"
  | "FIRST_SALE"

export async function trackOrganizerLifecycle(input: {
  step: OrganizerLifecycleStep
  organizerId: string
  dedupeKey: string
  eventId?: string | null
  source?: string | null
  metadata?: Record<string, unknown> | null
}) {
  try {
    await db
      .insert(organizerLifecycleEvents)
      .values({
        organizerId: input.organizerId,
        eventId: input.eventId ?? null,
        step: input.step,
        dedupeKey: input.dedupeKey,
        source: input.source ?? null,
        metadata: input.metadata ?? null,
      })
      .onConflictDoNothing({ target: organizerLifecycleEvents.dedupeKey })
  } catch (error) {
    // Product analytics must never break the organizer's task.
    log.warn("organizer lifecycle tracking failed", {
      step: input.step,
      organizerId: input.organizerId,
      error: String(error),
    })
  }
}

export async function trackOrganizerFirstSale(eventId: string, orderId: string) {
  try {
    const [event] = await db
      .select({ organizerId: events.organizerId })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)
    if (!event) return

    await trackOrganizerLifecycle({
      step: "FIRST_SALE",
      organizerId: event.organizerId,
      eventId,
      dedupeKey: `organizer:${event.organizerId}:first-sale`,
      source: "ticket_delivery",
      metadata: { orderId },
    })
  } catch (error) {
    log.warn("first sale lifecycle tracking failed", { eventId, orderId, error: String(error) })
  }
}
