import Link from "next/link"
import { Sparkles, Wallet, ShieldCheck, Clock, ArrowRight, Check, Banknote, Smartphone } from "lucide-react"
import { FAQ as FAQSection } from "@/components/ui/Accordion"

const RAILS = [
  { icon: Smartphone, title: "EcoCash",  body: "Instant on event completion. No fee under USD 50.", chip: "Instant" },
  { icon: Banknote,   title: "USD bank", body: "Wire to your nominated USD account, settled in 24h.", chip: "24 hours" },
  { icon: Banknote,   title: "ZAR bank", body: "EFT to South African bank, settled in 24h.",         chip: "24 hours" },
  { icon: Wallet,     title: "Card refund pool", body: "Refunds to attendees come from this, auto.", chip: "Automatic" },
]

const TIMELINE = [
  { title: "Event ends",                    body: "Your event is marked complete by the scanner." },
  { title: "24-hour review window",         body: "Disputes (no-shows, refunds) can be resolved in this window." },
  { title: "Payout calculation",            body: "Total sales − refunds − 5% TicketPulse fee = your payout." },
  { title: "Funds released",                body: "EcoCash: instant. USD/ZAR bank: arrives within 24h of release." },
]

const FAQ = [
  { q: "What's the fee?",                  a: "5% of ticket sales. We cover EcoCash and Paynow processing under USD 50. Card processing above USD 50 carries a 2.5% pass-through." },
  { q: "Can I split payouts to multiple accounts?", a: "Yes. Add up to 3 destinations and weight each by percentage. Useful for shared events with co-organizers." },
  { q: "What happens to refunds?",         a: "Refunds are deducted from your gross sales before payout. If refunds exceed sales, the difference is invoiced separately." },
  { q: "Is my money safe before the event?", a: "All ticket revenue is held in a TrustCo Zimbabwe escrow account, separate from TicketPulse operating funds. Read more in the Terms." },
]

export default function PayoutsPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-12 md:pb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-blue" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">Payouts</span>
          </div>
          <h1 className="text-[36px] md:text-[56px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Get paid the day your event ends.
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-ink-2 max-w-xl leading-relaxed">
            EcoCash, USD, or ZAR, release straight to your account when the gate closes. No invoices, no chasing.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[12.5px] text-ink-3">
            <span className="inline-flex items-center gap-2"><Clock size={14} className="text-emerald-600" /> 24-hour settlement</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-600" /> Escrow-backed</span>
            <span className="inline-flex items-center gap-2"><Check size={14} className="text-emerald-600" /> No setup fee</span>
          </div>
        </div>
      </section>

      {/* Rails */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Methods</p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Choose your rails.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {RAILS.map(({ icon: Icon, title, body, chip }) => (
            <div key={title} className="rounded-2xl border border-line bg-paper p-6 relative">
              <span className="absolute top-5 right-5 text-[10px] font-semibold tracking-wide bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                {chip}
              </span>
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 mb-4">
                <Icon size={17} className="text-blue" />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="text-[13px] text-ink-2 mt-1.5 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-14 md:py-20">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Timeline</p>
          <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">When the money moves.</h2>
          <ol className="relative">
            <span className="absolute left-[7px] top-2 bottom-2 w-px bg-line" aria-hidden />
            {TIMELINE.map((s, i) => (
              <li key={i} className="relative pl-8 pb-8 last:pb-0">
                <span className="absolute left-0 top-2 w-3.5 h-3.5 rounded-full bg-paper border-2 border-navy" />
                <p className="text-[16px] font-semibold tracking-tight text-ink">{s.title}</p>
                <p className="text-[13.5px] text-ink-2 mt-1 leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">FAQ</p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Common payout questions.</h2>
        <FAQSection items={FAQ} />
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/auth/signup?role=organizer" className="inline-flex items-center gap-2 rounded-xl bg-navy text-white font-semibold px-5 py-3.5 text-sm hover:bg-navy-700 transition shadow-sm shadow-navy/20">
            Start selling tickets <ArrowRight size={15} />
          </Link>
          <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper text-ink font-semibold px-5 py-3.5 text-sm hover:border-line-2 transition-colors">
            Talk to sales
          </Link>
        </div>
      </section>
    </div>
  )
}
