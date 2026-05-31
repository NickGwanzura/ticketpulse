"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"

interface MobileBuyBarProps {
  label: string         // "Buy tickets", "Get a quote"
  primary: string       // "From $5", "From $250"
  secondary?: string    // "per ticket", "per booking"
  href: string          // "#tickets"
  /** Show only after the user has scrolled past this many pixels (defaults to 240) */
  showAfter?: number
}

export default function MobileBuyBar({ label, primary, secondary, href, showAfter = 240 }: MobileBuyBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight - 320
      setVisible(y > showAfter && y < max)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [showAfter])

  return (
    <div
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-paper/95 backdrop-blur-xl px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(10,37,64,0.18)] transition-transform duration-200 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      role="complementary"
    >
      <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase">{secondary ?? "From"}</p>
          <p className="text-[16px] font-bold tracking-tight text-ink truncate">{primary}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-3 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 active:scale-[0.99] transition shrink-0"
        >
          {label} <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}
