import "server-only"
import { eq, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, eventOrganisers, users } from "@/db/schema"
import { authenticateRequest } from "@/lib/mobile-auth"

export async function authenticateOrganizer(request: Request) {
  const identity = await authenticateRequest(request)
  if (!identity.ok) return identity
  // Read the current role so revoking organizer access takes effect immediately.
  const [user] = await db.select({ role: users.role }).from(users)
    .where(eq(users.id, identity.userId)).limit(1)
  if (!user || (user.role !== "organizer" && user.role !== "admin")) {
    return { ok: false as const, status: 403, error: "Organizer access required" }
  }
  return { ...identity, role: user.role }
}

export function organizerEventScope(userId: string, role: string) {
  if (role === "admin") return undefined
  return or(
    eq(events.organizerId, userId),
    sql`EXISTS (SELECT 1 FROM ${eventOrganisers} WHERE ${eventOrganisers.eventId} = ${events.id} AND ${eventOrganisers.userId} = ${userId})`,
  )
}

export const privateHeaders = { "Cache-Control": "private, no-store" }
