import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Lock, Sparkles, ArrowRight } from "lucide-react"
import Countdown from "@/components/launch/Countdown"
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_VALUE,
  LAUNCH_DATE_ISO,
  verifyAccessPassword,
} from "@/lib/launch-gate"

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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Harare",
    hour12: false,
  }).format(new Date(LAUNCH_DATE_ISO))

  return (
    <main
      className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(900px 420px at 80% -10%, #DBE8FB 0%, transparent 55%), radial-gradient(700px 360px at -10% 110%, rgba(254,235,200,0.5) 0%, transparent 55%), linear-gradient(180deg, #F6F9FC 0%, #FFFFFF 100%)",
      }}
    >
      <div className="relative w-full max-w-xl mx-auto text-center">
        <Link
          href="/coming-soon"
          className="inline-flex items-center gap-2 font-bold text-xl tracking-tight text-ink"
        >
          <span className="relative inline-flex w-7 h-7 items-center justify-center rounded-md bg-navy">
            <span className="block w-1.5 h-1.5 rounded-full bg-white" />
          </span>
          TicketPulse
        </Link>

        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 shadow-sm shadow-ink/5">
          <Sparkles size={13} className="text-blue" />
          <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">
            Coming soon
          </span>
        </div>

        <h1 className="mt-5 text-[28px] sm:text-[36px] md:text-[44px] font-bold tracking-tight text-ink leading-tight">
          Every event. One ticket.
        </h1>
        <p className="mt-3 text-[14.5px] sm:text-[15px] text-ink-2 max-w-md mx-auto leading-relaxed">
          Zimbabwe&apos;s premier event ticketing platform launches{" "}
          <span className="font-semibold text-ink">{launchLabel} CAT</span>.
          Tickets, merch, shuttles and photo packs in one place.
        </p>

        <div className="mt-9">
          <Countdown targetIso={LAUNCH_DATE_ISO} />
        </div>

        <form
          action={unlock}
          className="mt-10 mx-auto max-w-sm rounded-2xl border border-line bg-paper p-5 shadow-sm shadow-ink/[0.04]"
        >
          <p className="text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-3">
            Have early access?
          </p>
          <div className="relative">
            <Lock
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"
            />
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

        <p className="mt-8 text-[12px] text-ink-3">
          Built in Harare. Questions?{" "}
          <a
            href="mailto:hello@ticketpulse.tech"
            className="text-navy font-semibold hover:underline"
          >
            hello@ticketpulse.tech
          </a>
        </p>
      </div>
    </main>
  )
}
