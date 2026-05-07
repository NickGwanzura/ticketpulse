import Link from "next/link"
import { ArrowRight, Sparkles, Heart, ShieldCheck, Target, Zap } from "lucide-react"

const VALUES = [
  { icon: ShieldCheck, title: "Verified by default", body: "Every organizer and vendor on TicketPulse is checked. Trust isn't optional." },
  { icon: Zap,         title: "Built for low-bandwidth", body: "Mobile-first, EcoCash-native, works on patchy data. Designed for here." },
  { icon: Heart,       title: "Local first",        body: "Built in Harare, by people who actually go to these events." },
  { icon: Target,      title: "Aligned incentives",  body: "We only win when sellers do. Pay-as-you-sell, never up front." },
]

const MILESTONES = [
  { year: "2024", title: "Founded in Harare",         body: "TicketPulse launches as a side project for the Nyuki Marathon." },
  { year: "2024", title: "First 5,000 tickets",       body: "Sold to runners across 18 cities." },
  { year: "2025", title: "Vendor marketplace",        body: "Catering, sound, photography on board." },
  { year: "2025", title: "Cross-border bookings",     body: "Pretoria, Johannesburg, Vic Falls, London." },
  { year: "2026", title: "120+ events live",          body: "And just getting started." },
]

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-24 pb-12 md:pb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-blue" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">About</span>
          </div>
          <h1 className="text-[40px] md:text-[64px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Tickets that work, <span className="text-blue">where you live.</span>
          </h1>
          <p className="mt-5 md:mt-6 text-[16px] md:text-[19px] leading-relaxed text-ink-2 max-w-2xl">
            TicketPulse is a Zimbabwean ticketing platform built for the way events actually run here, patchy data, four currencies, mobile money, and a culture of last-minute decisions. We believe organizers and vendors deserve technology that respects them.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="mb-10 max-w-2xl">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">What we believe</p>
          <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">Four things we won&apos;t compromise on.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {VALUES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-line bg-paper p-6 hover:border-line-2 transition-colors">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 mb-4">
                <Icon size={17} className="text-blue" />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink mb-1.5">{title}</p>
              <p className="text-[13.5px] leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-16 md:py-20">
          <div className="mb-10">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">The story so far</p>
            <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">From one race to a region.</h2>
          </div>
          <ol className="relative">
            <span className="absolute left-[7px] top-2 bottom-2 w-px bg-line" aria-hidden />
            {MILESTONES.map((m, i) => (
              <li key={i} className="relative pl-8 pb-8 last:pb-0">
                <span className="absolute left-0 top-2 w-3.5 h-3.5 rounded-full bg-paper border-2 border-navy" />
                <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-1">{m.year}</p>
                <p className="text-[16px] font-semibold tracking-tight text-ink">{m.title}</p>
                <p className="text-[13.5px] text-ink-2 mt-1 leading-relaxed">{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 md:px-8 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-14 relative overflow-hidden">
          <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-blue/30 blur-3xl pointer-events-none" />
          <div className="relative grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="text-[28px] md:text-[40px] font-bold tracking-[-0.02em] leading-[1.05]">
                Want to work with us?
              </h2>
              <p className="mt-3 text-[15px] md:text-[16px] text-white/80 max-w-md leading-relaxed">
                We&apos;re hiring engineers, designers, and partnership leads. Or just say hi, we read every email.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl bg-white text-navy font-semibold px-5 py-3.5 text-sm hover:bg-paper-2 active:scale-[0.99] transition">
                Get in touch <ArrowRight size={15} />
              </Link>
              <Link href="/events" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 text-white font-semibold px-5 py-3.5 text-sm hover:bg-white/10 transition">
                Browse events
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
