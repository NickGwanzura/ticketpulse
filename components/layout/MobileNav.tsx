"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Calendar, ClipboardList, ScanLine, Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ORGANIZER_TABS = [
  { label: "Dashboard", href: "/organizer", icon: LayoutDashboard },
  { label: "Events", href: "/organizer/events", icon: Calendar },
  { label: "Orders", href: "/organizer/orders", icon: ClipboardList },
  { label: "Scanner", href: "/organizer/scan", icon: ScanLine },
  { label: "Payouts", href: "/payouts", icon: Wallet },
]

export default function MobileNav() {
  const pathname = usePathname()

  // Only show on organizer money/workflow routes
  if (!pathname?.startsWith("/organizer") && !pathname?.startsWith("/payouts")) return null

  const isActive = (href: string) => {
    if (href === "/organizer") return pathname === "/organizer"
    return pathname.startsWith(href)
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-paper/95 backdrop-blur-lg border-t border-line safe-area-pb">
      <div className="flex items-center justify-around px-2">
        {ORGANIZER_TABS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors",
                active ? "text-brand-600" : "text-ink-3"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
