import Link from "next/link"
import { ArrowRight, Sparkles, Heart, ShieldCheck, Target, Zap } from "lucide-react"

const VALUES = [
  { icon: ShieldCheck, title: "Verified by default", body: "Every organizer and vendor is checked before they go live. Trust isn't a setting. It's the floor." },
  { icon: Zap,         title: "Patchy-data friendly", body: "Mobile-first, EcoCash-native, scans at the gate even when venue Wi-Fi tanks." },
  { icon: Heart,       title: "Local first",          body: "Built in Harare by people who buy these tickets themselves. We sit on the same buses." },
  { icon: Target,      title: "Aligned incentives",   body: "5% per ticket, paid out of sales, never up front. We only win when sellers do." },
]

const MILESTONES = [
  { year: "2024",     title: "An idea in Harare",        body: "Started as a side project to run ticketing for the Nyuki Marathon." },
  { year: "2025",     title: "Built end-to-end",         body: "One platform: sale, printable PDF + mobile QR delivery, and our own gate-scanner. No third-party stack." },
  { year: "May 2026", title: "Launched.",                body: "Public on-sale opened with the Nyuki Marathon as our anchor event. EcoCash, Visa, USD and ZAR all clearing at checkout." },
  { year: "Now",      title: "Filling the calendar",     body: "Onboarding organizers across Harare, Bulawayo and Vic Falls. New events going live every week." },
]

const FACTS = [
  { k: "May 2026", v: "Day 1, public launch" },
  { k: "Harare",   v: "Where we sit, code and answer support" },
  { k: "5% flat",  v: "Per ticket sold. Nothing else" },
  { k: "1 stack",  v: "Sell · deliver · scan, all on TicketPulse" },
]

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-24 pb-12 md:pb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
              <span className="relative block w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">About · Live since May 2026</span>
          </div>
          <h1 className="text-[40px] md:text-[64px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Tickets that work, <span className="text-blue">where you live.</span>
          </h1>
          <p className="mt-5 md:mt-6 text-[16px] md:text-[19px] leading-relaxed text-ink-2 max-w-2xl">
            We&apos;re a Zimbabwean ticketing platform, built in Harare for the way events actually run here: patchy data, four currencies, mobile money and a culture of last-minute decisions. We launched in May 2026 with one anchor event and a single belief: organizers and vendors deserve technology that respects them.
          </p>

          <div className="mt-9 md:mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
            {FACTS.map(({ k, v }) => (
              <div key={k} className="rounded-2xl border border-line bg-paper/80 backdrop-blur p-4">
                <p className="text-[15px] md:text-[16px] font-semibold tracking-tight text-ink leading-tight">{k}</p>
                <p className="text-[12px] text-ink-3 mt-1 leading-snug">{v}</p>
              </div>
            ))}
          </div>
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
            <div key={title} className="rounded-2xl border border-line bg-paper p-6 hover:border-line-2 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-30px_rgba(10,37,64,0.18)] transition-all duration-300">
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
            <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">From one race to launch day.</h2>
          </div>
          <ol className="relative">
            <span className="absolute left-[7px] top-2 bottom-2 w-px bg-line" aria-hidden />
            {MILESTONES.map((m, i) => {
              const isNow = m.year === "Now"
              return (
                <li key={i} className="relative pl-8 pb-8 last:pb-0">
                  <span className={`absolute left-0 top-2 w-3.5 h-3.5 rounded-full bg-paper border-2 ${isNow ? "border-emerald-500" : "border-navy"}`}>
                    {isNow && <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" aria-hidden />}
                  </span>
                  <p className={`text-[11px] font-semibold tracking-[0.18em] uppercase mb-1 ${isNow ? "text-emerald-700" : "text-blue"}`}>{m.year}</p>
                  <p className="text-[16px] font-semibold tracking-tight text-ink">{m.title}</p>
                  <p className="text-[13.5px] text-ink-2 mt-1 leading-relaxed">{m.body}</p>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* Founders' note */}
      <section className="max-w-5xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div className="rounded-3xl border border-line bg-paper p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(600px 220px at 90% 0%, #EAF2FA 0%, transparent 60%)" }} />
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-3">A note from the team</p>
          <p className="text-[18px] md:text-[22px] font-medium tracking-tight leading-[1.4] text-ink max-w-3xl">
            &ldquo;We built TicketPulse because we were tired of paying scanner fees on top of platform fees, of payouts that took weeks, of QR codes that didn&apos;t open offline at the gate. So we wrote our own (sale, ticket, scanner) and we&apos;re running it on real events from day one.&rdquo;
          </p>
          <p className="mt-5 text-[13px] text-ink-3">The TicketPulse team, Harare</p>
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
                We&apos;re hiring engineers, designers and partnership leads. Or just say hi, we read every email.
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
