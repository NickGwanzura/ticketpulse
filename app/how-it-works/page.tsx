import Link from "next/link"
import {
  ArrowRight,
  Sparkles,
  Search,
  CreditCard,
  Ticket,
  ScanLine,
  Megaphone,
  Settings2,
  Wallet,
  Clock3,
  ShieldCheck,
  Store,
  CalendarCheck,
  Smartphone,
} from "lucide-react"

const ATTENDEE_STEPS = [
  {
    icon: Search,
    title: "Find your event",
    body: "Browse concerts, marathons, film, and more. Filter by date, city, and category.",
  },
  {
    icon: CreditCard,
    title: "Pay, no signup",
    body: "EcoCash or Visa, USD or ZAR. Just your name, email, and phone. We hold your seat the moment you pay.",
  },
  {
    icon: Ticket,
    title: "One-click verify",
    body: "We email a magic link. Click once: tickets release, account auto-created passwordless. Your ticket also arrives by WhatsApp — no app to download. Set a password later, or don't. Your call.",
  },
  {
    icon: ScanLine,
    title: "Walk in fast",
    body: "Our scanner reads your QR in under a second. PDF, screen, or wallet pass: works offline at the gate.",
  },
]

const ORGANIZER_STEPS = [
  {
    icon: Settings2,
    title: "Build your event",
    body: "Set tiers, capacity, and dates. Add merch, photo packs, or shuttles in the same flow.",
  },
  {
    icon: Megaphone,
    title: "Open pre-sales",
    body: "Run early-bird pricing, members-only windows, or password-gated drops before public on-sale.",
  },
  {
    icon: Ticket,
    title: "Sell tickets",
    body: "Public on-sale with EcoCash, Visa, USD, ZAR. Buyers get printable PDF, mobile QR, and WhatsApp ticket instantly.",
  },
  {
    icon: ScanLine,
    title: "Run the gate",
    body: "Scan with our app, see live entry counts, catch duplicates automatically.",
  },
  {
    icon: Wallet,
    title: "Get paid",
    body: "Verified payouts to EcoCash, USD, or ZAR after the event clears. 5% per ticket, nothing up front.",
  },
]

const VENDOR_STEPS = [
  {
    icon: Store,
    title: "List your service",
    body: "Caterers, sound, photo, security: set your profile, rates, and calendar.",
  },
  {
    icon: CalendarCheck,
    title: "Get booked",
    body: "Organizers send direct enquiries. Calendar sync prevents double-bookings.",
  },
  {
    icon: Wallet,
    title: "Paid safely",
    body: "TicketPulse holds payment until you deliver, so you're never chasing invoices.",
  },
]

const PRESALE_PERKS = [
  {
    icon: Clock3,
    title: "Early-bird windows",
    body: "Open a discounted tier for the first N days, or until a sales cap is hit. Auto-rolls into the public price.",
  },
  {
    icon: ShieldCheck,
    title: "Members-only drops",
    body: "Password-gated pre-sales for sponsors, mailing lists, or fan clubs. Share a link, no separate accounts needed.",
  },
  {
    icon: Smartphone,
    title: "Waitlist + alerts",
    body: "Capture demand before tickets go live. Notify your list the moment public on-sale opens.",
  },
]

export default function HowItWorksPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)",
          }}
        />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-24 pb-12 md:pb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-blue" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">How it works</span>
          </div>
          <h1 className="text-[40px] md:text-[64px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Tickets in three taps. <span className="text-blue">Sales in three steps.</span>
          </h1>
          <p className="mt-5 md:mt-6 text-[16px] md:text-[19px] leading-relaxed text-ink-2 max-w-2xl">
            Buying a ticket, hosting an event, or selling a service: here&apos;s what happens, and how pre-sales fit in. Live and running since May 2026.
          </p>
        </div>
      </section>

      {/* Attendees */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="mb-10 max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">For attendees</p>
          <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">Buy a ticket in under a minute.</h2>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ATTENDEE_STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative rounded-2xl border border-line bg-paper p-6 hover:border-line-2 transition-colors">
              <span className="absolute top-4 right-4 text-[11px] font-semibold tracking-[0.16em] text-ink-3">
                0{i + 1}
              </span>
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 mb-4">
                <Icon size={17} className="text-blue" />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink mb-1.5">{title}</p>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{body}</p>
            </li>
          ))}
        </ol>

        {/* Fast checkout callout */}
        <div className="mt-8 rounded-2xl border border-blue/15 bg-gradient-to-br from-blue-soft to-paper p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="inline-flex w-11 h-11 items-center justify-center rounded-xl bg-paper ring-1 ring-blue/20 shadow-sm shrink-0">
              <Smartphone size={18} className="text-blue" />
            </span>
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-blue uppercase mb-1">Why no signup?</p>
              <p className="text-[14.5px] font-semibold tracking-tight text-ink leading-snug">
                Last-minute decisions deserve last-minute checkouts.
              </p>
              <p className="mt-1.5 text-[13px] text-ink-2 leading-relaxed max-w-xl">
                Account creation is the #1 reason people abandon carts. So we put it after the buy. You pay, we hold the seat, the magic-link verifies you, tickets land. Total time: under a minute.
              </p>
            </div>
          </div>
          <Link
            href="/events"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-navy px-5 py-3 text-[13.5px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition shrink-0"
          >
            Try it now <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Organizers */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">For organizers</p>
            <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">Launch, sell, scan, get paid.</h2>
            <p className="mt-3 text-[15px] text-ink-2 max-w-xl leading-relaxed">
              One platform, no third-party stack. Run pre-sales, public on-sale, and gate scanning from the same dashboard.
            </p>
          </div>
          <ol className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {ORGANIZER_STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative rounded-2xl border border-line bg-paper p-6 hover:border-line-2 transition-colors">
                <span className="absolute top-4 right-4 text-[11px] font-semibold tracking-[0.16em] text-ink-3">
                  0{i + 1}
                </span>
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 mb-4">
                  <Icon size={17} className="text-blue" />
                </span>
                <p className="text-[15px] font-semibold tracking-tight text-ink mb-1.5">{title}</p>
                <p className="text-[13.5px] leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pre-sales spotlight */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="rounded-3xl border border-line bg-paper p-8 md:p-12 relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(600px 240px at 100% 0%, #DBE8FB 0%, transparent 60%), radial-gradient(500px 200px at 0% 100%, #EAF2FA 0%, transparent 60%)",
            }}
          />
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue/20 bg-blue-soft px-3 py-1.5 mb-4">
                <Clock3 size={13} className="text-blue" />
                <span className="text-[11px] font-semibold tracking-[0.16em] text-blue uppercase">Pre-sales</span>
              </div>
              <h2 className="text-[26px] md:text-[36px] font-bold tracking-tight leading-[1.1] text-ink">
                Yes, we run pre-sales.
              </h2>
              <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed text-ink-2 max-w-md">
                Open early-bird tiers, members-only windows, or build a waitlist before public on-sale. Same dashboard, same payouts, same gate scanner.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/auth/signup?role=organizer"
                  className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-[14px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition group"
                >
                  Set up a pre-sale
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-[14px] font-semibold text-ink-2 hover:text-ink hover:border-line-2 transition"
                >
                  Talk to us first
                </Link>
              </div>
            </div>
            <ul className="space-y-3">
              {PRESALE_PERKS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4 rounded-2xl border border-line bg-paper-2/60 p-5">
                  <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 shrink-0">
                    <Icon size={17} className="text-blue" />
                  </span>
                  <div>
                    <p className="text-[14.5px] font-semibold tracking-tight text-ink">{title}</p>
                    <p className="text-[13px] leading-relaxed text-ink-2 mt-1">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Vendors */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">For vendors</p>
            <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">Get listed, get booked, get paid.</h2>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VENDOR_STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative rounded-2xl border border-line bg-paper p-6 hover:border-line-2 transition-colors">
                <span className="absolute top-4 right-4 text-[11px] font-semibold tracking-[0.16em] text-ink-3">
                  0{i + 1}
                </span>
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 mb-4">
                  <Icon size={17} className="text-blue" />
                </span>
                <p className="text-[15px] font-semibold tracking-tight text-ink mb-1.5">{title}</p>
                <p className="text-[13.5px] leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 md:px-8 py-16 md:py-24">
        <div className="max-w-7xl mx-auto rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-14 relative overflow-hidden">
          <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-blue/30 blur-3xl pointer-events-none" />
          <div className="relative grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="text-[28px] md:text-[40px] font-bold tracking-[-0.02em] leading-[1.05]">
                Ready when you are.
              </h2>
              <p className="mt-3 text-[15px] md:text-[16px] text-white/80 max-w-md leading-relaxed">
                Set up your event, open a pre-sale, or browse what&apos;s on. No up-front fees, no per-seat hostage costs.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link
                href="/auth/signup?role=organizer"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-navy font-semibold px-5 py-3.5 text-sm hover:bg-paper-2 active:scale-[0.99] transition"
              >
                Start selling <ArrowRight size={15} />
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 text-white font-semibold px-5 py-3.5 text-sm hover:bg-white/10 transition"
              >
                Browse events
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
