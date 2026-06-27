"use client"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import {
  Search, Sparkles, Ticket, CreditCard, ShieldCheck, CalendarCog, Store,
  ArrowRight, Mail, MessageSquare, X, RefreshCw, QrCode, Wallet, AlertTriangle,
} from "lucide-react"
import { FAQ as FAQSection } from "@/components/ui/Accordion"

const TOPICS = [
  { icon: Ticket,      title: "Tickets & entry",  body: "QR codes, transfers, gate issues.",      href: "#tickets" },
  { icon: CreditCard,  title: "Payments",         body: "EcoCash, cards, pending payments.",      href: "#payments" },
  { icon: RefreshCw,   title: "Refunds",          body: "Cancellations and money back.",          href: "#refunds" },
  { icon: ShieldCheck, title: "Account & safety", body: "Sign in, transfers, fraud checks.",      href: "#account" },
  { icon: CalendarCog, title: "For organizers",   body: "Publishing, payouts, scanning.",         href: "/help/organizers" },
  { icon: Store,       title: "For vendors",      body: "Listing, bookings, payouts.",            href: "/help/vendors" },
]

const POPULAR = [
  { q: "I paid but did not receive my tickets. What should I do?", a: "Check your email spam folder first, then open Orders with the same email used at checkout. If money was deducted, contact support with your order reference, payment phone or card name, event name, and payment time." },
  { q: "How do I transfer a ticket to someone else?", a: "Open the ticket in your account, tap Transfer, and enter the recipient's email. The recipient gets a secure link and the ticket is moved to them once accepted." },
  { q: "My QR code is not scanning at the gate.", a: "Open the ticket from your account or email and increase screen brightness. If it still fails, ask gate staff to use manual lookup with your ticket code or order email." },
  { q: "When will I get my refund?", a: "Approved refunds usually appear in the original payment method within 24 to 72 hours, depending on the provider. EcoCash refunds are often faster." },
  { q: "What if I lose my phone before the event?", a: "Sign in on another device and open your ticket. If you cannot sign in, bring photo ID and the order email to the gate or contact support before arrival." },
  { q: "How do organizers get paid?", a: "Organizers request payouts from their dashboard. TicketPulse deducts the platform fee and transfers the available balance to the selected EcoCash or bank account." },
  { q: "Can I buy tickets for a group?", a: "Yes. Choose the quantity you need at checkout. Each ticket gets its own QR code, so share or transfer tickets carefully before the event." },
  { q: "Are vendor profiles vetted?", a: "Verified vendors have been reviewed by TicketPulse. New or unverified vendors may still be legitimate, but organizers should confirm availability and scope before booking." },
]

const QUICK_HELP = [
  {
    icon: AlertTriangle,
    title: "Payment deducted, no ticket",
    body: "Send your order reference, payment time, and checkout email. We can trace the payment and reissue tickets if confirmed.",
    href: "mailto:nick@ticketpulse.tech?subject=Payment%20deducted%20but%20no%20ticket",
    cta: "Email support",
  },
  {
    icon: QrCode,
    title: "Gate or scanner issue",
    body: "Open your ticket from the email or account page. Gate staff can also search by ticket code or buyer email.",
    href: "/orders/lookup",
    cta: "Find order",
  },
  {
    icon: Wallet,
    title: "Refund question",
    body: "Refund timing depends on payment provider. Include your order reference so support can check status quickly.",
    href: "mailto:nick@ticketpulse.tech?subject=Refund%20question",
    cta: "Ask about refund",
  },
]

const GUIDE_SECTIONS = [
  {
    id: "tickets",
    title: "Tickets & Entry",
    items: [
      "Every paid ticket has a unique QR code.",
      "Screenshots can work, but the live ticket page is safer because it shows the latest ticket state.",
      "Transferred, cancelled, or refunded tickets may stop working at the gate.",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    items: [
      "Keep the checkout page open until TicketPulse confirms the order.",
      "If your wallet or card is charged but the order stays pending, send support the order reference and payment time.",
      "Do not pay twice for the same order unless the first payment clearly failed.",
    ],
  },
  {
    id: "refunds",
    title: "Refunds",
    items: [
      "Refunds go back to the original payment method where possible.",
      "Cancelled or refunded tickets are invalidated automatically.",
      "For event cancellations, watch your email for organizer and TicketPulse updates.",
    ],
  },
  {
    id: "account",
    title: "Account & Safety",
    items: [
      "Use the same email at checkout and sign-in so orders are easy to find.",
      "Never share your QR code publicly before the event.",
      "Only accept transfer links from people you know.",
    ],
  },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<typeof POPULAR>([])
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchResults.length > 0) inputRef.current?.focus()
  }, [searchResults])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      setSearchResults([])
      setSearched(false)
      return
    }
    const results = POPULAR.filter(
      ({ q: question, a }) => `${question} ${a}`.toLowerCase().includes(q),
    )
    setSearchResults(results)
    setSearched(true)
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-12 md:pb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-brand-600" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">Help center</span>
          </div>
          <h1 className="text-[36px] md:text-[56px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-3xl">
            Help when tickets, payments, or event day get stuck.
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-ink-2 max-w-xl leading-relaxed">
            Search common answers, recover an order, or jump to the right guide for buyers, organizers, and vendors.
          </p>

          <form onSubmit={handleSearch} className="mt-8 max-w-2xl relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles, e.g. 'transfer ticket'…"
              className="w-full h-14 rounded-xl border border-line bg-paper pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-3 shadow-sm shadow-ink/[0.04] focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
            />
          </form>

          {searched && (
            <div className="mt-4 max-w-2xl rounded-xl border border-line bg-paper shadow-sm divide-y divide-line">
              <div className="flex items-center justify-between px-4 py-2.5">
                <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">
                  {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                </p>
                <button
                  type="button"
                  onClick={() => { setSearchResults([]); setSearchQuery(""); setSearched(false) }}
                  className="text-[11px] font-medium text-ink-3 hover:text-ink flex items-center gap-1 transition"
                >
                  <X size={11} /> Clear
                </button>
              </div>
              {searchResults.length > 0 ? (
                searchResults.map(({ q, a }) => (
                  <details key={q} className="group px-4 py-3 cursor-pointer">
                    <summary className="text-[14px] font-medium text-ink list-none flex items-start gap-2 [&::-webkit-details-marker]:hidden">
                      <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-green-500/60" />
                      {q}
                    </summary>
                    <p className="mt-2 text-[13px] text-ink-2 leading-relaxed pl-5">{a}</p>
                  </details>
                ))
              ) : (
                <div className="px-4 py-4">
                  <p className="text-[14px] font-medium text-ink">No exact answer found.</p>
                  <p className="mt-1 text-[13px] text-ink-2">Try “payment”, “refund”, “transfer”, or “QR”, or contact support with your order reference.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {QUICK_HELP.map(({ icon: Icon, title, body, href, cta }) => (
            <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all group">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-500/15 mb-4">
                <Icon size={17} className="text-amber-700" />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="text-[13px] text-ink-2 mt-1.5 leading-relaxed">{body}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-navy group-hover:gap-1.5 transition-all">
                {cta} <ArrowRight size={11} />
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Topics */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-14">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Topics</p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Browse by category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {TOPICS.map(({ icon: Icon, title, body, href }) => (
            <Link
              key={title}
              href={href}
              className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all group"
            >
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 mb-4">
                <Icon size={17} className="text-brand-600" />
              </span>
              <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="text-[13px] text-ink-2 mt-1">{body}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-navy group-hover:gap-1.5 transition-all">
                Open <ArrowRight size={11} />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 md:px-8 pb-14 md:pb-16">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Guides</p>
        <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Fast answers by situation</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {GUIDE_SECTIONS.map((section) => (
            <div id={section.id} key={section.id} className="rounded-2xl border border-line bg-paper p-5 scroll-mt-32">
              <p className="text-[16px] font-semibold tracking-tight text-ink">{section.title}</p>
              <ul className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Popular */}
      <section className="bg-paper-2 border-y border-line">
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-14 md:py-20">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: POPULAR.map(({ q, a }) => ({
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
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Popular</p>
          <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight text-ink mb-8">Most-asked questions</h2>
          <FAQSection items={POPULAR} />
        </div>
      </section>

      {/* Contact strip */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-14 md:py-20 grid md:grid-cols-2 gap-4">
        <Link href="/contact" className="rounded-2xl border border-line bg-paper p-6 flex items-start gap-4 hover:border-line-2 hover:shadow-sm transition-all">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 shrink-0">
            <MessageSquare size={17} className="text-brand-600" />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-ink">Live chat</p>
            <p className="text-[13px] text-ink-2 mt-0.5">Mon to Fri, 8:00 to 18:00 CAT. Average reply: 4 minutes.</p>
            <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-navy">
              Open chat <ArrowRight size={11} />
            </p>
          </div>
        </Link>
        <Link href="mailto:nick@ticketpulse.tech" className="rounded-2xl border border-line bg-paper p-6 flex items-start gap-4 hover:border-line-2 hover:shadow-sm transition-all">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-paper-2 ring-1 ring-line shrink-0">
            <Mail size={17} className="text-ink-2" />
          </span>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-ink">Email support</p>
            <p className="text-[13px] text-ink-2 mt-0.5">Replies within 4 business hours.</p>
            <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-navy">
              nick@ticketpulse.tech <ArrowRight size={11} />
            </p>
          </div>
        </Link>
      </section>
    </div>
  )
}
