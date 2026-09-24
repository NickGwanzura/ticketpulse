"use client"

import Link from "next/link"
import Logo from "@/components/ui/Logo"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { ArrowRight, ChevronDown, LayoutDashboard, LogOut, Menu, ShoppingBag, UserRound, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useCart } from "@/lib/cart-context"
import { getDashboardPathForRole, isAdminRole } from "@/lib/role-routes"

export interface NavbarFeaturedItem {
  slug: string
  title: string
  category: string
  date: string
}

const LINKS = [
  { label: "Events", href: "/events" },
  { label: "Pricing", href: "/pricing" },
  { label: "Help Center", href: "/help" },
]

export default function Navbar(_props: { featured?: NavbarFeaturedItem[] }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isHome = pathname === "/"
  const { totalCount, ready } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    queueMicrotask(() => setMenuOpen(false))
  }, [pathname])

  const dashboardHref = getDashboardPathForRole(session?.user?.role)
  const role = session?.user?.role
  const workspaceLabel = role === "organizer" || role === "vendor" || isAdminRole(role)
    ? "Workspace"
    : null
  const accountName = session?.user?.name?.trim() || session?.user?.email?.split("@")[0] || "Account"
  const accountInitial = accountName.charAt(0).toUpperCase()

  return (
    <header
      className={isHome
        ? "absolute inset-x-0 top-0 z-50 border-b border-line bg-paper text-ink"
        : `sticky top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-line bg-paper/92 shadow-[0_10px_30px_-24px_rgba(10,37,64,0.34)] backdrop-blur-xl"
            : "border-transparent bg-paper/82 backdrop-blur-xl"
        }`}
    >
      {scrolled && !isHome && (
        <span className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" aria-hidden />
      )}

      <nav className={`mx-auto flex max-w-7xl items-center gap-4 px-5 md:px-8 ${isHome ? "h-[72px] md:h-[82px]" : "h-16 md:h-[72px]"}`}>
        <Link href="/" className="mr-auto inline-flex items-center gap-2.5" aria-label="TicketPulse home">
          <Logo className="h-14 w-14 md:h-16 md:w-16" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors ${
                  active ? "bg-accent/10 text-brand-700" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/cart"
            aria-label={`Cart, ${totalCount} item${totalCount === 1 ? "" : "s"}`}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-accent/30 hover:text-accent"
          >
            <ShoppingBag size={16} />
            {ready && totalCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white ring-2 ring-paper">
                {totalCount > 99 ? "99+" : totalCount}
              </span>
            )}
          </Link>

          {session ? (
            <>
              {workspaceLabel && (
                <Link
                  href={dashboardHref}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-navy px-4 text-[11px] font-bold text-white shadow-sm transition hover:bg-accent active:scale-[0.99]"
                >
                  <LayoutDashboard size={15} /> {workspaceLabel}
                </Link>
              )}
              <details className="group relative">
                <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink transition hover:border-accent/30 hover:text-accent [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-[11px] font-bold text-accent">{accountInitial}</span>
                  <span className="max-w-28 truncate">Account</span>
                  <ChevronDown size={14} className="text-ink-3 transition group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 top-full z-[70] mt-2 w-60 rounded-2xl border border-line bg-white p-2 shadow-[0_18px_55px_-22px_rgba(10,37,64,0.3)]">
                  <div className="border-b border-line px-3 py-2.5">
                    <p className="truncate text-[13px] font-semibold text-ink">{accountName}</p>
                    {session.user.email && <p className="mt-0.5 truncate text-[11px] text-ink-3">{session.user.email}</p>}
                  </div>
                  {role !== "vendor" && (
                    <Link href="/orders" className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12px] font-medium text-ink-2 transition hover:bg-paper-2 hover:text-ink">
                      <ShoppingBag size={15} /> My tickets
                    </Link>
                  )}
                  <Link href="/account" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12px] font-medium text-ink-2 transition hover:bg-paper-2 hover:text-ink">
                    <UserRound size={15} /> Account settings
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium text-ink-2 transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/how-it-works" className="rounded-full px-3 py-2 text-[11px] font-semibold text-ink-2 transition hover:text-accent">
                For organisers
              </Link>
              <Link href="/auth/signin" className="rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink transition hover:text-accent">
                Sign in
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Link
            href="/cart"
            aria-label={`Cart, ${totalCount} item${totalCount === 1 ? "" : "s"}`}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink"
          >
            <ShoppingBag size={18} />
            {ready && totalCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white ring-2 ring-paper">
                {totalCount > 99 ? "99+" : totalCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-paper-2"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-line bg-paper md:hidden">
          <div className="mx-auto space-y-2 px-5 py-4">
            {LINKS.map(({ label, href }) => (
              <Link key={href} href={href} className="block rounded-xl px-3 py-3 text-[15px] font-semibold text-ink hover:bg-paper-2">
                {label}
              </Link>
            ))}
            <div className="mt-2 border-t border-line pt-3">
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
                {session ? "Your account" : "Explore TicketPulse"}
              </p>
              <div className="grid grid-cols-2 gap-2">
              {session ? (
                <>
                  {workspaceLabel && (
                    <Link href={dashboardHref} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-[14px] font-bold text-white">
                      <LayoutDashboard size={16} /> {workspaceLabel}
                    </Link>
                  )}
                  {role !== "vendor" && (
                    <Link href="/orders" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-[13px] font-semibold text-ink">
                      <ShoppingBag size={15} /> My tickets
                    </Link>
                  )}
                  <Link href="/account" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-[13px] font-semibold text-ink">
                    <UserRound size={15} /> Account
                  </Link>
                  <button onClick={() => signOut()} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-paper-2 px-4 py-3 text-[13px] font-semibold text-ink-2">
                    <LogOut size={15} /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/how-it-works" className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-50 px-4 py-3 text-[14px] font-bold text-accent">
                    For event organisers <ArrowRight size={15} />
                  </Link>
                  <Link href="/auth/signin" className="col-span-2 inline-flex items-center justify-center rounded-xl border border-line px-4 py-3 text-[14px] font-semibold text-ink">
                    Sign in
                  </Link>
                </>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
