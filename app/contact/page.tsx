"use client"
import Link from "next/link"
import { useState } from "react"
import { Mail, MessageSquare, MapPin, Phone, Clock, Sparkles, ArrowRight, CheckCircle2, Loader2 } from "lucide-react"
import { inputBaseClass } from "@/lib/utils"

const CHANNELS = [
  { icon: MessageSquare, title: "Live chat",     body: "Mon to Fri, 8:00 to 18:00 CAT", value: "Open chat",         href: "#chat" },
  { icon: Mail,          title: "Email",         body: "Replies within 4 hours",  value: "hello@ticketpulse.co.zw", href: "mailto:hello@ticketpulse.co.zw" },
  { icon: Phone,         title: "Phone / WhatsApp", body: "Daily, 8:00 to 20:00 CAT", value: "+263 788 689 923",  href: "https://wa.me/263788689923" },
]

const TOPICS = [
  "I need help with a ticket",
  "Press / media enquiry",
  "Partnership / sponsorship",
  "I want to organize an event",
  "Vendor application question",
  "Something else",
]

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus("sending")
    const form = e.currentTarget
    const data = new FormData(form)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          topic: data.get("topic"),
          message: data.get("message"),
        }),
      })
      if (!res.ok) throw new Error("Server error")
      setStatus("sent")
      form.reset()
    } catch {
      setStatus("error")
    }
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-brand-600" />
            <span className="text-[11px] font-semibold tracking-[0.16em] text-ink uppercase">Contact</span>
          </div>
          <h1 className="text-[36px] md:text-[56px] font-bold tracking-[-0.025em] leading-[1.04] text-ink max-w-2xl">
            We read every message.
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-ink-2 max-w-xl leading-relaxed">
            Pick whichever channel suits you. Most enquiries are answered inside four hours during business hours, weekdays CAT.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16 grid lg:grid-cols-[1.2fr_1fr] gap-10 md:gap-14">
        {/* Form */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Send a message</p>
          <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight text-ink mb-6">How can we help?</h2>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-line bg-paper p-6 md:p-7 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-ink-2 mb-1.5">Your name</label>
                <input type="text" name="name" required placeholder="Tendai Moyo"
                  className={inputBaseClass} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink-2 mb-1.5">Email</label>
                <input type="email" name="email" required placeholder="you@example.com"
                  className={inputBaseClass} />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-ink-2 mb-1.5">Topic</label>
              <select name="topic" required className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition">
                <option value="">Choose a topic…</option>
                {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-ink-2 mb-1.5">Message</label>
              <textarea name="message" rows={6} required placeholder="Tell us a bit more…"
                className={`${inputBaseClass} resize-none`} />
            </div>

            {status === "sent" && (
              <div className="flex items-center gap-2 text-[13px] text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                <CheckCircle2 size={15} />
                Message sent. We'll get back to you within 4 hours.
              </div>
            )}
            {status === "error" && (
              <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                Something went wrong. Please try again or email us directly.
              </p>
            )}

            <button type="submit" disabled={status === "sending"}
              className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-700 active:scale-[0.99] transition shadow-sm shadow-brand-600/20 text-sm disabled:opacity-70">
              {status === "sending" ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <>Send message <ArrowRight size={15} /></>}
            </button>
          </form>
        </div>

        {/* Channels + office */}
        <aside className="space-y-4">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Other ways</p>
          {CHANNELS.map(({ icon: Icon, title, body, value, href }) => (
            <Link key={title} href={href} className="block rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15 shrink-0">
                  <Icon size={16} className="text-brand-600" />
                </span>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold tracking-tight text-ink">{title}</p>
                  <p className="text-[13px] text-ink-3">{body}</p>
                  <p className="text-[13px] font-medium text-navy mt-1.5">{value}</p>
                </div>
              </div>
            </Link>
          ))}

          <div className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-paper-2 ring-1 ring-line shrink-0">
                <MapPin size={16} className="text-ink-2" />
              </span>
              <div>
                <p className="text-[15px] font-semibold tracking-tight text-ink">Office</p>
                <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">
                  Harare CBD<br />
                  Zimbabwe
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-[12px] text-ink-3">
                  <Clock size={11} /> Mon to Fri, 8:00 to 18:00 CAT
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
