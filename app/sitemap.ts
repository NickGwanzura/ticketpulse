import type { MetadataRoute } from "next"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm"

// Sitemap metadata routes are cached by default. Read the event database at
// request time so a build without DATABASE_URL cannot freeze out event URLs.
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech").replace(/\/+$/, "")

  // Keep this list to canonical, indexable destinations. Redirects and
  // noindex pages (for example /about and /media) should not be submitted.
  const staticRoutes = [
    "",
    "/events",
    "/vendors",
    "/how-it-works",
    "/pricing",
    "/contact",
    "/help",
    "/help/organizers",
    "/help/vendors",
    "/legal/terms",
    "/legal/privacy",
    "/legal/cookies",
  ]

  // Dynamic public event pages. Keep completed/cancelled event URLs available
  // as useful archives; draft and pending-review events are not public targets.
  let eventRoutes: MetadataRoute.Sitemap = []
  try {
    const eventRows = await db
      .select({ slug: events.slug, updatedAt: events.updatedAt })
      .from(events)
      .where(inArray(events.status, ["published", "sold_out", "cancelled", "completed"]))

    eventRoutes = eventRows.map((e) => ({
      url: `${baseUrl}/events/${e.slug}`,
      ...(e.updatedAt ? { lastModified: e.updatedAt } : {}),
    }))
  } catch {
    // Keep the static sitemap available during deployments without DB access.
  }

  // Public organizer profiles are useful landing pages only when they have an
  // upcoming published event to show; avoid submitting empty profile pages.
  let organizerRoutes: MetadataRoute.Sitemap = []
  try {
    const organizerRows = await db
      .selectDistinct({ slug: users.organizerSlug, updatedAt: users.updatedAt })
      .from(users)
      .innerJoin(events, eq(events.organizerId, users.id))
      .where(and(
        eq(users.role, "organizer"),
        isNotNull(users.organizerSlug),
        eq(events.status, "published"),
        gte(events.startsAt, new Date()),
      ))

    organizerRoutes = organizerRows.flatMap((organizer) => organizer.slug ? [{
      url: `${baseUrl}/o/${encodeURIComponent(organizer.slug)}`,
      ...(organizer.updatedAt ? { lastModified: organizer.updatedAt } : {}),
    }] : [])
  } catch {
    // Organizer URLs are optional; event and static URLs remain in the sitemap.
  }

  return [
    ...staticRoutes.map((path) => ({ url: `${baseUrl}${path}` })),
    ...eventRoutes,
    ...organizerRoutes,
  ]
}
