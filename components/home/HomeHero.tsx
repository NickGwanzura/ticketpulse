import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, Search, Ticket, Wallet } from "lucide-react"
import type { FeaturedEvent } from "@/lib/events"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const CATEGORIES = [
  { label: "Concerts", value: "concert" },
  { label: "Food & drink", value: "food & drink" },
  { label: "Marathons", value: "marathon" },
  { label: "Film", value: "film" },
]

export default function HomeHero({ spotlight }: { spotlight?: FeaturedEvent }) {
  const ticketLabel = spotlight?.ticketsAvailable
    ? spotlight.lowestPrice === 0
      ? "Free"
      : spotlight.lowestPrice != null
        ? formatCurrency(spotlight.lowestPrice, spotlight.currency)
        : "See tickets"
    : null

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[linear-gradient(125deg,#fff_0%,#fffaf6_60%,#f8eee7_100%)] text-ink">
        <div className="pointer-events-none absolute -right-60 -top-52 -z-10 h-[650px] w-[650px] rounded-full border border-orange-200/50 shadow-[0_0_0_72px_rgba(233,216,201,0.12),0_0_0_144px_rgba(233,216,201,0.06)]" aria-hidden />
        <div className="pointer-events-none absolute left-[35%] top-0 -z-10 h-96 w-96 rounded-full bg-orange-100/45 blur-3xl" aria-hidden />

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 pt-30 md:grid-cols-[1.05fr_0.95fr] md:gap-16 md:px-8 md:pb-20 md:pt-40">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-orange-200 bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.17em] text-brand-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden />
              Zimbabwe&apos;s live event guide
            </p>
            <h1 className="mt-6 max-w-[690px] font-heading text-[clamp(3.25rem,5.8vw,5.625rem)] font-black leading-[0.98] tracking-[-0.065em] text-navy">
              Find your <span className="text-brand-600">next event</span> in Zimbabwe.
            </h1>
            <p className="mt-5 max-w-[540px] text-[15px] leading-relaxed text-ink-2 sm:text-[18px]">
              Concerts, food, sport and experiences worth going out for. Find your place, pay securely and get your ticket straight to your phone.
            </p>

            <form action="/events" method="get" role="search" className="mt-8 flex w-full max-w-[570px] items-center gap-2 rounded-2xl border border-line-2 bg-white p-2 shadow-[0_18px_42px_rgba(10,37,64,0.10)] transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
              <Search size={20} className="ml-2.5 shrink-0 text-ink-3" aria-hidden />
              <label htmlFor="home-event-search" className="sr-only">Search events, venues or cities</label>
              <input id="home-event-search" name="q" type="search" placeholder="Search events" className="min-w-0 flex-1 border-0 bg-transparent px-1 py-3 text-[13px] text-ink outline-none placeholder:text-ink-3 sm:text-[14px]" />
              <button type="submit" className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-[12px] font-bold text-white transition hover:bg-brand-700 sm:px-5 sm:text-[13px]">
                Find events <ArrowRight size={15} />
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-ink-2 sm:text-[12px]">
              <span className="inline-flex items-center gap-1.5"><Ticket size={14} className="text-brand-600" /> No account needed</span>
              <span className="inline-flex items-center gap-1.5"><Wallet size={14} className="text-brand-600" /> EcoCash or card</span>
              <span className="inline-flex items-center gap-1.5"><ArrowRight size={14} className="text-brand-600" /> Instant tickets</span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-orange-200/60 pt-5 text-[13px] md:mt-12">
              <span className="text-ink-3">Planning an event?</span>
              <Link href="/auth/signup?role=organizer" className="inline-flex items-center gap-1 font-bold text-navy hover:text-brand-600">Start selling tickets <ArrowUpRight size={14} /></Link>
              <span className="hidden text-ink-3 sm:inline">·</span>
              <Link href="/vendors/apply" className="inline-flex items-center gap-1 font-bold text-navy hover:text-brand-600">List your service <ArrowUpRight size={14} /></Link>
            </div>
          </div>

          <article className="relative min-h-[430px] overflow-hidden rounded-[24px] bg-navy shadow-[0_35px_75px_rgba(10,37,64,0.22)] sm:min-h-[520px] md:rotate-[1.5deg] md:rounded-[30px]" aria-label={spotlight ? `Featured event: ${spotlight.title}` : "Discover events"}>
            <Image
              src={spotlight?.coverImage || "/images/home-hero/concert.jpg"}
              alt={spotlight?.coverImage ? `Cover image for ${spotlight.title}` : "People enjoying an outdoor concert"}
              fill
              sizes="(max-width: 768px) 100vw, 44vw"
              className="object-cover"
              preload
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,24,43,0.08)_3%,transparent_30%,rgba(7,24,43,0.2)_48%,rgba(7,24,43,0.95)_100%)]" aria-hidden />
            <div className="absolute inset-x-5 top-5 z-10 flex items-start justify-between gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-white sm:inset-x-7 sm:top-7">
              <span className="rounded-full bg-white px-3.5 py-2.5 text-navy">✦ {spotlight?.sponsored ? "Sponsored event" : "Event spotlight"}</span>
              {spotlight && <span className="rounded-full border border-white/30 bg-navy/75 px-3.5 py-2.5 text-right backdrop-blur-sm">{formatDateShort(spotlight.startsAt)} · {spotlight.city}</span>}
            </div>
            <div className="absolute inset-x-5 bottom-5 z-10 text-white sm:inset-x-7 sm:bottom-7">
              <p className="text-[10px] font-black uppercase tracking-[0.17em] text-orange-200">{spotlight ? `${spotlight.category} · ${spotlight.city}` : "Discover what is on"}</p>
              <h2 className="mt-2 font-heading text-[42px] font-black leading-none tracking-[-0.06em] sm:text-[52px]">{spotlight?.title ?? "Your next night out starts here."}</h2>
              <p className="mt-2 text-[13px] text-white/80 sm:text-[14px]">{spotlight ? `${spotlight.venue} · ${formatDateShort(spotlight.startsAt)}` : "Explore upcoming events across Zimbabwe."}</p>
              <div className="mt-6 flex items-end justify-between gap-3 border-t border-white/25 pt-5">
                <div>{ticketLabel && <><span className="block text-[11px] text-white/70">Tickets from</span><strong className="mt-1 block text-[22px] leading-none">{ticketLabel}</strong></>}</div>
                <Link href={spotlight ? `/events/${spotlight.slug}` : "/events"} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-4 text-[13px] font-bold text-navy transition hover:bg-orange-100">
                  {spotlight?.ticketsAvailable ? "Get tickets" : spotlight ? "View event" : "Browse events"} <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>

      <nav aria-label="Browse events by category" className="border-b border-line bg-white px-5 py-5 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5">
          <span className="mr-2 text-[12px] font-bold text-navy">Explore what&apos;s on</span>
          {CATEGORIES.map((category) => (
            <Link key={category.label} href={`/events?category=${encodeURIComponent(category.value)}`} className="rounded-full border border-line bg-paper-2 px-4 py-2.5 text-[12px] font-semibold text-ink-2 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
              {category.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
