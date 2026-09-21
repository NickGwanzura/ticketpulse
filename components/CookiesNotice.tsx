"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Cookie, X } from "lucide-react"

const STORAGE_KEY = "tp_cookie_notice_v1"

export default function CookiesNotice() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (localStorage.getItem(STORAGE_KEY) === "ok") return
    const t = setTimeout(() => setVisible(true), 250)
    return () => clearTimeout(t)
  }, [])

  // Publish the banner's top edge (distance from the viewport bottom, plus a gap)
  // as --tp-cookie-top so other fixed bottom-right elements (the support button)
  // sit above the banner instead of underneath it. Cleared when it goes away.
  useEffect(() => {
    const el = bannerRef.current
    if (!visible || !el) return
    const root = document.documentElement
    const update = () => {
      root.style.setProperty("--tp-cookie-top", `${Math.round(window.innerHeight - el.getBoundingClientRect().top + 12)}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
      root.style.removeProperty("--tp-cookie-top")
    }
  }, [visible, pathname])
  if (pathname?.startsWith("/coming-soon")) return null
  if (pathname?.startsWith("/legal/cookies")) return null
  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "ok")
    setVisible(false)
  }

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:right-5 md:bottom-5 md:max-w-sm z-50"
    >
      <div className="rounded-2xl border border-line bg-paper/95 backdrop-blur shadow-[0_24px_60px_-30px_rgba(10,37,64,0.35)] p-4 md:p-5 relative">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-1.5 right-1.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:text-ink hover:bg-line/40 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15">
            <Cookie size={16} className="text-brand-600" />
          </span>
          <div className="min-w-0 pr-5">
            <p className="text-[14px] font-semibold tracking-tight text-ink">We use essential cookies</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
              They keep you signed in, your cart working and your checkout safe. No tracking. Read our{" "}
              <Link href="/legal/cookies" className="text-blue font-semibold hover:underline">cookie policy</Link>.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 text-white text-[13px] font-semibold tracking-tight px-4 py-2 hover:bg-brand-700 transition-colors"
              >
                Got it
              </button>
              <Link
                href="/legal/cookies"
                className="inline-flex items-center text-[13px] font-semibold tracking-tight text-ink-2 hover:text-ink px-3 py-2"
              >
                Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
