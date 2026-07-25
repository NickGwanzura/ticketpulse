"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutGrid, BarChart3, Wallet, Users, Calendar, Receipt, Settings,
  LogOut, Shield, Megaphone, Activity, GitCompareArrows, Star, Bus, CreditCard,
  PieChart, Store, Contact, History,
} from "lucide-react"
import NotificationBell from "@/components/notifications/NotificationBell"
import ThemeToggle from "@/components/ui/ThemeToggle"

type NavItem = { label: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }>; badgeKey?: string }
type NavGroup = { label?: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Overview", href: "/admin", icon: LayoutGrid },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Communications", href: "/admin/communications", icon: Megaphone },
      { label: "Payments",       href: "/admin/payments",       icon: CreditCard },
      { label: "Velocity",       href: "/admin/velocity",       icon: Activity },
      { label: "Reconciliation", href: "/admin/reconciliation", icon: GitCompareArrows },
    ],
  },
  {
    label: "Data",
    items: [
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Key Stats", href: "/admin/key-stats", icon: PieChart },
      { label: "Users",     href: "/admin/users",     icon: Users },
      { label: "Customers", href: "/admin/customers", icon: Contact },
      { label: "Events",    href: "/admin/events",    icon: Calendar, badgeKey: "pendingEvents" },
      { label: "Orders",    href: "/admin/orders",    icon: Receipt },
      { label: "Reviews",   href: "/admin/reviews",   icon: Star },
      { label: "Vendors",   href: "/admin/vendors",   icon: Store, badgeKey: "pendingVendors" },
      { label: "Transport", href: "/admin/transport", icon: Bus, badgeKey: "pendingOperators" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payouts", href: "/admin/payouts", icon: Wallet },
      { label: "Organizer fees", href: "/admin/organizer-fees", icon: CreditCard },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Audit log", href: "/admin/audit-log", icon: History },
    ],
  },
]

const NAV_FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

export default function Sidebar({
  name,
  email,
  pendingEventCount = 0,
  pendingVendorCount = 0,
  pendingOperatorCount = 0,
}: {
  name: string
  email: string
  pendingEventCount?: number
  pendingVendorCount?: number
  pendingOperatorCount?: number
}) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const badgeValue = (key?: string): number | undefined => {
    if (key === "pendingEvents") return pendingEventCount
    if (key === "pendingVendors") return pendingVendorCount
    if (key === "pendingOperators") return pendingOperatorCount
    return undefined
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex sticky top-24 self-start h-[calc(100vh-6rem)] w-[240px] shrink-0 flex-col bg-[#0a2540]">

        {/* Admin identity */}
        <div className="px-4 pt-5 pb-4 border-b border-white/10">
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-white/30 mb-2">Admin</p>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-white/10 text-white text-[12px] font-bold shrink-0">
              {initials || <Shield size={14} />}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{name}</p>
              <p className="text-[11px] text-white/40 truncate">{email}</p>
            </div>
            <div className="ml-auto shrink-0">
              <NotificationBell />
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-white/30">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ label, href, icon: Icon, badgeKey }) => {
                  const active = isActive(href)
                  const badge = badgeValue(badgeKey)
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
                      {!!badge && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-[10px] font-bold text-[#0a2540]">
                          {badge}
                        </span>
                      )}
                      {active && !badge && <span className="ml-auto w-1 h-1 rounded-full bg-white/60" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-4 pt-2 border-t border-white/10 flex items-center gap-1">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <LogOut size={14} className="text-white/30" /> Sign out
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* ── Mobile tab strip ── */}
      <div className="lg:hidden sticky top-24 z-30 bg-[#0a2540]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-white/10 text-white text-[11px] font-bold shrink-0">
              {initials || <Shield size={12} />}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-white/30 leading-none">Admin</p>
              <p className="text-[13px] font-semibold text-white truncate mt-0.5">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-medium text-white/60 hover:text-white hover:border-white/40 transition-colors"
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
        <nav className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar">
          {NAV_FLAT.map(({ label, href, icon: Icon, badgeKey }) => {
            const active = isActive(href)
            const badge = badgeValue(badgeKey)
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] whitespace-nowrap transition-colors ${
                  active
                    ? "bg-white/10 text-white font-semibold"
                    : "text-white/50 hover:text-white hover:bg-white/[0.06] font-medium"
                }`}
              >
                <Icon size={13} className={active ? "text-white" : "text-white/40"} />
                {label}
                {!!badge && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-[9px] font-bold text-[#0a2540]">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
