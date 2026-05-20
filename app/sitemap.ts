import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

  // Static routes — add more as the site grows.
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

  return staticRoutes.map((r) => ({
    url: `${baseUrl}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
