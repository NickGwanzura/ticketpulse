import Link from "next/link"
import { Check, Sparkles, ArrowRight, ShieldCheck, FileText, Smartphone, ScanLine, MessageCircle } from "lucide-react"
import { FAQ as FAQSection } from "@/components/ui/Accordion"

const TIERS = [
  {
    name: "Attendee",
    tagline: "For ticket buyers",
    price: "Free",
    sub: "forever",
    features: [
      "Browse all events",
      "Printable PDF ticket + mobile QR",
      "WhatsApp ticket delivery",
      "EcoCash and Visa cards",
      "Refund up to 24h before",
      "Photo packs & merch in-app",
    ],
    cta: { label: "Start browsing", href: "/events" },
    highlight: false,
  },
  {
    name: "Organizer",
    tagline: "For event hosts",
    price: "5%",
    sub: "per ticket sold",
    features: [
      "Unlimited events & tiers",
      "PDF + mobile tickets, WhatsApp delivery, our gate scanner",
      "WhatsApp broadcast to all attendees",
      "Built-in shuttle, merch, photo packs",
      "Verified payouts (USD, ZAR, EcoCash)",
      "Real-time scan analytics & duplicate guard",
      "Vendor marketplace access",
      "Email & live chat support",
    ],
    cta: { label: "Start selling", href: "/auth/signup?role=organizer" },
    highlight: true,
  },
  {
    name: "Vendor",
    tagline: "For caterers, sound, photo, security",
    price: "Free",
    sub: "to list",
    features: [
      "Public profile + reviews",
      "Direct organizer enquiries",
      "TicketPulse holds payments",
      "Verified badge after 5 events",
      "Calendar sync to avoid double-bookings",
    ],
    cta: { label: "Apply to list", href: "/vendors/apply" },
    highlight: false,
  },
]

const FAQ = [
  { q: "Do attendees need an account to buy?", a: "No, and that's by design. Buyers check out with just name, email, and phone. We hold the seat, email a magic link, and one click verifies them and releases the tickets. The account is auto-created passwordless. Cuts cart abandonment dramatically, and your ticket conversion goes up." },
  { q: "How does the 5% organizer fee work?", a: "We deduct 5% from each ticket sold and pay out the rest directly to your linked EcoCash, ZAR, or USD account on event completion. There are no monthly fees, no setup fees, and no charges if you don't sell." },
  { q: "Is the gate scanner included in the 5%?", a: "Yes. The 5% covers the full pipeline: sale, printable PDF + mobile QR delivery, and our gate-scanner app for organizers. No extra per-scan charge, no third-party scanner fees, no separate hardware to buy." },
  { q: "Are there processing fees?",          a: "TicketPulse covers EcoCash processing fees out of our 5% on amounts under USD 50. For Visa card payments above USD 50, a 2.5% processor fee is passed through." },
  { q: "When do payouts arrive?",             a: "USD and ZAR payouts arrive within 24 hours of your event ending. EcoCash payouts are instant once the event has been marked complete." },
  { q: "Can I refund attendees?",             a: "Yes, full or partial, any time. Funds are returned to the original payment method automatically." },
]

export default function PricingPage() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-24 pb-10 md:pb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-green-600" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">Pricing</span>
          </div>
          <h1 className="text-[40px] md:text-[64px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Simple. <span className="text-green-600">Pay-as-you-sell.</span>
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-ink-2 max-w-2xl leading-relaxed">
            Free for attendees. Free to list as a vendor. Organizers pay a flat 5%, and only when you actually sell tickets. No setup costs, no monthly fees, no third-party scanner contracts. Same pricing since launch in May 2026.
          </p>

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl">
            {[
              { icon: FileText,   k: "Printable PDF tickets", v: "Emailed at checkout. A4-ready, scan from paper." },
              { icon: Smartphone, k: "Mobile QR + wallet",    v: "Same code in your account, on any device." },
              { icon: MessageCircle, k: "WhatsApp delivery",  v: "Tickets land straight in your WhatsApp chat." },
              { icon: ScanLine,   k: "Our gate scanner",      v: "Reader app for organizers, included in 5%." },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="rounded-xl border border-line bg-paper/80 backdrop-blur p-3.5 flex items-start gap-3">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-green-50 ring-1 ring-green-500/15 shrink-0">
                  <Icon size={14} className="text-green-600" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold tracking-tight text-ink">{k}</p>
                  <p className="text-[11.5px] text-ink-2 leading-snug">{v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-3xl bg-paper p-7 md:p-8 flex flex-col ${
                t.highlight
                  ? "border-2 border-navy shadow-[0_24px_60px_-24px_rgba(10,37,64,0.25)]"
                  : "border border-line"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 inline-flex items-center gap-1 bg-navy text-white text-[10px] font-semibold tracking-wide px-3 py-1 rounded-full shadow-sm">
                  <Sparkles size={10} /> Most popular
                </span>
              )}
              <p className="text-[12px] font-semibold tracking-[0.16em] text-blue uppercase">{t.name}</p>
              <p className="text-[13px] text-ink-3 mt-1">{t.tagline}</p>
              <div className="mt-6 mb-7 flex items-baseline gap-2">
                <span className="text-[44px] md:text-[52px] font-bold tracking-[-0.025em] text-ink leading-none">{t.price}</span>
                <span className="text-[13px] text-ink-3">{t.sub}</span>
              </div>
              <ul className="space-y-2.5 mb-8">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[14px] text-ink-2">
                    <Check size={15} className="text-green-600 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={t.cta.href}
                className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
                  t.highlight
                    ? "bg-green-600 text-white shadow-sm shadow-green-600/20 hover:bg-green-700"
                    : "border border-line bg-paper text-ink hover:border-line-2"
                }`}
              >
                {t.cta.label} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-16 md:py-20">
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
          <div className="mb-10">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">FAQ</p>
            <h2 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-tight text-ink">Pricing questions, answered.</h2>
          </div>
          <FAQSection items={FAQ} />
          <div className="mt-10 rounded-2xl border border-line bg-paper p-5 flex items-start gap-3">
            <ShieldCheck size={16} className="text-green-600 mt-0.5 shrink-0" />
            <p className="text-[13.5px] text-ink-2 leading-relaxed">
              <span className="font-semibold text-ink">No surprise fees.</span>{" "}
              We publish every cent we charge. If you spot a fee that isn&apos;t listed here,{" "}
              <Link href="/contact" className="text-navy font-semibold hover:underline">tell us</Link> and we&apos;ll refund it.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
