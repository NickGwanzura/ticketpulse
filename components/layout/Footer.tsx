import Link from "next/link"
import { ArrowRight, Mail, MapPin, Globe } from "lucide-react"

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={15} height={15} {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  )
}
function IconInstagram(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={15} height={15} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function IconFacebook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={15} height={15} {...props}>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  )
}
function IconYouTube(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={15} height={15} {...props}>
      <path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.38.48A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.12C4.5 20.4 12 20.4 12 20.4s7.5 0 9.38-.48a3 3 0 0 0 2.12-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.24 3.6Z" />
    </svg>
  )
}

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Discover",
    links: [
      ["All events", "/events"],
      ["Concerts", "/events?category=concert"],
      ["Marathons", "/events?category=marathon"],
      ["Film", "/events?category=film"],
      ["Photo gallery", "/media"],
    ],
  },
  {
    title: "Organizers",
    links: [
      ["Sell tickets", "/auth/signup?role=organizer"],
      ["Pricing", "/pricing"],
      ["Payouts", "/payouts"],
      ["Help center", "/help"],
    ],
  },
  {
    title: "Vendors",
    links: [
      ["Marketplace", "/vendors"],
      ["Apply to list", "/vendors/apply"],
      ["Vendor FAQ", "/help/vendors"],
      ["Payouts", "/payouts"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Contact", "/contact"],
      ["Terms", "/legal/terms"],
      ["Privacy", "/legal/privacy"],
    ],
  },
]

const SOCIALS: { label: string; href: string; Icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement }[] = [
  { label: "X",         href: "https://twitter.com/ticketpulse",   Icon: IconX },
  { label: "Instagram", href: "https://instagram.com/ticketpulse", Icon: IconInstagram },
  { label: "Facebook",  href: "https://facebook.com/ticketpulse",  Icon: IconFacebook },
  { label: "YouTube",   href: "https://youtube.com/@ticketpulse",  Icon: IconYouTube },
]

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-2">
      {/* Newsletter band */}
      <div className="relative overflow-hidden border-b border-line">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(700px 240px at 90% 50%, #DBE8FB 0%, transparent 60%), radial-gradient(500px 200px at 0% 50%, #EAF2FA 0%, transparent 60%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-14">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Stay in the loop</p>
              <h2 className="text-[24px] md:text-[32px] font-bold tracking-tight leading-[1.15] text-ink">
                Get tickets <span className="text-blue">before they sell out.</span>
              </h2>
              <p className="mt-2.5 text-[14px] text-ink-2 max-w-md">
                A weekly digest of events near you. No spam, unsubscribe any time.
              </p>
            </div>
            <form className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  aria-label="Email address"
                  placeholder="you@example.com"
                  className="w-full h-12 rounded-xl border border-line bg-paper pl-11 pr-4 text-[14px] text-ink placeholder:text-ink-3 shadow-sm shadow-ink/[0.03] focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
                />
              </div>
              <button
                type="submit"
                className="h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 text-[14px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition group"
              >
                Subscribe
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-[18px] tracking-tight text-ink">
              <span className="relative inline-flex w-7 h-7 items-center justify-center rounded-md bg-navy">
                <span className="block w-1.5 h-1.5 rounded-full bg-white" />
                <span className="absolute inset-0 rounded-md ring-2 ring-navy/15 ring-offset-2 ring-offset-paper-2" aria-hidden />
              </span>
              TicketPulse
            </Link>
            <p className="mt-4 text-[14px] leading-relaxed text-ink-2 max-w-xs">
              Zimbabwe&apos;s premier event ticketing platform. One ticket, every event.
            </p>

            {/* Office */}
            <div className="mt-5 inline-flex items-start gap-2 text-[12.5px] text-ink-3">
              <MapPin size={13} className="text-ink-3 mt-0.5 shrink-0" />
              <span className="leading-relaxed">Harare CBD, Zimbabwe</span>
            </div>

            {/* Socials */}
            <div className="mt-5 flex gap-1.5">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex w-9 h-9 items-center justify-center rounded-lg border border-line bg-paper text-ink-2 hover:text-ink hover:border-line-2 hover:bg-paper-3 transition-all"
                >
                  <Icon />
                </a>
              ))}
            </div>

            {/* Payments */}
            <div className="mt-6">
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-2.5">We accept</p>
              <div className="flex flex-wrap gap-1.5">
                {["EcoCash", "Visa"].map((m) => (
                  <span
                    key={m}
                    className="text-[11px] font-medium rounded-md border border-line bg-paper px-2 py-1 text-ink-2"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[13.5px] text-ink-2 hover:text-ink transition-colors inline-flex items-center group"
                    >
                      {label}
                      <ArrowRight
                        size={11}
                        className="ml-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 md:gap-5">
            <span className="inline-flex items-center gap-2 text-[12px] text-ink-3">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                <span className="relative block w-2 h-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-emerald-700 font-medium">All systems operational</span>
            </span>
            <span className="hidden md:inline text-line-2">·</span>
            <p className="text-[12px] text-ink-3">© {new Date().getFullYear()} TicketPulse. Built in Harare.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 md:gap-5">
            <button className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink-2 transition-colors">
              <Globe size={12} /> English (Zimbabwe)
            </button>
            <span className="hidden md:inline text-line-2">·</span>
            <Link href="/legal/terms"   className="text-[12px] text-ink-3 hover:text-ink-2 transition-colors">Terms</Link>
            <Link href="/legal/privacy" className="text-[12px] text-ink-3 hover:text-ink-2 transition-colors">Privacy</Link>
            <Link href="/legal/cookies" className="text-[12px] text-ink-3 hover:text-ink-2 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
