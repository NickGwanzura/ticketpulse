"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  Menu, X, LogOut, LayoutDashboard, ChevronDown, ShoppingBag, Search,
  Music, Trophy, Footprints, Film, Building2, Mountain, ArrowRight, ArrowUpRight,
  CalendarCog, Store, Shield,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useCart } from "@/lib/cart-context"

interface NavCategory {
  label: string
  value: string
  desc: string
  icon: typeof Music
  accent: string
  ring: string
}

const CATEGORIES: NavCategory[] = [
  { label: "Concerts",    value: "concert",    desc: "Live music & festivals", icon: Music,      accent: "text-violet-700",  ring: "ring-violet-200/60" },
  { label: "Marathons",   value: "marathon",   desc: "Road races & timed runs", icon: Trophy,    accent: "text-sky-700",     ring: "ring-sky-200/60" },
  { label: "Walkathons",  value: "walkathon",  desc: "Family walks & charity",  icon: Footprints, accent: "text-green-700", ring: "ring-green-200/60" },
  { label: "Film",        value: "film",       desc: "Premieres & screenings",  icon: Film,       accent: "text-amber-700",   ring: "ring-amber-200/60" },
  { label: "Exhibitions", value: "exhibition", desc: "Expos, fairs, trade",     icon: Building2,  accent: "text-indigo-700",  ring: "ring-indigo-200/60" },
  { label: "Expeditions", value: "expedition", desc: "Outdoor & wilderness",    icon: Mountain,   accent: "text-lime-700",    ring: "ring-lime-200/60" },
]

export interface NavbarFeaturedItem {
  slug: string
  title: string
  emoji: string
  date: string
}

const TOP_LINKS: { label: string; href: string }[] = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Vendors",      href: "/vendors" },
  { label: "Pricing",      href: "/pricing" },
  { label: "About",        href: "/about" },
]

export default function Navbar({ featured = [] }: { featured?: NavbarFeaturedItem[] }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { totalCount, ready } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const eventsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    queueMicrotask(() => { setMenuOpen(false); setProfileOpen(false); setEventsOpen(false) })
  }, [pathname])

  // Close events menu on outside click
  useEffect(() => {
    if (!eventsOpen) return
    const onClick = (e: MouseEvent) => {
      if (eventsRef.current && !eventsRef.current.contains(e.target as Node)) {
        setEventsOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEventsOpen(false) }
    window.addEventListener("mousedown", onClick)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onClick)
      window.removeEventListener("keydown", onKey)
    }
  }, [eventsOpen])

  const eventsActive = pathname === "/events" || pathname.startsWith("/events/")
  const isDashboardRoute = pathname.startsWith("/organizer") || pathname.startsWith("/admin") || pathname.startsWith("/dashboard")

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-paper/85 backdrop-blur-xl border-b border-line shadow-[0_1px_0_rgba(10,37,64,0.04),0_8px_24px_-12px_rgba(10,37,64,0.10)]"
          : "bg-paper/70 backdrop-blur-xl border-b border-transparent"
      }`}
    >
      {/* Hairline gradient under header (only when scrolled) */}
      {scrolled && (
        <span
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-blue/30 to-transparent"
          aria-hidden
        />
      )}

      <nav className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-24 flex items-center gap-3 md:gap-6">
        {/* Brand — hidden on dashboard routes */}
        {!isDashboardRoute && (
          <Link
            href="/"
            className="group flex items-center gap-2.5 mr-auto md:mr-0 font-bold text-[19px] tracking-tight text-ink"
            aria-label="TicketPulse home"
          >
            <span className="relative inline-flex items-center justify-center py-1.5 px-1 transition-transform group-hover:scale-105">
              <img src="/ticketpulse-logo.svg" alt="TicketPulse" className="h-12 md:h-[86px] w-auto" />
            </span>
          </Link>
        )}

        {/* Desktop nav with mega menu */}
        <div className="hidden md:flex items-center gap-1 mx-auto">
          <div ref={eventsRef} className="relative">
            <button
              type="button"
              onClick={() => setEventsOpen((v) => !v)}
              aria-expanded={eventsOpen}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                eventsActive || eventsOpen ? "text-ink bg-paper-2" : "text-ink-2 hover:text-ink hover:bg-paper-2"
              }`}
            >
              Events
              <ChevronDown size={13} className={`text-ink-3 transition-transform duration-200 ${eventsOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {TOP_LINKS.map(({ label, href }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={label}
                href={href}
                className={`relative rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  isActive ? "text-ink" : "text-ink-2 hover:text-ink hover:bg-paper-2"
                }`}
              >
                {label}
                {isActive && (
                  <span className="absolute left-3 right-3 -bottom-px h-px bg-gradient-to-r from-transparent via-blue to-transparent" aria-hidden />
                )}
              </Link>
            )
          })}
        </div>

        {/* Search button (desktop) */}
        <Link
          href="/events"
          className="group hidden md:inline-flex items-center gap-2 rounded-lg border border-line bg-paper/70 backdrop-blur px-3 py-2 text-[13px] text-ink-3 hover:text-ink hover:border-line-2 hover:shadow-[0_2px_10px_-4px_rgba(10,37,64,0.12)] transition-all"
          aria-label="Search events"
        >
          <Search size={14} className="group-hover:text-blue transition-colors" />
          <span className="hidden xl:inline">Search events…</span>
          <kbd className="hidden xl:inline-flex items-center font-mono text-[10px] font-semibold text-ink-3 bg-paper-2 ring-1 ring-line rounded px-1.5 py-0.5 ml-1">⌘K</kbd>
        </Link>

        {/* Cart (mobile) */}
        <Link
          href="/cart"
          aria-label={`Cart, ${totalCount} item${totalCount === 1 ? "" : "s"}`}
          className="relative inline-flex md:hidden h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-paper-2 transition-colors"
        >
          <ShoppingBag size={18} />
          {ready && totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-navy text-white text-[10px] font-bold px-1 ring-2 ring-paper">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </Link>

        {/* Right cluster (desktop) */}
        <div className="hidden md:flex items-center gap-1.5">
          <Link
            href="/cart"
            aria-label={`Cart, ${totalCount} item${totalCount === 1 ? "" : "s"}`}
            className="relative inline-flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-ink hover:border-line-2 transition-colors"
          >
            <ShoppingBag size={15} />
            {ready && totalCount > 0 && (
              <span className="inline-flex min-w-[20px] h-[20px] items-center justify-center rounded-full bg-navy text-white text-[10.5px] font-bold px-1">
                {totalCount > 99 ? "99+" : totalCount}
              </span>
            )}
          </Link>
          {session ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-medium text-ink hover:border-line-2 transition-colors"
              >
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex w-6 h-6 items-center justify-center rounded-full bg-navy text-white text-[11px] font-semibold">
                    {(session.user.name?.[0] ?? "U").toUpperCase()}
                  </span>
                )}
                <span className="hidden lg:block">{session.user.name?.split(" ")[0] ?? "Account"}</span>
                <ChevronDown size={14} className="text-ink-3" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-line bg-paper shadow-lg shadow-ink/10 animate-[tp-fade-up_0.2s_cubic-bezier(0.16,1,0.3,1)_both]">
                    <div className="px-4 py-3 border-b border-line">
                      <p className="text-sm font-semibold text-ink truncate">{session.user.name ?? "Account"}</p>
                      <p className="text-xs text-ink-3 truncate">{session.user.email}</p>
                    </div>
                    {session.user.role === "admin" && (
                      <Link href="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink">
                        <Shield size={15} className="text-ink-3" /> Admin
                      </Link>
                    )}
                    <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink">
                      <LayoutDashboard size={15} className="text-ink-3" /> Dashboard
                    </Link>
                    <Link href="/orders" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink">
                      <ShoppingBag size={15} className="text-ink-3" /> Orders
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink border-t border-line"
                    >
                      <LogOut size={15} className="text-ink-3" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/signin" className="text-sm font-medium text-ink-2 hover:text-ink px-3 py-2 transition-colors">
                Sign in
              </Link>
              <Link
                href="/events"
                className="group relative inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-navy-600 via-navy to-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(10,37,64,0.45)] hover:shadow-[0_8px_22px_-6px_rgba(10,37,64,0.55)] hover:-translate-y-px active:translate-y-0 transition-all overflow-hidden"
              >
                <span className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "radial-gradient(120px 40px at 30% 0%, rgba(255,255,255,0.18), transparent 70%)" }} aria-hidden />
                Get tickets
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile: auth or hamburger */}
        {session ? (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-paper-2"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        ) : (
          <div className="md:hidden flex items-center gap-1">
            <Link
              href="/auth/signin"
              className="hidden sm:inline-flex h-9 items-center rounded-lg px-2.5 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="hidden sm:inline-flex h-9 items-center rounded-lg bg-green-600 px-2.5 text-[12.5px] font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Sign up
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-paper-2"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        )}
      </nav>

      {/* Events mega menu */}
      {eventsOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-ink/10 backdrop-blur-[1px]" onClick={() => setEventsOpen(false)} aria-hidden />
          <div className="absolute left-0 right-0 top-16 md:top-24 z-40 border-t border-line bg-paper/95 backdrop-blur-xl shadow-[0_24px_60px_-24px_rgba(10,37,64,0.18)] animate-[tp-fade-in_0.2s_ease-out]">
            <div className="max-w-7xl mx-auto px-5 md:px-8 py-7 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8">
              <div>
                <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-4">By category</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {CATEGORIES.map(({ label, value, desc, icon: Icon, accent, ring }) => (
                    <Link
                      key={value}
                      href={`/events?category=${value}`}
                      className="group flex items-start gap-3 rounded-xl p-3 hover:bg-paper-2 transition-colors"
                    >
                      <span className={`shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ${ring} shadow-sm`}>
                        <Icon size={15} className={accent} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold tracking-tight text-ink group-hover:text-navy-700 transition-colors">{label}</p>
                        <p className="text-[11.5px] text-ink-3">{desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                  <Link href="/events" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy hover:gap-1.5 transition-all">
                    Browse all events <ArrowUpRight size={12} />
                  </Link>
                  <Link href="/auth/signup?role=organizer" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink transition-colors">
                    <CalendarCog size={12} /> Sell tickets
                  </Link>
                </div>
              </div>

              <div>
                <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-4">Featured</p>
                <div className="space-y-2">
                  {featured.length > 0 ? (
                    featured.map((f) => (
                      <Link
                        key={f.slug}
                        href={`/events/${f.slug}`}
                        className="group flex items-center gap-3 rounded-xl border border-line bg-paper p-3 hover:border-line-2 hover:shadow-sm transition-all"
                      >
                        <span className="shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-lg bg-paper-2 ring-1 ring-line text-xl">{f.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold tracking-tight text-ink line-clamp-1">{f.title}</p>
                          <p className="text-[11.5px] text-ink-3">{f.date}</p>
                        </div>
                        <ArrowUpRight size={13} className="text-ink-3 group-hover:text-navy transition-colors shrink-0" />
                      </Link>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-line bg-paper-2 p-3 text-[12px] text-ink-3">
                      No upcoming events yet. Check back soon.
                    </p>
                  )}
                </div>
                <div className="mt-3 rounded-xl bg-green-50/60 border border-green-500/15 p-3.5">
                  <p className="text-[12px] font-semibold text-ink">For organizers</p>
                  <p className="text-[11.5px] text-ink-2 mt-0.5 leading-relaxed">Launch your event in minutes. Verified payouts and built-in shuttle, merch, photos.</p>
                  <Link href="/auth/signup?role=organizer" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-navy hover:gap-1.5 transition-all">
                    Start selling <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
            <style>{`
              @keyframes tp-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
          </div>
        </>
      )}

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-30 bg-ink/20 backdrop-blur-[1px]" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="md:hidden relative z-40 border-t border-line bg-paper">
          <div className="max-w-7xl mx-auto px-5 py-4 space-y-5">
            {/* Search */}
            <Link href="/events" className="flex items-center gap-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-2">
              <Search size={15} className="text-ink-3" /> Search events…
            </Link>

            {/* Top links */}
            <div className="flex flex-col">
              <Link href="/events" className="py-3 text-[15px] font-semibold text-ink border-b border-line flex items-center justify-between">
                Events <ArrowUpRight size={14} className="text-ink-3" />
              </Link>
              {TOP_LINKS.map(({ label, href }) => (
                <Link key={label} href={href} className="py-3 text-[15px] font-medium text-ink-2 hover:text-ink border-b border-line">
                  {label}
                </Link>
              ))}
            </div>

            {/* Categories grid */}
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-2.5">Categories</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ label, value, icon: Icon, accent, ring }) => (
                  <Link
                    key={value}
                    href={`/events?category=${value}`}
                    className="flex items-center gap-2 rounded-xl border border-line bg-paper p-3 hover:border-line-2 transition-colors"
                  >
                    <span className={`shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-lg bg-paper ring-1 ${ring}`}>
                      <Icon size={14} className={accent} />
                    </span>
                    <span className="text-[13px] font-semibold tracking-tight text-ink">{label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Sell row */}
            <Link href="/auth/signup?role=organizer" className="flex items-center gap-3 rounded-xl bg-green-50/60 border border-green-500/15 p-4">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line">
                <CalendarCog size={15} className="text-green-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-ink">Sell tickets</p>
                <p className="text-[11.5px] text-ink-2">Launch in minutes, verified payouts.</p>
              </div>
              <ArrowRight size={14} className="text-ink-2 shrink-0" />
            </Link>
            <Link href="/vendors/apply" className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper-2 ring-1 ring-line">
                <Store size={15} className="text-ink-2" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-ink">Apply as a vendor</p>
                <p className="text-[11.5px] text-ink-2">Get booked across Zimbabwe.</p>
              </div>
              <ArrowRight size={14} className="text-ink-2 shrink-0" />
            </Link>

            {/* Auth */}
            <div className="pt-2">
              {session ? (
                <div className="space-y-2">
                  {session.user.role === "admin" && (
                    <Link href="/admin" className="flex items-center justify-center gap-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink">
                      <Shield size={15} /> Admin
                    </Link>
                  )}
                  <Link href="/dashboard" className="flex items-center justify-center gap-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink">
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                  <button onClick={() => signOut()} className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/auth/signin" className="flex items-center justify-center rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink">
                      Sign in
                    </Link>
                    <Link href="/auth/signup" className="flex items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white">
                      Sign up <ArrowRight size={13} />
                    </Link>
                  </div>
                  <Link href="/events" className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:bg-paper-2 transition-colors">
                    Browse events <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </header>
  )
}
