import { signIn } from "@/auth"
import Link from "next/link"
import { Mail, Lock, ArrowRight, CheckCircle2 } from "lucide-react"
import PasswordInput from "@/components/PasswordInput"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>
}) {
  const sp = await searchParams
  const resetOk = sp.reset === "ok"

  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12"
      style={{
        background:
          "radial-gradient(800px 400px at 80% -10%, #DBE8FB 0%, transparent 55%), radial-gradient(600px 300px at 0% 100%, rgba(254,235,200,0.4) 0%, transparent 55%), linear-gradient(180deg, #F6F9FC 0%, #FFFFFF 100%)",
      }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl tracking-tight text-ink">
            <span className="relative inline-flex w-6 h-6 items-center justify-center rounded-md bg-navy">
              <span className="block w-1.5 h-1.5 rounded-full bg-white" />
            </span>
            TicketPulse
          </Link>
          <h1 className="mt-6 text-[22px] font-semibold tracking-tight text-ink">Welcome back</h1>
          <p className="text-sm text-ink mt-1">Sign in to continue</p>
        </div>

        {resetOk ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 px-3.5 py-3">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
            <p className="text-[13px] font-medium text-green-900">
              Password updated. Sign in below.
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
              redirectTo: "/dashboard",
            })
          }}
          className="rounded-2xl border border-line-2 bg-paper p-6 shadow-md shadow-navy/[0.04] space-y-5"
        >
          <div>
            <label className="block text-[13px] font-medium text-ink mb-2">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" />
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className="w-full bg-paper border border-line-2 rounded-xl pl-10 pr-4 py-3.5 text-[15px] text-ink placeholder:text-ink-2 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[13px] font-medium text-ink">Password</label>
              <Link href="/auth/forgot" className="text-[12px] font-semibold text-navy hover:underline">Forgot?</Link>
            </div>
            <PasswordInput />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold text-[15px] py-3.5 rounded-xl hover:bg-green-700 active:scale-[0.99] transition shadow-md shadow-green-600/25"
          >
            Sign in <ArrowRight size={15} />
          </button>
        </form>

        {/* Or divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-line-2" />
          <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-line-2" />
        </div>

        {/* OAuth & magic link */}
        <div className="rounded-2xl border border-line-2 bg-paper p-6 space-y-3">
          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: "/dashboard" })
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 border border-line-2 bg-paper text-ink font-medium text-[14px] py-3.5 rounded-xl hover:bg-paper-2 hover:border-line-2 transition-colors"
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

          <form
            action={async (formData: FormData) => {
              "use server"
              await signIn("resend", {
                email: formData.get("email") as string,
                redirectTo: "/dashboard",
              })
            }}
            className="space-y-2.5"
          >
            <div className="relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" />
              <input
                type="email"
                name="email"
                required
                placeholder="Send a magic link"
                className="w-full bg-paper border border-line-2 rounded-xl pl-10 pr-4 py-3.5 text-[15px] text-ink placeholder:text-ink-2 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
              />
            </div>
            <button
              type="submit"
              className="w-full text-[14px] font-semibold text-navy hover:text-navy-700 py-2.5 transition-colors"
            >
              Email me a link
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] text-ink-2 mt-5">
          Don't have an account?{" "}
          <Link href="/auth/signup" className="font-semibold text-navy hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}
