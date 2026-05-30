import Link from "next/link"
import { AlertTriangle, ArrowLeft } from "lucide-react"

const ERROR_MESSAGES: Record<string, { title: string; body: string }> = {
  Configuration:   { title: "Server configuration error",     body: "Something is mis-configured on our end. Try again in a moment, or contact support." },
  AccessDenied:    { title: "Access denied",                  body: "Your account doesn't have permission to view this page." },
  Verification:    { title: "Magic link expired or invalid",  body: "Sign-up links expire after 24 hours. Request a new one to continue." },
  OAuthCallback:   { title: "Couldn't complete sign-in",      body: "We couldn't verify your provider's response. Please try signing in again." },
  OAuthAccountNotLinked: { title: "Account already linked",   body: "This email is already linked to a different sign-in method. Try the original one." },
  Default:         { title: "Something went wrong",           body: "We hit an unexpected error. Try again, or get in touch with support." },
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const code = sp.error ?? "Default"
  const err = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.Default

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper-2 px-4 py-10 md:py-20">
      <div className="max-w-md mx-auto text-center">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-rose-50 ring-1 ring-rose-200/60 mb-5">
          <AlertTriangle size={22} className="text-rose-600" />
        </div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">{err.title}</h1>
        <p className="mt-2 text-[14.5px] text-ink-2 leading-relaxed">{err.body}</p>
        <p className="mt-3 text-[11px] font-mono text-ink-3 bg-paper border border-line inline-block px-2 py-1 rounded">
          code: {code}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition"
          >
            Try signing in again
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-xl border border-line bg-paper px-5 py-3 text-sm font-medium text-ink hover:border-line-2 transition-colors"
          >
            Contact support
          </Link>
        </div>

        <Link href="/" className="mt-8 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink transition-colors">
          <ArrowLeft size={13} /> Back home
        </Link>
      </div>
    </div>
  )
}
