import Link from "next/link"
import { Mail, MessageSquare, MapPin, Phone, Clock, Sparkles, ArrowRight } from "lucide-react"

const CHANNELS = [
  { icon: MessageSquare, title: "Live chat",     body: "Mon to Fri, 8:00 to 18:00 CAT", value: "Open chat",         href: "#chat" },
  { icon: Mail,          title: "Email",         body: "Replies within 4 hours",  value: "hello@ticketpulse.co.zw", href: "mailto:hello@ticketpulse.co.zw" },
  { icon: Phone,         title: "Phone / WhatsApp", body: "Daily, 8:00 to 20:00 CAT", value: "+263 777 816 368",  href: "https://wa.me/263777816368" },
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
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 360px at 80% -20%, #DBE8FB 0%, transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)" }} />
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 backdrop-blur px-3 py-1.5 mb-6 shadow-sm shadow-ink/5">
            <Sparkles size={13} className="text-blue" />
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

          <form className="rounded-2xl border border-line bg-paper p-6 md:p-7 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Your name</label>
                <input type="text" required placeholder="Tendai Moyo"
                  className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition" />
              </div>
              <div>
                <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Email</label>
                <input type="email" required placeholder="you@example.com"
                  className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition" />
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Topic</label>
              <select required className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition">
                <option value="">Choose a topic…</option>
                {TOPICS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-ink-2 mb-1.5">Message</label>
              <textarea rows={6} required placeholder="Tell us a bit more…"
                className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-4 focus:ring-blue/10 transition resize-none" />
            </div>

            <button type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-navy text-white font-semibold py-3.5 rounded-xl hover:bg-navy-700 active:scale-[0.99] transition shadow-sm shadow-navy/20 text-sm">
              Send message <ArrowRight size={15} />
            </button>
          </form>
        </div>

        {/* Channels + office */}
        <aside className="space-y-4">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Other ways</p>
          {CHANNELS.map(({ icon: Icon, title, body, value, href }) => (
            <Link key={title} href={href} className="block rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft ring-1 ring-blue/15 shrink-0">
                  <Icon size={16} className="text-blue" />
                </span>
                <div className="flex-1">
                  <p className="text-[14.5px] font-semibold tracking-tight text-ink">{title}</p>
                  <p className="text-[12.5px] text-ink-3">{body}</p>
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
                <p className="text-[14.5px] font-semibold tracking-tight text-ink">Office</p>
                <p className="text-[12.5px] text-ink-2 mt-1 leading-relaxed">
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
