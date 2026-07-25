"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Receipt, QrCode, Wallet } from "lucide-react"

type NavItem = { label: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }> }

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/organizer", icon: LayoutGrid },
  { label: "Orders", href: "/organizer/orders", icon: Receipt },
  { label: "Scan", href: "/organizer/scan", icon: QrCode },
  { label: "Payouts", href: "/payouts", icon: Wallet },
]

/**
 * Persistent nav for the top-level organiser area. Before this, /organizer,
 * /organizer/orders and /organizer/scan each rendered their own header with
 * no shared way to move between them — an organiser managing more than one
 * thing had no orientation except the browser back button. Per-event pages
 * already have EventSidebar; this is the equivalent one level up.
 */
export default function OrganizerTopNav() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === "/organizer" ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <nav className="sticky top-0 z-40 bg-[#0a2540] border-b border-white/10">
      <div className="max-w-7xl mx-auto px-5 md:px-8 flex items-center gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? "border-white text-white"
                  : "border-transparent text-white/60 hover:text-white/90"
              }`}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
