import Link from "next/link"
import {
  ArrowRight, Mail, MapPin, Globe, Apple, Smartphone,
  ShieldCheck, FileText, ScanLine, Wallet, MessageCircle,
} from "lucide-react"

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14} {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  )
}
function IconInstagram(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={14} height={14} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function IconWhatsApp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14} {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.66-2.059-.174-.297-.018-.458.153-.606.134-.133.298-.347.446-.527.145-.18.198-.299.297-.497.097-.198.058-.414-.015-.559-.074-.15-.68-1.627-1.11-2.579-.37-.7-.768-.688-1.06-.688-.258-.014-.546-.016-.845.016-.3.031-.752.244-1.14.952-.285.534-.855 1.676-.855 2.765 0 1.089.603 2.07.912 2.486.176.22 2.492 3.193 5.828 4.002.62.186 1.223.306 1.768.426.96.212 1.828.17 2.497-.075.696-.252 1.588-.94 1.808-1.553.22-.613.22-1.287.151-1.415-.07-.127-.285-.2-.573-.32zM12.014 2.38h.002c5.8 0 10.508 4.706 10.508 10.505 0 2.555-.913 4.886-2.418 6.686l1.33 4.258-4.426-1.173a10.497 10.497 0 0 1-4.994 1.247c-5.799 0-10.508-4.71-10.508-10.508 0-5.798 4.709-10.505 10.508-10.505z"/>
    </svg>
  )
}
function IconFacebook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14} {...props}>
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
    </svg>
  )
}
function IconYouTube(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14} {...props}>
      <path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.38.48A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.12C4.5 20.4 12 20.4 12 20.4s7.5 0 9.38-.48a3 3 0 0 0 2.12-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.24 3.6Z" />
    </svg>
  )
}

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Discover",
    links: [
      ["All events",     "/events"],
      ["Concerts",       "/events?category=concert"],
      ["Marathons",      "/events?category=marathon"],
      ["Film",           "/events?category=film"],
      ["Photo gallery",  "/media"],
    ],
  },
  {
    title: "Organizers",
    links: [
      ["How it works",   "/how-it-works"],
      ["Sell tickets",   "/auth/signup?role=organizer"],
      ["Pricing",        "/pricing"],
      ["Payouts",        "/payouts"],
      ["Help center",    "/help"],
    ],
  },
  {
    title: "Vendors",
    links: [
      ["Marketplace",    "/vendors"],
      ["Apply to list",  "/vendors/apply"],
      ["Vendor FAQ",     "/help/vendors"],
      ["Payouts",        "/payouts"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About",          "/about"],
      ["Contact",        "/contact"],
      ["Terms",          "/legal/terms"],
      ["Privacy",        "/legal/privacy"],
    ],
  },
]

const SOCIALS: { label: string; href: string; Icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement }[] = [
  { label: "WhatsApp",  href: "https://wa.me/263777816368",        Icon: IconWhatsApp },
  { label: "X",         href: "https://twitter.com/ticketpulse",   Icon: IconX },
  { label: "Instagram", href: "https://instagram.com/ticketpulse", Icon: IconInstagram },
  { label: "Facebook",  href: "https://facebook.com/ticketpulse",  Icon: IconFacebook },
  { label: "YouTube",   href: "https://youtube.com/@ticketpulse",  Icon: IconYouTube },
]

const TRUST = [
  { icon: ShieldCheck, k: "Verified by default", v: "Every organizer & vendor checked" },
  { icon: FileText,    k: "Printable PDF + QR",   v: "Same code, paper or phone" },
  { icon: MessageCircle, k: "WhatsApp delivery",  v: "Tickets land in your chat" },
  { icon: ScanLine,    k: "Our gate scanner",     v: "End-to-end on TicketPulse" },
  { icon: Wallet,      k: "Pay-as-you-sell",      v: "Flat 5%, never up front" },
]

export default function Footer() {
  return (
    <footer className="mt-24 relative overflow-hidden text-white">
      {/* Background — deep navy with multi-layer atmospherics */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            "linear-gradient(180deg, #08203a 0%, #0a2540 38%, #07182b 100%)",
        }}
        aria-hidden
      />
      {/* Glow orbs */}
      <div
        className="absolute -top-32 right-[8%] -z-10 w-[520px] h-[520px] rounded-full blur-3xl pointer-events-none opacity-60"
        style={{ background: "radial-gradient(closest-side, rgba(5,112,222,0.45), transparent)" }}
        aria-hidden
      />
      <div
        className="absolute bottom-[-160px] left-[-120px] -z-10 w-[480px] h-[480px] rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ background: "radial-gradient(closest-side, rgba(45,184,160,0.30), transparent)" }}
        aria-hidden
      />
      {/* Grid texture */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
        }}
        aria-hidden
      />
      {/* Top hairline */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden />

      {/* Newsletter band */}
      <div className="relative border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-14 md:py-20">
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur px-3 py-1.5 mb-5">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
                  <span className="relative block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10.5px] font-semibold tracking-[0.18em] text-white/85 uppercase">Newsletter · Weekly</span>
              </span>
              <h2 className="font-bold tracking-[-0.025em] leading-[1.05] text-[34px] md:text-[52px]">
                Get tickets <span className="bg-gradient-to-r from-blue-300 to-white bg-clip-text text-transparent">before they sell out.</span>
              </h2>
              <p className="mt-4 text-[14.5px] md:text-[16px] text-white/70 max-w-md leading-relaxed">
                A curated digest of what&apos;s on near you, plus pre-sale codes from the organizers we work with. No spam, unsubscribe in one click.
              </p>
            </div>

            <form className="space-y-3">
              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                <input
                  type="email"
                  required
                  aria-label="Email address"
                  placeholder="you@example.com"
                  className="w-full h-14 rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur pl-11 pr-4 text-[14.5px] text-white placeholder:text-white/40 focus:outline-none focus:border-blue/60 focus:ring-4 focus:ring-blue/20 transition"
                />
              </div>
              <button
                type="submit"
                className="w-full h-14 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-navy font-semibold text-[14.5px] shadow-[0_18px_50px_-20px_rgba(255,255,255,0.45)] hover:bg-paper-2 active:scale-[0.99] transition group"
              >
                Subscribe to the digest
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <p className="text-[11.5px] text-white/45 leading-relaxed">
                By subscribing you agree to our{" "}
                <Link href="/legal/privacy" className="underline decoration-white/30 underline-offset-2 hover:text-white/70">privacy policy</Link>.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div className="relative border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-7">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8">
            {TRUST.map(({ icon: Icon, k, v }) => (
              <div key={k} className="flex items-start gap-3">
                <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/15 shrink-0">
                  <Icon size={15} className="text-blue-300" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight text-white">{k}</p>
                  <p className="text-[11.5px] text-white/55 leading-snug">{v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-14 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 font-bold text-[19px] tracking-tight text-white">
              <span className="relative inline-flex w-7 h-7 items-center justify-center rounded-md bg-white">
                <span className="block w-1.5 h-1.5 rounded-full bg-navy" />
                <span className="absolute inset-0 rounded-md ring-2 ring-white/30 ring-offset-2 ring-offset-transparent" aria-hidden />
              </span>
              TicketPulse
            </Link>
            <p className="mt-5 text-[14px] leading-relaxed text-white/65 max-w-xs">
              Zimbabwe&apos;s ticketing platform. Sell, deliver, scan: one stack, built in Harare and live since May 2026.
            </p>

            <div className="mt-5 inline-flex items-start gap-2 text-[12.5px] text-white/55">
              <MapPin size={13} className="text-white/45 mt-0.5 shrink-0" />
              <span className="leading-relaxed">Harare CBD, Zimbabwe</span>
            </div>

            {/* Socials */}
            <div className="mt-6 flex gap-1.5">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex w-9 h-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-white/75 hover:text-white hover:border-white/30 hover:bg-white/[0.08] transition-all"
                >
                  <Icon />
                </a>
              ))}
            </div>

            {/* Payments */}
            <div className="mt-7">
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-white/45 uppercase mb-2.5">We accept</p>
              <div className="flex flex-wrap gap-1.5">
                {["EcoCash", "Visa", "USD", "ZAR"].map((m) => (
                  <span
                    key={m}
                    className="text-[11px] font-medium rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-white/75"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Mobile apps */}
            <div className="mt-6">
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-white/45 uppercase mb-2.5">Mobile apps</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-white/75">
                  <Apple size={11} className="text-white/55" />
                  iOS
                  <span className="ml-1 rounded bg-blue/30 px-1 py-px text-[9.5px] font-semibold tracking-wide uppercase text-blue-200">Soon</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-white/75">
                  <Smartphone size={11} className="text-white/55" />
                  Android
                  <span className="ml-1 rounded bg-blue/30 px-1 py-px text-[9.5px] font-semibold tracking-wide uppercase text-blue-200">Soon</span>
                </span>
              </div>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-white/45 uppercase mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[13.5px] text-white/70 hover:text-white transition-colors inline-flex items-center group"
                    >
                      {label}
                      <ArrowRight
                        size={11}
                        className="ml-1 opacity-0 -translate-x-1 group-hover:opacity-80 group-hover:translate-x-0 transition-all"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Mega wordmark */}
      <div
        aria-hidden
        className="relative max-w-7xl mx-auto px-6 md:px-8 select-none pointer-events-none"
      >
        <div className="overflow-hidden">
          <p className="font-bold tracking-[-0.045em] leading-none text-[clamp(64px,16vw,260px)] bg-gradient-to-b from-white/[0.10] to-white/[0.02] bg-clip-text text-transparent whitespace-nowrap">
            TicketPulse
          </p>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="relative border-t border-white/10 bg-black/20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-5">
            <Link href="/help" className="inline-flex items-center gap-2 text-[12px] text-white/55 hover:text-white/85 transition-colors">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                <span className="relative block w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-emerald-300 font-medium">All systems operational</span>
            </Link>
            <span className="hidden md:inline text-white/15">·</span>
            <p className="text-[12px] text-white/45">© {new Date().getFullYear()} TicketPulse. Built in Harare.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-5">
            <button className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white/85 transition-colors">
              <Globe size={12} /> English (Zimbabwe) · USD
            </button>
            <span className="hidden md:inline text-white/15">·</span>
            <Link href="/legal/terms"   className="text-[12px] text-white/55 hover:text-white/85 transition-colors">Terms</Link>
            <Link href="/legal/privacy" className="text-[12px] text-white/55 hover:text-white/85 transition-colors">Privacy</Link>
            <Link href="/legal/cookies" className="text-[12px] text-white/55 hover:text-white/85 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
