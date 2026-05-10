"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Zap, Mail, ShieldCheck, Sparkles, X } from "lucide-react"

const MESSAGES = [
  { icon: Zap,         text: "Buy tickets in 60 seconds — no signup required" },
  { icon: Mail,        text: "Pay first, verify your email later. We hold your seat" },
  { icon: ShieldCheck, text: "Verified organizers · EcoCash + Visa · Refundable up to 24h before" },
] as const

const STORAGE_KEY = "tp:topbar:dismissed:v2"

export default function TopBar() {
  const [hidden, setHidden] = useState(true)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setHidden(typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1")
  }, [])

  useEffect(() => {
    if (hidden) return
    const id = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 5500)
    return () => clearInterval(id)
  }, [hidden])

  if (hidden) return null

  const dismiss = () => {
    setHidden(true)
    try { window.localStorage.setItem(STORAGE_KEY, "1") } catch {}
  }

  return (
    <div className="relative z-[60] text-white border-b border-white/10 overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(90deg, #07182b 0%, #0a2540 28%, #143d6b 60%, #0a2540 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 opacity-50"
        style={{
          background:
            "radial-gradient(420px 80px at 80% 50%, rgba(5,112,222,0.45), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="max-w-7xl mx-auto px-4 md:px-8 h-9 flex items-center gap-3">
        {/* Live dot */}
        <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
            <span className="relative block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10.5px] font-semibold tracking-[0.18em] text-white/80 uppercase">Live</span>
          <span className="hidden md:inline text-white/30">·</span>
        </span>

        {/* Rotating message */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="relative h-9">
            {MESSAGES.map(({ icon: Icon, text }, i) => (
              <p
                key={i}
                aria-hidden={i !== idx}
                className={`absolute inset-0 flex items-center gap-2 text-[12px] md:text-[12.5px] text-white/85 transition-all duration-500 ${
                  i === idx ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5 pointer-events-none"
                }`}
              >
                <Icon size={12} className="text-emerald-300 shrink-0" />
                <span className="truncate">{text}</span>
              </p>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/how-it-works"
          className="hidden md:inline-flex items-center gap-1.5 shrink-0 text-[12px] font-semibold text-white/85 hover:text-white transition-colors group"
        >
          <Sparkles size={11} className="text-blue-300 group-hover:text-blue-200 transition-colors" />
          See how it works
          <span className="text-white/35 group-hover:text-white/60 transition-colors">→</span>
        </Link>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="relative shrink-0 inline-flex w-7 h-7 items-center justify-center rounded-md text-white/55 hover:text-white hover:bg-white/10 transition-colors before:absolute before:content-[''] before:-inset-2"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
