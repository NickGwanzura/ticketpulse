import Link from "next/link"
import { Sparkles, ArrowLeft, ArrowRight, ShieldCheck, Wallet, Calendar, Star } from "lucide-react"
import { FAQ as FAQSection } from "@/components/ui/Accordion"

const STEPS = [
  { n: "01", title: "Apply",        body: "Fill the short form. We approve in 48 hours." },
  { n: "02", title: "Build profile", body: "Add packages, photos, and serving areas." },
  { n: "03", title: "Take bookings", body: "Organizers find you. Quote and confirm in-app." },
  { n: "04", title: "Get paid",      body: "We hold the payment. Released on event completion." },
]

const FAQ = [
  { q: "Do I have to be VAT-registered?",   a: "No. Sole traders and informal businesses are welcome. We collect basic ID and a reference for verification." },
  { q: "How are payments held?",            a: "Organizers pay TicketPulse on confirmation. Funds are held in a TrustCo Zimbabwe escrow account and released to you when the event is marked complete." },
  { q: "What's the cut?",                   a: "Vendors keep 95% of the booking. We take 5% to cover payment processing, escrow, and organizer support." },
  { q: "How do I get the verified badge?",  a: "Complete 5 paid events with a 4.5+ average rating. Verification is free and reviewed monthly." },
  { q: "Can I sync my external calendar?",  a: "Yes, we support iCal feeds. Confirmed bookings auto-block your TicketPulse calendar." },
  { q: "What happens if an event is cancelled?", a: "If the organizer cancels more than 7 days out, you keep a 25% deposit. Within 7 days, 50%. Day-of cancellations are paid in full per our standard terms." },
]

export default function HelpVendorsPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
          <Link href="/help" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink transition-colors mb-6">
            <ArrowLeft size={13} /> All help topics
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-brand-600" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">For vendors</span>
          </div>
          <h1 className="text-[36px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.05] text-ink max-w-2xl">
            How TicketPulse works for vendors.
          </h1>
          <p className="mt-5 text-[16px] text-ink-2 max-w-xl leading-relaxed">
            Catering, sound, photography, security, decor, here&apos;s the full picture before you apply.
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
              <p className="mt-1.5 text-[13.5px] text-ink-2 leading-relaxed">{s.body}</p>
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
                <p className="text-[13.5px] text-ink-2 mt-1.5 leading-relaxed">{body}</p>
              </div>
            ))}
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
          <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-green-500/30 blur-3xl pointer-events-none" />
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
