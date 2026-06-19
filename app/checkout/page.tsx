"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/lib/cart-context"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowLeft, ArrowRight, Lock, Smartphone, CreditCard, Check, Mail, User, Phone, Loader2, X, Tag, Percent,
} from "lucide-react"
import CheckoutSteps from "@/components/CheckoutSteps"

type CheckoutResponse = {
  success: true
  paymentMethod: "CARD" | "ECOCASH" | "FREE"
  flow: "velocity-seamless" | "velocity-redirect" | "free"
  orderId: string
  salesOrderTrace?: string
  transactionTrace?: string
  pollRequired?: true
  redirectUrl?: string | null
  amount: number
  currency: string
  resumed?: boolean
}

type PaymentMethodValue = "velocity-ecocash"

const POLL_INTERVAL_MS = 4000
// Must match POLL_TIMEOUT_MS in app/api/checkout/velocity/status/[id]/route.ts.
// Client uses slightly longer window to account for network latency on the final poll.
const POLL_TIMEOUT_MS = 5.5 * 60 * 1000

const PAYMENT_METHODS: { value: PaymentMethodValue; label: string; body: string; icon: typeof Smartphone }[] = [
  { value: "velocity-ecocash", label: "EcoCash", body: "Pay with EcoCash via mobile money. Instant confirmation.", icon: Smartphone },
]

// Key prefix used to persist polling state across page refresh.
const POLL_SESSION_KEY = "polling"

function clearPollingSession() {
  try {
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:orderId`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:name`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:email`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:phone`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:method`)
  } catch { /* sessionStorage may be unavailable */ }
}

function savePollingSession(orderId: string, contact: { name: string; email: string; phone: string; method: string }) {
  try {
    sessionStorage.setItem(`${POLL_SESSION_KEY}:orderId`, orderId)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:name`, contact.name)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:email`, contact.email)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:phone`, contact.phone)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:method`, contact.method)
  } catch { /* sessionStorage may be unavailable */ }
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, ready, totalsByCurrency, placeOrder } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errorOrderId, setErrorOrderId] = useState<string | null>(null)
  const [pollingOrderId, setPollingOrderId] = useState<string | null>(null)
  const pollingContact = useRef<{ name: string; email: string; phone: string; method: string } | null>(null)

  // ── Restore polling session after page refresh ───────────────────────────
  // Check sessionStorage for an active polling session and resume it.
  useEffect(() => {
    try {
      const savedOrderId = sessionStorage.getItem(`${POLL_SESSION_KEY}:orderId`)
      if (savedOrderId) {
        const name = sessionStorage.getItem(`${POLL_SESSION_KEY}:name`)
        const email = sessionStorage.getItem(`${POLL_SESSION_KEY}:email`)
        const phone = sessionStorage.getItem(`${POLL_SESSION_KEY}:phone`)
        const method = sessionStorage.getItem(`${POLL_SESSION_KEY}:method`)
        if (name && email && phone && method) {
          pollingContact.current = { name, email, phone, method }
          setPollingOrderId(savedOrderId)
          setSubmitting(true)
        }
      }
    } catch { /* sessionStorage may be unavailable */ }
  }, [])
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    payment: "velocity-ecocash" as PaymentMethodValue,
  })
  const [eventQuestions, setEventQuestions] = useState<{ id: string; question: string; required: boolean }[]>([])
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({})
  const [promoInput, setPromoInput] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; type: "percent" | "fixed"; value: number; discount: number } | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)

  // Drives the "Check your phone" overlay for seamless mobile-money payments.
  // Polls the Velocity transaction status at 4s intervals until a terminal state.
  // Page-refresh safe: stores startedAt in sessionStorage so the timer survives navigation.
  // Terminal states: SUCCESS, FAILED, CANCELLED, EXPIRED (polling stops immediately).
  useEffect(() => {
    if (!pollingOrderId) return

    const startedAtKey = `poll_started:${pollingOrderId}`
    const stored = sessionStorage.getItem(startedAtKey)
    const startedAt = stored ? Number(stored) : Date.now()
    if (!stored) sessionStorage.setItem(startedAtKey, String(startedAt))

    let active = true
    const statusEndpoint = `/api/checkout/velocity/status/${pollingOrderId}`

    const interval = setInterval(async () => {
      if (!active) return

      // ── Timeout check ──────────────────────────────────────────────────
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(interval)
        sessionStorage.removeItem(startedAtKey)
        clearPollingSession()
        setErrorOrderId(pollingOrderId)
        setPollingOrderId(null)
        setSubmitError("The payment window closed before we got confirmation. If money was deducted, your tickets will be sent automatically once payment clears.")
        setSubmitting(false)
        return
      }

      try {
        const res = await fetch(statusEndpoint, { cache: "no-store" })
        const data = await res.json()

        // ── TERMINAL: paid ───────────────────────────────────────────────
        if (data.paid && pollingContact.current) {
          clearInterval(interval)
          sessionStorage.removeItem(startedAtKey)
          clearPollingSession()
          const contact = pollingContact.current
          placeOrder(
            { name: contact.name, email: contact.email, phone: contact.phone },
            { method: contact.method },
            pollingOrderId,
            data.status ?? "paid",
          )
          router.push(`/orders/${pollingOrderId}?welcome=1`)
          return
        }

        // ── TERMINAL: failed / cancelled / expired ───────────────────────
        const terminalPollStatuses = ["FAILED", "CANCELLED", "EXPIRED"]
        const terminalOrderStatuses = ["cancelled", "expired"]

        if (
          terminalOrderStatuses.includes(data.status) ||
          terminalPollStatuses.includes(data.pollStatus) ||
          data.pollStatus === "TIMEOUT"
        ) {
          clearInterval(interval)
          sessionStorage.removeItem(startedAtKey)
          clearPollingSession()
          const isExpired = data.status === "expired" || data.pollStatus === "TIMEOUT" || data.pollStatus === "EXPIRED"
          if (isExpired) setErrorOrderId(pollingOrderId)
          setPollingOrderId(null)
          setSubmitError(
            isExpired
              ? "The payment window expired. If money was deducted, your tickets will be sent automatically once your payment clears."
              : "Payment was cancelled or declined. Please try again.",
          )
          setSubmitting(false)
          return
        }

        // ── NON-TERMINAL: UNKNOWN / ERROR — show message but keep polling ──
        if (data.pollStatus === "UNKNOWN") {
          setSubmitError("We couldn't confirm your payment status. If money was deducted, your tickets will be sent once confirmed. Contact support.")
          return
        }

        if (data.pollStatus === "ERROR") {
          setSubmitError(`An error occurred: ${data.message ?? "Unknown error"}. Your payment may still complete — we'll keep checking.`)
          return
        }

        // ── PENDING — clear any previous error and continue ──────────────
        if (data.pollStatus === "PENDING" || !data.pollStatus) {
          // No update needed — still waiting
        }
      } catch {
        // Network blip — fall through to next tick.
      }
    }, POLL_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [pollingOrderId, placeOrder, router])

  // Fetch event questions once cart is ready
  useEffect(() => {
    if (!ready || items.length === 0) return
    const ticketItem = items.find((i) => i.kind === "ticket")
    if (!ticketItem) return
    fetch(`/api/checkout/questions?eventSlug=${encodeURIComponent(ticketItem.eventSlug)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.questions) {
          setEventQuestions(data.questions)
        }
      })
      .catch(() => {
        // silently fail — questions are optional
      })
  }, [ready, items])

  if (!ready) {
    return (
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-64 bg-paper-2 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 text-center">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Nothing to check out yet</h1>
        <p className="mt-2 text-[15px] text-ink-2">Add tickets to your cart first.</p>
        <Link href="/events" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition">
          Browse events <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const lineCount = items.reduce((s, i) => s + i.qty, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null)
    setErrorOrderId(null)
    setSubmitting(true)

    // All items must be for the same event.
    const eventLines = items.filter((i) => i.kind === "ticket" || i.kind === "vendor_addon")
    const ticketLines = items.filter((i) => i.kind === "ticket")
    const vendorAddonLines = items.filter((i) => i.kind === "vendor_addon")
    if (ticketLines.length === 0) {
      setSubmitError("Your cart has no tickets. Add a ticket to continue.")
      setSubmitting(false)
      return
    }
    const slugs = new Set(eventLines.map((i) => i.eventSlug))
    if (slugs.size > 1) {
      setSubmitError("You have items for multiple events. Please check out one event at a time.")
      setSubmitting(false)
      return
    }

    try {
      // Validate required questions
      for (const q of eventQuestions) {
        if (q.required && !questionAnswers[q.id]?.trim()) {
          setSubmitError(`Please answer the required question: "${q.question}"`)
          setSubmitting(false)
          return
        }
      }

      const body: Record<string, unknown> = {
        email: form.email,
        name: form.name,
        phone: form.phone,
        paymentMethod: form.payment,
        eventSlug: ticketLines[0].eventSlug,
        items: [
          ...ticketLines.map((l) => ({ kind: "ticket" as const, tierId: l.tierId, quantity: l.qty })),
          ...vendorAddonLines.map((l) => ({ kind: "vendor_addon" as const, listingId: l.listingId, quantity: l.qty })),
        ],
      }
      if (appliedPromo) {
        body.promoCode = appliedPromo.code
      }
      if (eventQuestions.length > 0) {
        body.questionResponses = questionAnswers
      }
      const checkoutEndpoint = "/api/checkout/velocity"
      const res = await fetch(checkoutEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let errorMsg = "Checkout failed"
        try {
          const errBody = await res.json()
          errorMsg = errBody.error ?? errorMsg
        } catch { /* use default */ }

	        // Card payment specific: if we got a 502 (bad gateway) during card
	      // payment, the provider may not have returned a checkout URL.
        if (res.status === 502) {
          throw new Error(errorMsg || "Payment service is temporarily unavailable. Please try again.")
        }
        throw new Error(errorMsg)
      }
      const data = (await res.json()) as CheckoutResponse

      const contactData = { name: form.name, email: form.email, phone: form.phone, method: form.payment }

      if (data.flow === "free") {
        placeOrder(
          { name: form.name, email: form.email, phone: form.phone },
          { method: "velocity-ecocash" },
          data.orderId,
          "paid",
        )
        window.location.href = `/orders/${data.orderId}?welcome=1`
        return
      }

      if (data.flow === "velocity-seamless") {
        pollingContact.current = contactData
        savePollingSession(data.orderId, contactData)
        setPollingOrderId(data.orderId)
        return
      }

      if (data.flow === "velocity-redirect") {
        if (data.redirectUrl) {
          placeOrder(
            { name: form.name, email: form.email, phone: form.phone },
            { method: form.payment },
            data.orderId,
            "pending",
          )
          window.location.href = data.redirectUrl
          return
        }
        // Fallback: poll if no redirect URL (unlikely for card, expected for Ecocash)
        pollingContact.current = contactData
        savePollingSession(data.orderId, contactData)
        setPollingOrderId(data.orderId)
        return
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "We couldn't process your order. Please try again.",
      )
      setSubmitting(false)
    }
  }

  return (
    <div>
      {pollingOrderId && (
        <PaymentWaitingOverlay
          method={form.payment}
          phone={form.phone}
          orderId={pollingOrderId}
          onCancel={() => {
            clearPollingSession()
            setPollingOrderId(null)
            setSubmitting(false)
            setSubmitError("Payment cancelled. You can try again with the same or another method.")
          }}
        />
      )}
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-12">
          <Link href="/cart" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors mb-5">
            <ArrowLeft size={13} /> Back to cart
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Checkout</p>
              <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-tight text-ink">
                Almost there.
              </h1>
            </div>
            <div className="w-full md:max-w-md">
              <CheckoutSteps active={
                form.payment && eventQuestions.length > 0
                  ? "pay"
                  : form.payment
                  ? "pay"
                  : eventQuestions.length > 0 && Object.keys(questionAnswers).length > 0
                  ? "questions"
                  : "details"
              } />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-5 md:px-8 py-10 grid lg:grid-cols-[1.5fr_1fr] gap-8 md:gap-10">
        {/* Form */}
        <div className="space-y-6">
          {/* Contact */}
          <section className="rounded-2xl border border-line bg-paper p-6 md:p-7">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">01 · Contact</p>
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">Where do we send your tickets?</h2>
            <p className="text-xs text-ink-3 mb-5">QR codes are emailed and saved in your account.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[12px] font-medium text-ink-2 mb-1.5">Full name</label>
                <div className="relative">
                  <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tendai Moyo"
                    className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink-2 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-ink-2 mb-1.5">Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+263 77…"
                    className="w-full bg-paper border border-line rounded-xl pl-10 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Questions */}
          {eventQuestions.length > 0 && (
            <section className="rounded-2xl border border-line bg-paper p-6 md:p-7">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">02 · Questions</p>
              <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">A few quick questions</h2>
              <p className="text-xs text-ink-3 mb-5">The organiser would like to know a little more about you.</p>

              <div className="space-y-4">
                {eventQuestions.map((q) => (
                  <div key={q.id}>
                    <label className="block text-[12px] font-medium text-ink-2 mb-1.5">
                      {q.question}
                      {q.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input
                      type="text"
                      required={q.required}
                      value={questionAnswers[q.id] ?? ""}
                      onChange={(e) =>
                        setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="Your answer"
                      className="w-full bg-paper border border-line rounded-xl px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-brand-500/10 transition"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Payment */}
          <section className="rounded-2xl border border-line bg-paper p-6 md:p-7">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
              {eventQuestions.length > 0 ? "03" : "02"} · Payment
            </p>
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">How would you like to pay?</h2>
            <p className="text-xs text-ink-3 mb-5">Choose your method, we&apos;ll redirect to confirm.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {PAYMENT_METHODS.map(({ value, label, body, icon: Icon }) => {
                      const checked = form.payment === value
                      return (
                        <label key={value} className={`relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          checked
                            ? "border-navy bg-navy/[0.03] ring-1 ring-navy/10"
                            : "border-line bg-paper hover:border-line-2 hover:bg-paper-2"
                        }`}>
                          <input
                            type="radio"
                            name="payment"
                            value={value}
                            checked={checked}
                            onChange={(e) => setForm({ ...form, payment: e.target.value as PaymentMethodValue })}
                            className="sr-only"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <span className={`relative shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-xl ring-1 ${
                                checked ? "bg-navy text-white ring-navy/15" : "bg-paper-2 text-ink-2 ring-line"
                              }`}>
                                {checked && (
                                  <span className="tp-ring-ping absolute inset-0 rounded-xl bg-navy/20" />
                                )}
                                <Icon size={16} />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-semibold tracking-tight text-ink">{label}</p>
                                <p className="text-[13px] text-ink-2 mt-0.5">{body}</p>
                              </div>
                              {checked && <Check size={16} className="text-navy mt-1 shrink-0" />}
                            </div>
                          </div>
                        </label>
                      )
                    })}
            </div>
          </section>

          {submitError && (
            <div role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 space-y-1">
              <p>{submitError}</p>
              {errorOrderId && (
                <Link
                  href={`/orders/${errorOrderId}`}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-red-700 transition-colors"
                >
                  Check order status <ArrowRight size={12} />
                </Link>
              )}
            </div>
          )}

          {/* Submit (mobile) */}
          <button
            type="submit"
            disabled={submitting}
            className="lg:hidden w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition disabled:opacity-90"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Processing payment…</>
              : <><Lock size={14} /> Place order</>}
          </button>
        </div>

        {/* Summary */}
        <aside className="order-first lg:order-none">
          <div className="lg:sticky lg:top-24 rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.04]">
            <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-1">Order summary</h2>
            <p className="text-xs text-ink-3 mb-5">{lineCount} {lineCount === 1 ? "item" : "items"}</p>

            <ul className="space-y-3 mb-5 max-h-72 overflow-y-auto pr-1">
              {items.map((line) => (
                <li key={line.key} className="flex items-start gap-3 text-[13px]">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-line-2 mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold tracking-tight text-ink line-clamp-1">
                      {line.kind === "ticket" ? line.tierName
                        : line.kind === "merch" ? line.name
                        : line.kind === "vendor_addon" ? `${line.vendorName} · ${line.packageName}`
                        : line.description}
                    </p>
                    <p className="text-ink-3 line-clamp-1">{line.eventTitle} · ×{line.qty}</p>
                  </div>
                  <span className="font-semibold tracking-tight text-ink whitespace-nowrap">
                    {formatCurrency(line.price * line.qty, line.currency)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Promo code */}
            <div className="py-4 border-t border-line">
              {appliedPromo ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-green-700">
                      <Tag size={13} /> {appliedPromo.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setAppliedPromo(null); setPromoInput(""); setPromoError(null) }}
                      className="text-[12px] text-ink-3 hover:text-red-500 transition"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="text-ink-3">Discount</span>
                    <span className="font-semibold text-brand-600">-{formatCurrency(appliedPromo.discount, Object.keys(totalsByCurrency)[0] || "USD")}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Promo code"
                      className="flex-1 min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 transition focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-green-500"
                    />
                    <button
                      type="button"
                      disabled={promoLoading || !promoInput.trim()}
                      onClick={async () => {
                        const code = promoInput.trim().toUpperCase()
                        if (!code) return
                        setPromoLoading(true)
                        setPromoError(null)
                        try {
                          // Get event slug from first ticket item
                          const ticketItem = items.find(i => i.kind === "ticket")
                          if (!ticketItem) return
                          const res = await fetch(`/api/checkout/validate-promo?eventSlug=${encodeURIComponent(ticketItem.eventSlug)}&code=${encodeURIComponent(code)}`)
                          const data = await res.json()
                          if (data.valid) {
                            const ev = Object.values(totalsByCurrency)[0] ?? 0
                            let discount = 0
                            const val = Number(data.value)
                            if (data.type === "percent") {
                              discount = Math.round(ev * (val / 100) * 100) / 100
                            } else {
                              discount = Math.min(val, ev)
                            }
                            setAppliedPromo({ code: data.code, type: data.type, value: val, discount })
                            setPromoInput("")
                          } else {
                            setPromoError(data.error ?? "Invalid promo code")
                          }
                        } catch {
                          setPromoError("Failed to validate promo code")
                        } finally {
                          setPromoLoading(false)
                        }
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition disabled:opacity-70"
                    >
                      {promoLoading ? <Loader2 size={13} className="animate-spin" /> : <Percent size={13} />}
                      Apply
                    </button>
                  </div>
                  {promoError && (
                    <p className="text-[12px] text-red-500">{promoError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 pb-4 border-t border-line pt-4">
              {Object.entries(totalsByCurrency).map(([cur, total]) => {
                const finalTotal = appliedPromo ? Math.max(0, total - appliedPromo.discount) : total
                return (
                  <div key={cur} className="flex items-baseline justify-between">
                    <span className="text-[13px] text-ink-2">Total · {cur}</span>
                    <span className="text-[18px] font-bold tracking-tight text-ink">
                      {formatCurrency(finalTotal, cur)}
                    </span>
                  </div>
                )
              })}
              {appliedPromo && (
                <p className="text-[11px] text-ink-3 text-right">
                  Original: {formatCurrency(Object.values(totalsByCurrency)[0] ?? 0, Object.keys(totalsByCurrency)[0] || "USD")}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="hidden lg:inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] transition disabled:opacity-90 mt-2"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Processing payment…</>
                : <><Lock size={14} /> Place order</>}
            </button>

            <p className="mt-3 text-[12px] text-ink-3 text-center inline-flex items-center justify-center gap-1.5 w-full">
              <Lock size={11} /> Secured by TicketPulse · escrowed
            </p>
          </div>
        </aside>
      </form>
    </div>
  )
}

function PaymentWaitingOverlay({
  method, phone, orderId, onCancel,
}: { method: string; phone: string; orderId: string; onCancel: () => void }) {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(POLL_TIMEOUT_MS)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onCancel])

  // Countdown from session-stored start time
  useEffect(() => {
    const key = `poll_started:${orderId}`
    const stored = sessionStorage.getItem(key)
    const startedAt = stored ? Number(stored) : Date.now()

    const tick = () => setTimeLeftMs(Math.max(0, POLL_TIMEOUT_MS - (Date.now() - startedAt)))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [orderId])

  const mins = Math.floor(timeLeftMs / 60_000)
  const secs = Math.floor((timeLeftMs % 60_000) / 1000)
  const countdownLabel = `${mins}:${secs.toString().padStart(2, "0")}`
  const isLow = timeLeftMs < 60_000

  const label = method === "velocity-ecocash" ? "EcoCash" : "Card"
  const isCard = method === "velocity-card"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-paper p-7 shadow-xl shadow-ink/10">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-2 hover:text-ink transition"
          aria-label="Cancel and close"
        >
          <X size={14} />
        </button>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-navy">
            {isCard ? <CreditCard size={18} /> : <Smartphone size={18} />}
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">{label}</p>
            <h3 className="text-[16px] font-semibold tracking-tight text-ink">
              {isCard ? "Complete payment" : "Check your phone"}
            </h3>
          </div>
        </div>
        <p className="mt-4 text-[14px] text-ink-2 leading-relaxed">
          {isCard
            ? "We're redirecting you to complete the payment. Once confirmed, you'll be moved forward automatically."
            : <>Waiting for <span className="font-semibold text-ink">{phone}</span> to approve the EcoCash prompt. We&apos;ll move you forward as soon as it clears.</>}
        </p>
        <div className="mt-5 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-[13px] text-ink-3">
            <Loader2 size={13} className="animate-spin text-blue" />
            Waiting for confirmation…
          </div>
          {!isCard && (
            <span className={`text-[12px] font-mono tabular-nums ${isLow ? "text-amber-600 font-semibold" : "text-ink-3"}`}>
              {countdownLabel}
            </span>
          )}
        </div>
        {isLow && !isCard && (
          <p className="mt-2 text-[12px] text-amber-600">
            Running low — approve the prompt on your phone now.
          </p>
        )}
      </div>
    </div>
  )
}
