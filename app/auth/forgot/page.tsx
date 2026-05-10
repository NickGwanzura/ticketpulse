import Link from "next/link"
import ForgotForm from "./forgot-form"

export default function ForgotPasswordPage() {
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
          <h1 className="mt-6 text-[22px] font-semibold tracking-tight text-ink">Forgot your password?</h1>
          <p className="text-sm text-ink-2 mt-1">Enter your email and we&apos;ll send you a reset link.</p>
        </div>

        <ForgotForm />

        <p className="text-center text-xs text-ink-3 mt-4">
          Remembered it?{" "}
          <Link href="/auth/signin" className="font-semibold text-navy hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
