import Link from "next/link"
import { Mail, MailCheck, Send } from "lucide-react"
import { emailOrderLinksAction } from "./actions"

export const metadata = { title: "Find my tickets · TicketPulse" }

type Props = { searchParams: Promise<{ sent?: string; error?: string }> }

const ERROR_MESSAGE: Record<string, string> = {
  invalid_email: "Enter the email address you used at checkout.",
  rate_limited: "Too many requests. Please wait a few minutes and try again.",
  send_failed: "We couldn't send the email just now. Please try again shortly.",
}

export default async function OrderLookupPage({ searchParams }: Props) {
  const { sent, error } = await searchParams

  return (
    <div className="max-w-xl mx-auto px-5 md:px-8 py-16">
      <div className="mb-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Order lookup</p>
        <h1 className="text-[28px] font-bold tracking-tight text-ink mb-2">Find my tickets</h1>
        <p className="text-[14px] text-ink-2">
          Enter the email address you used at checkout. We&apos;ll email you a secure link to each of your orders.
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <MailCheck size={24} className="text-emerald-700 mb-3" />
          <p className="text-[15px] font-semibold text-emerald-900">Check your inbox</p>
          <p className="mt-1 text-[13px] leading-relaxed text-emerald-800">
            If <span className="font-semibold">{sent}</span> has TicketPulse orders, a message with links to them is on its way.
            It can take a minute. Check your spam folder too.
          </p>
          <Link href="/orders/lookup" className="mt-4 inline-flex text-[13px] font-semibold text-emerald-900 underline underline-offset-2">
            Use a different email
          </Link>
        </div>
      ) : (
        <form action={emailOrderLinksAction} className="space-y-3">
          <label htmlFor="lookup-email" className="block text-[12px] font-semibold text-ink-2">Checkout email</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                id="lookup-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-brand-700 transition"
            >
              <Send size={14} /> Email my links
            </button>
          </div>
          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
              {ERROR_MESSAGE[error] ?? "Something went wrong. Please try again."}
            </p>
          )}
        </form>
      )}

      <div className="mt-8 space-y-2 text-[13px] text-ink-3">
        <p>
          Bought on this device?{" "}
          <Link href="/orders" className="font-medium text-ink-2 underline hover:text-ink transition">See your saved orders</Link>.
        </p>
        <p>
          Still stuck?{" "}
          <a href="https://wa.me/263788689923" target="_blank" rel="noopener noreferrer" className="font-medium text-ink-2 underline hover:text-ink transition">
            WhatsApp support
          </a>{" "}
          with your checkout email.
        </p>
      </div>
    </div>
  )
}
