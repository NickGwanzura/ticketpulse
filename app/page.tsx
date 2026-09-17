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
  Calendar, MapPin, FileText, ScanLine, DoorOpen,
  ReceiptText,
} from "lucide-react"
import EventCard from "@/components/events/EventCard"
import HeroEventCard from "@/components/events/HeroEventCard"
import HeroBackgroundSlideshow from "@/components/home/HeroBackgroundSlideshow"
import HeroEventTypesSlider from "@/components/home/HeroEventTypesSlider"
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

const STEPS = [
  { icon: Ticket,      title: "Create ticket tiers",  body: "Build general admission, VIP, early bird, promo codes, staff tickets, merch, and event pages from one dashboard." },
  { icon: Wallet,      title: "Accept real payments", body: "EcoCash and card checkout create a traceable order, ledger entry, ticket record, and payout calculation." },
  { icon: ScanLine,    title: "Run the gate",         body: "QR scanning, duplicate detection, attendee exports, staff access, and live check-in stats keep entry controlled." },
  { icon: ReceiptText, title: "Reconcile and pay out", body: "Track gross sales, confirmed tickets, platform fees, Velocity settlements, paid out, and available balance." },
]

export default async function Home() {
  const featuredEvents = await getFeaturedEvents(6)

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
      <section className="relative isolate min-h-[720px] overflow-hidden bg-[#081522] text-[#fbf2e4] md:min-h-[820px]">
        <HeroBackgroundSlideshow />

        <div className="mx-auto flex min-h-[720px] max-w-7xl items-center px-5 pb-16 pt-36 sm:pb-20 md:min-h-[820px] md:px-8 md:pt-40">
          <div className="mx-auto max-w-5xl text-center">
            <p className="tp-fade-up text-[11px] font-bold uppercase tracking-[0.28em] text-[#f6c995]">
              Zimbabwe's home for live moments
            </p>
            <div className="tp-fade-up-1 mx-auto mt-7 inline-flex items-center gap-3 rounded-full border border-[#fbf2e4]/25 bg-[#081522]/45 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#fbf2e4]/85 backdrop-blur-sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#f47b4b]" aria-hidden />
              Sell tickets · fill the room · know your numbers
            </div>
            <h1 className="tp-fade-up-2 mx-auto mt-7 max-w-5xl font-display text-[66px] font-black uppercase leading-[0.82] tracking-[-0.045em] text-[#fbf2e4] drop-shadow-[0_8px_30px_rgba(0,0,0,0.3)] sm:text-[92px] md:mt-8 md:text-[142px]">
              Make it a <span className="text-[#f47b4b]">moment.</span>
            </h1>
            <p className="tp-fade-up-3 mx-auto mt-7 max-w-2xl text-[16px] leading-relaxed text-[#fbf2e4]/78 md:text-[18px]">
              Discover the nights worth remembering and give your guests a seamless way in. TicketPulse brings tickets, QR entry, guest lists and payouts together.
            </p>
            <div className="tp-fade-up-4 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/signup?role=organizer"
                className="group inline-flex h-13 overflow-hidden rounded-sm bg-[#f47b4b] text-[12px] font-bold uppercase tracking-[0.14em] text-[#081522] shadow-[0_18px_45px_-22px_rgba(0,0,0,0.65)] transition hover:-translate-y-0.5 hover:bg-[#ff9c6e] active:scale-[0.99]"
              >
                <span className="inline-flex items-center px-6">Start selling</span>
                <span className="inline-flex w-12 items-center justify-center bg-[#e9683b] text-[#081522] transition group-hover:bg-[#ffb08c]"><ArrowUpRight size={16} /></span>
              </Link>
              <Link
                href="/events"
                className="group inline-flex h-13 overflow-hidden rounded-sm border border-[#fbf2e4]/45 bg-[#081522]/35 text-[12px] font-bold uppercase tracking-[0.14em] text-[#fbf2e4] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-[#fbf2e4]/10 active:scale-[0.99]"
              >
                <span className="inline-flex items-center px-6">Find an event</span>
                <span className="inline-flex w-12 items-center justify-center border-l border-[#fbf2e4]/20 text-[#f6c995] transition group-hover:bg-[#fbf2e4]/10"><ArrowUpRight size={16} /></span>
              </Link>
            </div>
            <HeroEventTypesSlider />
          </div>
        </div>
      </section>

      {/* FEATURED */}
      {featuredEvents.length > 0 && (
        <section className="bg-white px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
          <div className="tp-reveal mb-8 md:mb-10 max-w-2xl">
            <p className="text-[11px] font-bold tracking-[0.22em] text-accent uppercase mb-2">On sale now</p>
            <h2 className="font-display font-black uppercase tracking-[-0.03em] text-[42px] md:text-[66px] leading-[0.9] text-ink">
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
            <div className="grid grid-cols-1 items-stretch sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {featuredEvents.map((e, i) => (
                <div
                  key={e.id}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className="tp-fade-up h-full"
                >
                  <EventCard {...e} />
                </div>
              ))}
            </div>
          )}
          </div>
        </section>
      )}

      {pastEvents.length > 0 && (
        <section className="bg-white px-5 py-14 md:px-8 md:py-18 border-t border-[#0a2540]/10">
          <div className="mx-auto max-w-7xl">
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
          </div>
        </section>
      )}
      {/* HOW IT WORKS */}
      <section className="bg-[#0a2540] px-5 py-16 text-[#fbf2e4] md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
        <div className="tp-reveal mb-10 md:mb-14 max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#f6c995] uppercase mb-2">How it works · end to end</p>
          <h2 className="font-display font-black uppercase tracking-[-0.03em] text-[42px] md:text-[66px] leading-[0.9] text-[#fbf2e4]">From discovery to the gate.</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#fbf2e4]/68">One place to sell tickets, welcome guests, scan the gate and track every payout.</p>
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
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-y border-[#0a2540]/10">
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
            <h2 className="font-display font-black uppercase tracking-[-0.03em] text-[42px] md:text-[60px] leading-[0.9] text-ink">Quick answers.</h2>
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
