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
import CommandPalette from "@/components/command-palette/CommandPalette"
import MobileNav from "@/components/layout/MobileNav"
import { getFeaturedEvents } from "@/lib/events"
import { formatDateShort } from "@/lib/utils"
import { grift, mona } from "@/lib/fonts"
import { THEME_CHROME_COLOR, THEME_INIT_SCRIPT } from "@/lib/theme"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"),
  title: {
    default: "TicketPulse. Every event. One ticket.",
    template: "%s | TicketPulse",
  },
  description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more, with tickets, merch, and photo packs in one place.",
  manifest: "/manifest",
  icons: {
    icon: [{ url: "/favicon.jpg", type: "image/jpeg", sizes: "3000x3000" }],
    shortcut: "/favicon.jpg",
    apple: "/apple-icon",
  },
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
    description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more, with tickets, merch, and photo packs in one place.",
    url: "/",
    images: [{ url: "/favicon.jpg", width: 3000, height: 3000, alt: "TicketPulse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TicketPulse. Every event. One ticket.",
    description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more, with tickets, merch, and photo packs in one place.",
    images: [{ url: "/favicon.jpg", width: 3000, height: 3000, alt: "TicketPulse" }],
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-ZW": "/",
      "x-default": "/",
    },
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Both schemes are supported; the head script (lib/theme.ts) narrows this to
  // the resolved in-app theme before first paint, and ThemeSync keeps it current.
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_CHROME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_CHROME_COLOR.dark },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const path = h.get("x-pathname") ?? ""
  const bare = path.startsWith("/coming-soon")
  const isHome = path === "/"
  const isCheckout = path.startsWith("/checkout")

  let featured: NavbarFeaturedItem[] = []
  if (!bare) {
    try {
      const events = await getFeaturedEvents(2)
      featured = events.map((e) => ({
        slug: e.slug,
        title: e.title,
        category: e.category.toLowerCase(),
        date: `${formatDateShort(e.startsAt)} · ${e.venue}, ${e.city}`,
      }))
    } catch (e) {
      // DB or network error — show empty navbar rather than crashing the entire app.
      console.error("[layout] failed to load featured events", e)
    }
  }

  return (
    // suppressHydrationWarning: the head script sets data-theme / data-theme-pref /
    // style.colorScheme on <html> before React hydrates, by design.
    <html lang="en" className={`${mona.variable} ${grift.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-body bg-paper text-ink antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "TicketPulse",
              url: process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech",
              logo: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/ticketpulse-logo.svg`,
              sameAs: ["https://www.instagram.com/ticketpulsezw"],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Harare",
                addressCountry: "ZW",
              },
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Customer Service",
                telephone: "+263-788-689-923",
                email: "nick@ticketpulse.tech",
                url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/contact`,
                availableLanguage: "English",
              },
              description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more.",
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "TicketPulse",
              url: process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ticketpulse.tech"}/events?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <Providers>
          {!bare && !isHome && !isCheckout && <TopBar />}
          {!bare && !isCheckout && <Navbar featured={featured} />}
          <div className={bare ? "" : "min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-9rem)]"}>{children}</div>
          {!bare && !isCheckout && <Footer />}
          {!bare && <CookiesNotice />}
          {!bare && !isCheckout && <WhatsAppWidget phone="263788689923" label="Support" />}
          <CommandPalette />
          <MobileNav />
        </Providers>
        {!bare && <PwaRegister />}
      </body>
    </html>
  )
}
