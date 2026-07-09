import { signIn } from "@/auth"
import Link from "next/link"
import Image from "next/image"
import {
  CheckCircle2, ChevronDown, Sparkles, Smartphone, ShieldCheck,
  BarChart3, Wallet, Ticket,
} from "lucide-react"
import PasswordInput from "@/components/PasswordInput"

function localCallback(value: string | undefined): string | null {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null
}

const FEATURES = [
  {
    icon: Smartphone,
    title: "Mobile Optimized",
    body: "Beautiful checkout experience on any device",
  },
  {
    icon: ShieldCheck,
    title: "Data Ownership",
    body: "You own 100% of your attendee data, always",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    body: "Track sales, revenue, and attendance with detailed reports",
  },
  {
    icon: Wallet,
    title: "Fast Payouts",
    body: "Get paid quickly via EcoCash or USD bank transfer",
  },
]

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; callbackUrl?: string; email?: string }>
}) {
  const sp = await searchParams
  const resetOk = sp.reset === "ok"
  const callbackUrl = localCallback(sp.callbackUrl) ?? "/dashboard"
  const email = sp.email?.toLowerCase().trim() ?? ""

  return (
    <div className="grid lg:grid-cols-2 min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-9rem)]">
      {/* ── Left: sign-in form ─────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center overflow-hidden bg-paper-2 px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_18%_12%,rgba(201,82,42,0.12),transparent_45%),radial-gradient(520px_circle_at_85%_92%,rgba(201,82,42,0.08),transparent_48%)]" />
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center gap-2.5">
              <img
                src="/ticketpulse-logo.svg"
                alt="TicketPulse"
                className="h-10 w-10"
              />
            </Link>
            <h1 className="mt-8 text-[28px] font-bold tracking-tight text-ink">Welcome back</h1>
            <p className="text-[14px] text-ink-2 mt-2">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="font-semibold text-accent hover:underline">
                Sign up
              </Link>
            </p>
          </div>

          {resetOk ? (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-600/20 bg-emerald-50 px-3.5 py-3">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-[13px] font-medium text-emerald-700">
                Password updated. Log in below.
              </p>
            </div>
          ) : null}

          {/* Email + password */}
          <form
            action={async (formData: FormData) => {
              "use server"
              await signIn("credentials", {
                email: formData.get("email") as string,
                password: formData.get("password") as string,
                redirectTo: callbackUrl,
              })
            }}
            className="rounded-2xl border border-accent/15 bg-paper p-6 md:p-7 shadow-[0_24px_70px_-44px_rgba(201,82,42,0.65)] space-y-5"
          >
            <div>
              <label className="block text-[14px] font-semibold text-ink mb-2">
                Email <span className="text-accent">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                defaultValue={email}
                className="w-full bg-paper-2 border border-line-2 rounded-xl px-4 py-3.5 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:bg-paper focus:border-accent focus:ring-4 focus:ring-accent/10 transition"
              />
            </div>
            <div>
              <label className="block text-[14px] font-semibold text-ink mb-2">
                Password <span className="text-accent">*</span>
              </label>
              <PasswordInput inputClassName="!bg-paper-2 focus:!bg-paper focus:!border-accent focus:!ring-accent/10" />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center bg-accent text-white font-semibold text-[15px] py-3.5 rounded-xl hover:bg-accent-hover active:scale-[0.99] transition shadow-md shadow-accent/25"
            >
              Log in
            </button>
            <p className="text-center">
              <Link href="/auth/forgot" className="text-[14px] font-medium text-ink-2 hover:text-ink hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>

          {/* Google OAuth */}
          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: callbackUrl })
            }}
            className="mt-4"
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-accent/20 bg-paper text-ink font-medium text-[14px] py-3.5 hover:border-accent/45 hover:bg-accent/5 active:scale-[0.99] transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

          {/* Guest ticket lookup */}
          <details className="group">
            <summary className="flex items-center justify-center gap-2 cursor-pointer list-none text-[14px] font-medium text-ink-2 hover:text-ink transition-colors [&::-webkit-details-marker]:hidden">
              <Ticket size={15} />
              Just looking for your tickets?
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 rounded-xl border border-accent/20 bg-paper p-4 text-center shadow-sm shadow-accent/5">
              <p className="text-[13px] text-ink-2 mb-3">
                No account needed — find your order with the email you used at checkout.
              </p>
              <Link
                href="/orders/lookup"
                className="inline-flex items-center justify-center rounded-xl border border-line-2 bg-paper px-5 py-2.5 text-[13px] font-semibold text-ink hover:bg-paper-2 transition-colors"
              >
                Find my tickets
              </Link>
            </div>
          </details>
        </div>
      </div>

      {/* ── Right: brand panel ─────────────────────────────────────────── */}
      <div className="relative hidden lg:flex items-center overflow-hidden">
        <Image
          src="/images/home-hero/concert.jpg"
          alt=""
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-accent/88" />
        <div className="absolute inset-0 bg-[radial-gradient(620px_circle_at_78%_20%,rgba(255,255,255,0.22),transparent_48%),linear-gradient(180deg,rgba(10,37,64,0.05),rgba(10,37,64,0.26))]" />

        <div className="relative w-full max-w-lg mx-auto px-10 py-16 space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/18 ring-1 ring-white/35 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-sm mb-4 shadow-lg shadow-navy/10">
            <Sparkles size={14} /> Event Management Platform
          </span>

          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group flex items-start gap-4 rounded-2xl bg-white/12 ring-1 ring-white/18 backdrop-blur-sm p-5 shadow-xl shadow-navy/10 hover:bg-white/16 hover:ring-white/30"
            >
              <span className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-xl bg-white/18 ring-1 ring-white/25 shadow-sm transition-transform group-hover:scale-105">
                <Icon size={17} className="text-white" />
              </span>
              <div>
                <p className="text-[15px] font-bold tracking-tight text-white">{title}</p>
                <p className="text-[13px] leading-5 text-white/85 mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
