"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Ticket,
  ImageIcon,
  ShoppingBag,
  Store,
  Activity,
  Mail,
  MessageCircle,
  Tag,
  UserPlus,
  QrCode,
  Users,
  ExternalLink,
  Settings,
  ArrowLeft,
  HelpCircle,
  Wallet,
} from "lucide-react"

const NAV = (eventId: string) =>
  [
    { label: "Overview", href: `/organizer/events/${eventId}`, icon: Activity },
    { label: "Event details", href: `/organizer/events/${eventId}/edit`, icon: Settings },
    { label: "Tickets", href: `/organizer/events/${eventId}/tiers`, icon: Ticket },
    { label: "Questions", href: `/organizer/events/${eventId}/questions`, icon: HelpCircle },
    { label: "Photo gallery", href: `/organizer/events/${eventId}/gallery`, icon: ImageIcon },
    { label: "Merch", href: `/organizer/events/${eventId}/merch`, icon: ShoppingBag },
    { label: "Vendors", href: `/organizer/events/${eventId}/vendors`, icon: Store },
    { label: "Live", href: `/organizer/events/${eventId}/live`, icon: Activity },
    { label: "Email", href: `/organizer/events/${eventId}/email`, icon: Mail },
    { label: "WhatsApp", href: `/organizer/events/${eventId}/whatsapp`, icon: MessageCircle },
    { label: "Promos", href: `/organizer/events/${eventId}/promos`, icon: Tag },
    { label: "Organisers", href: `/organizer/events/${eventId}/organisers`, icon: UserPlus },
    { label: "Staff", href: `/organizer/events/${eventId}/staff`, icon: QrCode },
    { label: "Attendees", href: `/organizer/events/${eventId}/attendees`, icon: Users },
    { label: "Payouts", href: "/payouts", icon: Wallet },
  ] as const

type Props = {
  eventId: string
  eventSlug: string
  eventTitle: string
  eventStatus: string | null
}

export default function EventSidebar({ eventId, eventSlug, eventTitle, eventStatus }: Props) {
  const pathname = usePathname()
  const navItems = NAV(eventId)
  const isPublished = eventStatus === "published"

  const isActive = (href: string) => {
    // Exact match for overview (no trailing slash), prefix match for others
    if (pathname === href) return true
    // Don't let /edit match /eventId itself
    if (href.endsWith(`/${eventId}`)) return pathname === href
    return pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-24 self-start h-[calc(100vh-6rem)] w-[232px] shrink-0 flex-col border-r border-line bg-paper">
        {/* Logo */}
        <div className="px-4 pt-4 pb-2">
          <Link href="/organizer" className="inline-block">
            <img src="/ticketpulse-logo.svg" alt="TicketPulse" className="h-10 w-auto" />
          </Link>
        </div>
        {/* Event header */}
        <div className="px-4 py-3 border-b border-line">
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink mb-1.5 transition-colors"
          >
            <ArrowLeft size={11} />
            Dashboard
          </Link>
          <p className="text-[13px] font-semibold text-ink truncate" title={eventTitle}>
            {eventTitle}
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                  active
                    ? "bg-paper-2 text-ink font-semibold"
                    : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                <Icon size={15} className={active ? "text-navy" : "text-ink-3 shrink-0"} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* View live */}
        {isPublished && (
          <div className="px-2 pt-2 pb-3 border-t border-line">
            <Link
              href={`/events/${eventSlug}`}
              target="_blank"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-navy hover:bg-brand-50 transition-colors"
            >
              <ExternalLink size={15} className="text-navy shrink-0" />
              View live
            </Link>
          </div>
        )}
      </aside>

      {/* Mobile/tablet top tab strip */}
      <div className="lg:hidden sticky top-24 z-30 bg-paper/90 backdrop-blur-xl border-b border-line">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line">
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink transition-colors shrink-0"
          >
            <ArrowLeft size={11} />
            Dashboard
          </Link>
          <span className="text-ink-3 text-[11px]">/</span>
          <p className="text-[12px] font-semibold text-ink truncate">{eventTitle}</p>
          {isPublished && (
            <Link
              href={`/events/${eventSlug}`}
              target="_blank"
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-navy hover:bg-brand-50 transition-colors shrink-0"
            >
              <ExternalLink size={11} />
              Live
            </Link>
          )}
        </div>
        <nav className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] whitespace-nowrap transition-colors ${
                  active
                    ? "bg-paper-2 text-ink font-semibold"
                    : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                <Icon size={13} className={active ? "text-navy" : "text-ink-3 shrink-0"} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
