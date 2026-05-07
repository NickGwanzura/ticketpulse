import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Lock, Sparkles, ArrowRight, Ticket, ScanLine, ShieldCheck } from "lucide-react"
import Countdown from "@/components/launch/Countdown"
import WhatsAppWidget from "@/components/launch/WhatsAppWidget"
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_VALUE,
  LAUNCH_DATE_ISO,
  verifyAccessPassword,
} from "@/lib/launch-gate"

const WHATSAPP_PHONE = "263777816368"

async function unlock(formData: FormData) {
  "use server"
  const input = String(formData.get("password") ?? "")
  if (!verifyAccessPassword(input)) {
    redirect("/coming-soon?e=1")
  }
  const c = await cookies()
  c.set(ACCESS_COOKIE, ACCESS_COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  redirect("/")
}

const TEASERS = [
  { icon: Ticket,       title: "Mobile + printable", body: "Same QR. Email PDF, wallet pass, or screenshot." },
  { icon: ScanLine,     title: "Our gate scanner",   body: "End-to-end. No third-party app. No queues." },
  { icon: ShieldCheck,  title: "EcoCash & Visa",     body: "Both clear instantly at checkout. Refundable up to 24h." },
]

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>
}) {
  const { e } = await searchParams
  const showError = e === "1"
  const launchLabel = new Intl.DateTimeFormat("en-ZW", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Harare",
    hour12: false,
  }).format(new Date(LAUNCH_DATE_ISO))

  return (
    <main
      className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-10 sm:py-14"
      style={{
        background: [
          "radial-gradient(1200px 540px at 88% -8%, #C7DBF5 0%, transparent 58%)",
          "radial-gradient(900px 460px at -6% 8%, #E5EFFA 0%, transparent 55%)",
          "radial-gradient(680px 380px at 55% 110%, rgba(254,235,200,0.55) 0%, transparent 60%)",
          "radial-gradient(420px 280px at 22% 60%, rgba(167,139,250,0.18) 0%, transparent 65%)",
          "linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)",
        ].join(", "),
      }}
    >
      {/* Floating decorative ticket — top right */}
      <div
        aria-hidden
        className="hidden md:block absolute top-16 right-[8%] w-44 rounded-2xl border border-line bg-paper shadow-[0_24px_60px_-24px_rgba(10,37,64,0.25)] -rotate-[6deg] overflow-hidden tp-fade-up"
        style={{ animationDelay: "120ms" }}
      >
        <div className="h-16 bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 flex items-center justify-center">
          <span className="text-2xl">🏃</span>
        </div>
        <div className="p-3">
          <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-sky-700 mb-0.5">Ticket</p>
          <p className="text-[11px] font-semibold tracking-tight text-ink truncate">Nyuki Marathon 2026</p>
          <p className="text-[10px] text-ink-3 mt-0.5">Sun 17 May · Harare</p>
        </div>
      </div>

      {/* Floating decorative ticket — bottom left */}
      <div
        aria-hidden
        className="hidden md:block absolute bottom-20 left-[6%] w-40 rounded-2xl border border-line bg-paper shadow-[0_20px_48px_-20px_rgba(10,37,64,0.22)] rotate-[5deg] overflow-hidden tp-fade-up"
        style={{ animationDelay: "240ms" }}
      >
        <div className="h-14 bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center">
          <span className="text-2xl">🎵</span>
        </div>
        <div className="p-3">
          <p className="text-[9px] font-semibold tracking-[0.18em] uppercase text-violet-700 mb-0.5">Ticket</p>
          <p className="text-[11px] font-semibold tracking-tight text-ink truncate">Rumble in SA</p>
          <p className="text-[10px] text-ink-3 mt-0.5">Sun 17 May · Pretoria</p>
        </div>
      </div>

      <div className="relative w-full max-w-2xl mx-auto text-center">
        {/* Brand */}
        <div className="inline-flex items-center gap-2 font-bold text-xl tracking-tight text-ink">
          <span className="relative inline-flex w-8 h-8 items-center justify-center rounded-lg bg-navy shadow-sm shadow-navy/30">
            <span className="block w-2 h-2 rounded-full bg-white" />
            <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" aria-hidden />
          </span>
          TicketPulse
        </div>

        {/* Tag */}
        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 shadow-sm shadow-ink/5">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-70" />
            <span className="relative block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </span>
          <Sparkles size={12} className="text-blue" />
          <span className="text-[10.5px] font-semibold tracking-[0.18em] text-ink uppercase">
            Launching Soon
          </span>
        </div>

        {/* Headline */}
        <h1 className="mt-5 text-[32px] sm:text-[42px] md:text-[52px] font-bold tracking-tight text-ink leading-[1.05]">
          Every event. <br className="sm:hidden" /> One ticket.
        </h1>
        <p className="mt-4 text-[14.5px] sm:text-[16px] text-ink-2 max-w-lg mx-auto leading-relaxed">
          Zimbabwe&apos;s premier event ticketing platform goes live{" "}
          <span className="font-semibold text-ink">{launchLabel} CAT</span>.
          Tickets, merch, shuttles and photo packs in one place.
        </p>

        {/* Countdown */}
        <div className="mt-10">
          <Countdown targetIso={LAUNCH_DATE_ISO} />
        </div>

        {/* Teaser cards */}
        <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-left">
          {TEASERS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-line bg-paper/70 backdrop-blur px-4 py-3.5 shadow-sm shadow-ink/[0.03]"
            >
              <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-blue-soft ring-1 ring-blue/15 mb-2">
                <Icon size={14} className="text-blue" />
              </span>
              <p className="text-[13px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="text-[11.5px] text-ink-2 mt-0.5 leading-snug">{body}</p>
            </li>
          ))}
        </ul>

        {/* Password form */}
        <form
          action={unlock}
          className="mt-10 mx-auto max-w-sm rounded-2xl border border-line bg-paper/85 backdrop-blur p-5 shadow-[0_16px_44px_-20px_rgba(10,37,64,0.18)]"
        >
          <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-3">
            Have early access?
          </p>
          <div className="relative">
            <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="password"
              name="password"
              required
              autoComplete="off"
              autoFocus
              placeholder="Access password"
              aria-invalid={showError}
              className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-rose-100"
            />
          </div>
          {showError && (
            <p className="mt-2 text-[12px] text-rose-600 text-left">
              Wrong password. Try again.
            </p>
          )}
          <button
            type="submit"
            className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-navy text-white font-semibold text-sm py-3 rounded-xl hover:bg-navy-700 active:scale-[0.99] transition shadow-sm shadow-navy/20"
          >
            Unlock preview <ArrowRight size={14} />
          </button>
        </form>

        {/* Footer line */}
        <p className="mt-9 text-[12px] text-ink-3">
          Built in Harare ·{" "}
          <a
            href="mailto:hello@ticketpulse.tech"
            className="text-navy font-semibold hover:underline"
          >
            hello@ticketpulse.tech
          </a>
        </p>
      </div>

      <WhatsAppWidget phone={WHATSAPP_PHONE} />
    </main>
  )
}
