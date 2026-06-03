import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  CalendarCog,
  Wallet,
  Percent,
  Banknote,
  Smartphone,
  ScanLine,
  Ticket,
  Megaphone,
  ShieldCheck,
  Clock3,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { FAQ as FAQSection } from "@/components/ui/Accordion"

const STEPS = [
  {
    icon: CalendarCog,
    title: "Create your event",
    body: "Set your event name, date, venue, and city. Add ticket tiers, capacity limits, and optional merch or photo packs in minutes.",
  },
  {
    icon: Megaphone,
    title: "Publish when ready",
    body: "Use the publish checklist to confirm details, add ticket tiers, preview the public page, then make the event live.",
  },
  {
    icon: Ticket,
    title: "Sell everywhere",
    body: "Buyers pay with EcoCash or Visa in USD or ZAR. They get a printable PDF, mobile QR, and WhatsApp ticket instantly.",
  },
  {
    icon: ScanLine,
    title: "Scan at the gate",
    body: "Use our built-in scanner to check guests in. See live entry counts and catch duplicate QR codes automatically.",
  },
  {
    icon: Wallet,
    title: "Get paid",
    body: "Request a payout from settled sales. We deduct the platform fee and send the available balance to your EcoCash or bank account.",
  },
]

const PRICING_PERKS = [
  {
    icon: Percent,
    title: "5% per ticket sold",
    body: "We charge 5% on every ticket sale. No monthly fees, no setup costs, no hidden charges. You only pay when you sell.",
  },
  {
    icon: Banknote,
    title: "Payouts on your schedule",
    body: "Withdraw earnings at any point along the way. Funds hit your EcoCash or bank account within 24 hours of request.",
  },
  {
    icon: Smartphone,
    title: "EcoCash & bank transfers",
    body: "Choose EcoCash for instant mobile money, or a direct bank transfer in USD or ZAR. You pick what works for you.",
  },
  {
    icon: ShieldCheck,
    title: "Fraud protection built in",
    body: "Every QR is unique and tied to the buyer's account. Duplicates are flagged automatically at the gate.",
  },
]

const PUBLISH_CHECKLIST = [
  "Event title, date, venue, city, and description are correct.",
  "At least one ticket tier is created with the right price and capacity.",
  "Refund, parking, age limit, dress code, or entry notes are added under More About This Event.",
  "Cover image and public preview look right on mobile.",
  "Payout details and organizer contact details are ready before heavy sales begin.",
]

const EVENT_DAY = [
  {
    icon: ScanLine,
    title: "Use scanner mode",
    body: "Open the organizer scanner on a phone, start the camera, and keep sound or vibration on for faster admit/reject feedback.",
  },
  {
    icon: Ticket,
    title: "Have manual lookup ready",
    body: "If a QR is cracked, dim, or unavailable, search by ticket code, buyer email, or order reference before turning guests away.",
  },
  {
    icon: AlertTriangle,
    title: "Escalate payment disputes",
    body: "If someone says they paid but has no ticket, capture their payment time, phone/email, and order reference for admin reconciliation.",
  },
]

const FAQS = [
  {
    q: "How much does TicketPulse charge organizers?",
    a: "We charge 5% of every ticket sale. There are no setup fees, no monthly subscriptions, and no hidden costs. You only pay when tickets are sold.",
  },
  {
    q: "When and how do I get paid?",
    a: "You can request a payout at any time from your organizer dashboard. Once requested, funds are sent to your EcoCash or bank account within 24 hours. The 5% fee is deducted automatically from the payout amount.",
  },
  {
    q: "Can I get paid before the event happens?",
    a: "Yes. You are not required to wait until the event ends. Request a partial or full payout whenever you like, as long as there are settled funds in your event balance.",
  },
  {
    q: "What payment methods do buyers use?",
    a: "Buyers can pay with EcoCash or Visa card in USD or ZAR. All transactions are processed securely and tickets are issued instantly upon successful payment.",
  },
  {
    q: "What happens if I cancel my event?",
    a: "Cancelled events trigger automatic refunds to all buyers. No payout is issued for cancelled events, and buyers are notified immediately by email and WhatsApp.",
  },
  {
    q: "How many organizers can manage one event?",
    a: "The event owner can invite up to 2 additional organizers to help manage the event. Each organizer gets access to ticket sales, check-in, and staff tickets.",
  },
  {
    q: "Can I offer different ticket tiers?",
    a: "Yes. You can create multiple tiers such as General, VIP, Early-bird, and Members-only. Each tier can have its own price, capacity, and sales window.",
  },
  {
    q: "How do I publish an event?",
    a: "Create the event, add at least one ticket tier, preview the public page, then press Publish event from the organizer event overview or ticket tiers page.",
  },
  {
    q: "Can I edit an event after publishing?",
    a: "Yes. You can update details after publishing, but avoid changing core entry rules, venue, or times without notifying buyers through email or WhatsApp broadcast.",
  },
  {
    q: "Do I need a separate app to scan tickets?",
    a: "No. Ticket scanning works directly from your phone's browser. Open the Live dashboard for your event, point the camera at a QR code, and the scanner handles the rest.",
  },
  {
    q: "What should I do if someone paid but has no ticket?",
    a: "Ask for their checkout email, payment phone or card name, payment time, and any order reference. Admin can use reconciliation tools to confirm payment and resend tickets if valid.",
  },
]

export const metadata = {
  title: "Help for organizers",
  description:
    "How TicketPulse works for event organizers. 5% per ticket, payouts via EcoCash or bank, and built-in scanning.",
}

export default function HelpOrganizersPage() {
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
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
          <Link
            href="/help"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink mb-6 transition-colors"
          >
            <ArrowLeft size={13} />
            Back to help center
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-5 shadow-sm shadow-ink/5">
            <CalendarCog size={13} className="text-brand-600" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">
              For organizers
            </span>
          </div>
          <h1 className="text-[36px] md:text-[52px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Everything you need to sell tickets.
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-ink-2 max-w-xl leading-relaxed">
            Launch an event, publish only when it is ready, sell with supported payments, scan tickets at the gate, and track payout readiness.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-16">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
          How it works
        </p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">
          From idea to payout in five steps
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="relative rounded-2xl border border-line bg-paper p-5 hover:border-line-2 transition-colors"
            >
              <span className="absolute top-4 right-4 text-[11px] font-semibold tracking-[0.16em] text-ink-3">
                0{i + 1}
              </span>
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 mb-4">
                <Icon size={17} className="text-brand-600" />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink mb-1.5">
                {title}
              </p>
              <p className="text-[13px] leading-relaxed text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-14 md:pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-line bg-paper p-6">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
              Before publishing
            </p>
            <h2 className="text-[24px] md:text-[30px] font-bold tracking-tight text-ink">
              Publish checklist
            </h2>
            <div className="mt-5 space-y-3">
              {PUBLISH_CHECKLIST.map((item) => (
                <div key={item} className="flex gap-3 rounded-xl bg-paper-2 px-4 py-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  <p className="text-[13px] leading-relaxed text-ink-2">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-[15px] font-semibold text-amber-900">Do this before sharing widely</p>
            <p className="mt-2 text-[13px] leading-relaxed text-amber-800">
              Buy one test ticket or issue a staff ticket, open it on a phone, and scan it from another device. This confirms the gate workflow before real guests arrive.
            </p>
            <Link
              href="/auth/signup?role=organizer"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-700 transition"
            >
              Open organizer tools <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing / Payouts */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-16">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
            Pricing & payouts
          </p>
          <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">
            Simple pricing. Flexible payouts.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRICING_PERKS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex gap-4 rounded-2xl border border-line bg-paper p-5"
              >
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 shrink-0">
                  <Icon size={17} className="text-brand-600" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold tracking-tight text-ink">
                    {title}
                  </p>
                  <p className="text-[13px] leading-relaxed text-ink-2 mt-1">{body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Payout callout */}
          <div className="mt-6 rounded-2xl border border-green-500/15 bg-gradient-to-br from-blue-soft to-paper p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-start gap-4">
              <span className="inline-flex w-11 h-11 items-center justify-center rounded-xl bg-paper ring-1 ring-green-500/20 shadow-sm shrink-0">
                <Clock3 size={18} className="text-brand-600" />
              </span>
              <div>
                <p className="text-[15px] font-semibold tracking-tight text-ink leading-snug">
                  Payouts within 24 hours
                </p>
                <p className="mt-1 text-[13px] text-ink-2 leading-relaxed max-w-xl">
                  Request a payout at any time from your dashboard. We deduct the 5% fee and transfer the balance to your EcoCash or bank account. No minimum balance, no waiting for the event to end.
                </p>
              </div>
            </div>
            <Link
              href="/auth/signup?role=organizer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-3 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition shrink-0"
            >
              Start selling <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-16">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
          Event day
        </p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">
          Run the gate with fewer surprises
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {EVENT_DAY.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-line bg-paper p-5">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 mb-4">
                <Icon size={17} className="text-brand-600" />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-5 md:px-8 py-14 md:py-16">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
          FAQ
        </p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">
          Organizer questions
        </h2>
        <FAQSection items={FAQS} />
      </section>

      {/* CTA */}
      <section className="px-5 md:px-8 pb-14 md:pb-20">
        <div className="max-w-7xl mx-auto rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-8 md:p-12 relative overflow-hidden">
          <div className="relative grid md:grid-cols-2 gap-6 items-center">
            <div>
              <h2 className="text-[26px] md:text-[36px] font-bold tracking-[-0.02em] leading-[1.05]">
                Ready to sell your first tickets?
              </h2>
              <p className="mt-3 text-[15px] text-white/80 max-w-md leading-relaxed">
                No upfront fees, no monthly costs. Just 5% per ticket sold and payouts when you want them.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link
                href="/auth/signup?role=organizer"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-navy font-semibold px-5 py-3.5 text-sm hover:bg-paper-2 active:scale-[0.99] transition"
              >
                Sign up as organizer <ArrowRight size={15} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 text-white font-semibold px-5 py-3.5 text-sm hover:bg-white/10 transition"
              >
                Talk to support
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
