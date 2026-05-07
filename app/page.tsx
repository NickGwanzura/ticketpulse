import Link from "next/link"
import {
  ArrowRight, ArrowUpRight, Search, Ticket, Smartphone, Wallet,
  Music, Trophy, Film, Building2, Mountain, Footprints, MousePointerClick,
  Calendar, MapPin, Star, Quote, FileText, ScanLine, DoorOpen,
} from "lucide-react"
import EventCard from "@/components/events/EventCard"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const PARTNERS = [
  "EcoCash", "Old Mutual", "Econet", "Dairibord", "Stanbic Bank",
  "Worker Bees Africa", "Delta Beverages", "ZTV", "Nyaradzo",
]

const TESTIMONIALS = [
  {
    quote: "We sold out the marathon in 9 days. The shuttle and merch bundles took the back-office work off our plate completely.",
    name: "Tendai Moyo",
    role: "Director, Worker Bees Africa",
    initials: "TM",
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    quote: "Verified payouts in USD the day after our event. After years of chasing organizers, this is what running a small catering business should feel like.",
    name: "Rumbidzai Sibanda",
    role: "Owner, Mama's Kitchen",
    initials: "RS",
    color: "from-amber-500 to-rose-500",
  },
  {
    quote: "Mobile QR entry handled 1,200 runners in a tent with one bar of signal. I've never seen a queue move that fast.",
    name: "Farai Chikomba",
    role: "Race director, Nyuki Marathon",
    initials: "FC",
    color: "from-sky-500 to-blue-600",
  },
]

const FAQ = [
  { q: "How do I get my ticket after I buy?",       a: "Instantly. You get a printable PDF ticket by email and inside your TicketPulse account, plus a mobile QR. The QR is bound to your account, so you can sign in on any device the day-of." },
  { q: "Who scans the tickets at the gate?",        a: "We do. TicketPulse ships with a built-in gate-scanner app that organizers run on any phone or tablet — it reads the QR from a printed PDF, your phone, or wallet pass and checks you in instantly. No third-party scanners, no extra hardware fees." },
  { q: "Can I get a refund?",                       a: "Yes, full refund up to 24 hours before the event, processed back to your original payment method (instant for EcoCash, 24–72h for cards)." },
  { q: "What payments do you accept?",              a: "EcoCash, Paynow, USD cash at venue, ZAR, GBP, and Visa / Mastercard / AmEx. We pick the best processor at checkout based on your method." },
  { q: "Is TicketPulse only for Harare?",           a: "We started here, but events are live in Bulawayo, Vic Falls, Mutare, Pretoria, Durban, and London. New cities open every month." },
  { q: "How do I sell tickets to my own event?",    a: "Sign up as an organizer, build your event in the dashboard, and share your link. We pay out within 24h of the event ending." },
  { q: "What about photo packs and merch?",         a: "Built-in. Organizers can add merch and photo packs that attendees can buy at checkout or after the event, no extra integrations." },
]

const FEATURED_EVENTS = [
  {
    id: "1", slug: "rumble-in-sa-pretoria-2026", title: "Rumble in SA 2026, Pretoria",
    category: "concert", venue: "Propaganda", city: "Pretoria", startsAt: new Date("2026-05-17T12:00:00"),
    featured: true, lowestPrice: 350, currency: "ZAR", status: "published",
  },
  {
    id: "2", slug: "nyuki-marathon-2026", title: "Nyuki Marathon 2026: One Bee, Million Futures",
    category: "marathon", venue: "National Sports Stadium", city: "Harare", startsAt: new Date("2026-05-17T06:00:00"),
    featured: true, lowestPrice: 5, currency: "USD", status: "published",
  },
  {
    id: "3", slug: "becoming-madam-boss-harare", title: "Becoming Madam Boss: Film Premiere",
    category: "film", venue: "Ster-Kinekor", city: "Harare", startsAt: new Date("2026-05-30T18:00:00"),
    featured: true, lowestPrice: 15, currency: "USD", status: "published",
  },
]

const HERO_TICKETS = [
  {
    title: "Nyuki Marathon 2026",
    venue: "National Sports Stadium · Harare",
    date: new Date("2026-05-17T06:00:00"),
    price: 5,
    currency: "USD",
    emoji: "🏃",
    gradient: "from-sky-100 via-blue-50 to-cyan-50",
    accent: "text-sky-700",
    badge: { label: "ON SALE", color: "bg-emerald-600 text-white" },
    rotate: "lg:-rotate-[3deg]",
    placement: "lg:top-4 lg:right-12 lg:left-auto",
    z: "z-30",
  },
  {
    title: "Rumble in SA, Pretoria",
    venue: "Propaganda · Pretoria",
    date: new Date("2026-05-17T12:00:00"),
    price: 350,
    currency: "ZAR",
    emoji: "🎵",
    gradient: "from-violet-100 via-fuchsia-50 to-pink-50",
    accent: "text-violet-700",
    badge: { label: "FEATURED", color: "bg-navy text-white" },
    rotate: "lg:rotate-[2deg]",
    placement: "lg:top-32 lg:left-2 lg:right-auto",
    z: "z-20",
  },
  {
    title: "Becoming Madam Boss",
    venue: "Ster-Kinekor · Harare",
    date: new Date("2026-05-30T18:00:00"),
    price: 15,
    currency: "USD",
    emoji: "🎬",
    gradient: "from-amber-100 via-orange-50 to-rose-50",
    accent: "text-amber-700",
    badge: { label: "LIVE", color: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60", pulse: true },
    rotate: "lg:-rotate-[4deg]",
    placement: "lg:top-[260px] lg:right-4 lg:left-auto",
    z: "z-10",
  },
]

const AVATARS = [
  { initials: "TM", bg: "from-violet-500 to-fuchsia-500" },
  { initials: "RS", bg: "from-sky-500 to-blue-600" },
  { initials: "FC", bg: "from-emerald-500 to-teal-600" },
  { initials: "NT", bg: "from-amber-500 to-rose-500" },
]

const CATEGORIES = [
  { label: "Concerts",    value: "concert",    icon: Music,      gradient: "from-violet-50 to-fuchsia-50",   ring: "ring-violet-200/60",   accent: "text-violet-700" },
  { label: "Marathons",   value: "marathon",   icon: Trophy,     gradient: "from-sky-50 to-blue-50",         ring: "ring-sky-200/60",      accent: "text-sky-700" },
  { label: "Walkathons",  value: "walkathon",  icon: Footprints, gradient: "from-emerald-50 to-teal-50",     ring: "ring-emerald-200/60",  accent: "text-emerald-700" },
  { label: "Film",        value: "film",       icon: Film,       gradient: "from-amber-50 to-orange-50",     ring: "ring-amber-200/60",    accent: "text-amber-700" },
  { label: "Exhibitions", value: "exhibition", icon: Building2,  gradient: "from-slate-50 to-indigo-50",     ring: "ring-indigo-200/60",   accent: "text-indigo-700" },
  { label: "Expeditions", value: "expedition", icon: Mountain,   gradient: "from-lime-50 to-emerald-50",     ring: "ring-lime-200/60",     accent: "text-lime-700" },
]

const STATS = [
  { value: "120+",   label: "Events live",          delta: "+12 this month" },
  { value: "50K",    label: "Tickets sold",         delta: "+2.4K this week" },
  { value: "320",    label: "Verified organizers",  delta: "+18 this month" },
  { value: "12",     label: "Cities covered",       delta: "+2 in 2026" },
]

const STEPS = [
  { icon: MousePointerClick, title: "Browse & buy",   body: "Find concerts, marathons, premieres, and more. Pay with EcoCash, Paynow, USD, ZAR, or card in seconds." },
  { icon: FileText,          title: "Get your ticket", body: "Printable PDF by email and a mobile QR in your account — same code, your choice. Save to wallet, print at home, or screenshot it." },
  { icon: ScanLine,          title: "We scan you in",  body: "Our gate-scanner app, run by the organizer, reads your QR off paper, screen, or wallet pass. End to end on TicketPulse — no third-party scanners." },
]

const FADE_DELAY = ["80ms", "180ms", "280ms"] as const

function HeroTicketCard({ ticket, index = 0 }: { ticket: (typeof HERO_TICKETS)[number]; index?: number }) {
  return (
    <div
      style={{ animationDelay: FADE_DELAY[index] ?? "0ms" }}
      className={`tp-fade-up relative lg:absolute ${ticket.placement ?? ""} ${ticket.rotate ?? ""} ${ticket.z ?? ""} w-full max-w-[280px] rounded-2xl border border-line bg-paper shadow-[0_24px_60px_-24px_rgba(10,37,64,0.25)] overflow-hidden transition-transform duration-500 hover:rotate-0 hover:scale-[1.02] hover:z-40`}
    >
      <div className={`relative h-24 bg-gradient-to-br ${ticket.gradient} flex items-center justify-center`}>
        <div className="absolute inset-0 [background:radial-gradient(400px_circle_at_30%_20%,rgba(255,255,255,0.65),transparent_60%)]" />
        <span className="text-3xl relative">{ticket.emoji}</span>
        <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 ${ticket.badge.color} text-[9.5px] font-semibold tracking-wide px-2 py-0.5 rounded-full`}>
          {ticket.badge.pulse && (
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
              <span className="relative block w-1.5 h-1.5 rounded-full bg-rose-500" />
            </span>
          )}
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
            <span className="text-[10px] text-ink-3 font-normal mr-1">From</span>
            {formatCurrency(ticket.price, ticket.currency)}
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

export default function Home() {
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
        <div className="absolute top-[58%] left-[12%] -z-10 w-1 h-1 rounded-full bg-emerald-500/70 shadow-[0_0_12px_3px_rgba(16,185,129,0.3)] animate-pulse [animation-delay:1.2s]" aria-hidden />
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
              <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-paper/80 backdrop-blur pl-2.5 pr-3.5 py-1.5 mb-7 shadow-sm shadow-ink/5">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                  <span className="relative block w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11.5px] font-semibold tracking-[0.04em] text-ink">
                  <span className="text-emerald-700">12 events</span>
                  <span className="text-ink-3"> on sale today</span>
                </span>
              </div>

              <h1 className="font-bold tracking-[-0.035em] text-[44px] leading-[1.0] sm:text-[60px] md:text-[76px] md:leading-[0.96] text-ink">
                Every event.<br />
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-navy via-navy-700 to-blue bg-clip-text text-transparent">One ticket.</span>
                  <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden>
                    <path className="tp-stroke-draw" d="M0 5 Q 50 0, 100 5 T 200 5" stroke="#0570DE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="mt-6 text-[16.5px] md:text-[19px] leading-relaxed text-ink-2 max-w-xl">
                Concerts, marathons, premieres, and more. Discover what&apos;s on, grab a ticket, and walk in — printable PDF or mobile QR, scanned at the gate by our own app. End to end, on one platform.
              </p>

              <form action="/events" className="mt-9 flex flex-col sm:flex-row gap-2.5 max-w-2xl">
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

              <div className="mt-5 inline-flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-full border border-line/80 bg-paper/70 backdrop-blur pl-3.5 pr-4 py-1.5 shadow-sm shadow-ink/[0.03] text-[12px] text-ink-2">
                <span className="inline-flex items-center gap-1.5"><Wallet size={12.5} className="text-emerald-600" /> Pay your way</span>
                <span className="hidden md:inline-block w-px h-3 bg-line/80" aria-hidden />
                <span className="inline-flex items-center gap-1.5"><FileText size={12.5} className="text-emerald-600" /> PDF + mobile QR</span>
                <span className="hidden md:inline-block w-px h-3 bg-line/80" aria-hidden />
                <span className="inline-flex items-center gap-1.5"><ScanLine size={12.5} className="text-emerald-600" /> Our gate scanner</span>
              </div>

              {/* Social proof */}
              <div className="mt-8 inline-flex items-center gap-3.5 rounded-2xl border border-line bg-paper/60 backdrop-blur px-4 py-2.5">
                <div className="flex -space-x-2">
                  {AVATARS.map((a) => (
                    <span
                      key={a.initials}
                      className={`inline-flex w-7 h-7 items-center justify-center rounded-full bg-gradient-to-br ${a.bg} text-white text-[10px] font-semibold ring-2 ring-paper shadow-sm`}
                    >
                      {a.initials}
                    </span>
                  ))}
                  <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-full bg-navy text-white text-[10px] font-semibold ring-2 ring-paper shadow-sm">
                    +5K
                  </span>
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={11} className="text-amber-500 fill-amber-500" />
                    ))}
                    <span className="text-[11.5px] font-semibold text-ink">4.9</span>
                  </div>
                  <p className="text-[11.5px] text-ink-3 mt-0.5">5,840 attendees this month</p>
                </div>
              </div>
            </div>

            {/* RIGHT. Floating ticket cards */}
            <div className="relative h-[420px] lg:h-[480px] hidden sm:block">
              {/* Decorative glow */}
              <div className="absolute inset-0 -z-10 [background:radial-gradient(500px_circle_at_50%_45%,rgba(5,112,222,0.10),transparent_60%)] pointer-events-none" />

              {/* Mobile/tablet: stack horizontally with snap */}
              <div className="lg:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-5 px-5 scrollbar-none">
                {HERO_TICKETS.map((t) => (
                  <div key={t.title} className="snap-center shrink-0 w-[280px]">
                    <HeroTicketCard ticket={t} />
                  </div>
                ))}
              </div>

              {/* Desktop: absolute floating */}
              <div className="hidden lg:block relative h-full">
                {HERO_TICKETS.map((t, i) => (
                  <HeroTicketCard key={t.title} ticket={t} index={i} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-line bg-paper/60 backdrop-blur">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-7 md:py-9">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 md:gap-x-0 md:gap-y-0 md:divide-x md:divide-line">
              {STATS.map((s, i) => (
                <div key={i} className="md:px-6 md:first:pl-0 md:last:pr-0">
                  <p className="text-[26px] md:text-[32px] font-bold tracking-tight text-ink leading-none tabular-nums">
                    {s.value}
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-ink-3">{s.label}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold tracking-wide text-emerald-700">
                    <span className="inline-block w-1 h-1 rounded-full bg-emerald-500" aria-hidden />
                    {s.delta}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section className="border-b border-line bg-paper">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-12">
          <p className="text-center text-[11px] font-semibold tracking-[0.22em] text-ink-3 uppercase mb-7">
            Trusted by leading organizers across Southern Africa
          </p>
          <div className="relative">
            <div
              className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to right, var(--color-paper), transparent)" }}
              aria-hidden
            />
            <div
              className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to left, var(--color-paper), transparent)" }}
              aria-hidden
            />
            <div className="overflow-hidden">
              <div className="flex items-center gap-10 md:gap-14 whitespace-nowrap animate-[tp-marquee_36s_linear_infinite] hover:[animation-play-state:paused]">
                {[...PARTNERS, ...PARTNERS].map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    className="inline-flex items-center text-[15px] md:text-[17px] font-semibold tracking-tight text-ink-2/80 hover:text-ink transition-colors"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <style>{`
            @keyframes tp-marquee {
              from { transform: translateX(0); }
              to   { transform: translateX(-50%); }
            }
          `}</style>
        </div>
      </section>

      {/* FEATURED */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 md:mb-10">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Trending</p>
            <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">Featured events</h2>
            <p className="mt-3 text-[15px] text-ink-2 max-w-xl">Hand-picked happenings on sale right now — the ones our team is going to themselves.</p>
          </div>
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:gap-1.5 transition-all"
          >
            View all events <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {FEATURED_EVENTS.map((e) => (
            <EventCard key={e.id} {...e} />
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <div className="mb-8 md:mb-10">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Browse</p>
            <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">By category</h2>
            <p className="mt-3 text-[15px] text-ink-2 max-w-xl">Find the experience you&apos;re after, from sold-out concerts to local marathons and premieres.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {CATEGORIES.map(({ label, value, icon: Icon, gradient, ring, accent }) => (
              <Link
                key={value}
                href={`/events?category=${value}`}
                className={`group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br ${gradient} p-5 h-36 flex flex-col justify-between hover:shadow-[0_12px_40px_-16px_rgba(10,37,64,0.2)] hover:-translate-y-0.5 transition-all`}
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

      {/* TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24">
        <div className="mb-10 md:mb-12 max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Customer stories</p>
          <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">Loved by organizers and vendors.</h2>
          <p className="mt-3 text-[15px] text-ink-2">From sold-out marathons to weekly jazz nights — the people running events on TicketPulse, in their own words.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="relative flex flex-col rounded-2xl border border-line bg-paper p-6 md:p-7 hover:border-line-2 hover:shadow-[0_18px_60px_-24px_rgba(10,37,64,0.18)] transition-all duration-300"
            >
              <Quote size={22} className="text-blue/50 mb-4" />
              <blockquote className="flex-1">
                <p className="text-[15px] leading-relaxed text-ink">&ldquo;{t.quote}&rdquo;</p>
              </blockquote>
              <div className="mt-5 flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} className="text-amber-500 fill-amber-500" />
                ))}
              </div>
              <figcaption className="flex items-center gap-3 pt-4 border-t border-line">
                <span className={`inline-flex w-9 h-9 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-white text-[12px] font-semibold ring-2 ring-paper shadow-sm shrink-0`}>
                  {t.initials}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold tracking-tight text-ink truncate">{t.name}</p>
                  <p className="text-[12px] text-ink-3 truncate">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24 border-t border-line">
        <div className="mb-10 md:mb-14 max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">How it works · end to end</p>
          <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">From discovery to the gate. All on TicketPulse.</h2>
          <p className="mt-3 text-[15px] text-ink-2">We sell the ticket, deliver it as a printable PDF and a mobile QR, and scan it at the gate with our own reader app. One platform, one log, one payout — no third-party scanner contracts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-line bg-paper p-6 md:p-7 hover:border-line-2 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-28px_rgba(10,37,64,0.18)] transition-all duration-300"
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
            { icon: Smartphone, k: "Mobile QR",           v: "Live in your account on any device. Same code as the PDF — pick whichever you have on hand.", tone: "from-emerald-50 to-paper-2", ring: "ring-emerald-200/60", accent: "text-emerald-700" },
            { icon: DoorOpen,   k: "Gate scanner by us",  v: "Organizers run the TicketPulse reader on any phone or tablet. We sell, we deliver, we scan.", tone: "from-violet-50 to-paper-2", ring: "ring-violet-200/60", accent: "text-violet-700" },
          ].map(({ icon: Icon, k, v, tone, ring, accent }) => (
            <div key={k} className="group relative rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:-translate-y-0.5 transition-all duration-300">
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
          <div className="mb-10 max-w-xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">FAQ</p>
            <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">Quick answers.</h2>
            <p className="mt-3 text-[15px] text-ink-2">Still wondering? <Link href="/help" className="text-navy font-semibold hover:underline">Browse the help center</Link> or <Link href="/contact" className="text-navy font-semibold hover:underline">talk to a human</Link>.</p>
          </div>

          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-line bg-paper p-5 md:p-6 hover:border-line-2 open:border-blue/30 open:shadow-[0_18px_50px_-30px_rgba(5,112,222,0.30)] transition-all [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between gap-3 cursor-pointer">
                  <p className="text-[15px] font-semibold tracking-tight text-ink group-open:text-navy transition-colors">{f.q}</p>
                  <span className="shrink-0 inline-flex w-7 h-7 items-center justify-center rounded-full bg-paper-2 ring-1 ring-line text-ink-2 text-lg leading-none transition-transform group-open:rotate-45 group-open:bg-navy group-open:text-white group-open:ring-navy/20">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ORGANIZER CTA */}
      <section className="px-5 md:px-8 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-14">
            <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-blue/30 blur-3xl pointer-events-none" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #ffffff20 1px, transparent 1px), linear-gradient(to bottom, #ffffff20 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
              aria-hidden
            />

            <div className="relative grid md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase mb-3">For organizers</p>
                <h2 className="font-bold tracking-[-0.02em] text-[28px] md:text-[44px] leading-[1.05]">
                  Sell out your next event.
                </h2>
                <p className="mt-4 text-[15.5px] md:text-[17px] leading-relaxed text-white/80 max-w-lg">
                  Launch in minutes. Verified payouts, mobile QR entry, and built-in shuttle, merch, and photo bundles. Keep more of every ticket.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/auth/signup?role=organizer"
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-navy font-semibold px-5 py-3.5 text-sm hover:bg-paper-2 active:scale-[0.99] transition"
                  >
                    <Ticket size={15} /> Start selling
                  </Link>
                  <Link
                    href="/events"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 text-white font-semibold px-5 py-3.5 text-sm hover:bg-white/10 transition"
                  >
                    See live events <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {[
                  { k: "98%",     l: "Payout success" },
                  { k: "<2 min",  l: "Setup time" },
                  { k: "0%",      l: "Booking fees on you" },
                  { k: "Included", l: "Gate scanner & PDF tickets" },
                ].map(({ k, l }) => (
                  <div key={l} className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 backdrop-blur hover:bg-white/[0.09] transition-colors">
                    <p className="text-[22px] md:text-[26px] font-bold tracking-tight">{k}</p>
                    <p className="text-[12.5px] text-white/70 mt-1">{l}</p>
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
