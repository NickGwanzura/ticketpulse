import type { MetadataRoute } from "next"
import { db } from "@/db"
import { events } from "@/db/schema"
import { eq } from "drizzle-orm"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketplse.tech"

  // Static routes
  const staticRoutes = [
    { path: "",                    priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/events",             priority: 0.9, changeFrequency: "daily"  as const },
    { path: "/vendors",            priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/how-it-works",       priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/pricing",            priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/about",              priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/contact",            priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/help",               priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/help/vendors",       priority: 0.4, changeFrequency: "monthly" as const },
    { path: "/media",              priority: 0.4, changeFrequency: "weekly" as const },
    { path: "/legal/terms",        priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/legal/privacy",      priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/legal/cookies",      priority: 0.3, changeFrequency: "yearly" as const },
  ]

  // Dynamic event pages — graceful fallback when DB is unreachable at build time
  let eventRoutes: MetadataRoute.Sitemap = []
  try {
    const eventRows = await db
      .select({ slug: events.slug, updatedAt: events.updatedAt })
      .from(events)
      .where(eq(events.status, "published"))

    eventRoutes = eventRows.map((e) => ({
      url: `${baseUrl}/events/${e.slug}`,
      lastModified: e.updatedAt ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  } catch {
    // Build-time DB may not be available (e.g. Railway build without DB access).
    // Static routes are still emitted so the build doesn't fail.
  }

  return [
    ...staticRoutes.map((r) => ({
      url: `${baseUrl}${r.path}`,
      lastModified: new Date(),
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...eventRoutes,
  ]
}
