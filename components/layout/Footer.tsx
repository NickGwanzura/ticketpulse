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
                  <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-70" />
                  <span className="relative block w-1.5 h-1.5 rounded-full bg-green-400" />
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
                  className="w-full h-14 rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur pl-11 pr-4 text-[14.5px] text-white placeholder:text-white/40 focus:outline-none focus:border-green-500/60 focus:ring-4 focus:ring-green-500/20 transition"
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
                  <Icon size={15} className="text-green-300" />
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
              <span className="relative inline-flex w-11 h-11 items-center justify-center">
                <svg viewBox="0 0 283.46 283.46" className="w-11 h-11" fill="none" aria-hidden="true">
                  <path d="M113.36,166.49c0.58,1.5,2.04,2.58,3.75,2.58h0.31C116.19,168.01,114.81,167.14,113.36,166.49z"/>
                  <path fill="#FFFFFF" d="M138.28,103.34h-10.44v25.85h-8.76v-25.85h-9.63v-6.88h28.01L138.28,103.34z"/>
                  <path fill="#FFFFFF" d="M145.5,102.66c-1.28,0-2.39-0.46-3.32-1.4c-0.93-0.93-1.4-2.04-1.4-3.32c0-1.32,0.46-2.45,1.4-3.39c0.93-0.95,2.04-1.42,3.32-1.42c1.32,0,2.45,0.47,3.39,1.42c0.95,0.95,1.42,2.08,1.42,3.39c0,1.28-0.47,2.39-1.42,3.32C147.94,102.2,146.81,102.66,145.5,102.66z M141.16,129.18v-23.34h8.76v23.34H141.16z"/>
                  <path fill="#FFFFFF" d="M174.04,107.38l-2.45,6.02c-0.93-0.48-1.73-0.81-2.41-0.99c-0.67-0.18-1.43-0.26-2.26-0.26c-1.22,0-2.29,0.5-3.2,1.49c-0.91,1-1.37,2.29-1.37,3.9c0,1.57,0.45,2.81,1.35,3.71c0.9,0.9,1.97,1.35,3.23,1.35c0.8,0,1.56-0.09,2.26-0.26c0.71-0.18,1.51-0.51,2.41-0.99l2.45,6.02c-1.99,1.57-4.65,2.36-7.99,2.36c-3.85,0-6.94-1.07-9.27-3.2c-2.33-2.13-3.49-5.13-3.49-8.98c0-2.57,0.54-4.8,1.61-6.69c1.08-1.89,2.58-3.34,4.5-4.33s4.14-1.49,6.64-1.49C169.38,105.02,172.05,105.81,174.04,107.38z"/>
                  <path fill="#FFFFFF" d="M177.21,129.18V95.73l8.76-0.53v17.33l8.71-7.36l5.25,6.02l-6.21,4.67l7.89,13.33h-9.43l-4.62-8.71l-1.59,1.2v7.51H177.21z"/>
                  <path fill="#FFFFFF" d="M226.3,119.7h-14.2c0.32,0.99,0.92,1.77,1.8,2.33c0.88,0.56,2.05,0.84,3.49,0.84c2.21,0,4.35-0.53,6.4-1.59l2.45,5.92c-0.96,0.71-2.35,1.3-4.16,1.78c-1.81,0.48-3.67,0.72-5.56,0.72c-2.73,0-5.14-0.47-7.24-1.4c-2.1-0.93-3.75-2.32-4.93-4.16c-1.19-1.84-1.78-4.05-1.78-6.62c0-2.53,0.55-4.75,1.64-6.64c1.09-1.89,2.59-3.34,4.5-4.36c1.91-1.01,4.05-1.52,6.43-1.52c2.41,0,4.44,0.55,6.11,1.64c1.67,1.09,2.93,2.55,3.78,4.38c0.85,1.83,1.28,3.87,1.28,6.11V119.7z M211.86,115.37h6.06c0-0.8-0.26-1.56-0.77-2.26c-0.51-0.71-1.27-1.06-2.26-1.06c-0.8,0-1.52,0.34-2.14,1.01C212.13,113.73,211.83,114.5,211.86,115.37z"/>
                  <path fill="#FFFFFF" d="M246.23,106.8l0.82,6.88h-6.93v5.78c0,0.96,0.25,1.73,0.75,2.29c0.5,0.56,1.16,0.84,2,0.84c1.15,0,2.28-0.3,3.37-0.91l2.5,5.97c-0.61,0.51-1.56,0.99-2.86,1.42c-1.3,0.43-2.5,0.65-3.59,0.65c-1.93,0-3.72-0.35-5.39-1.06c-1.67-0.71-3.01-1.76-4.02-3.15c-1.01-1.4-1.52-3.09-1.52-5.08v-6.74h-3.61v-6.88h3.61v-6.3l8.76-1.2v7.51H246.23z"/>
                  <path fill="#8DD32F" d="M124.27,165.85h-8.76v-32.73h13.77c2.5,0,4.77,0.44,6.81,1.32c2.04,0.88,3.66,2.21,4.86,3.99c1.2,1.78,1.8,3.94,1.8,6.47c0,2.5-0.64,4.61-1.93,6.33c-1.28,1.72-2.98,2.99-5.08,3.83c-2.1,0.83-4.39,1.25-6.86,1.25h-4.62V165.85z M128.99,140h-4.72v9.43h4.81c1.35,0,2.45-0.43,3.32-1.3s1.3-1.94,1.3-3.22c0-1.48-0.43-2.66-1.28-3.56C131.58,140.45,130.43,140,128.99,140z"/>
                  <path fill="#8DD32F" d="M161.91,142.56h8.76v23.34h-4.24l-2.5-2.41c-3.4,2.12-6.58,3.18-9.53,3.18c-2.82,0-4.94-0.83-6.35-2.48c-1.41-1.65-2.12-3.84-2.12-6.57v-15.06h8.76v14.25c0,0.8,0.19,1.47,0.58,2c0.39,0.53,1.03,0.79,1.93,0.79c0.51,0,1.23-0.14,2.17-0.41c0.93-0.27,1.78-0.58,2.55-0.94V142.56z"/>
                  <path fill="#8DD32F" d="M175.96,165.85V132.4l8.76-0.53v33.98H175.96z"/>
                  <path fill="#8DD32F" d="M188.67,163.64l2.45-5.53c0.93,0.45,2.06,0.83,3.39,1.15c1.33,0.32,2.41,0.48,3.25,0.48c0.58,0,1.06-0.1,1.44-0.29c0.39-0.19,0.58-0.45,0.58-0.77c0-0.19-0.22-0.42-0.65-0.7c-0.43-0.27-0.99-0.52-1.66-0.75c-2.44-0.87-4.44-1.89-5.99-3.08s-2.33-2.74-2.33-4.67c0-2.44,0.91-4.35,2.74-5.73c1.83-1.38,4.36-2.07,7.6-2.07c1.38,0,2.9,0.19,4.55,0.55c1.65,0.37,3.07,1.02,4.26,1.95l-2.45,5.53c-0.96-0.42-1.95-0.75-2.96-1.01c-1.01-0.26-1.93-0.39-2.77-0.39c-0.71,0-1.28,0.1-1.73,0.29c-0.45,0.19-0.68,0.45-0.68,0.77c0,0.19,0.22,0.42,0.68,0.67c0.45,0.26,1.04,0.51,1.78,0.77c2.41,0.83,4.37,1.85,5.9,3.06c1.52,1.2,2.29,2.77,2.29,4.69c0,2.47-0.82,4.39-2.45,5.75c-1.64,1.36-4.06,2.05-7.27,2.05c-1.38,0-3.09-0.23-5.13-0.67C191.46,165.26,189.85,164.57,188.67,163.64z"/>
                  <path fill="#8DD32F" d="M234,156.37h-14.2c0.32,0.99,0.92,1.77,1.8,2.33c0.88,0.56,2.05,0.84,3.49,0.84c2.21,0,4.35-0.53,6.4-1.59l2.45,5.92c-0.96,0.71-2.35,1.3-4.16,1.78c-1.81,0.48-3.67,0.72-5.56,0.72c-2.73,0-5.14-0.47-7.24-1.4c-2.1-0.93-3.75-2.32-4.93-4.16c-1.19-1.84-1.78-4.05-1.78-6.62c0-2.53,0.55-4.75,1.64-6.64c1.09-1.89,2.59-3.34,4.5-4.36c1.91-1.01,4.05-1.52,6.43-1.52c2.41,0,4.44,0.55,6.11,1.64c1.67,1.09,2.93,2.55,3.78,4.38c0.85,1.83,1.28,3.87,1.28,6.11V156.37z M219.56,152.04h6.06c0-0.8-0.26-1.56-0.77-2.26c-0.51-0.71-1.27-1.06-2.26-1.06c-0.8,0-1.52,0.34-2.14,1.01S219.53,151.17,219.56,152.04z"/>
                  <path fill="#FFFFFF" d="M142.02,164.02c-1.05-2.02-2.06-4.03-3.02-6.08c-0.04,0.03-0.1,0.04-0.16,0.07c-2.5,0.98-5.24,1.5-8.12,1.53c1.39,3.01,2.87,5.99,4.41,8.96c0.47,0.54,0.38,2.36-0.27,2.54l-13.02,3.53c-1.15-2.17-2.65-4.03-4.43-5.51c-1.23-1.06-2.61-1.93-4.06-2.58c-3.53-1.62-7.55-2.04-11.47-1.05c-7.95,2.03-13.75,9.25-13.27,18.01l-15.66,3.99c-1.05-29.92-8.5-57.74-22.14-83.69c-0.26-1.02,0.24-2.81,0.97-2.99l14.34-3.72c3.79,7.92,12.05,11.6,19.8,9.62c7.86-2.02,13.24-9.45,12.59-18.31l14.39-3.72c0.09,2.34,0.21,4.68,0.38,7h8.19c-0.17-2.29-0.3-4.57-0.38-6.86c-0.21-5.61-5.89-9.43-11.06-8.05l-16.68,4.46c-3.04,0.82-3.86,3.96-3.19,6.67c1.19,4.87-1.79,9.68-6.19,10.86c-4.58,1.22-9.47-1.6-10.89-6.32c-1.01-3.31-3.59-4.93-6.94-3.99L49.6,92.96c-6.32,1.75-9.11,8.77-6.08,14.52c12.82,24.34,20.1,50.76,21.09,78.39c0.2,5.62,4.93,10.99,11.01,9.4l18.32-4.77c2.53-0.65,3.73-3.18,3.08-5.59c-1.41-5.18,1.96-10.29,6.73-11.45c5.35-1.32,10.04,1.67,11.58,7.01c0.6,2.09,3.21,3.48,5.25,2.92l16.71-4.54c2.92-0.79,5.21-3.79,5.95-5.98C144.35,169.65,143.51,166.86,142.02,164.02z"/>
                  <path fill="#8DD32F" d="M47.72,141.89c6.32,14.05,13.16,29.16,12.95,44.95c-3.64-0.94-5.53-4.3-6.23-7.62c-1.44-6.83-2.98-13.25-5.58-19.84c-4.98-12.65-11.42-24.13-18.59-35.58c-1.93-3.08-1.9-7.74,1.06-9.78c2.83-1.95,5.79-3.14,9.04-4.42l2.82,5.67l-6.44,2.77c-0.47,0.2-1.3,1-1.38,1.4c-0.08,0.4,0.21,1.33,0.45,1.7C40.36,127.88,44.37,134.46,47.72,141.89z"/>
                  <polygon fill="#FFFFFF" points="87.82,127.62 81.19,129.5 79.8,125.06 86.59,123.37"/>
                  <polygon fill="#FFFFFF" points="74.27,131.09 67.57,132.98 66.38,128.6 73.07,126.8"/>
                  <polygon fill="#FFFFFF" points="101.23,124.19 94.6,126.02 93.34,121.63 100.01,119.87"/>
                  <polygon fill="#FFFFFF" points="114.81,120.7 108.08,122.47 106.89,118.16 113.52,116.4"/>
                  <circle fill="#8DD32F" cx="242.85" cy="160.38" r="5.08"/>
                </svg>
              </span>
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
                  <span className="ml-1 rounded bg-green-500/30 px-1 py-px text-[9.5px] font-semibold tracking-wide uppercase text-green-200">Soon</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-white/75">
                  <Smartphone size={11} className="text-white/55" />
                  Android
                  <span className="ml-1 rounded bg-green-500/30 px-1 py-px text-[9.5px] font-semibold tracking-wide uppercase text-green-200">Soon</span>
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
                <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" />
                <span className="relative block w-2 h-2 rounded-full bg-green-400" />
              </span>
              <span className="text-green-300 font-medium">All systems operational</span>
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
