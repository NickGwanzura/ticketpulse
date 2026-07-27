import type { Metadata } from "next"
import Image from "next/image"
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
  Calendar, MapPin, FileText, ScanLine, DoorOpen, ShieldCheck,
  ReceiptText,
} from "lucide-react"
import SplitCTA from "@/components/ui/SplitCTA"
import EventCard from "@/components/events/EventCard"
import HeroEventCard from "@/components/events/HeroEventCard"
import HeroBackgroundSlideshow from "@/components/home/HeroBackgroundSlideshow"
import { FAQ as FAQSection } from "@/components/ui/Accordion"
import { formatDateShort } from "@/lib/utils"
import { getFeaturedEvents } from "@/lib/events"
import { db } from "@/db"
import { events as eventsTable } from "@/db/schema"
import { and, desc, inArray, sql } from "drizzle-orm"

const FAQ = [
  { q: "Do I need an account to buy tickets?",      a: "No. Pay with just your name, email, and phone. Tickets land in your inbox, WhatsApp, and SMS the moment payment clears. Your account is auto-created — no password required." },
  { q: "How do I get my ticket after I buy?",       a: "Instantly after payment clears. You get a printable PDF ticket by email, a mobile QR in your TicketPulse account, a WhatsApp message, and an SMS with your ticket details — all at once. You can also find and resend tickets from order lookup." },
  { q: "What payments do you accept?",              a: "EcoCash and Visa cards. Both clear instantly at checkout." },
  { q: "How do organizers get paid?",               a: "Organizers request payouts from the dashboard. TicketPulse deducts the 5% fee from confirmed ticket sales and shows gross, fee, paid out, pending, and available balance before withdrawal." },
]

function buildStats(eventsOnSale: number) {
  return [
    { value: "5%",      label: "Organizer fee" },
    { value: "2 ways",  label: "EcoCash · Visa" },
    { value: "QR",      label: "Scanner included" },
    { value: String(eventsOnSale), label: eventsOnSale === 1 ? "Event on sale today" : "Events on sale today" },
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
  { icon: Wallet, label: "EcoCash + Visa", tone: "bg-orange-50", accent: "text-orange-700", ring: "ring-orange-200/80" },
  { icon: Smartphone, label: "Instant QR delivery", tone: "bg-sky-50", accent: "text-sky-700", ring: "ring-sky-200/70" },
]

const HERO_PROOF_ITEMS = [
  { label: "Online sales", value: "$1,840", note: "Velocity settled", icon: Wallet },
  { label: "QR tickets", value: "368", note: "PDF, SMS, WhatsApp", icon: Ticket },
  { label: "Checked in", value: "211", note: "Live gate count", icon: ScanLine },
]

export default async function Home() {
  const featuredEvents = await getFeaturedEvents(6)
  const eventsOnSale = featuredEvents.length

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

        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="tp-live-glow absolute left-[8%] top-20 h-44 w-44 rounded-full bg-orange-500/28 blur-3xl" />
          <div className="tp-live-glow tp-live-glow-delay absolute right-[10%] top-32 h-52 w-52 rounded-full bg-[#b8e448]/16 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-orange-950/35 to-transparent" />
          <div className="absolute left-1/2 top-16 h-px w-[78vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-orange-300/60 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-5 md:px-8 pt-12 md:pt-14 pb-10 md:pb-14">
          <div className="mx-auto max-w-5xl text-center">
            <div className="tp-fade-up inline-flex items-center gap-2.5 rounded-full border border-orange-300/35 bg-navy/55 px-3.5 py-1.5 shadow-sm shadow-orange-950/20 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-orange-400 animate-ping opacity-75" />
                <span className="relative block h-2 w-2 rounded-full bg-orange-400" />
              </span>
              <span className="text-[12px] font-semibold tracking-[0.04em] text-orange-50">
                Built for Zimbabwe events, gates, and payouts
              </span>
            </div>

            <h1 className="tp-fade-up-1 mx-auto mt-6 max-w-4xl font-bold tracking-[-0.035em] text-[42px] leading-[1.03] text-white drop-shadow-sm sm:text-[60px] sm:leading-[0.96] md:text-[76px] md:leading-[0.92]">
              Sell tickets.<br />
              <span className="text-orange-300">Scan guests.</span><br />
              Get paid.
            </h1>

            <p className="tp-fade-up-2 mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-white/82 md:text-[18px]">
              Create an event, sell tickets online, send instant QR tickets, scan guests at the gate, and request payouts from one dashboard.
            </p>

            <div className="tp-fade-up-3 mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <SplitCTA href="/auth/signup?role=organizer" label="Start selling" size="lg" />
              <Link
                href="/events"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-7 text-[15px] font-semibold text-white/85 shadow-sm shadow-black/10 backdrop-blur-md transition hover:border-orange-300/55 hover:bg-orange-400/15 hover:text-orange-100 active:scale-[0.99]"
              >
                Buying tickets? Browse events <ArrowUpRight size={15} />
              </Link>
            </div>

            <div className="tp-fade-up-4 mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
              {HERO_TRUST_ITEMS.map(({ icon: Icon, label, tone, accent, ring }) => (
                <span key={label} className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-navy/55 px-3 py-2 text-[12px] font-semibold text-white/90 ring-1 ${ring} backdrop-blur-md`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${tone}`}>
                    <Icon size={12} className={accent} />
                  </span>
                  {label}
                </span>
              ))}
            </div>

            <p className="tp-fade-up-5 mx-auto mt-4 max-w-2xl text-[13px] font-medium text-white/65">
              Used for Zimbabwe ticket sales, QR entry, Velocity reconciliation, and organizer payouts.
            </p>
          </div>

          <div className="tp-fade-up-6 mx-auto mt-8 max-w-5xl rounded-2xl border border-white/14 bg-white/[0.08] p-3 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-4">
            <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border border-white/10 bg-navy/70 p-4 md:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-200">Organizer dashboard</p>
                    <h2 className="mt-1 text-[20px] font-bold tracking-tight text-white md:text-[24px]">Mommy Matcha launch night</h2>
                    <p className="mt-1 text-[13px] text-white/58">Ticket tiers, payments, scans, and payout status stay connected.</p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/12 px-3 py-1.5 text-[12px] font-semibold text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Live sales
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {HERO_PROOF_ITEMS.map(({ label, value, note, icon: Icon }) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/[0.07] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12px] font-medium text-white/58">{label}</span>
                        <Icon size={15} className="text-orange-200" />
                      </div>
                      <p className="mt-2 text-[24px] font-bold tracking-tight text-white">{value}</p>
                      <p className="mt-1 text-[11px] text-white/45">{note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                  {[
                    ["Early bird", "142 sold", "Paid"],
                    ["General admission", "184 sold", "Selling"],
                    ["VIP table", "42 sold", "Few left"],
                  ].map(([tier, sold, status]) => (
                    <div key={tier} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-white/10 bg-white/[0.04] px-3 py-3 text-[12px] last:border-b-0">
                      <span className="font-semibold text-white/86">{tier}</span>
                      <span className="text-white/52">{sold}</span>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-orange-100">{status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.07] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Gate scanner</p>
                      <p className="mt-1 text-[18px] font-bold text-white">211 guests checked in</p>
                    </div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-300 text-navy">
                      <ScanLine size={20} />
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
                    <div className="h-full w-[57%] rounded-full bg-orange-300" />
                  </div>
                  <p className="mt-2 text-[12px] text-white/52">Duplicate detection and staff access are included.</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.07] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Available payout</p>
                      <p className="mt-1 text-[30px] font-bold tracking-tight text-white">$1,748</p>
                      <p className="mt-1 text-[12px] text-white/52">Gross sales, TicketPulse fee, paid out, and pending balances are reconciled before withdrawal.</p>
                    </div>
                    <ReceiptText size={22} className="mt-1 text-orange-200" />
                  </div>
                  <Link href="/pricing" className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-white/14 px-4 text-[13px] font-semibold text-white/82 transition hover:border-orange-300/55 hover:text-orange-100">
                    See 5% pricing
                  </Link>
                </div>
              </div>
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {featuredEvents.map((e, i) => (
                <div
                  key={e.id}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className="tp-fade-up"
                >
                  <EventCard {...e} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {pastEvents.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-18 border-t border-line">
          <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-rose-50 p-4 md:p-5">
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
                          <Image src={event.coverImage} alt={`${event.title} event cover`} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
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
        </section>
      )}
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

      <section className="px-5 md:px-8 py-14 md:py-18">
        <div className="mx-auto max-w-4xl rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 via-white to-paper-2 p-7 text-center md:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Ready to launch?</p>
          <h2 className="mt-3 text-[28px] font-bold tracking-tight text-ink md:text-[40px]">Start selling tickets on TicketPulse.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Create your organiser account, publish your event, accept EcoCash and Visa, and scan tickets at the gate.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/signup?role=organizer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[14px] font-bold text-white shadow-sm shadow-accent/20 transition hover:bg-accent-hover active:scale-[0.99]"
            >
              Get Started <ArrowRight size={15} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-paper px-6 text-[14px] font-semibold text-ink transition hover:border-accent/30 hover:text-accent"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
