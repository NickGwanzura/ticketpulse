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

      <nav className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center gap-6">
        {/* Brand */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 mr-auto md:mr-0 font-bold text-[19px] tracking-tight text-ink"
          aria-label="TicketPulse home"
        >
          <span className="relative inline-flex w-7 h-7 items-center justify-center transition-transform group-hover:scale-105">
            <svg viewBox="0 0 283.46 283.46" className="w-7 h-7" fill="none" aria-hidden="true">
              <path d="M113.36,166.49c0.58,1.5,2.04,2.58,3.75,2.58h0.31C116.19,168.01,114.81,167.14,113.36,166.49z"/>
              <path fill="#0E1032" d="M138.28,103.34h-10.44v25.85h-8.76v-25.85h-9.63v-6.88h28.01L138.28,103.34z"/>
              <path fill="#0E1032" d="M145.5,102.66c-1.28,0-2.39-0.46-3.32-1.4c-0.93-0.93-1.4-2.04-1.4-3.32c0-1.32,0.46-2.45,1.4-3.39c0.93-0.95,2.04-1.42,3.32-1.42c1.32,0,2.45,0.47,3.39,1.42c0.95,0.95,1.42,2.08,1.42,3.39c0,1.28-0.47,2.39-1.42,3.32C147.94,102.2,146.81,102.66,145.5,102.66z M141.16,129.18v-23.34h8.76v23.34H141.16z"/>
              <path fill="#0E1032" d="M174.04,107.38l-2.45,6.02c-0.93-0.48-1.73-0.81-2.41-0.99c-0.67-0.18-1.43-0.26-2.26-0.26c-1.22,0-2.29,0.5-3.2,1.49c-0.91,1-1.37,2.29-1.37,3.9c0,1.57,0.45,2.81,1.35,3.71c0.9,0.9,1.97,1.35,3.23,1.35c0.8,0,1.56-0.09,2.26-0.26c0.71-0.18,1.51-0.51,2.41-0.99l2.45,6.02c-1.99,1.57-4.65,2.36-7.99,2.36c-3.85,0-6.94-1.07-9.27-3.2c-2.33-2.13-3.49-5.13-3.49-8.98c0-2.57,0.54-4.8,1.61-6.69c1.08-1.89,2.58-3.34,4.5-4.33s4.14-1.49,6.64-1.49C169.38,105.02,172.05,105.81,174.04,107.38z"/>
              <path fill="#0E1032" d="M177.21,129.18V95.73l8.76-0.53v17.33l8.71-7.36l5.25,6.02l-6.21,4.67l7.89,13.33h-9.43l-4.62-8.71l-1.59,1.2v7.51H177.21z"/>
              <path fill="#0E1032" d="M226.3,119.7h-14.2c0.32,0.99,0.92,1.77,1.8,2.33c0.88,0.56,2.05,0.84,3.49,0.84c2.21,0,4.35-0.53,6.4-1.59l2.45,5.92c-0.96,0.71-2.35,1.3-4.16,1.78c-1.81,0.48-3.67,0.72-5.56,0.72c-2.73,0-5.14-0.47-7.24-1.4c-2.1-0.93-3.75-2.32-4.93-4.16c-1.19-1.84-1.78-4.05-1.78-6.62c0-2.53,0.55-4.75,1.64-6.64c1.09-1.89,2.59-3.34,4.5-4.36c1.91-1.01,4.05-1.52,6.43-1.52c2.41,0,4.44,0.55,6.11,1.64c1.67,1.09,2.93,2.55,3.78,4.38c0.85,1.83,1.28,3.87,1.28,6.11V119.7z M211.86,115.37h6.06c0-0.8-0.26-1.56-0.77-2.26c-0.51-0.71-1.27-1.06-2.26-1.06c-0.8,0-1.52,0.34-2.14,1.01C212.13,113.73,211.83,114.5,211.86,115.37z"/>
              <path fill="#0E1032" d="M246.23,106.8l0.82,6.88h-6.93v5.78c0,0.96,0.25,1.73,0.75,2.29c0.5,0.56,1.16,0.84,2,0.84c1.15,0,2.28-0.3,3.37-0.91l2.5,5.97c-0.61,0.51-1.56,0.99-2.86,1.42c-1.3,0.43-2.5,0.65-3.59,0.65c-1.93,0-3.72-0.35-5.39-1.06c-1.67-0.71-3.01-1.76-4.02-3.15c-1.01-1.4-1.52-3.09-1.52-5.08v-6.74h-3.61v-6.88h3.61v-6.3l8.76-1.2v7.51H246.23z"/>
              <path fill="#8DD32F" d="M124.27,165.85h-8.76v-32.73h13.77c2.5,0,4.77,0.44,6.81,1.32c2.04,0.88,3.66,2.21,4.86,3.99c1.2,1.78,1.8,3.94,1.8,6.47c0,2.5-0.64,4.61-1.93,6.33c-1.28,1.72-2.98,2.99-5.08,3.83c-2.1,0.83-4.39,1.25-6.86,1.25h-4.62V165.85z M128.99,140h-4.72v9.43h4.81c1.35,0,2.45-0.43,3.32-1.3s1.3-1.94,1.3-3.22c0-1.48-0.43-2.66-1.28-3.56C131.58,140.45,130.43,140,128.99,140z"/>
              <path fill="#8DD32F" d="M161.91,142.56h8.76v23.34h-4.24l-2.5-2.41c-3.4,2.12-6.58,3.18-9.53,3.18c-2.82,0-4.94-0.83-6.35-2.48c-1.41-1.65-2.12-3.84-2.12-6.57v-15.06h8.76v14.25c0,0.8,0.19,1.47,0.58,2c0.39,0.53,1.03,0.79,1.93,0.79c0.51,0,1.23-0.14,2.17-0.41c0.93-0.27,1.78-0.58,2.55-0.94V142.56z"/>
              <path fill="#8DD32F" d="M175.96,165.85V132.4l8.76-0.53v33.98H175.96z"/>
              <path fill="#8DD32F" d="M188.67,163.64l2.45-5.53c0.93,0.45,2.06,0.83,3.39,1.15c1.33,0.32,2.41,0.48,3.25,0.48c0.58,0,1.06-0.1,1.44-0.29c0.39-0.19,0.58-0.45,0.58-0.77c0-0.19-0.22-0.42-0.65-0.7c-0.43-0.27-0.99-0.52-1.66-0.75c-2.44-0.87-4.44-1.89-5.99-3.08s-2.33-2.74-2.33-4.67c0-2.44,0.91-4.35,2.74-5.73c1.83-1.38,4.36-2.07,7.6-2.07c1.38,0,2.9,0.19,4.55,0.55c1.65,0.37,3.07,1.02,4.26,1.95l-2.45,5.53c-0.96-0.42-1.95-0.75-2.96-1.01c-1.01-0.26-1.93-0.39-2.77-0.39c-0.71,0-1.28,0.1-1.73,0.29c-0.45,0.19-0.68,0.45-0.68,0.77c0,0.19,0.22,0.42,0.68,0.67c0.45,0.26,1.04,0.51,1.78,0.77c2.41,0.83,4.37,1.85,5.9,3.06c1.52,1.2,2.29,2.77,2.29,4.69c0,2.47-0.82,4.39-2.45,5.75c-1.64,1.36-4.06,2.05-7.27,2.05c-1.38,0-3.09-0.23-5.13-0.67C191.46,165.26,189.85,164.57,188.67,163.64z"/>
              <path fill="#8DD32F" d="M234,156.37h-14.2c0.32,0.99,0.92,1.77,1.8,2.33c0.88,0.56,2.05,0.84,3.49,0.84c2.21,0,4.35-0.53,6.4-1.59l2.45,5.92c-0.96,0.71-2.35,1.3-4.16,1.78c-1.81,0.48-3.67,0.72-5.56,0.72c-2.73,0-5.14-0.47-7.24-1.4c-2.1-0.93-3.75-2.32-4.93-4.16c-1.19-1.84-1.78-4.05-1.78-6.62c0-2.53,0.55-4.75,1.64-6.64c1.09-1.89,2.59-3.34,4.5-4.36c1.91-1.01,4.05-1.52,6.43-1.52c2.41,0,4.44,0.55,6.11,1.64c1.67,1.09,2.93,2.55,3.78,4.38c0.85,1.83,1.28,3.87,1.28,6.11V156.37z M219.56,152.04h6.06c0-0.8-0.26-1.56-0.77-2.26c-0.51-0.71-1.27-1.06-2.26-1.06c-0.8,0-1.52,0.34-2.14,1.01S219.53,151.17,219.56,152.04z"/>
              <path fill="#0E1032" d="M142.02,164.02c-1.05-2.02-2.06-4.03-3.02-6.08c-0.04,0.03-0.1,0.04-0.16,0.07c-2.5,0.98-5.24,1.5-8.12,1.53c1.39,3.01,2.87,5.99,4.41,8.96c0.47,0.54,0.38,2.36-0.27,2.54l-13.02,3.53c-1.15-2.17-2.65-4.03-4.43-5.51c-1.23-1.06-2.61-1.93-4.06-2.58c-3.53-1.62-7.55-2.04-11.47-1.05c-7.95,2.03-13.75,9.25-13.27,18.01l-15.66,3.99c-1.05-29.92-8.5-57.74-22.14-83.69c-0.26-1.02,0.24-2.81,0.97-2.99l14.34-3.72c3.79,7.92,12.05,11.6,19.8,9.62c7.86-2.02,13.24-9.45,12.59-18.31l14.39-3.72c0.09,2.34,0.21,4.68,0.38,7h8.19c-0.17-2.29-0.3-4.57-0.38-6.86c-0.21-5.61-5.89-9.43-11.06-8.05l-16.68,4.46c-3.04,0.82-3.86,3.96-3.19,6.67c1.19,4.87-1.79,9.68-6.19,10.86c-4.58,1.22-9.47-1.6-10.89-6.32c-1.01-3.31-3.59-4.93-6.94-3.99L49.6,92.96c-6.32,1.75-9.11,8.77-6.08,14.52c12.82,24.34,20.1,50.76,21.09,78.39c0.2,5.62,4.93,10.99,11.01,9.4l18.32-4.77c2.53-0.65,3.73-3.18,3.08-5.59c-1.41-5.18,1.96-10.29,6.73-11.45c5.35-1.32,10.04,1.67,11.58,7.01c0.6,2.09,3.21,3.48,5.25,2.92l16.71-4.54c2.92-0.79,5.21-3.79,5.95-5.98C144.35,169.65,143.51,166.86,142.02,164.02z"/>
              <path fill="#8DD32F" d="M47.72,141.89c6.32,14.05,13.16,29.16,12.95,44.95c-3.64-0.94-5.53-4.3-6.23-7.62c-1.44-6.83-2.98-13.25-5.58-19.84c-4.98-12.65-11.42-24.13-18.59-35.58c-1.93-3.08-1.9-7.74,1.06-9.78c2.83-1.95,5.79-3.14,9.04-4.42l2.82,5.67l-6.44,2.77c-0.47,0.2-1.3,1-1.38,1.4c-0.08,0.4,0.21,1.33,0.45,1.7C40.36,127.88,44.37,134.46,47.72,141.89z"/>
              <polygon fill="#0E1032" points="87.82,127.62 81.19,129.5 79.8,125.06 86.59,123.37"/>
              <polygon fill="#0E1032" points="74.27,131.09 67.57,132.98 66.38,128.6 73.07,126.8"/>
              <polygon fill="#0E1032" points="101.23,124.19 94.6,126.02 93.34,121.63 100.01,119.87"/>
              <polygon fill="#0E1032" points="114.81,120.7 108.08,122.47 106.89,118.16 113.52,116.4"/>
              <circle fill="#8DD32F" cx="242.85" cy="160.38" r="5.08"/>
            </svg>
          </span>
        </Link>

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

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-paper-2"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Events mega menu */}
      {eventsOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-ink/10 backdrop-blur-[1px]" onClick={() => setEventsOpen(false)} aria-hidden />
          <div className="absolute left-0 right-0 top-16 z-40 border-t border-line bg-paper/95 backdrop-blur-xl shadow-[0_24px_60px_-24px_rgba(10,37,64,0.18)] animate-[tp-fade-in_0.2s_ease-out]">
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
                <div className="mt-3 rounded-xl bg-blue-soft/60 border border-blue/15 p-3.5">
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
        <div className="md:hidden border-t border-line bg-paper">
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
            <Link href="/auth/signup?role=organizer" className="flex items-center gap-3 rounded-xl bg-blue-soft/60 border border-blue/15 p-4">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line">
                <CalendarCog size={15} className="text-blue" />
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
                  <button onClick={() => signOut()} className="flex items-center justify-center gap-2 w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/auth/signin" className="flex items-center justify-center rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink">
                    Sign in
                  </Link>
                  <Link href="/auth/signup" className="flex items-center justify-center gap-1.5 rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white">
                    Get tickets <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
