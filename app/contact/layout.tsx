import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the TicketPulse team. Live chat, email (hello@ticketpulse.co.zw), or WhatsApp. Replies within 4 hours.",
  alternates: { canonical: "/contact" },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
