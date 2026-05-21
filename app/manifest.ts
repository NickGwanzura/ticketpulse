import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TicketPulse",
    short_name: "TicketPulse",
    description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f7fa",
    theme_color: "#0a2540",
    categories: ["events", "tickets", "entertainment", "shopping"],
    lang: "en",
    scope: "/",
    id: "/",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/pwa-icon?size=192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [],
    prefer_related_applications: false,
  }
}
