import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Help center",
  description: "Find answers about tickets, payments, refunds, transfers, and organizing events on TicketPulse. Live chat available weekdays.",
  alternates: { canonical: "/help" },
  openGraph: {
    title: "TicketPulse Help Center",
    description: "Find answers about tickets, payments, refunds, transfers, and organizing events on TicketPulse. Live chat available weekdays.",
    url: "/help",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TicketPulse Help Center",
    description: "Find answers about tickets, payments, refunds, transfers, and organizing events on TicketPulse. Live chat available weekdays.",
  },
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children
}
