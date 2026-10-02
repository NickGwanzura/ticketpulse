import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, Megaphone, Palette, PenTool, Share2, Sparkles } from "lucide-react"

export const metadata: Metadata = {
  title: "Marketing on demand",
  description: "Get event graphics, social content and launch support from the TicketPulse team.",
  alternates: { canonical: "/marketing" },
}

const SERVICES = [
  {
    icon: Palette,
    title: "Event graphics",
    body: "Posters, ticket artwork, social tiles, sponsor slides and WhatsApp-ready creatives sized for each channel.",
  },
  {
    icon: PenTool,
    title: "Copy and content",
    body: "Clear event descriptions, captions, calls to action and message variations that help people decide to attend.",
  },
  {
    icon: Share2,
    title: "Launch campaigns",
    body: "A practical release plan for your event, including a launch calendar, content checklist and audience follow-ups.",
  },
  {
    icon: Megaphone,
    title: "Promotion support",
    body: "We help package your event for partners, sponsors and community channels so your team can focus on delivery.",
  },
]

const PACKAGES = [
  { name: "Quick creative", price: "From $35", body: "One polished poster or social graphic, with copy and one revision.", items: ["One design concept", "Print and social sizes", "One revision"] },
  { name: "Launch kit", price: "From $75", body: "A ready-to-publish set for announcing and selling an event.", items: ["Poster and five social tiles", "Caption and WhatsApp copy", "Launch checklist"] },
  { name: "Campaign partner", price: "Custom quote", body: "Ongoing creative and promotion help for a larger event or season.", items: ["Full content calendar", "Sponsor and partner assets", "Weekly creative support"] },
]

export default function MarketingPage() {
  return (
    <div className="tp-fade-up">
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10 tp-page-wash" />
        <div className="max-w-6xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-12 md:pb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-brand-600" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">Marketing on demand</span>
          </div>
          <h1 className="text-[38px] md:text-[62px] font-bold tracking-[-0.03em] leading-[1.02] text-ink max-w-4xl">
            Bring the event. <span className="text-brand-600">We help it look the part.</span>
          </h1>
          <p className="mt-5 text-[16px] md:text-[19px] leading-relaxed text-ink-2 max-w-2xl">
            Need graphics, captions or a launch plan? TicketPulse can turn your event details into polished, ready-to-use marketing assets without adding another agency to your week.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition-colors">
              Request a marketing brief <ArrowRight size={15} />
            </Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3.5 text-sm font-semibold text-ink hover:border-line-2 transition-colors">
              See platform pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">What we can do</p>
        <h2 className="text-[26px] md:text-[36px] font-bold tracking-tight text-ink mb-8">Practical creative help when you need it.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SERVICES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-line bg-paper p-6 md:p-7">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 mb-5"><Icon size={18} className="text-brand-600" /></span>
              <h3 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Simple packages</p>
          <h2 className="text-[26px] md:text-[36px] font-bold tracking-tight text-ink mb-8">Choose the level of help you need.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PACKAGES.map((pkg, index) => (
              <div key={pkg.name} className={`rounded-2xl border bg-paper p-6 ${index === 1 ? "border-navy/30 shadow-sm shadow-navy/5" : "border-line"}`}>
                {index === 1 && <span className="inline-flex rounded-full bg-navy px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white mb-4">Most popular</span>}
                <h3 className="text-[18px] font-semibold tracking-tight text-ink">{pkg.name}</h3>
                <p className="mt-2 text-[24px] font-bold tracking-tight text-ink">{pkg.price}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{pkg.body}</p>
                <ul className="mt-5 space-y-2.5">
                  {pkg.items.map((item) => <li key={item} className="flex gap-2 text-[13px] text-ink-2"><Check size={14} className="mt-0.5 shrink-0 text-brand-600" />{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[12px] text-ink-3">Prices are starting points. Final quotes depend on turnaround, number of assets, revisions and campaign scope.</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <div className="rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-12">
          <h2 className="text-[28px] md:text-[40px] font-bold tracking-tight max-w-2xl">Send us the brief. We&apos;ll send back a clear plan.</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80 max-w-xl">Tell us the event date, audience, channels, assets you already have and what success looks like. We will confirm scope, timing and price before work starts.</p>
          <Link href="/contact" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-navy hover:bg-paper-2 transition-colors">Request marketing support <ArrowRight size={15} /></Link>
        </div>
      </section>
    </div>
  )
}
