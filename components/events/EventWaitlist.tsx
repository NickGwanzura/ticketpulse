"use client"

import { useState, FormEvent } from "react"
import { Bell, Check, Loader2 } from "lucide-react"

export default function EventWaitlist() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || status === "sending") return
    setStatus("sending")
    setMessage("")

    try {
      const res = await fetch("/api/events/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus("success")
        setMessage(data.message ?? "You're on the list!")
        setEmail("")
      } else {
        setStatus("error")
        setMessage(data.error ?? "Something went wrong. Try again.")
      }
    } catch {
      setStatus("error")
      setMessage("Couldn't reach the server. Please try again.")
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="inline-flex w-10 h-10 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-navy">
          <Bell size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-ink">Not what you're looking for?</h3>
          <p className="mt-1 text-[13px] text-ink-2">
            Get notified the moment new events go live. No spam — just the good stuff.
          </p>

          {status === "success" ? (
            <div className="mt-4 flex items-center gap-2 text-green-700 text-[13px] font-medium">
              <Check size={16} />
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={status === "sending"}
                className="flex-1 h-11 rounded-xl border border-line bg-paper px-4 text-[13px] text-ink placeholder:text-ink-3 shadow-sm shadow-ink/[0.03] focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-700 transition disabled:opacity-60 shrink-0"
              >
                {status === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                Notify me
              </button>
            </form>
          )}

          {status === "error" && message && (
            <p className="mt-2 text-[12px] text-rose-600">{message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
