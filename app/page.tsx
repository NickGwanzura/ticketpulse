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
  ArrowRight, ArrowUpRight, Search, Ticket, Smartphone,
  Music, Trophy, Film, Building2, Mountain, Footprints, MousePointerClick,
  FileText, ScanLine,
} from "lucide-react"
import EventCard from "@/components/events/EventCard"
import { FAQ as FAQSection } from "@/components/ui/Accordion"
import { getFeaturedEvents } from "@/lib/events"
import { db } from "@/db"
import { events as eventsTable, ticketTiers } from "@/db/schema"
import { and, asc, eq, inArray, sql } from "drizzle-orm"

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

const CATEGORIES = [
  { label: "Concerts",    value: "concert",    icon: Music },
  { label: "Marathons",   value: "marathon",   icon: Trophy },
  { label: "Film",        value: "film",       icon: Film },
  { label: "Exhibitions", value: "exhibition", icon: Building2 },
  { label: "Expeditions", value: "expedition", icon: Mountain },
  { label: "Walkathons",  value: "walkathon",  icon: Footprints },
]

const FILTER_CHIPS = [
  { label: "All",         value: "all" },
  { label: "Concerts",    value: "concert" },
  { label: "Marathons",   value: "marathon" },
  { label: "Film",        value: "film" },
  { label: "Exhibitions", value: "exhibition" },
  { label: "Expeditions", value: "expedition" },
  { label: "Walkathons",  value: "walkathon" },
]

const STEPS = [
  { icon: MousePointerClick, title: "Browse & buy in 60s", body: "Find concerts, marathons, premieres, and more. Pay with EcoCash or Visa. No signup, no friction — just an email and a phone number." },
  { icon: FileText,          title: "One-click verify",    body: "We email a magic link the moment you pay. Click it once and your printable PDF + mobile QR drop in, and your account is created and signed in." },
  { icon: Smartphone,        title: "Tickets on WhatsApp", body: "Your ticket QR and event details land directly on your phone via WhatsApp after purchase. No app to download, no email to search for." },
  { icon: ScanLine,          title: "We scan you in",      body: "Our gate-scanner app, run by the organizer, reads your QR off paper, screen, wallet pass, or your WhatsApp chat. End to end on TicketPulse." },
]

const CTA_STATS = [
  { k: "0%",       l: "Setup fees" },
  { k: "24h",      l: "To payout" },
  { k: "EcoCash",  l: "+ Visa accepted" },
  { k: "Built-in", l: "Gate scanner" },
]

export default async function Home() {
  const featuredEvents = await getFeaturedEvents(3)
  const eventsOnSale = featuredEvents.length

  // ── Published events starting now or later, soonest first ──
  const allPublished = await db
    .select({
      id: eventsTable.id,
      slug: eventsTable.slug,
      title: eventsTable.title,
      category: eventsTable.category,
      venue: eventsTable.venue,
      city: eventsTable.city,
      startsAt: eventsTable.startsAt,
      coverImage: eventsTable.coverImage,
      featured: eventsTable.featured,
      status: eventsTable.status,
    })
    .from(eventsTable)
    .where(and(
      eq(eventsTable.status, "published"),
      sql`COALESCE(${eventsTable.endsAt}, ${eventsTable.startsAt} + INTERVAL '6 hours') >= NOW()`,
    ))
    .orderBy(asc(eventsTable.startsAt))
    .limit(30)

  const priceByEvent = new Map<string, { price: number; currency: string }>()
  if (allPublished.length > 0) {
    const priceRows = await db
      .select({
        eventId: ticketTiers.eventId,
        price: ticketTiers.price,
        currency: ticketTiers.currency,
      })
      .from(ticketTiers)
      .where(inArray(ticketTiers.eventId, allPublished.map((e) => e.id)))
    for (const t of priceRows) {
      const p = Number(t.price)
      const c = t.currency ?? "USD"
      const cur = priceByEvent.get(t.eventId)
      if (!cur || p < cur.price) priceByEvent.set(t.eventId, { price: p, currency: c })
    }
  }

  const eventsByCategory = new Map<string, typeof allPublished>()
  for (const ev of allPublished) {
    const cat = ev.category.toLowerCase()
    if (!eventsByCategory.has(cat)) eventsByCategory.set(cat, [])
    eventsByCategory.get(cat)!.push(ev)
  }

  const upcoming = allPublished.slice(0, 6).map((e) => {
    const price = priceByEvent.get(e.id)
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      category: e.category,
      venue: e.venue,
      city: e.city,
      startsAt: e.startsAt,
      coverImage: e.coverImage,
      featured: e.featured ?? false,
      lowestPrice: price?.price ?? null,
      currency: price?.currency ?? "USD",
      status: e.status ?? "published",
    }
  })

  return (
    <main className="bg-paper text-ink">
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative border-b border-line overflow-hidden">
        {/* subtle grid backdrop, faded toward the bottom */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(11,15,25,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,15,25,0.035) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
          }}
          aria-hidden
        />

        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-20 md:pt-28 pb-16 md:pb-20 text-center">
          <span className="tp-fade-up inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 border border-line rounded-full px-3.5 py-1.5 bg-paper">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            Now live in Harare, Bulawayo, Vic Falls &amp; 3 more
          </span>

          <h1 className="tp-fade-up-1 mx-auto mt-7 max-w-3xl font-bold tracking-[-0.03em] text-[42px] leading-[1.04] sm:text-[58px] md:text-[68px] md:leading-[1.02] text-ink">
            Tickets, done<br className="hidden sm:block" /> properly.
          </h1>

          <p className="tp-fade-up-2 mx-auto mt-6 max-w-xl text-[16px] md:text-[17px] leading-relaxed text-ink-2">
            Discover and buy tickets to Zimbabwe&apos;s best events — concerts, marathons, premieres and more. Plus merch, shuttle passes and photo packs, all in one checkout.
          </p>

          {/* search */}
          <form
            action="/events"
            method="get"
            className="tp-fade-up-3 mx-auto mt-9 flex items-center gap-2 max-w-xl bg-paper border border-line-2 rounded-xl p-1.5 shadow-sm shadow-ink/[0.03]"
          >
            <div className="flex-1 flex items-center gap-2.5 pl-3">
              <Search size={18} className="text-ink-3 shrink-0" />
              <input
                type="text"
                name="q"
                placeholder="Search events, venues, artists…"
                className="bg-transparent outline-none text-[15px] w-full placeholder:text-ink-3 py-2.5 text-ink"
              />
            </div>
            <button
              type="submit"
              className="bg-brand text-white font-semibold text-[15px] px-6 py-2.5 rounded-lg hover:bg-brand-700 active:scale-[0.99] transition-all"
            >
              Search
            </button>
          </form>

          {/* stats */}
          <div className="tp-fade-up-4 mt-12 flex items-center justify-center gap-8 md:gap-10">
            {[
              { v: eventsOnSale > 0 ? `${eventsOnSale}` : "Live", l: eventsOnSale === 1 ? "Event on sale" : "Events on sale" },
              { v: "EcoCash · Visa", l: "Pay your way" },
              { v: "24h", l: "Organiser payouts" },
            ].map((s, i) => (
              <div key={s.l} className="flex items-center gap-8 md:gap-10">
                {i > 0 && <span className="w-px h-8 bg-line" aria-hidden />}
                <div>
                  <div className="font-bold text-[18px] md:text-[20px] tracking-tight tabular-nums text-ink">{s.v}</div>
                  <div className="text-[13px] text-ink-3">{s.l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UPCOMING EVENTS ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-20">
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <h2 className="font-bold tracking-tight text-[28px] md:text-[34px] leading-tight text-ink">
              {upcoming.length <= 1 ? "On sale now" : "Upcoming events"}
            </h2>
            <p className="text-ink-3 mt-1.5 text-[15px]">
              {upcoming.length === 0
                ? "No events live yet — check back soon."
                : "Showing events near you, soonest first."}
            </p>
          </div>
          <Link href="/events" className="hidden sm:inline-flex items-center gap-1 text-[14px] text-brand font-semibold hover:gap-1.5 transition-all">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {/* filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {FILTER_CHIPS.map((chip) => (
            <Link
              key={chip.value}
              href={chip.value === "all" ? "/events" : `/events?category=${chip.value}`}
              className={`text-[13px] font-medium px-3.5 py-1.5 rounded-full border transition-all ${
                chip.value === "all"
                  ? "bg-ink text-white border-ink"
                  : "bg-paper-2 border-line text-ink-2 hover:text-ink hover:border-line-2"
              }`}
            >
              {chip.label}
            </Link>
          ))}
        </div>

        {upcoming.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {upcoming.map((e, i) => (
              <div key={e.id} style={{ animationDelay: `${i * 70}ms` }} className="tp-fade-up">
                <EventCard {...e} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-12 text-center">
            <p className="text-[15px] font-medium text-ink mb-1">No events yet</p>
            <p className="text-sm text-ink-2">Check back soon — organisers are coming online.</p>
          </div>
        )}
      </section>

      {/* ── CATEGORIES ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-20">
        <h2 className="font-bold tracking-tight text-[28px] md:text-[34px] leading-tight text-ink mb-7">Browse by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {CATEGORIES.map(({ label, value, icon: Icon }) => {
            const count = eventsByCategory.get(value)?.length ?? 0
            return (
              <Link
                key={value}
                href={`/events?category=${value}`}
                className="group rounded-xl border border-line bg-paper p-5 hover:border-brand/40 hover:shadow-[0_12px_40px_-16px_rgba(11,15,25,0.18)] hover:-translate-y-0.5 transition-all"
              >
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-brand-50 text-brand">
                  <Icon size={18} />
                </span>
                <p className="mt-3 text-[15px] font-semibold tracking-tight text-ink">{label}</p>
                <p className="text-[12.5px] text-ink-3 mt-0.5">{count > 0 ? `${count} upcoming` : "Browse"}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-24">
        <div className="max-w-2xl mb-10">
          <h2 className="font-bold tracking-tight text-[28px] md:text-[34px] leading-tight text-ink">From discovery to the gate. All on TicketPulse.</h2>
          <p className="mt-3 text-[15px] text-ink-2">We sell the ticket, deliver it as a printable PDF and a mobile QR, and scan it at the gate with our own reader app. One platform, one log, one payout.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="rounded-2xl border border-line bg-paper p-6 hover:border-line-2 transition-colors">
              <div className="flex items-center justify-between mb-5">
                <span className="inline-flex w-11 h-11 items-center justify-center rounded-xl bg-brand-50 text-brand">
                  <Icon size={20} />
                </span>
                <span className="text-[12px] font-semibold tracking-[0.16em] text-ink-3 uppercase tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight text-ink mb-1.5">{title}</h3>
              <p className="text-[14px] leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 md:px-8 pt-16 md:pt-24">
        <div className="mb-8 max-w-xl">
          <h2 className="font-bold tracking-tight text-[28px] md:text-[34px] leading-tight text-ink">Quick answers.</h2>
          <p className="mt-3 text-[15px] text-ink-2">Still wondering? <Link href="/help" className="text-brand font-semibold hover:underline">Browse the help center</Link> or <Link href="/contact" className="text-brand font-semibold hover:underline">talk to a human</Link>.</p>
        </div>
        <FAQSection items={FAQ} />
      </section>

      {/* ── ORGANIZER CTA ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-16 md:pt-24 pb-20 md:pb-28">
        <div className="rounded-2xl border border-line bg-paper p-8 md:p-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-brand uppercase mb-3">For organizers</p>
            <h2 className="font-bold tracking-[-0.02em] text-[28px] md:text-[40px] leading-[1.06] text-ink">
              Sell tickets to your event. Get paid in 24 hours.
            </h2>
            <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed text-ink-2 max-w-lg">
              Build your event, sell tickets, merch and shuttle passes, scan at the gate with our built-in app, and get paid out within a day of the show ending.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/auth/signup?role=organizer"
                className="group inline-flex items-center gap-2 rounded-lg bg-brand text-white font-semibold px-5 py-3 text-sm hover:bg-brand-700 active:scale-[0.99] transition-all"
              >
                <Ticket size={15} /> Become an organiser
                <ArrowRight size={14} className="opacity-0 -ml-1 transition-all group-hover:opacity-100 group-hover:ml-0" />
              </Link>
              <Link
                href="/events"
                className="group inline-flex items-center gap-2 rounded-lg border border-line-2 bg-paper text-ink font-semibold px-5 py-3 text-sm hover:border-ink/30 active:scale-[0.99] transition-all"
              >
                See live events <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {CTA_STATS.map(({ k, l }) => (
              <div key={l} className="rounded-xl border border-line p-5">
                <div className="font-bold text-[22px] tracking-tight text-ink">{k}</div>
                <div className="text-[13px] text-ink-3 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
