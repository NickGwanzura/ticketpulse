import Link from "next/link"
import {
  Search, Sparkles, Ticket, CreditCard, ShieldCheck, Users, CalendarCog, Store,
  ArrowRight, Mail, MessageSquare,
} from "lucide-react"
import { FAQ as FAQSection } from "@/components/ui/Accordion"

const TOPICS = [
  { icon: Ticket,      title: "Tickets & entry",  body: "QR codes, transfers, refunds.",         href: "#tickets" },
  { icon: CreditCard,  title: "Payments",         body: "EcoCash and Visa cards.",                 href: "#payments" },
  { icon: ShieldCheck, title: "Account & safety", body: "Security, verification, refunds.",      href: "#account" },
  { icon: CalendarCog, title: "For organizers",   body: "Selling, payouts, scanning.",           href: "/help#organizers" },
  { icon: Store,       title: "For vendors",      body: "Listing, bookings, payouts.",           href: "/help/vendors" },
  { icon: Users,       title: "Group bookings",   body: "Buy for teams or families.",            href: "#groups" },
]

const POPULAR = [
  { q: "How do I transfer a ticket to someone else?",  a: "Open the ticket in your account, tap Transfer, and enter the recipient's email. They'll get a link and a fresh QR code in their account." },
  { q: "When will I get my refund?",                   a: "Refunds appear in the original payment method within 24 to 72 hours, depending on the provider. EcoCash refunds are usually instant." },
  { q: "What if I lose my phone before the event?",    a: "Sign in to your account on any device, your QR is bound to your account, not the device. Or visit will-call at the gate with photo ID." },
  { q: "How do organizers get paid?",                  a: "Payouts run within 24h of an event ending, in USD, ZAR, or to EcoCash. Cancelled events trigger automatic refunds, no payout." },
  { q: "Are vendor profiles vetted?",                  a: "Verified badge means we've checked business registration, references, and reviewed past events. Unverified profiles are still real businesses but newer to the platform." },
]

export default function HelpPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-12 md:pb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-blue" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">Help center</span>
          </div>
          <h1 className="text-[36px] md:text-[56px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Need a hand?
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-ink-2 max-w-xl leading-relaxed">
            Search the help center, or skip ahead to a topic. Still stuck? Live chat is open weekdays, average reply under five minutes.
          </p>

          <form action="/help/search" className="mt-8 max-w-2xl relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            <input
              type="text"
              name="q"
              placeholder="Search articles, e.g. 'transfer ticket'…"
              className="w-full h-14 rounded-xl border border-line bg-paper pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-3 shadow-sm shadow-ink/[0.04] focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
            />
          </form>
        </div>
      </section>

      {/* Topics */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-16">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Topics</p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Browse by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {TOPICS.map(({ icon: Icon, title, body, href }) => (
            <Link
              key={title}
              href={href}
              className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all group"
            >
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 mb-4">
                <Icon size={17} className="text-blue" />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="text-[12.5px] text-ink-2 mt-1">{body}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy group-hover:gap-1.5 transition-all">
                Open <ArrowRight size={11} />
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-14 md:py-20">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Popular</p>
          <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Most-asked questions</h2>
          <FAQSection items={POPULAR} />
        </div>
      </section>

      {/* Contact strip */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-20 grid md:grid-cols-2 gap-4">
        <Link href="/contact" className="rounded-2xl border border-line bg-paper p-6 flex items-start gap-4 hover:border-line-2 hover:shadow-sm transition-all">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 shrink-0">
            <MessageSquare size={17} className="text-blue" />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-ink">Live chat</p>
            <p className="text-[13px] text-ink-2 mt-0.5">Mon to Fri, 8:00 to 18:00 CAT. Average reply: 4 minutes.</p>
            <p className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy">
              Open chat <ArrowRight size={11} />
            </p>
          </div>
        </Link>
        <Link href="mailto:hello@ticketpulse.co.zw" className="rounded-2xl border border-line bg-paper p-6 flex items-start gap-4 hover:border-line-2 hover:shadow-sm transition-all">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-paper-2 ring-1 ring-line shrink-0">
            <Mail size={17} className="text-ink-2" />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-ink">Email support</p>
            <p className="text-[13px] text-ink-2 mt-0.5">Replies within 4 business hours.</p>
            <p className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy">
              hello@ticketpulse.co.zw <ArrowRight size={11} />
            </p>
          </div>
        </Link>
      </section>
    </div>
  )
}
