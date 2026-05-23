"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutGrid, BarChart3, Wallet, Users, Calendar, Receipt, Ticket, Settings, LogOut, Shield,
} from "lucide-react"

const NAV = [
  { label: "Overview",  href: "/admin",           icon: LayoutGrid },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Payouts",   href: "/admin/payouts",   icon: Wallet },
  { label: "Users",     href: "/admin/users",     icon: Users },
  { label: "Events",    href: "/admin/events",    icon: Calendar },
  { label: "Orders",    href: "/admin/orders",    icon: Receipt },
  { label: "Tickets",   href: "/admin/tickets",   icon: Ticket },
  { label: "Settings",  href: "/admin/settings",  icon: Settings },
] as const

export default function Sidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname()
  const isActive = (href: string) => href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-20 self-start h-[calc(100vh-5rem)] w-[248px] shrink-0 flex-col border-r border-line bg-paper">
        <div className="px-5 py-5 border-b border-line">
          <p className="text-[10.5px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Admin</p>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-navy text-white">
              <Shield size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold tracking-tight text-ink truncate">{name}</p>
              <p className="text-[11.5px] text-ink-3 truncate">{email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                  active
                    ? "bg-paper-2 text-ink font-semibold"
                    : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                <Icon size={15} className={active ? "text-navy" : "text-ink-3"} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 pt-2 pb-4 border-t border-line">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors"
          >
            <LogOut size={15} className="text-ink-3" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile/tablet top tab strip */}
      <div className="lg:hidden sticky top-20 z-30 bg-paper/90 backdrop-blur-xl border-b border-line">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-navy text-white shrink-0">
              <Shield size={14} />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-blue uppercase leading-none">Admin</p>
              <p className="text-[12.5px] font-semibold tracking-tight text-ink truncate mt-0.5">{name}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
        <nav className="flex items-center gap-1 px-3 py-2 overflow-x-auto no-scrollbar">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                  active
                    ? "bg-paper-2 text-ink font-semibold"
                    : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                <Icon size={13} className={active ? "text-navy" : "text-ink-3"} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
