"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Ticket, ImageIcon, ShoppingBag, Store, Activity, Mail, MessageCircle,
  Tag, UserPlus, QrCode, Users, ExternalLink, Settings,
  HelpCircle, Wallet, ScanLine, LayoutDashboard, ChevronLeft,
  BarChart2, Search, Music2, Percent, CalendarDays, Share2, MailOpen,
} from "lucide-react"

type NavItem = { label: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }> }
type NavGroup = { label?: string; items: NavItem[] }

const NAV_GROUPS = (eventId: string): NavGroup[] => [
  {
    items: [
      { label: "Overview", href: `/organizer/events/${eventId}`, icon: LayoutDashboard },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Event details", href: `/organizer/events/${eventId}/edit`, icon: Settings },
      { label: "Tickets",       href: `/organizer/events/${eventId}/tiers`, icon: Ticket },
      { label: "Questions",     href: `/organizer/events/${eventId}/questions`, icon: HelpCircle },
      { label: "Lineup",        href: `/organizer/events/${eventId}/lineup`,    icon: Music2 },
      { label: "Capacity",      href: `/organizer/events/${eventId}/capacity`,  icon: BarChart2 },
      { label: "Live feed",     href: `/organizer/events/${eventId}/live`, icon: Activity },
      { label: "Scanner",       href: "/organizer/scan", icon: ScanLine },
    ],
  },
  {
    label: "Communicate",
    items: [
      { label: "Attendees", href: `/organizer/events/${eventId}/attendees`, icon: Users },
      { label: "Email",     href: `/organizer/events/${eventId}/email`, icon: Mail },
      { label: "WhatsApp",  href: `/organizer/events/${eventId}/whatsapp`, icon: MessageCircle },
      { label: "Promos",    href: `/organizer/events/${eventId}/promos`, icon: Tag },
    ],
  },
  {
    label: "Experience",
    items: [
      { label: "Photo gallery", href: `/organizer/events/${eventId}/gallery`, icon: ImageIcon },
      { label: "Merch",         href: `/organizer/events/${eventId}/merch`, icon: ShoppingBag },
      { label: "Vendors",       href: `/organizer/events/${eventId}/vendors`, icon: Store },
      { label: "Staff",         href: `/organizer/events/${eventId}/staff`, icon: QrCode },
      { label: "Organisers",    href: `/organizer/events/${eventId}/organisers`, icon: UserPlus },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "SEO",             href: `/organizer/events/${eventId}/seo`,             icon: Search },
      { label: "Fee handling",    href: `/organizer/events/${eventId}/platform-fees`,   icon: Percent },
      { label: "Recurring",       href: `/organizer/events/${eventId}/recurring`,       icon: CalendarDays },
      { label: "Affiliates",      href: `/organizer/events/${eventId}/affiliates`,      icon: Share2 },
      { label: "Email templates", href: `/organizer/events/${eventId}/email-templates`, icon: MailOpen },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Payouts", href: "/payouts", icon: Wallet },
    ],
  },
]

// Flat list for mobile tab strip (all items in order)
const NAV_FLAT = (eventId: string): NavItem[] =>
  NAV_GROUPS(eventId).flatMap((g) => g.items)

type Props = {
  eventId: string
  eventSlug: string
  eventTitle: string
  eventStatus: string | null
}

export default function EventSidebar({ eventId, eventSlug, eventTitle, eventStatus }: Props) {
  const pathname = usePathname()
  const groups = NAV_GROUPS(eventId)
  const flat = NAV_FLAT(eventId)
  const isPublished = eventStatus === "published"

  const isActive = (href: string) => {
    if (pathname === href) return true
    if (href.endsWith(`/${eventId}`)) return pathname === href
    return pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex sticky top-24 self-start h-[calc(100vh-6rem)] w-[240px] shrink-0 flex-col bg-[#0a2540]">

        {/* Event context */}
        <div className="px-4 pt-5 pb-3 border-b border-white/10">
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white/40 hover:text-white/70 mb-2 transition-colors"
          >
            <ChevronLeft size={11} /> Dashboard
          </Link>
          <p className="text-[13px] font-semibold text-white leading-snug truncate" title={eventTitle}>
            {eventTitle}
          </p>
          <span className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isPublished
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-amber-400/15 text-amber-300"
          }`}>
            {isPublished ? "Published" : "Draft"}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-white/30">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ label, href, icon: Icon }) => {
                  const active = isActive(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                        active
                          ? "bg-white/10 text-white shadow-sm"
                          : "text-white/55 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      <Icon size={14} className={active ? "text-white" : "text-white/40"} />
                      {label}
                      {active && <span className="ml-auto w-1 h-1 rounded-full bg-white/60" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* View live footer */}
        <div className="px-3 pb-4 pt-2 border-t border-white/10">
          <Link
            href={`/events/${eventSlug}`}
            target="_blank"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ExternalLink size={13} className="text-white/40" />
            {isPublished ? "View live page" : "Preview page"}
          </Link>
        </div>
      </aside>

      {/* ── Mobile tab strip ── */}
      <div className="lg:hidden sticky top-24 z-30 bg-[#0a2540]">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
          <Link
            href="/organizer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors shrink-0"
          >
            <ChevronLeft size={11} /> Dashboard
          </Link>
          <span className="text-white/20 text-[11px]">/</span>
          <p className="text-[12px] font-semibold text-white truncate">{eventTitle}</p>
          {isPublished && (
            <Link
              href={`/events/${eventSlug}`}
              target="_blank"
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:text-white hover:border-white/40 transition-colors shrink-0"
            >
              <ExternalLink size={11} /> Live
            </Link>
          )}
        </div>
        <div className="relative">
          <nav className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar">
            {flat.map(({ label, href, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] whitespace-nowrap transition-colors ${
                    active
                      ? "bg-white/10 text-white font-semibold"
                      : "text-white/50 hover:text-white hover:bg-white/[0.06] font-medium"
                  }`}
                >
                  <Icon size={13} className={active ? "text-white" : "text-white/40"} />
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[#0a2540] to-transparent" />
        </div>
      </div>
    </>
  )
}
