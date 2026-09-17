"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { ArrowRight, LayoutDashboard, LogOut, Menu, Plus, ShoppingBag, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useCart } from "@/lib/cart-context"
import { getDashboardPathForRole } from "@/lib/role-routes"

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
  const canCreateEvent = session?.user?.role === "organizer" || session?.user?.role === "admin"

  return (
    <header
      className={isHome
        ? "absolute left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 rounded-[1.35rem] border border-black/10 bg-white/90 shadow-[0_18px_55px_-24px_rgba(10,37,64,0.34)] backdrop-blur-xl"
        : `sticky top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-line bg-paper/92 shadow-[0_10px_30px_-24px_rgba(10,37,64,0.34)] backdrop-blur-xl"
            : "border-transparent bg-paper/82 backdrop-blur-xl"
        }`}
    >
      {scrolled && !isHome && (
        <span className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" aria-hidden />
      )}

      <nav className={`mx-auto flex max-w-7xl items-center gap-4 px-4 md:px-6 ${isHome ? "h-16 md:h-[72px]" : "h-16 md:h-[72px]"}`}>
        <Link href="/" className="mr-auto inline-flex items-center gap-2.5" aria-label="TicketPulse home">
          <img src="/ticketpulse-logo.svg" alt="TicketPulse" className="h-12 w-12 md:h-14 md:w-14" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${
                  active ? "bg-accent/10 text-accent" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
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
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-ink transition hover:border-accent/30 hover:text-accent"
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
              {canCreateEvent && (
                <Link
                  href="/organizer/events/new"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-[14px] font-bold text-white shadow-sm shadow-accent/20 transition hover:bg-accent-hover active:scale-[0.99]"
                >
                  <Plus size={15} /> Create Event
                </Link>
              )}
              <Link
                href={dashboardHref}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[14px] font-semibold text-ink transition hover:border-accent/30 hover:text-accent"
              >
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              <button
                onClick={() => signOut()}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-semibold text-white transition hover:bg-accent"
              >
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="rounded-full px-4 py-2 text-[14px] font-semibold text-ink-2 transition hover:text-ink">
                Login
              </Link>
              <Link
                href="/auth/signup?role=organizer"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-bold text-white shadow-sm shadow-accent/20 transition hover:bg-accent-hover active:scale-[0.99]"
              >
                Get Started <ArrowRight size={14} />
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
            <div className="grid grid-cols-2 gap-2 pt-2">
              {session ? (
                <>
                  {canCreateEvent && (
                    <Link href="/organizer/events/new" className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white">
                      <Plus size={15} /> Create Event
                    </Link>
                  )}
                  <Link href={dashboardHref} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-[14px] font-semibold text-ink">
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                  <button onClick={() => signOut()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-[14px] font-semibold text-white">
                    <LogOut size={15} /> Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/signin" className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-3 text-[14px] font-semibold text-ink">
                    Login
                  </Link>
                  <Link href="/auth/signup?role=organizer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white">
                    Get Started <ArrowRight size={14} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
