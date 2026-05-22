import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "TicketPulse — Zimbabwe's event ticketing platform",
  description: "Discover concerts, marathons, film premieres, exhibitions and more. Buy tickets, merch, shuttle passes, and photo packs — all in one place. TicketPulse.",
  openGraph: {
    title: "TicketPulse — Zimbabwe's event ticketing platform",
    description: "Discover concerts, marathons, film premieres, exhibitions and more. Buy tickets, merch, shuttle passes, and photo packs — all in one place.",
  },
  twitter: {
    title: "TicketPulse — Zimbabwe's event ticketing platform",
    description: "Discover concerts, marathons, film premieres, exhibitions and more. Buy tickets, merch, shuttle passes, and photo packs — all in one place.",
  },
  alternates: {
    canonical: "/",
  },
}
import {
  ArrowRight, ArrowUpRight, Search, Ticket, Smartphone, Wallet,
  Music, Trophy, Film, Building2, Mountain, Footprints, MousePointerClick,
  Calendar, MapPin, FileText, ScanLine, DoorOpen, ShieldCheck,
} from "lucide-react"
import EventCard from "@/components/events/EventCard"
import { FAQ as FAQSection } from "@/components/ui/Accordion"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getFeaturedEvents, type FeaturedEvent } from "@/lib/events"

const CATEGORY_HERO_VISUAL: Record<string, { emoji: string; gradient: string; accent: string }> = {
  concert:    { emoji: "🎵", gradient: "from-violet-100 via-fuchsia-50 to-pink-50",  accent: "text-violet-700" },
  marathon:   { emoji: "🏃", gradient: "from-sky-100 via-blue-50 to-cyan-50",        accent: "text-sky-700" },
  walkathon:  { emoji: "🚶", gradient: "from-green-100 via-teal-50 to-cyan-50",    accent: "text-green-700" },
  film:       { emoji: "🎬", gradient: "from-amber-100 via-orange-50 to-rose-50",    accent: "text-amber-700" },
  exhibition: { emoji: "🏢", gradient: "from-slate-100 via-blue-50 to-indigo-50",    accent: "text-slate-700" },
  expedition: { emoji: "⛰️", gradient: "from-lime-100 via-green-50 to-teal-50",    accent: "text-green-800" },
}

interface HeroTicket {
  slug: string
  title: string
  venue: string
  date: Date
  price: number
  currency: string
  emoji: string
  gradient: string
  accent: string
  badge: { label: string; color: string }
  coverImage?: string | null
  rotate?: string
  placement?: string
  z?: string
}

const FAQ = [
  { q: "Do I need an account to buy tickets?",      a: "No. Pay first with just your name, email, and phone. We hold your seat and email a magic link. One click verifies the email, releases your tickets, and creates your account passwordless. You can set a password later from your account settings, or never. The tickets work either way." },
  { q: "How do I get my ticket after I buy?",       a: "Instantly after you click the magic link. You get a printable PDF ticket by email, a mobile QR in your TicketPulse account, and a WhatsApp message with your ticket details — all at once. The QR is bound to your account, so you can sign in on any device the day-of." },
  { q: "Who scans the tickets at the gate?",        a: "We do. TicketPulse ships with a built-in gate-scanner app that organizers run on any phone or tablet. It reads the QR from a printed PDF, your phone, or wallet pass and checks you in instantly. No third-party scanners, no extra hardware fees." },
  { q: "Can I get a refund?",                       a: "Yes, full refund up to 24 hours before the event, processed back to your original payment method (instant for EcoCash, 24 to 72h for cards)." },
  { q: "What payments do you accept?",              a: "EcoCash and Visa cards. Both clear instantly at checkout." },
  { q: "Is TicketPulse only for Harare?",           a: "We started here, but events are live in Bulawayo, Vic Falls, Mutare, Pretoria, Durban, and London. New cities open every month." },
  { q: "How do I sell tickets to my own event?",    a: "Sign up as an organizer, build your event in the dashboard, and share your link. We pay out within 24h of the event ending." },
  { q: "What about photo packs and merch?",         a: "Built-in. Organizers can add merch and photo packs that attendees can buy at checkout or after the event, no extra integrations." },
]

const HERO_PLACEMENTS = [
  { rotate: "lg:-rotate-[2deg]", placement: "lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2", z: "z-30" },
  { rotate: "lg:rotate-[3deg]",  placement: "lg:top-[12%] lg:right-[6%]",                                      z: "z-20" },
  { rotate: "lg:-rotate-[4deg]", placement: "lg:bottom-[8%] lg:left-[6%]",                                     z: "z-10" },
] as const

function buildHeroTickets(featured: FeaturedEvent[]): HeroTicket[] {
  return featured.slice(0, HERO_PLACEMENTS.length).map((event, i) => {
    const visual = CATEGORY_HERO_VISUAL[event.category.toLowerCase()] ?? {
      emoji: "🎫",
      gradient: "from-slate-100 via-blue-50 to-indigo-50",
      accent: "text-slate-700",
    }
    const placement = HERO_PLACEMENTS[i]
    return {
      slug: event.slug,
      title: event.title,
      venue: `${event.venue} · ${event.city}`,
      date: event.startsAt,
      price: event.lowestPrice ?? 0,
      currency: event.currency,
      emoji: visual.emoji,
      gradient: visual.gradient,
      accent: visual.accent,
      coverImage: event.coverImage,
      badge: event.status === "sold_out"
        ? { label: "SOLD OUT", color: "bg-rose-600 text-white" }
        : { label: "ON SALE", color: "bg-green-600 text-white" },
      rotate: placement.rotate,
      placement: placement.placement,
      z: placement.z,
    }
  })
}

const CATEGORIES = [
  { label: "Concerts",    value: "concert",    icon: Music,      gradient: "from-violet-50 to-fuchsia-50",   ring: "ring-violet-200/60",   accent: "text-violet-700" },
  { label: "Marathons",   value: "marathon",   icon: Trophy,     gradient: "from-sky-50 to-blue-50",         ring: "ring-sky-200/60",      accent: "text-sky-700" },
  { label: "Walkathons",  value: "walkathon",  icon: Footprints, gradient: "from-green-50 to-teal-50",     ring: "ring-green-200/60",  accent: "text-green-700" },
  { label: "Film",        value: "film",       icon: Film,       gradient: "from-amber-50 to-orange-50",     ring: "ring-amber-200/60",    accent: "text-amber-700" },
  { label: "Exhibitions", value: "exhibition", icon: Building2,  gradient: "from-slate-50 to-indigo-50",     ring: "ring-indigo-200/60",   accent: "text-indigo-700" },
  { label: "Expeditions", value: "expedition", icon: Mountain,   gradient: "from-lime-50 to-green-50",     ring: "ring-lime-200/60",     accent: "text-lime-700" },
]

function buildStats(eventsOnSale: number) {
  return [
    { value: "Live",    label: "Launched May 2026" },
    { value: String(eventsOnSale), label: eventsOnSale === 1 ? "Event on sale today" : "Events on sale today" },
    { value: "2 ways",  label: "EcoCash · Visa" },
    { value: "5%",      label: "Organizer fee, pay as you sell" },
  ]
}

const STEPS = [
  { icon: MousePointerClick, title: "Browse & buy in 60s",  body: "Find concerts, marathons, premieres, and more. Pay with EcoCash or Visa. No signup, no friction. Just an email and a phone number." },
  { icon: FileText,          title: "One-click verify",     body: "We email a magic link the moment you pay. Click it once and your printable PDF + mobile QR drop in. Your ticket also arrives by WhatsApp — all at once. Your account is created and signed in. Set a password later if you want." },
  { icon: Smartphone,        title: "Tickets on WhatsApp",  body: "Your ticket QR and event details land directly on your phone via WhatsApp after purchase. No app to download, no email to search for — it's right in your chat." },
  { icon: ScanLine,          title: "We scan you in",       body: "Our gate-scanner app, run by the organizer, reads your QR off paper, screen, wallet pass, or your WhatsApp chat. End to end on TicketPulse. No third-party scanners." },
]

const FADE_DELAY = ["80ms", "180ms", "280ms"] as const

function HeroTicketCard({ ticket, index = 0 }: { ticket: HeroTicket; index?: number }) {
  return (
    <div
      style={{ animationDelay: FADE_DELAY[index] ?? "0ms" }}
      className={`tp-fade-up relative lg:absolute ${ticket.placement ?? ""} ${ticket.rotate ?? ""} ${ticket.z ?? ""} w-full max-w-[280px] rounded-2xl border border-line bg-paper shadow-[0_24px_60px_-24px_rgba(10,37,64,0.25)] overflow-hidden transition-transform duration-500 hover:rotate-0 hover:scale-[1.02] hover:z-40`}
    >
      <div className={`relative h-24 overflow-hidden ${ticket.coverImage ? "" : `bg-gradient-to-br ${ticket.gradient}`} flex items-center justify-center`}>
        {ticket.coverImage ? (
          <>
            <img
              src={ticket.coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 [background:radial-gradient(400px_circle_at_30%_20%,rgba(255,255,255,0.65),transparent_60%)]" />
        )}
        {!ticket.coverImage && <span className="text-3xl relative">{ticket.emoji}</span>}
        <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 ${ticket.badge.color} text-[9.5px] font-semibold tracking-wide px-2 py-0.5 rounded-full`}>
          {ticket.badge.label}
        </span>
      </div>
      <div className="p-3.5">
        <p className={`text-[9.5px] font-semibold tracking-[0.18em] uppercase ${ticket.accent} mb-1`}>Ticket</p>
        <p className="text-[13px] font-semibold tracking-tight text-ink line-clamp-1">{ticket.title}</p>
        <div className="mt-2 space-y-1 text-[11.5px] text-ink-2">
          <p className="inline-flex items-center gap-1.5"><Calendar size={11} className="text-ink-3" /> {formatDateShort(ticket.date)}</p>
          <p className="inline-flex items-center gap-1.5 truncate"><MapPin size={11} className="text-ink-3 shrink-0" /> <span className="truncate">{ticket.venue}</span></p>
        </div>
        <div className="mt-3 pt-3 border-t border-dashed border-line flex items-center justify-between">
          <span className="text-[13px] font-semibold tracking-tight text-ink">
            {ticket.price > 0 ? (
              <>
                <span className="text-[10px] text-ink-3 font-normal mr-1">From</span>
                {formatCurrency(ticket.price, ticket.currency)}
              </>
            ) : (
              <span className="text-green-700">Free entry</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-navy">
            View <ArrowUpRight size={11} />
          </span>
        </div>
      </div>
      {/* Ticket notch */}
      <div className="absolute top-[105px] -left-1.5 w-3 h-3 rounded-full bg-paper-2 ring-1 ring-line" aria-hidden />
      <div className="absolute top-[105px] -right-1.5 w-3 h-3 rounded-full bg-paper-2 ring-1 ring-line" aria-hidden />
    </div>
  )
}

export default async function Home() {
  const featuredEvents = await getFeaturedEvents(3)
  const heroTickets = buildHeroTickets(featuredEvents)
  const eventsOnSale = featuredEvents.length

  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Layer 1: base mesh, multiple radial gradients */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: [
              "radial-gradient(1200px 540px at 88% -8%, #C7DBF5 0%, transparent 58%)",
              "radial-gradient(900px 460px at -6% 8%, #E5EFFA 0%, transparent 55%)",
              "radial-gradient(680px 380px at 55% 110%, rgba(254,235,200,0.55) 0%, transparent 60%)",
              "radial-gradient(420px 280px at 22% 60%, rgba(167,139,250,0.18) 0%, transparent 65%)",
              "linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)",
            ].join(", "),
          }}
          aria-hidden
        />

        {/* Layer 2: vivid accent orb, top right, animated pulse */}
        <div
          className="absolute -top-20 right-[10%] -z-10 w-72 h-72 rounded-full blur-3xl pointer-events-none animate-[pulse_6s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(closest-side, rgba(5,112,222,0.25), transparent)" }}
          aria-hidden
        />

        {/* Layer 3: secondary orb, left mid */}
        <div
          className="absolute top-[40%] -left-16 -z-10 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(closest-side, rgba(45,184,160,0.18), transparent)" }}
          aria-hidden
        />

        {/* Layer 4: warm orb, bottom right */}
        <div
          className="absolute bottom-0 right-[20%] -z-10 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-70"
          style={{ background: "radial-gradient(closest-side, rgba(251,191,36,0.16), transparent)" }}
          aria-hidden
        />

        {/* Layer 5: dotted pattern, softly fading */}
        <div
          className="absolute inset-x-0 top-0 -z-10 h-[560px] opacity-60"
          style={{
            backgroundImage: "radial-gradient(rgba(10,37,64,0.13) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(80% 70% at 50% 0%, black 0%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(80% 70% at 50% 0%, black 0%, transparent 80%)",
          }}
          aria-hidden
        />

        {/* Layer 6: faint grid for structure */}
        <div
          className="absolute inset-x-0 top-0 -z-10 h-[420px] opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #0a2540 1px, transparent 1px), linear-gradient(to bottom, #0a2540 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
          aria-hidden
        />

        {/* Layer 7: decorative ring SVG */}
        <svg
          className="absolute -top-24 right-[2%] -z-10 w-[420px] h-[420px] opacity-30 pointer-events-none hidden md:block"
          viewBox="0 0 200 200"
          aria-hidden
        >
          <defs>
            <linearGradient id="ringStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0570DE" stopOpacity="0.6" />
              <stop offset="1" stopColor="#0570DE" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="92" fill="none" stroke="url(#ringStroke)" strokeWidth="0.5" strokeDasharray="2 4" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="url(#ringStroke)" strokeWidth="0.4" strokeDasharray="1 3" />
        </svg>

        {/* Layer 8: floating sparkles */}
        <div className="absolute top-[18%] left-[44%] -z-10 w-1.5 h-1.5 rounded-full bg-blue/70 shadow-[0_0_18px_4px_rgba(5,112,222,0.4)] animate-pulse" aria-hidden />
        <div className="absolute top-[58%] left-[12%] -z-10 w-1 h-1 rounded-full bg-green-500/70 shadow-[0_0_12px_3px_rgba(141,211,47,0.3)] animate-pulse [animation-delay:1.2s]" aria-hidden />
        <div className="absolute top-[35%] right-[6%] -z-10 w-1 h-1 rounded-full bg-amber-400/80 shadow-[0_0_10px_3px_rgba(245,158,11,0.3)] animate-pulse [animation-delay:2.4s] hidden md:block" aria-hidden />

        {/* Layer 9: bottom curve fade */}
        <svg
          className="absolute bottom-0 left-0 right-0 -z-10 w-full h-12 pointer-events-none"
          viewBox="0 0 1200 60"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 60 Q 300 0, 600 30 T 1200 60 Z" fill="rgba(5,112,222,0.06)" />
        </svg>

        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-16 md:pb-24">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
            {/* LEFT. Text */}
            <div>
              <div className="tp-fade-up inline-flex items-center gap-2.5 rounded-full border border-line bg-paper/80 backdrop-blur pl-2.5 pr-3.5 py-1.5 mb-7 shadow-sm shadow-ink/5">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
                  <span className="relative block w-2 h-2 rounded-full bg-green-500" />
                </span>
                <span className="text-[11.5px] font-semibold tracking-[0.04em] text-ink">
                  <span className="text-green-700">Live</span>
                  <span className="text-ink-3"> · launched May 2026</span>
                </span>
              </div>

              <h1 className="tp-fade-up-1 font-bold tracking-[-0.035em] text-[44px] leading-[1.0] sm:text-[60px] md:text-[76px] md:leading-[0.96] text-ink">
                Every event.<br />
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-navy via-navy-700 to-blue bg-clip-text text-transparent">One ticket.</span>
                  <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden>
                    <path className="tp-stroke-draw" d="M0 5 Q 50 0, 100 5 T 200 5" stroke="#0570DE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="tp-fade-up-2 mt-6 text-[16.5px] md:text-[19px] leading-relaxed text-ink-2 max-w-xl">
                Concerts, marathons, premieres, and more. <span className="text-ink font-semibold">No signup needed</span>. Pay with EcoCash or Visa, we email a magic link, and your printable PDF + mobile QR land in seconds. Account secured later, on your terms.
              </p>

              <form action="/events" className="tp-fade-up-3 mt-9 flex flex-col sm:flex-row gap-2.5 max-w-2xl">
                <div className="relative flex-1 group">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none transition-colors group-focus-within:text-blue" />
                  <input
                    type="text"
                    name="q"
                    placeholder="Search events, venues, cities…"
                    aria-label="Search events"
                    className="w-full h-14 rounded-xl border border-line bg-paper pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-3 shadow-sm shadow-ink/[0.04] focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="h-14 inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-6 text-[15px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition group"
                >
                  Find tickets
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>

              <div className="tp-fade-up-4 mt-5 inline-flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-full border border-line/80 bg-paper/70 backdrop-blur pl-3.5 pr-4 py-1.5 shadow-sm shadow-ink/[0.03] text-[12px] text-ink-2">
                <span className="inline-flex items-center gap-1.5"><Wallet size={12.5} className="text-green-600" /> No signup to buy</span>
                <span className="inline-flex items-center gap-1.5"><FileText size={12.5} className="text-green-600" /> PDF + mobile QR</span>
                <span className="inline-flex items-center gap-1.5"><Smartphone size={12.5} className="text-green-600" /> Delivered on WhatsApp</span>
                <span className="inline-flex items-center gap-1.5"><ScanLine size={12.5} className="text-green-600" /> Our gate scanner</span>
              </div>

              {/* Launch credibility */}
              <div className="tp-fade-up-5 mt-8 inline-flex items-center gap-3 rounded-2xl border border-line bg-paper/60 backdrop-blur px-4 py-2.5">
                <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 shrink-0">
                  <ShieldCheck size={16} className="text-blue" />
                </span>
                <div className="leading-tight">
                  <p className="text-[12.5px] font-semibold tracking-tight text-ink">Built end-to-end on TicketPulse</p>
                  <p className="text-[11.5px] text-ink-3 mt-0.5">Sell, deliver, scan: one platform, no third-party stack.</p>
                </div>
              </div>
            </div>

            {/* RIGHT. Floating ticket cards */}
            <div className="relative h-[420px] lg:h-[480px]">
              {/* Decorative glow */}
              <div className="absolute inset-0 -z-10 [background:radial-gradient(500px_circle_at_50%_45%,rgba(5,112,222,0.10),transparent_60%)] pointer-events-none" />

              {heroTickets.length > 0 ? (
                <>
                  {/* Mobile/tablet: stack horizontally with snap */}
                  <div className="lg:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-5 px-5 scrollbar-none">
                    {heroTickets.map((t) => (
                      <div key={t.slug} className="snap-center shrink-0 w-[280px]">
                        <HeroTicketCard ticket={t} />
                      </div>
                    ))}
                  </div>

                  {/* Desktop: absolute floating */}
                  <div className="hidden lg:block relative h-full">
                    {heroTickets.map((t, i) => (
                      <HeroTicketCard key={t.slug} ticket={t} index={i} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="rounded-2xl border border-dashed border-line bg-paper/70 backdrop-blur p-8 text-center max-w-sm">
                    <p className="text-[13.5px] font-semibold tracking-tight text-ink">Events drop soon.</p>
                    <p className="mt-1.5 text-[12.5px] text-ink-2">The first tickets land here the moment organizers go live.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-line bg-paper/60 backdrop-blur">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-7 md:py-9">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 md:gap-x-0 md:gap-y-0 md:divide-x md:divide-line">
              {buildStats(eventsOnSale).map((s, i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${300 + i * 70}ms` }}
                  className="tp-fade-up md:px-6 md:first:pl-0 md:last:pr-0"
                >
                  <p className="text-[26px] md:text-[32px] font-bold tracking-tight text-ink leading-none pb-0.5">
                    {s.value}
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-ink-3">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      {featuredEvents.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <div className="tp-reveal mb-8 md:mb-10 max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">On sale now</p>
            <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">
              {featuredEvents.length === 1 ? "Our launch event." : "What's on."}
            </h2>
            <p className="mt-3 text-[15px] text-ink-2">The calendar is filling up fast. <Link href="/events" className="text-navy font-semibold hover:underline">See what else is on</Link>.</p>
          </div>

          <div className={featuredEvents.length === 1 ? "max-w-md mx-auto" : "columns-1 sm:columns-2 lg:columns-3 gap-5 md:gap-6 space-y-5 md:space-y-6"}>
            {featuredEvents.map((e, i) => (
              <div
                key={e.id}
                style={{ animationDelay: `${i * 90}ms` }}
                className="tp-fade-up break-inside-avoid"
              >
                <EventCard {...e} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CATEGORIES */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <div className="tp-reveal mb-8 md:mb-10">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Browse</p>
            <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">By category</h2>
            <p className="mt-3 text-[15px] text-ink-2 max-w-xl">Find the experience you&apos;re after, from sold-out concerts to local marathons and premieres.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {CATEGORIES.map(({ label, value, icon: Icon, gradient, ring, accent }, i) => (
              <Link
                key={value}
                href={`/events?category=${value}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`tp-fade-up group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br ${gradient} p-5 h-36 flex flex-col justify-between hover:shadow-[0_12px_40px_-16px_rgba(10,37,64,0.2)] hover:-translate-y-0.5 active:scale-[0.99] transition-all`}
              >
                <span className={`inline-flex w-9 h-9 items-center justify-center rounded-xl bg-white ring-1 ${ring} shadow-sm`}>
                  <Icon size={17} className={accent} />
                </span>
                <div>
                  <p className="text-[15px] font-semibold tracking-tight text-ink">{label}</p>
                  <p className="text-[12px] text-ink-3 inline-flex items-center gap-1 mt-0.5 group-hover:text-navy transition-colors">
                    Explore <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24 border-t border-line">
        <div className="tp-reveal mb-10 md:mb-14 max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">How it works · end to end</p>
          <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">From discovery to the gate. All on TicketPulse.</h2>
          <p className="mt-3 text-[15px] text-ink-2">We sell the ticket, deliver it as a printable PDF and a mobile QR, and scan it at the gate with our own reader app. One platform, one log, one payout. No third-party scanner contracts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              style={{ animationDelay: `${i * 100}ms` }}
              className="tp-fade-up group relative overflow-hidden rounded-2xl border border-line bg-paper p-6 md:p-7 hover:border-line-2 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-28px_rgba(10,37,64,0.18)] transition-all duration-300"
            >
              <span
                className="pointer-events-none absolute -top-2 -right-1 select-none text-[80px] md:text-[96px] font-bold tracking-tighter leading-none text-paper-3 group-hover:text-blue-soft transition-colors"
                aria-hidden
              >
                0{i + 1}
              </span>

              <div className="relative flex items-center gap-3 mb-5">
                <span className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-blue-soft ring-1 ring-blue/15 group-hover:ring-blue/25 transition-colors">
                  <Icon size={22} className="text-blue" />
                </span>
                <span className="text-[10.5px] font-semibold tracking-[0.2em] text-ink-3 uppercase">Step {i + 1}</span>
              </div>

              <h3 className="relative text-[19px] font-semibold tracking-tight text-ink mb-1.5">{title}</h3>
              <p className="relative text-[14.5px] leading-relaxed text-ink-2">{body}</p>

              <div className="pointer-events-none absolute -bottom-16 -right-12 w-40 h-40 rounded-full bg-blue/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden />
            </div>
          ))}
        </div>

        {/* End-to-end strip */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {[
            { icon: FileText,   k: "Printable PDF",       v: "A4 ticket emailed at checkout. Print at home or keep it as a backup if your phone dies.", tone: "from-blue-soft to-paper-2",   ring: "ring-blue/15",   accent: "text-blue" },
            { icon: Smartphone, k: "Mobile QR",           v: "Live in your account on any device. Same code as the PDF. Pick whichever you have on hand.", tone: "from-green-50 to-paper-2", ring: "ring-green-200/60", accent: "text-green-700" },
            { icon: DoorOpen,   k: "Gate scanner by us",  v: "Organizers run the TicketPulse reader on any phone or tablet. We sell, we deliver, we scan.", tone: "from-violet-50 to-paper-2", ring: "ring-violet-200/60", accent: "text-violet-700" },
          ].map(({ icon: Icon, k, v, tone, ring, accent }, i) => (
            <div
              key={k}
              style={{ animationDelay: `${i * 80}ms` }}
              className="tp-fade-up group relative rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:-translate-y-0.5 transition-all duration-300"
            >
              <span className={`inline-flex w-11 h-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} ring-1 ${ring} shrink-0 mb-3.5`}>
                <Icon size={18} className={accent} />
              </span>
              <p className="text-[14.5px] font-semibold tracking-tight text-ink">{k}</p>
              <p className="mt-1 text-[12.5px] text-ink-2 leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <div className="tp-reveal mb-10 max-w-xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">FAQ</p>
            <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">Quick answers.</h2>
            <p className="mt-3 text-[15px] text-ink-2">Still wondering? <Link href="/help" className="text-navy font-semibold hover:underline">Browse the help center</Link> or <Link href="/contact" className="text-navy font-semibold hover:underline">talk to a human</Link>.</p>
          </div>

          <div className="tp-reveal">
            <FAQSection items={FAQ} />
          </div>
        </div>
      </section>

      {/* ORGANIZER CTA */}
      <section className="px-5 md:px-8 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto tp-reveal">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-14">
            {/* One restrained ambient detail: a soft blue glow in the top-right corner. */}
            <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-blue/30 blur-3xl pointer-events-none" aria-hidden />
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #ffffff20 1px, transparent 1px), linear-gradient(to bottom, #ffffff20 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
              aria-hidden
            />

            <div className="relative grid md:grid-cols-2 gap-10 md:gap-12 items-start">
              <div>
                <p className="tp-fade-up text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase mb-3">For organizers</p>
                <h2 className="tp-fade-up-1 font-bold tracking-[-0.02em] text-[28px] md:text-[44px] leading-[1.05]">
                  Sell out your next event.
                </h2>
                <p className="tp-fade-up-2 mt-4 text-[15.5px] md:text-[17px] leading-relaxed text-white/80 max-w-lg">
                  Launch in minutes. Verified payouts, mobile QR entry, and built-in shuttle, merch, and photo bundles. Keep more of every ticket.
                </p>
                <div className="tp-fade-up-3 mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/auth/signup?role=organizer"
                    className="group inline-flex items-center gap-2 rounded-xl bg-white text-navy font-semibold px-5 py-3.5 text-sm shadow-sm shadow-black/10 hover:bg-paper-2 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/20 active:scale-[0.99] active:translate-y-0 transition-all"
                  >
                    <Ticket size={15} /> Start selling
                    <ArrowRight size={14} className="opacity-0 -ml-1 transition-all group-hover:opacity-100 group-hover:ml-0" />
                  </Link>
                  <Link
                    href="/events"
                    className="group inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 text-white font-semibold px-5 py-3.5 text-sm hover:bg-white/10 hover:border-white/30 active:scale-[0.99] transition-all"
                  >
                    See live events <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              </div>

              {/* Stats: align the grid's top edge to the heading on md+ so the eye reads
                  eyebrow → heading || stat-row, side by side. On mobile, natural flow. */}
              <div className="grid grid-cols-2 gap-3 md:gap-4 md:mt-7">
                {[
                  { k: "98%",      l: "Payout success" },
                  { k: "<2 min",   l: "Setup time" },
                  { k: "0%",       l: "Booking fees on you" },
                  { k: "Included", l: "Gate scanner & PDF tickets" },
                ].map(({ k, l }, i) => (
                  <div
                    key={l}
                    style={{ animationDelay: `${120 + i * 80}ms` }}
                    className="tp-fade-up group relative overflow-hidden rounded-2xl bg-white/[0.06] border border-white/10 px-4 pt-5 pb-4 backdrop-blur hover:bg-white/[0.09] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {/* Delicate accent bar — tells the eye these are stats, not links. */}
                    <span
                      className="absolute left-4 top-0 h-px w-8 bg-gradient-to-r from-blue/60 to-transparent group-hover:w-12 transition-all duration-300"
                      aria-hidden
                    />
                    <p className="text-[22px] md:text-[26px] font-bold tracking-tight leading-none pb-1">
                      {k}
                    </p>
                    <p className="text-[12.5px] text-white/70 mt-1.5 leading-snug">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
