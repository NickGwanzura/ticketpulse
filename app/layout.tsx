import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import "./globals.css"
import Providers from "@/components/layout/Providers"
import TopBar from "@/components/layout/TopBar"
import Navbar, { type NavbarFeaturedItem } from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import CookiesNotice from "@/components/CookiesNotice"
import PwaRegister from "@/components/PwaRegister"
import WhatsAppWidget from "@/components/launch/WhatsAppWidget"
import { getFeaturedEvents } from "@/lib/events"
import { formatDateShort } from "@/lib/utils"
import { clashDisplay, generalSans } from "@/lib/fonts"

const NAV_CATEGORY_EMOJI: Record<string, string> = {
  concert: "🎵",
  marathon: "🏃",
  walkathon: "🚶",
  film: "🎬",
  exhibition: "🏢",
  expedition: "⛰️",
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"),
  title: {
    default: "TicketPulse. Every event. One ticket.",
    template: "%s | TicketPulse",
  },
  description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more, tickets, merch, shuttle, and photo packs in one place.",
  manifest: "/manifest",
  appleWebApp: {
    capable: true,
    title: "TicketPulse",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  openGraph: {
    type: "website",
    locale: "en_ZW",
    siteName: "TicketPulse",
    title: "TicketPulse. Every event. One ticket.",
    description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more, tickets, merch, shuttle, and photo packs in one place.",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TicketPulse. Every event. One ticket.",
    description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more, tickets, merch, shuttle, and photo packs in one place.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  alternates: {
    canonical: "/",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a2540",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const path = h.get("x-pathname") ?? ""
  const bare = path.startsWith("/coming-soon")

  let featured: NavbarFeaturedItem[] = []
  if (!bare) {
    const events = await getFeaturedEvents(2)
    featured = events.map((e) => ({
      slug: e.slug,
      title: e.title,
      emoji: NAV_CATEGORY_EMOJI[e.category.toLowerCase()] ?? "🎫",
      date: `${formatDateShort(e.startsAt)} · ${e.venue}, ${e.city}`,
    }))
  }

  return (
    <html lang="en" className={`${clashDisplay.variable} ${generalSans.variable}`}>
      <body className="font-body bg-paper text-ink antialiased">
        <Providers>
          {!bare && <TopBar />}
          {!bare && <Navbar featured={featured} />}
          <div className={bare ? "" : "min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-9rem)]"}>{children}</div>
          {!bare && <Footer />}
          {!bare && <CookiesNotice />}
          {!bare && <WhatsAppWidget phone="263777816368" label="Support" />}
        </Providers>
        {!bare && <PwaRegister />}
      </body>
    </html>
  )
}
