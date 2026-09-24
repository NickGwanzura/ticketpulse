import Link from "next/link"
import { Sparkles, ArrowLeft, ArrowRight, ShieldCheck, Wallet, Calendar, Star, FileCheck2, MessageSquare, BadgeCheck } from "lucide-react"
import { FAQ as FAQSection } from "@/components/ui/Accordion"

const STEPS = [
  { n: "01", title: "Apply", body: "Send your business details, category, city, contact information, and basic verification documents." },
  { n: "02", title: "Build profile", body: "Add packages, photos, serving areas, minimum notice, capacity, and starting prices." },
  { n: "03", title: "Confirm scope", body: "Organizers enquire, you confirm availability, price, timing, and what is included." },
  { n: "04", title: "Get paid", body: "Confirmed bookings and payout details are tracked so both sides know what is owed and when." },
]

const REQUIREMENTS = [
  "Business name or trading name",
  "Primary service category",
  "City and areas served",
  "Phone and email contact",
  "Clear package descriptions and price-from guidance",
  "Photos, references, or social proof where available",
]

const BOOKING_GUIDE = [
  {
    icon: MessageSquare,
    title: "Reply quickly",
    body: "Fast replies convert more enquiries. Confirm date, venue, guest count, setup time, and exact package scope before quoting.",
  },
  {
    icon: FileCheck2,
    title: "Write down the scope",
    body: "List what is included, what costs extra, cancellation terms, arrival time, and who provides power, tables, water, or security.",
  },
  {
    icon: BadgeCheck,
    title: "Build trust",
    body: "Keep photos current, honour confirmed prices, and ask organizers to review you after successful events.",
  },
]

const FAQ = [
  { q: "Do I have to be VAT-registered?", a: "No. Sole traders, small teams, and registered companies can apply. TicketPulse may ask for ID, business references, photos, or social proof before approval." },
  { q: "How do organizers contact me?", a: "Organizers browse vendor profiles and send enquiries from TicketPulse. Keep your phone, email, city, package descriptions, and pricing guidance up to date." },
  { q: "What should I include in a package?", a: "Include what is delivered, setup time, staffing, quantity or guest limits, travel area, overtime rules, and anything the organizer must provide." },
  { q: "How do I get the verified badge?", a: "Verification is reviewed by TicketPulse. Strong profiles usually include references, clear photos, reliable contact details, and a record of successful events." },
  { q: "Can I reject a booking?", a: "Yes. You should reject enquiries when you are unavailable, the scope is unclear, or the event is outside your service area." },
  { q: "What happens if an event is cancelled?", a: "Cancellation handling depends on the agreement between vendor and organizer. Put deposit, refund, and cancellation terms in writing before confirming work." },
]

export const metadata = {
  title: "Help for vendors",
  description: "How TicketPulse works for vendors, including applications, profiles, enquiries, packages, and booking support.",
  alternates: { canonical: "/help/vendors" },
}

export default function HelpVendorsPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10 tp-page-wash" />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
          <Link href="/help" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors mb-6">
            <ArrowLeft size={13} /> All help topics
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-brand-600" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">For vendors</span>
          </div>
          <h1 className="text-[36px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.05] text-ink max-w-2xl">
            Get discovered by organizers who need reliable event suppliers.
          </h1>
          <p className="mt-5 text-[16px] text-ink-2 max-w-xl leading-relaxed">
            Catering, sound, photography, security, decor, logistics, and specialist services can use TicketPulse to present packages and receive event enquiries.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">The flow</p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">From application to payout.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-paper p-6">
              <span className="text-[11px] font-mono font-semibold text-blue">{s.n}</span>
              <p className="mt-3 text-[16px] font-semibold tracking-tight text-ink">{s.title}</p>
              <p className="mt-1.5 text-[14px] text-ink-2 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-20">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Why list with us</p>
          <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Three reasons vendors stay.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Wallet,      title: "Guaranteed payouts",  body: "Money in escrow before you start. No more chasing organizers." },
              { icon: Calendar,    title: "Discoverable profile", body: "Listed in front of every organizer searching your category." },
              { icon: ShieldCheck, title: "Dispute support",      body: "We mediate cancellations, scope changes, and rating disputes." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-paper p-6">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 mb-4">
                  <Icon size={17} className="text-brand-600" />
                </span>
                <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
                <p className="text-[14px] text-ink-2 mt-1.5 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-14 md:pb-20">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-line bg-paper p-6">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Before applying</p>
            <h2 className="text-[24px] md:text-[30px] font-bold tracking-tight text-ink">What to prepare</h2>
            <div className="mt-5 grid gap-2">
              {REQUIREMENTS.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl bg-paper-2 px-4 py-3">
                  <ShieldCheck size={14} className="shrink-0 text-brand-600" />
                  <span className="text-[13px] text-ink-2">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-6">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Bookings</p>
            <h2 className="text-[24px] md:text-[30px] font-bold tracking-tight text-ink">How to win better event work</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {BOOKING_GUIDE.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 mb-4">
                    <Icon size={17} className="text-brand-600" />
                  </span>
                  <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">FAQ</p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Vendor questions, answered.</h2>
        <FAQSection items={FAQ} />
      </section>

      {/* CTA */}
      <section className="px-5 md:px-8 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-12 relative overflow-hidden">
          <div className="relative grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="text-[26px] md:text-[36px] font-bold tracking-[-0.02em] leading-[1.05]">
                Ready to take bookings?
              </h2>
              <p className="mt-3 text-[15px] text-white/80 max-w-md leading-relaxed">
                Free to apply. We approve in 48 hours.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/vendors/apply" className="inline-flex items-center gap-2 rounded-xl bg-white text-navy font-semibold px-5 py-3.5 text-sm hover:bg-paper-2 active:scale-[0.99] transition">
                Apply now <ArrowRight size={15} />
              </Link>
              <Link href="/vendors" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 text-white font-semibold px-5 py-3.5 text-sm hover:bg-white/10 transition">
                See live vendors <Star size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
