import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Help center",
  description: "Find answers about tickets, payments, refunds, transfers, and organizing events on TicketPulse. Live chat available weekdays.",
  alternates: { canonical: "/help" },
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children
}
