import type { Metadata, Viewport } from "next"
import { Google_Sans } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"
import Providers from "@/components/layout/Providers"
import TopBar from "@/components/layout/TopBar"
import Navbar, { type NavbarFeaturedItem } from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"
import CookiesNotice from "@/components/CookiesNotice"
import { getFeaturedEvents } from "@/lib/events"
import { formatDateShort } from "@/lib/utils"

const NAV_CATEGORY_EMOJI: Record<string, string> = {
  concert: "🎵",
  marathon: "🏃",
  walkathon: "🚶",
  film: "🎬",
  exhibition: "🏢",
  expedition: "⛰️",
}

const googleSans = Google_Sans({
  subsets: ["latin"],
  variable: "--font-google-sans",
  display: "swap",
  axes: ["GRAD", "opsz"],
})

export const metadata: Metadata = {
  title: "TicketPulse. Every event. One ticket.",
  description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more, tickets, merch, shuttle, and photo packs in one place.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
    <html lang="en" className={googleSans.variable}>
      <body className="font-sans bg-paper text-ink antialiased">
        <Providers>
          {!bare && <TopBar />}
          {!bare && <Navbar featured={featured} />}
          <div className={bare ? "" : "min-h-[calc(100vh-4rem)]"}>{children}</div>
          {!bare && <Footer />}
          {!bare && <CookiesNotice />}
        </Providers>
      </body>
    </html>
  )
}
