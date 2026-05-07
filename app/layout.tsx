import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"
import Providers from "@/components/layout/Providers"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "TicketPulse. Every event. One ticket.",
  description: "Zimbabwe's premier event ticketing platform. Concerts, marathons, premieres and more, tickets, merch, shuttle, and photo packs in one place.",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers()
  const path = h.get("x-pathname") ?? ""
  const bare = path.startsWith("/coming-soon")

  return (
    <html lang="en" className={geist.variable}>
      <body className="font-sans bg-paper text-ink antialiased">
        <Providers>
          {!bare && <Navbar />}
          <div className={bare ? "" : "min-h-[calc(100vh-4rem)]"}>{children}</div>
          {!bare && <Footer />}
        </Providers>
      </body>
    </html>
  )
}
