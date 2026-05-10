import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import ResetForm from "./reset-form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const sp = await searchParams
  const token = sp.token?.trim()

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
          <h1 className="mt-6 text-[22px] font-semibold tracking-tight text-ink">
            {token ? "Choose a new password" : "Invalid link"}
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            {token
              ? "Enter a new password for your account."
              : "This reset link is missing or malformed."}
          </p>
        </div>

        {token ? (
          <ResetForm token={token} />
        ) : (
          <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.03] text-center">
            <div className="inline-flex w-11 h-11 items-center justify-center rounded-2xl bg-rose-50 ring-1 ring-rose-200/60 mb-4">
              <AlertTriangle size={18} className="text-rose-600" />
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">
              Request a fresh reset link to continue.
            </p>
            <Link
              href="/auth/forgot"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition"
            >
              Request new link
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-ink-3 mt-4">
          <Link href="/auth/signin" className="font-semibold text-navy hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
