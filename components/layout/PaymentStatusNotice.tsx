"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, MessageCircle, X } from "lucide-react"

const STORAGE_KEY = "tp:payment-status-notice:dismissed:v2"

export default function PaymentStatusNotice() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setHidden(window.localStorage.getItem(STORAGE_KEY) === "1") } catch {}
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  if (hidden) return null

  const dismiss = () => {
    setHidden(true)
    try { window.localStorage.setItem(STORAGE_KEY, "1") } catch {}
  }

  return (
    <aside
      role="alert"
      aria-label="Payment service notice"
      className="border-b border-amber-200 bg-amber-50 text-amber-800"
    >
      <div className="mx-auto flex min-h-12 max-w-7xl items-center gap-3 px-4 py-2 md:px-8">
        <AlertTriangle size={18} className="shrink-0 text-amber-600" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[12px] leading-5 md:text-[13px]">
          <strong>EcoCash payment notice:</strong> Confirmations may be delayed. Approve the USSD prompt and wait for confirmation—please don’t pay again if your wallet was debited. For help, WhatsApp&nbsp;
          <a
            href="https://wa.me/263788689923"
            className="inline-flex min-h-8 items-center gap-1 font-bold text-amber-800 underline decoration-amber-400 underline-offset-2 hover:text-amber-700"
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={13} aria-hidden="true" />
            +263 78 868 9923
          </a>
          &nbsp;for help.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss payment service notice"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-amber-800/70 transition-colors hover:bg-amber-100 hover:text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
