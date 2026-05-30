"use client"

import { useState } from "react"
import { Mail, ArrowRight } from "lucide-react"

export default function ForgotForm() {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Intentionally swallow — UI shows the same generic confirmation either way.
    }
    setSubmitting(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.03]">
        <p className="text-sm text-ink leading-relaxed">
          If an account exists for that email, we&apos;ve sent reset instructions. Check your inbox.
        </p>
        <p className="text-[12.5px] text-ink-3 mt-3 leading-relaxed">
          The link expires in one hour. Didn&apos;t see anything? Check your spam folder, or try again with a different address.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.03] space-y-4"
    >
      <div>
        <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Email</label>
        <div className="relative">
          <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold text-sm py-3 rounded-xl hover:bg-brand-700 active:scale-[0.99] transition shadow-sm shadow-brand-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Sending..." : (<>Send reset link <ArrowRight size={14} /></>)}
      </button>
    </form>
  )
}
