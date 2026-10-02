"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Cookie } from "lucide-react"
import { COOKIE_SETTINGS_EVENT, saveCookiePreferences } from "@/lib/cookie-preferences"
import { useCookiePreferences } from "@/lib/use-cookie-preferences"

export default function CookiesNotice() {
  const pathname = usePathname()
  const analytics = useCookiePreferences()
  const [opened, setOpened] = useState(false)
  const visible = opened || analytics === null
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const open = () => setOpened(true)
    window.addEventListener(COOKIE_SETTINGS_EVENT, open)
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, open)
  }, [])

  useEffect(() => {
    if (opened) bannerRef.current?.focus()
  }, [opened])

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
  if (!visible) return null

  const choose = (allowAnalytics: boolean) => {
    saveCookiePreferences(allowAnalytics)
    setOpened(false)
  }

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-labelledby="cookie-notice-title"
      aria-describedby="cookie-notice-description"
      tabIndex={-1}
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-7rem)] overflow-y-auto md:inset-x-auto md:right-5 md:bottom-5 md:max-w-md z-50"
    >
      <div className="rounded-2xl border border-line bg-paper/95 backdrop-blur shadow-[0_24px_60px_-30px_rgba(10,37,64,0.35)] p-4 md:p-5 relative">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-50 ring-1 ring-green-500/15">
            <Cookie size={16} className="text-brand-600" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p id="cookie-notice-title" className="text-[15px] font-semibold tracking-tight text-ink">Your privacy choices</p>
            <p id="cookie-notice-description" className="mt-1 text-[13px] leading-relaxed text-ink-2">
              Essential cookies and browser storage keep sign-in, your cart and checkout working. With your permission, optional analytics help us understand event visits and checkout use. You can use TicketPulse with essential storage only.
            </p>
            <nav aria-label="Legal policies" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-ink">
              <Link href="/legal/cookies" className="py-1 underline underline-offset-4">Cookie Policy</Link>
              <Link href="/legal/terms" className="py-1 underline underline-offset-4">Terms of Service</Link>
              <Link href="/legal/privacy" className="py-1 underline underline-offset-4">Privacy Policy</Link>
            </nav>
            <div className="mt-3 grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => choose(false)}
                className="inline-flex min-h-11 items-center justify-center border border-input rounded-lg bg-paper text-ink text-[12px] font-semibold px-3 py-2 hover:bg-paper-2 transition-colors"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={() => choose(true)}
                className="inline-flex min-h-11 items-center justify-center border border-input rounded-lg bg-paper text-ink text-[12px] font-semibold px-3 py-2 hover:bg-paper-2 transition-colors"
              >
                Allow analytics
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-3">Change your choice anytime in Cookie settings. This choice is separate from agreeing to the terms.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
