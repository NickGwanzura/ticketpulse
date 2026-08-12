import Link from "next/link"
import {
  ArrowRight, Globe, Mail, MapPin, MessageCircle,
  ScanLine, ShieldCheck, Smartphone, Ticket, Wallet,
} from "lucide-react"

function IconInstagram(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={14} height={14} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Buyers",
    links: [
      ["Browse events", "/events"],
      ["Find my order", "/orders/lookup"],
      ["Help center", "/help"],
      ["Reviews", "/reviews/new"],
    ],
  },
  {
    title: "Organizers",
    links: [
      ["Start selling", "/auth/signup?role=organizer"],
      ["How it works", "/how-it-works"],
      ["Pricing", "/pricing"],
      ["Payouts", "/payouts"],
      ["Organizer help", "/help/organizers"],
    ],
  },
  {
    title: "Marketplace",
    links: [
      ["Vendors", "/vendors"],
      ["Apply as vendor", "/vendors/apply"],
      ["Media galleries", "/media"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Contact", "/contact"],
      ["Terms", "/legal/terms"],
      ["Privacy", "/legal/privacy"],
      ["Cookies", "/legal/cookies"],
    ],
  },
]

const TRUST = [
  { icon: Ticket, label: "EcoCash + Visa checkout" },
  { icon: Smartphone, label: "Instant QR delivery" },
  { icon: ScanLine, label: "Gate scanner included" },
  { icon: Wallet, label: "5% organizer fee" },
]

export default function Footer() {
  return (
    <footer className="mt-24 overflow-hidden bg-[#081a2e] text-white">
      <div className="h-px bg-gradient-to-r from-transparent via-orange-300/55 to-transparent" aria-hidden />

      <div className="relative">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage: "linear-gradient(to bottom, black, transparent 80%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 80%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-[radial-gradient(780px_circle_at_12%_8%,rgba(201,82,42,0.22),transparent_44%),linear-gradient(180deg,rgba(8,26,46,0)_0%,#081a2e_100%)]" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-18">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-400/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-100">
                <ShieldCheck size={13} /> Built for live events
              </span>
              <h2 className="mt-5 max-w-3xl text-[34px] font-bold leading-[1.02] tracking-tight md:text-[56px]">
                Sell tickets, scan guests, and settle payouts from one place.
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/68 md:text-[16px]">
                TicketPulse gives organizers a clean checkout, instant ticket delivery, order recovery, attendee tools, and payout tracking without stitching together separate systems.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link
                href="/auth/signup?role=organizer"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-[14px] font-bold text-white shadow-[0_18px_50px_-24px_rgba(201,82,42,0.75)] transition hover:bg-brand-700 active:scale-[0.99]"
              >
                Start selling <ArrowRight size={15} />
              </Link>
              <Link
                href="/events"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/8 px-6 text-[14px] font-bold text-white transition hover:border-orange-300/50 hover:bg-orange-400/12"
              >
                Browse events
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-400/12 text-orange-200 ring-1 ring-orange-300/25">
                  <Icon size={17} />
                </span>
                <p className="text-[13px] font-semibold leading-snug text-white/82">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-y border-white/10 bg-black/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:px-8 lg:grid-cols-[1.25fr_2fr]">
          <div>
            <Link href="/" className="inline-flex items-center" aria-label="TicketPulse home">
              <img src="/ticketpulse-logo-white.svg" alt="TicketPulse" loading="lazy" className="h-16 w-auto" />
            </Link>
            <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-white/62">
              Zimbabwe&apos;s event ticketing platform. Built in Harare for online sales, QR validation, support, reconciliation, and payouts.
            </p>

            <div className="mt-6 space-y-3 text-[13px] text-white/58">
              <p className="flex items-center gap-2">
                <MapPin size={14} className="text-orange-200" /> Harare, Zimbabwe
              </p>
              <Link href="/contact" className="flex items-center gap-2 transition hover:text-white">
                <Mail size={14} className="text-orange-200" /> support@ticketpulse.tech
              </Link>
              <a
                href="https://www.instagram.com/ticketpulsezw"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 transition hover:text-white"
              >
                <IconInstagram className="text-orange-200" /> @ticketpulsezw
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {["EcoCash", "Visa", "USD"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-9 md:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-200/85">{column.title}</p>
                <ul className="mt-4 space-y-3">
                  {column.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="group inline-flex items-center text-[14px] font-medium text-white/62 transition hover:text-white">
                        {label}
                        <ArrowRight size={11} className="ml-1 opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-70" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#061321]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 text-[12px] text-white/46 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/help" className="inline-flex items-center gap-2 text-white/58 transition hover:text-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-70 animate-ping" />
                <span className="relative block h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              All systems operational
            </Link>
            <span className="hidden text-white/15 md:inline">/</span>
            <span>© {new Date().getFullYear()} TicketPulse. Built in Harare.</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <Globe size={12} /> English · USD
            </span>
            <Link href="/legal/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/legal/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/legal/cookies" className="transition hover:text-white">Cookies</Link>
            <a
              href="https://velocity.qantra.co.zw/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition hover:text-white"
            >
              <MessageCircle size={12} /> Velocity Payments
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
