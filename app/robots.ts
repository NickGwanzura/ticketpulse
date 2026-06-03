import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard/",
        "/account/",
        "/admin/",
        "/organizer/",
        "/orders/",
        "/cart/",
        "/checkout/",
        "/payouts/",
        "/vendors/dashboard/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
