import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "TicketPulse — Event tickets, vendors and payouts",
  description: "Sell event tickets with QR validation, attendee tools, vendors, reviews, and payouts on one TicketPulse platform.",
  openGraph: {
    title: "TicketPulse — Event tickets, vendors and payouts",
    description: "Sell event tickets with QR validation, attendee tools, vendors, reviews, and payouts on one TicketPulse platform.",
  },
  twitter: {
    title: "TicketPulse — Event tickets, vendors and payouts",
    description: "Sell event tickets with QR validation, attendee tools, vendors, reviews, and payouts on one TicketPulse platform.",
  },
  alternates: {
    canonical: "/",
  },
}
import {
  ArrowRight, ArrowUpRight, Ticket, Smartphone, Wallet,
  Music, Trophy, Film, Building2, Mountain, Footprints,
  Calendar, MapPin, FileText, ScanLine, DoorOpen, ShieldCheck,
  BarChart3, Megaphone, PhoneCall, ReceiptText, TicketCheck, Users,
} from "lucide-react"
import EventCard from "@/components/events/EventCard"
import HeroEventCard from "@/components/events/HeroEventCard"
import HeroBackgroundSlideshow from "@/components/home/HeroBackgroundSlideshow"
import ReviewHighlights from "@/components/reviews/ReviewHighlights"
import { FAQ as FAQSection } from "@/components/ui/Accordion"
import { formatDateShort } from "@/lib/utils"
import { getFeaturedEvents, type FeaturedEvent } from "@/lib/events"
import { db } from "@/db"
import { events as eventsTable, reviews, ticketTiers } from "@/db/schema"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"

const FAQ = [
  { q: "Do I need an account to buy tickets?",      a: "No. Pay with just your name, email, and phone. Tickets land in your inbox, WhatsApp, and SMS the moment payment clears. Your account is auto-created — no password required." },
  { q: "How do I get my ticket after I buy?",       a: "Instantly after payment clears. You get a printable PDF ticket by email, a mobile QR in your TicketPulse account, a WhatsApp message, and an SMS with your ticket details — all at once. You can also find and resend tickets from order lookup." },
  { q: "What client service is included?",          a: "TicketPulse helps clients before, during, and after the event: secure checkout, instant ticket delivery, order lookup, ticket resend, transfer links, event reviews, and support if payment clears but tickets do not arrive." },
  { q: "Who scans the tickets at the gate?",        a: "We do. TicketPulse ships with a built-in gate-scanner app that organizers run on any phone or tablet. It reads the QR from a printed PDF, your phone, or wallet pass and checks you in instantly. No third-party scanners, no extra hardware fees." },
  { q: "Can I get a refund?",                       a: "Yes, full refund up to 24 hours before the event, processed back to your original payment method (instant for EcoCash, 24 to 72h for cards)." },
  { q: "What payments do you accept?",              a: "EcoCash and Visa cards. Both clear instantly at checkout." },
  { q: "Is TicketPulse only for Harare?",           a: "We started here, but events are live in Bulawayo, Vic Falls, Mutare, Pretoria, Durban, and London. New cities open every month." },
  { q: "How do I sell tickets to my own event?",    a: "Sign up as an organizer, build your event in the dashboard, and share your link. You get sales tracking, attendee exports, broadcasts, scanner stats, payout ledgers, and verified reviews in one place." },
  { q: "What about photo packs and merch?",         a: "Built-in. Organizers can add merch and photo packs that attendees can buy at checkout or after the event, no extra integrations." },
]

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
    { value: "6%",      label: "Organizer fee, pay as you sell" },
  ]
}

const STEPS = [
  { icon: Ticket,      title: "Create ticket tiers",  body: "Build general admission, VIP, early bird, promo codes, staff tickets, merch, and event pages from one dashboard." },
  { icon: Wallet,      title: "Accept real payments", body: "EcoCash and card checkout create a traceable order, ledger entry, ticket record, and payout calculation." },
  { icon: ScanLine,    title: "Run the gate",         body: "QR scanning, duplicate detection, attendee exports, staff access, and live check-in stats keep entry controlled." },
  { icon: ReceiptText, title: "Reconcile and pay out", body: "Track gross sales, confirmed tickets, platform fees, Velocity settlements, paid out, and available balance." },
]

const HERO_TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Secure checkout", tone: "bg-emerald-50", accent: "text-emerald-700", ring: "ring-emerald-200/70" },
  { icon: Smartphone, label: "Instant QR delivery", tone: "bg-sky-50", accent: "text-sky-700", ring: "ring-sky-200/70" },
  { icon: FileText, label: "Order lookup", tone: "bg-amber-50", accent: "text-amber-700", ring: "ring-amber-200/70" },
  { icon: Wallet, label: "Verified payouts", tone: "bg-violet-50", accent: "text-violet-700", ring: "ring-violet-200/70" },
]

const PLATFORM_SERVICES = [
  { title: "Create ticket tiers", body: "Set pricing, capacity, sale windows, limits, promos, questions, staff passes, and publish status.", icon: Ticket, href: "/auth/signup?role=organizer", tone: "from-sky-50 to-blue-50", accent: "text-sky-700", ring: "ring-sky-200/70" },
  { title: "Accept EcoCash and card", body: "Every payment produces an order, payment trace, ledger entry, and ticket delivery event for reconciliation.", icon: Wallet, href: "/pricing", tone: "from-emerald-50 to-teal-50", accent: "text-emerald-700", ring: "ring-emerald-200/70" },
  { title: "Deliver buyer support", body: "PDF tickets, mobile QR, order lookup, resends, transfers, and support emails are handled inside TicketPulse.", icon: Smartphone, href: "/help", tone: "from-amber-50 to-yellow-50", accent: "text-amber-700", ring: "ring-amber-200/70" },
  { title: "Scan at the gate", body: "Organizer scanner validates QR tickets, blocks duplicates, records check-ins, and keeps manifests current.", icon: ScanLine, href: "/how-it-works", tone: "from-violet-50 to-fuchsia-50", accent: "text-violet-700", ring: "ring-violet-200/70" },
  { title: "Export attendees", body: "Download attendee, phone, email, order, ticket, check-in, and question response data for operations.", icon: Users, href: "/organizer", tone: "from-rose-50 to-pink-50", accent: "text-rose-700", ring: "ring-rose-200/70" },
  { title: "Reconcile payouts", body: "See gross sales, fees, settlements, manual payouts, pending amounts, and available balance.", icon: ReceiptText, href: "/payouts", tone: "from-cyan-50 to-sky-50", accent: "text-cyan-700", ring: "ring-cyan-200/70" },
]

const ORGANIZER_PROOF = [
  { title: "Built for real event money", body: "Orders, ticket counts, Velocity traces, payouts, and manual adjustments stay visible instead of living in screenshots and chats.", icon: ReceiptText, tone: "from-amber-50 to-orange-50", accent: "text-amber-700", ring: "ring-amber-200/70" },
  { title: "Buyer service is included", body: "TicketPulse handles delivery, lookup, resend, transfer, expiry, and support moments so organizers are not chasing every buyer manually.", icon: FileText, tone: "from-sky-50 to-cyan-50", accent: "text-sky-700", ring: "ring-sky-200/70" },
  { title: "Mobile gate control", body: "Organizers can scan, admit, reject, and review attendance from the same platform that sold the ticket.", icon: TicketCheck, tone: "from-emerald-50 to-teal-50", accent: "text-emerald-700", ring: "ring-emerald-200/70" },
]

const ORGANIZER_BENEFITS = [
  { icon: ShieldCheck, label: "Built for Zimbabwean payments", tone: "bg-emerald-50", accent: "text-emerald-700", border: "border-emerald-200/70" },
  { icon: Smartphone, label: "Instant buyer ticket delivery", tone: "bg-sky-50", accent: "text-sky-700", border: "border-sky-200/70" },
  { icon: Users, label: "Live attendee counts", tone: "bg-violet-50", accent: "text-violet-700", border: "border-violet-200/70" },
  { icon: Wallet, label: "6% fee shown clearly", tone: "bg-amber-50", accent: "text-amber-700", border: "border-amber-200/70" },
  { icon: ReceiptText, label: "Velocity reconciliation", tone: "bg-cyan-50", accent: "text-cyan-700", border: "border-cyan-200/70" },
  { icon: Megaphone, label: "Email, WhatsApp and SMS tools", tone: "bg-rose-50", accent: "text-rose-700", border: "border-rose-200/70" },
]

export default async function Home() {
  const featuredEvents = await getFeaturedEvents(3)
  const eventsOnSale = featuredEvents.length

  // ── Events by category (for category cards) ──
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
      tags: eventsTable.tags,
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

  const reviewRows = await db
    .select({
      id: reviews.id,
      reviewerName: reviews.reviewerName,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      createdAt: reviews.createdAt,
      eventTitle: eventsTable.title,
    })
    .from(reviews)
    .leftJoin(eventsTable, eq(eventsTable.id, reviews.eventId))
    .where(and(
      eq(reviews.status, "approved"),
      eq(reviews.publicConsent, true),
    ))
    .orderBy(desc(reviews.featured), desc(reviews.createdAt))
    .limit(3)

  const eventsByCategory = new Map<string, typeof allPublished>()
  for (const ev of allPublished) {
    const cat = ev.category.toLowerCase()
    if (!eventsByCategory.has(cat)) eventsByCategory.set(cat, [])
    const list = eventsByCategory.get(cat)!
    if (list.length < 3) list.push(ev)
  }

  const pastEvents = await db
    .select({
      id: eventsTable.id,
      slug: eventsTable.slug,
      title: eventsTable.title,
      category: eventsTable.category,
      venue: eventsTable.venue,
      city: eventsTable.city,
      startsAt: eventsTable.startsAt,
      endsAt: eventsTable.endsAt,
      coverImage: eventsTable.coverImage,
      status: eventsTable.status,
    })
    .from(eventsTable)
    .where(and(
      inArray(eventsTable.status, ["published", "completed"]),
      sql`COALESCE(${eventsTable.endsAt}, ${eventsTable.startsAt} + INTERVAL '6 hours') < NOW()`,
    ))
    .orderBy(desc(sql`COALESCE(${eventsTable.endsAt}, ${eventsTable.startsAt})`))
    .limit(6)

  return (
    <main>
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <HeroBackgroundSlideshow />
        <div className="hidden" aria-hidden>
        {/* Base surface: bright, structured, and quiet enough for the product UI to lead. */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: [
              "linear-gradient(135deg, rgba(246,249,252,0.96) 0%, rgba(255,255,255,0.98) 42%, rgba(238,243,248,0.9) 100%)",
              "linear-gradient(90deg, rgba(5,112,222,0.06) 0%, transparent 36%, rgba(19,17,50,0.04) 100%)",
              "linear-gradient(150deg, rgba(16,185,129,0.1) 0%, transparent 34%, rgba(245,158,11,0.1) 100%)",
              "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(5,112,222,0.045) 100%)",
            ].join(", "),
          }}
          aria-hidden
        />
        <div className="absolute inset-y-0 right-0 -z-10 hidden w-[48%] skew-x-[-8deg] bg-gradient-to-b from-sky-50/90 via-paper/55 to-amber-50/60 lg:block" aria-hidden />
        <div className="absolute left-1/2 top-12 -z-10 hidden h-64 w-[110vw] -translate-x-1/2 -rotate-6 bg-gradient-to-r from-transparent via-sky-100/50 to-transparent lg:block" aria-hidden />
        <div className="absolute left-1/2 top-44 -z-10 hidden h-40 w-[95vw] -translate-x-1/2 rotate-3 bg-gradient-to-r from-transparent via-emerald-100/38 to-transparent lg:block" aria-hidden />
        <div className="absolute left-0 right-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-sky-300/80 to-transparent" aria-hidden />
        <div className="absolute left-0 right-0 top-0 -z-10 h-24 bg-[linear-gradient(180deg,rgba(14,165,233,0.08),transparent)]" aria-hidden />

        {/* Dotted pattern, softly fading */}
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

        {/* Faint grid for structure */}
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

        <div
          className="absolute inset-x-0 top-0 -z-10 h-[520px] opacity-[0.08]"
          style={{
            backgroundImage: "repeating-linear-gradient(115deg, #0a2540 0 1px, transparent 1px 36px)",
            maskImage: "linear-gradient(to bottom, black, transparent 76%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 76%)",
          }}
          aria-hidden
        />

        {/* Bottom curve fade */}
        <svg
          className="absolute bottom-0 left-0 right-0 -z-10 w-full h-12 pointer-events-none"
          viewBox="0 0 1200 60"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 60 Q 300 0, 600 30 T 1200 60 Z" fill="rgba(5,112,222,0.06)" />
        </svg>
        </div>

        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-16 md:pt-20 pb-12 md:pb-20">
          <div className="mx-auto max-w-5xl text-center">
            <div className="tp-fade-up inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-navy/55 px-3.5 py-1.5 shadow-sm shadow-black/10 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                <span className="relative block h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[12px] font-semibold tracking-[0.04em] text-white">
                Organizer ticketing, payments, scanning, and payouts
              </span>
            </div>

            <h1 className="tp-fade-up-1 mx-auto mt-8 max-w-4xl font-bold tracking-[-0.035em] text-[42px] leading-[1.03] text-white drop-shadow-sm sm:text-[64px] sm:leading-[0.98] md:text-[82px] md:leading-[0.94]">
              Sell tickets.<br />
              <span className="text-[#b8e448]">Scan guests.</span><br />
              Get paid.
            </h1>

            <p className="tp-fade-up-2 mx-auto mt-7 max-w-2xl text-[16px] leading-relaxed text-white/82 md:text-[18px]">
              TicketPulse helps organizers sell online, deliver instant QR tickets, manage attendees, reconcile Velocity payments, and request payouts. Buyers get secure checkout and support without needing an account.
            </p>

            <div className="tp-fade-up-3 mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/auth/signup?role=organizer"
                className="group inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#a3d63c] px-7 text-[15px] font-semibold text-navy shadow-sm shadow-black/20 transition hover:bg-[#b8e448] active:scale-[0.99]"
              >
                Start selling <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-7 text-[15px] font-semibold text-white shadow-sm shadow-black/10 backdrop-blur-md transition hover:border-white/40 hover:bg-white/16 active:scale-[0.99]"
              >
                <PhoneCall size={15} /> Book a call
              </Link>
              <Link
                href="/events"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-3 text-[15px] font-semibold text-white transition hover:text-[#b8e448] active:scale-[0.99]"
              >
                Browse events <ArrowUpRight size={15} />
              </Link>
            </div>

            <div className="tp-fade-up-4 mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
              {HERO_TRUST_ITEMS.map(({ icon: Icon, label, tone, accent, ring }) => (
                <span key={label} className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-navy/55 px-3 py-2 text-[12px] font-semibold text-white/90 ring-1 ${ring} backdrop-blur-md`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${tone}`}>
                    <Icon size={12} className={accent} />
                  </span>
                  {label}
                </span>
              ))}
            </div>

            <p className="tp-fade-up-5 mx-auto mt-5 max-w-2xl text-[13px] font-medium text-white/65">
              One platform for ticket sales, QR delivery, gate scanning, reconciliation, and payouts.
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-white/15 bg-navy/70 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-7 md:py-9">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 md:gap-x-0 md:gap-y-0 md:divide-x md:divide-white/15">
              {buildStats(eventsOnSale).map((s, i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${300 + i * 70}ms` }}
                  className="tp-fade-up md:px-6 md:first:pl-0 md:last:pr-0"
                >
                  <p className="pb-0.5 text-[26px] font-bold leading-none tracking-tight text-white md:text-[32px]">
                    {s.value}
                  </p>
                  <p className="mt-1.5 text-[13px] text-white/60">{s.label}</p>
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
              {featuredEvents.length === 1 ? "Featured event." : "What's on."}
            </h2>
            <p className="mt-3 text-[15px] text-ink-2">
              {featuredEvents.length === 1
                ? "Tickets are open now. Grab your spot while sales are moving."
                : "The calendar is filling up fast."}{" "}
              <Link href="/events" className="text-navy font-semibold hover:underline">See what else is on</Link>.
            </p>
          </div>

          {featuredEvents.length === 1 ? (
            <div className="tp-fade-up">
              <HeroEventCard
                slug={featuredEvents[0].slug}
                title={featuredEvents[0].title}
                category={featuredEvents[0].category}
                venue={featuredEvents[0].venue}
                city={featuredEvents[0].city}
                startsAt={featuredEvents[0].startsAt}
                coverImage={featuredEvents[0].coverImage}
                lowestPrice={featuredEvents[0].lowestPrice}
                currency={featuredEvents[0].currency}
                soldQuantity={featuredEvents[0].soldQuantity}
                totalQuantity={featuredEvents[0].totalQuantity}
                sponsored={featuredEvents[0].sponsored}
                tags={featuredEvents[0].tags}
              />
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 md:gap-6 space-y-5 md:space-y-6">
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
          )}
        </section>
      )}

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-18 border-t border-line">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="tp-reveal">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Organizer proof</p>
            <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
              Trusted by organisers running real events.
            </h2>
            <p className="mt-3 text-[15px] text-ink-2 leading-relaxed">
              TicketPulse is built for the messy middle of selling tickets: paid orders, ticket delivery, attendee lists, scanner access, payout requests, and reconciliation when a payment needs a second look.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {ORGANIZER_BENEFITS.map(({ icon: Icon, label, tone, accent, border }) => (
                <span key={label} className={`inline-flex items-center gap-2 rounded-full border ${border} ${tone} px-3 py-1.5 text-[12px] font-semibold text-ink-2`}>
                  <Icon size={13} className={accent} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ORGANIZER_PROOF.map(({ title, body, icon: Icon, tone, accent, ring }, i) => (
              <div
                key={title}
                style={{ animationDelay: `${i * 80}ms` }}
                className={`tp-premium-card tp-fade-up rounded-2xl border border-line bg-gradient-to-br ${tone} p-5 shadow-sm shadow-ink/[0.03]`}
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ${ring}`}>
                  <Icon size={17} className={accent} />
                </span>
                <h3 className="mt-4 text-[15px] font-bold tracking-tight text-ink">{title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {pastEvents.length > 0 && (
          <div className="mt-5 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-rose-50 p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">Past events</p>
                <h3 className="mt-1 text-[18px] font-bold tracking-tight text-ink">Events already run through TicketPulse</h3>
              </div>
              <Link href="/events?past=1" className="inline-flex items-center gap-1 text-[13px] font-semibold text-violet-700 hover:underline">
                View past events <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {pastEvents.slice(0, 3).map((event) => (
                  <Link key={event.id} href={`/events/${event.slug}`} className="tp-premium-card overflow-hidden rounded-xl border border-white/80 bg-white/85 shadow-sm shadow-ink/[0.03] transition hover:border-violet-200 hover:bg-white">
                    <div className="relative h-24 bg-gradient-to-br from-violet-100 to-rose-100">
                      {event.coverImage ? (
                        <>
                          <img src={event.coverImage} alt={`${event.title} event cover`} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                        </>
                      ) : null}
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700 shadow-sm">
                        Completed
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">{event.category}</p>
                      <h4 className="mt-1 line-clamp-1 text-[15px] font-bold text-ink">{event.title}</h4>
                      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3"><Calendar size={12} /> {formatDateShort(event.startsAt)}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-3"><MapPin size={12} /> <span className="line-clamp-1">{event.venue} · {event.city}</span></p>
                    </div>
                  </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-18 border-t border-line">
        <div className="mb-8 grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-end">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">For organizers</p>
            <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
              Know who paid, who arrived, and what you earned.
            </h2>
          </div>
          <p className="text-[15px] text-ink-2 leading-relaxed">
            TicketPulse turns event checkout into an operating system: launch sales, deliver tickets, run the gate, support buyers, reconcile revenue, and request payouts from one clean dashboard.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLATFORM_SERVICES.map(({ title, body, icon: Icon, href, tone, accent, ring }) => (
            <Link key={title} href={href} className={`tp-premium-card group rounded-2xl border border-line bg-gradient-to-br ${tone} p-5 ring-1 ${ring} transition hover:border-line-2 hover:-translate-y-0.5 hover:shadow-[0_16px_42px_-24px_rgba(10,37,64,0.22)]`}>
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm shadow-ink/[0.04]">
                <Icon size={20} className={accent} />
              </span>
              <h3 className="text-[16px] font-semibold text-ink group-hover:text-navy">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{body}</p>
              <p className={`mt-4 inline-flex items-center gap-1 text-[12px] font-semibold ${accent}`}>Open <ArrowUpRight size={12} /></p>
            </Link>
          ))}
        </div>
      </section>

      <ReviewHighlights reviews={reviewRows} />

      {/* CATEGORIES */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <div className="tp-reveal mb-8 md:mb-10">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Browse</p>
            <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">By category</h2>
            <p className="mt-3 text-[15px] text-ink-2 max-w-xl">Find the experience you&apos;re after, from sold-out concerts to local marathons and premieres.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {CATEGORIES.map(({ label, value, icon: Icon, gradient, ring, accent }, i) => {
              const catEvents = eventsByCategory.get(value) ?? []
              return (
              <Link
                key={value}
                href={`/events?category=${value}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`tp-premium-card tp-fade-up group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br ${gradient} p-4 sm:p-5 flex flex-col hover:shadow-[0_12px_40px_-16px_rgba(10,37,64,0.2)] hover:-translate-y-0.5 hover:ring-1 hover:ring-brand-500/15 active:scale-[0.99] transition-all`}
              >
                <div className="flex items-start justify-between">
                  <span className={`inline-flex w-9 h-9 items-center justify-center rounded-xl bg-white ring-1 ${ring} shadow-sm`}>
                    <Icon size={17} className={accent} />
                  </span>
                  {catEvents.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-3 bg-white/60 rounded-full px-2 py-0.5">
                      {catEvents.length}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <p className="text-[15px] font-semibold tracking-tight text-ink">{label}</p>
                  {catEvents.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {catEvents.slice(0, 2).map((ev) => (
                        <li key={ev.id} className="text-[11px] text-ink-2 leading-tight line-clamp-1">
                          {ev.title}
                          <span className="text-ink-3 ml-1">
                            {formatDateShort(ev.startsAt)}
                          </span>
                        </li>
                      ))}
                      {catEvents.length > 2 && (
                        <li className="text-[11px] text-navy font-medium">+{catEvents.length - 2} more</li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-ink-3 mt-1">No upcoming events</p>
                  )}
                  <p className="text-[11px] font-medium text-navy inline-flex items-center gap-1 mt-1.5 group-hover:gap-1.5 transition-all">
                    Browse {label.toLowerCase()} <ArrowRight size={10} />
                  </p>
                </div>
              </Link>
            )})}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24 border-t border-line">
        <div className="tp-reveal mb-10 md:mb-14 max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">How it works · end to end</p>
          <h2 className="font-bold tracking-tight text-[28px] md:text-[40px] leading-tight text-ink">From discovery to the gate. All on TicketPulse.</h2>
          <p className="mt-3 text-[15px] text-ink-2">We serve the client and the organizer: checkout, ticket delivery, order recovery, reviews, attendee messaging, gate scanning, and payout tracking all live in one place. One platform, one log, one payout.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {STEPS.map(({ icon: Icon, title, body }, i) => {
            const stepTone = [
              { bg: "from-sky-50 to-white", icon: "bg-sky-100 ring-sky-200/70", text: "text-sky-700", number: "text-sky-100" },
              { bg: "from-emerald-50 to-white", icon: "bg-emerald-100 ring-emerald-200/70", text: "text-emerald-700", number: "text-emerald-100" },
              { bg: "from-violet-50 to-white", icon: "bg-violet-100 ring-violet-200/70", text: "text-violet-700", number: "text-violet-100" },
              { bg: "from-amber-50 to-white", icon: "bg-amber-100 ring-amber-200/70", text: "text-amber-700", number: "text-amber-100" },
            ][i]
            return (
            <div
              key={title}
              style={{ animationDelay: `${i * 100}ms` }}
              className={`tp-premium-card tp-fade-up group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br ${stepTone.bg} p-6 md:p-7 hover:border-line-2 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-28px_rgba(10,37,64,0.18)] transition-all duration-300`}
            >
              <span
                className={`pointer-events-none absolute -top-2 -right-3 select-none text-[72px] md:text-[96px] font-bold tracking-tighter leading-none ${stepTone.number} group-hover:scale-110 group-hover:translate-x-0.5 transition-all duration-300`}
                aria-hidden
              >
                0{i + 1}
              </span>

              <div className="relative flex items-center gap-3 mb-5">
                <span className={`inline-flex w-12 h-12 items-center justify-center rounded-2xl ${stepTone.icon} ring-1 transition-all duration-300`}>
                  <Icon size={22} className={stepTone.text} />
                </span>
                <span className="text-[11px] font-semibold tracking-[0.2em] text-ink-3 uppercase">Step {i + 1}</span>
              </div>

              <h3 className="relative text-[18px] font-semibold tracking-tight text-ink mb-1.5">{title}</h3>
              <p className="relative text-[15px] leading-relaxed text-ink-2">{body}</p>

            </div>
          )})}
        </div>

        {/* End-to-end strip */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {[
            { icon: FileText,   k: "Printable PDF",       v: "A4 ticket emailed at checkout. Print at home or keep it as a backup if your phone dies.", tone: "from-blue-soft to-paper-2",   ring: "ring-brand-500/15",   accent: "text-brand-600" },
            { icon: Smartphone, k: "Mobile QR",           v: "Live in your account on any device. Same code as the PDF. Pick whichever you have on hand.", tone: "from-green-50 to-paper-2", ring: "ring-green-200/60", accent: "text-green-700" },
            { icon: DoorOpen,   k: "Organizer benefits",  v: "Health checks, payout ledgers, reconciliation warnings, broadcasts, attendee exports, reviews, and scanner reports are included.", tone: "from-violet-50 to-paper-2", ring: "ring-violet-200/60", accent: "text-violet-700" },
          ].map(({ icon: Icon, k, v, tone, ring, accent }, i) => (
            <div
              key={k}
              style={{ animationDelay: `${i * 80}ms` }}
              className="tp-premium-card tp-fade-up group relative rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(10,37,64,0.12)] transition-all duration-300"
            >
              <span className={`inline-flex w-11 h-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} ring-1 ${ring} shrink-0 mb-3.5`}>
                <Icon size={18} className={accent} />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink">{k}</p>
              <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-ink via-navy to-[#172554] text-white">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="tp-reveal">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-white/55 uppercase mb-3">Organizer mobile</p>
              <h2 className="text-[30px] md:text-[46px] font-bold tracking-tight leading-tight">
                Run the event from your phone.
              </h2>
              <p className="mt-4 max-w-xl text-[15px] md:text-[16px] leading-relaxed text-white/72">
                Open the organiser view on mobile to scan tickets, check attendee counts, review orders, and keep the door moving without a laptop at the venue.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/organizer/scan"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-navy transition hover:bg-paper-2 active:scale-[0.99]"
                >
                  <ScanLine size={15} /> Open scanner
                </Link>
                <Link
                  href="/auth/signup?role=organizer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/18 bg-white/[0.06] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.1] active:scale-[0.99]"
                >
                  Create organizer account <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: ScanLine, title: "Fast gate scanning", body: "Valid, duplicate, invalid, and already-used states are clear for event staff.", accent: "bg-emerald-300 text-emerald-950" },
                { icon: Users, title: "Live attendee count", body: "See confirmed tickets and check-ins without waiting for a spreadsheet export.", accent: "bg-sky-300 text-sky-950" },
                { icon: Megaphone, title: "Buyer messaging", body: "Use email, WhatsApp, and SMS tools to reach attendees before or after the event.", accent: "bg-amber-300 text-amber-950" },
                { icon: BarChart3, title: "Revenue snapshot", body: "Keep sales, payouts, and reconciliation close to the operator running the event.", accent: "bg-fuchsia-300 text-fuchsia-950" },
              ].map(({ icon: Icon, title, body, accent }, i) => (
                <div
                  key={title}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className="tp-premium-card tp-fade-up rounded-2xl border border-white/12 bg-white/[0.075] p-5 backdrop-blur transition hover:bg-white/[0.1]"
                >
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
                    <Icon size={17} />
                  </span>
                  <h3 className="mt-4 text-[15px] font-bold tracking-tight">{title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/65">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-16 md:py-24">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ.map(({ q, a }) => ({
                  "@type": "Question",
                  name: q,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: a,
                  },
                })),
              }),
            }}
          />
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
      <section className="px-5 md:px-8 pt-12 md:pt-20 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto tp-reveal">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-14">
            {/* One restrained ambient detail: a soft blue glow in the top-right corner. */}
            <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-green-500/30 blur-3xl pointer-events-none" aria-hidden />
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
                <p className="tp-fade-up-2 mt-4 text-[15px] md:text-[16px] leading-relaxed text-white/80 max-w-lg">
                  Launch in minutes. Get verified payouts, mobile QR entry, attendee messaging, ticket recovery, review collection, payout ledgers, and scanner analytics. Keep more of every ticket.
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
                    className="tp-premium-card tp-fade-up group relative overflow-hidden rounded-2xl bg-white/[0.06] border border-white/10 px-4 pt-5 pb-4 backdrop-blur hover:bg-white/[0.09] hover:border-white/20 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {/* Delicate accent bar — tells the eye these are stats, not links. */}
                    <span
                      className="absolute left-4 top-0 h-px w-8 bg-gradient-to-r from-blue/60 to-transparent group-hover:w-12 transition-all duration-300"
                      aria-hidden
                    />
                    <p className="text-[22px] md:text-[26px] font-bold tracking-tight leading-none pb-1">
                      {k}
                    </p>
                    <p className="text-[13px] text-white/70 mt-1.5 leading-snug">{l}</p>
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
