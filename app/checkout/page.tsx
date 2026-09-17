"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import CheckoutPaymentNotice from "@/app/checkout/CheckoutPaymentNotice"
import { useCart } from "@/lib/cart-context"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowRight, Lock, Smartphone, CreditCard, Mail, User, Phone, Loader2, Tag, Percent, ChevronLeft, Check,
} from "lucide-react"

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

type PaymentMethodValue = "velocity-ecocash" | "velocity-card"

const PAYMENT_METHODS: {
  value: PaymentMethodValue
  label: string
  body: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}[] = [
  { value: "velocity-ecocash", label: "EcoCash", body: "Mobile money · instant confirmation", icon: Smartphone },
  { value: "velocity-card",    label: "VISA / Mastercard", body: "Pay by card on a secure checkout page", icon: CreditCard },
]

const POLL_INTERVAL_MS = 2000
// Must match POLL_TIMEOUT_MS in app/api/checkout/velocity/status/[id]/route.ts.
// Client uses slightly longer window to account for network latency on the final poll.
const POLL_TIMEOUT_MS = 5.5 * 60 * 1000

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
          queueMicrotask(() => {
            setPollingOrderId(savedOrderId)
            setSubmitting(true)
          })
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
  // Polls the Velocity transaction status with a 2s pause between completed
  // requests until a terminal state (never overlapping slow provider calls).
  // Page-refresh safe: stores startedAt in sessionStorage so the timer survives navigation.
  useEffect(() => {
    if (!pollingOrderId) return

    const startedAtKey = `poll_started:${pollingOrderId}`
    const stored = sessionStorage.getItem(startedAtKey)
    const startedAt = stored ? Number(stored) : Date.now()
    if (!stored) sessionStorage.setItem(startedAtKey, String(startedAt))

    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null
    const statusEndpoint = `/api/checkout/velocity/status/${pollingOrderId}`

    const poll = async () => {
      if (!active) return

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (timer) clearTimeout(timer)
        sessionStorage.removeItem(startedAtKey)
        clearPollingSession()
        setPollingOrderId(null)
        setSubmitting(false)
        router.replace(`/checkout/expired?ref=${pollingOrderId}&pending=1`)
        return
      }

      try {
        controller = new AbortController()
        const res = await fetch(statusEndpoint, { cache: "no-store", signal: controller.signal })
        const data = await res.json()
        if (!active) return

        if (data.paid && pollingContact.current) {
          if (timer) clearTimeout(timer)
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

        const terminalPollStatuses = ["FAILED", "CANCELLED", "EXPIRED", "EVENT_ENDED"]
        const terminalOrderStatuses = ["cancelled", "expired"]

        if (
          terminalOrderStatuses.includes(data.status) ||
          terminalPollStatuses.includes(data.pollStatus) ||
          data.pollStatus === "TIMEOUT"
        ) {
          if (timer) clearTimeout(timer)
          sessionStorage.removeItem(startedAtKey)
          clearPollingSession()
          const isExpired = data.status === "expired" || data.pollStatus === "TIMEOUT" || data.pollStatus === "EXPIRED"
          setPollingOrderId(null)
          setSubmitting(false)
          if (isExpired || data.pollStatus === "EVENT_ENDED") {
            router.replace(`/checkout/expired?ref=${pollingOrderId}`)
          } else {
            clearPollingSession()
            setSubmitError("Payment was cancelled or declined. Please try again.")
          }
          return
        }

        if (data.pollStatus === "UNKNOWN") {
          setSubmitError("We couldn't confirm your payment status. If money was deducted, your tickets will be sent once confirmed. Contact support.")
        }

        if (data.pollStatus === "ERROR") {
          setSubmitError(`An error occurred: ${data.message ?? "Unknown error"}. Your payment may still complete — we'll keep checking.`)
        }
      } catch {
        // Network blip — fall through to next tick.
      } finally {
        controller = null
      }

      // Do not overlap requests: a Velocity poll can take longer than the
      // display interval while its async workflow settles.
      if (active) timer = setTimeout(() => { void poll() }, POLL_INTERVAL_MS)
    }

    void poll()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
      controller?.abort()
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
        if (data.questions) setEventQuestions(data.questions)
      })
      .catch(() => { /* questions are optional */ })
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
  const firstEventTitle = items[0]?.eventTitle ?? ""

  // Compute the final total for the CTA label
  const firstCurrency = Object.keys(totalsByCurrency)[0] ?? "USD"
  const rawTotal = totalsByCurrency[firstCurrency] ?? 0
  const finalTotal = appliedPromo ? Math.max(0, rawTotal - appliedPromo.discount) : rawTotal
  const isFree = finalTotal === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null)
    setErrorOrderId(null)
    setSubmitting(true)

    const eventLines = items
    const ticketLines = items.filter((i) => i.kind === "ticket")
    const merchLines = items.filter((i) => i.kind === "merch")
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
          ...merchLines.map((l) => ({ kind: "merch" as const, itemId: l.itemId, quantity: l.qty, size: l.size })),
          ...vendorAddonLines.map((l) => ({ kind: "vendor_addon" as const, listingId: l.listingId, quantity: l.qty })),
        ],
      }
      if (appliedPromo) body.promoCode = appliedPromo.code
      if (eventQuestions.length > 0) body.questionResponses = questionAnswers

      const res = await fetch("/api/checkout/velocity", {
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
        if (res.status === 502) throw new Error(errorMsg || "Payment service is temporarily unavailable. Please try again.")
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
        pollingContact.current = contactData
        savePollingSession(data.orderId, contactData)
        setPollingOrderId(data.orderId)
        return
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "We couldn't process your order. Please try again.",
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#0a2540]">
      {pollingOrderId && (
        <PaymentWaitingOverlay
          method={form.payment}
          phone={form.phone}
          orderId={pollingOrderId}
          onCancel={() => {
            clearPollingSession()
            setPollingOrderId(null)
            setSubmitting(false)
            setSubmitError("Payment cancelled. You can try again.")
          }}
        />
      )}

      {/* Header */}
      <div className="border-b border-[#0a2540]/10 bg-white">
        <div className="mx-auto max-w-5xl px-5 pb-8 pt-12 md:px-8 md:pb-12 md:pt-16">
          <Link
            href="/cart"
            className="mb-8 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0a2540]/55 transition-colors hover:text-[#f06d43]"
          >
            <ChevronLeft size={12} /> Back to cart
          </Link>
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0a2540]/55">TicketPulse checkout</p>
            <h1 className="mt-4 font-display text-[58px] font-black uppercase leading-[0.84] tracking-[-0.04em] text-[#0a2540] sm:text-[76px] md:text-[104px]">
              Your event.<br /><span className="text-[#f06d43]">Your ticket.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-[#0a2540]/65 md:text-[15px]">
              {firstEventTitle ? <>You&apos;re booking <strong className="font-semibold text-[#0a2540]">{firstEventTitle}</strong>. Complete your details below and choose how you&apos;d like to pay.</> : "Complete your details below and choose how you&apos;d like to pay."}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-5 py-8 md:px-8 md:py-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6">
        {/* Left: form fields */}
        <div className="space-y-5">
          {/* Contact */}
          <div className="rounded-[1.25rem] border border-[#0a2540]/15 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(10,37,64,0.45)] md:p-7">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0a2540]/60">Your details</h2>
            <p className="mb-5 text-[13px] text-[#0a2540]/55">Where should we send your ticket?</p>

            <div className="space-y-3.5">
              <div>
                    <label htmlFor="checkout-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a2540]/70">Full name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                  <input
                    id="checkout-name"
                    type="text"
                    required
                    autoFocus
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tendai Moyo"
                    className="w-full rounded-md border border-[#0a2540]/20 bg-white py-3 pl-9 pr-4 text-[15px] text-[#0a2540] placeholder:text-[#0a2540]/35 transition focus:border-[#f06d43] focus:outline-none focus:ring-4 focus:ring-[#f06d43]/10"
                  />
                </div>
              </div>

              <div className={`grid grid-cols-1 gap-3.5 ${!isFree && form.payment === "velocity-ecocash" ? "sm:grid-cols-2" : ""}`}>
                <div>
                  <label htmlFor="checkout-email" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a2540]/70">Email for your ticket</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                    <input
                      id="checkout-email"
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full rounded-md border border-[#0a2540]/20 bg-white py-3 pl-9 pr-4 text-[15px] text-[#0a2540] placeholder:text-[#0a2540]/35 transition focus:border-[#f06d43] focus:outline-none focus:ring-4 focus:ring-[#f06d43]/10"
                    />
                  </div>
                </div>
                {!isFree && form.payment === "velocity-ecocash" && (
                  <div>
                    <label htmlFor="checkout-phone" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a2540]/70">EcoCash number</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                      <input
                        id="checkout-phone"
                        type="tel"
                        required
                        autoComplete="tel"
                        inputMode="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+263 77…"
                        className="w-full rounded-md border border-[#0a2540]/20 bg-white py-3 pl-9 pr-4 text-[15px] text-[#0a2540] placeholder:text-[#0a2540]/35 transition focus:border-[#f06d43] focus:outline-none focus:ring-4 focus:ring-[#f06d43]/10"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Event questions */}
          {eventQuestions.length > 0 && (
            <div className="rounded-[1.25rem] border border-[#0a2540]/15 bg-white p-5 md:p-7">
              <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0a2540]/60">A few quick questions</h2>
              <p className="mb-4 text-[12px] text-[#0a2540]/55">The organiser would like to know a bit more about you.</p>

              <div className="space-y-3.5">
                {eventQuestions.map((q) => (
                  <div key={q.id}>
                    <label htmlFor={`checkout-question-${q.id}`} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a2540]/70">
                      {q.question}
                      {q.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <input
                      id={`checkout-question-${q.id}`}
                      type="text"
                      required={q.required}
                      value={questionAnswers[q.id] ?? ""}
                      onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Your answer"
                      className="w-full rounded-md border border-[#0a2540]/20 bg-white px-4 py-3 text-[15px] text-[#0a2540] placeholder:text-[#0a2540]/35 transition focus:border-[#f06d43] focus:outline-none focus:ring-4 focus:ring-[#f06d43]/10"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment method — hidden for free orders */}
          {!isFree && <div className="rounded-[1.25rem] border border-[#0a2540]/15 bg-white p-5 md:p-7">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0a2540]/60">Choose how to pay</h2>
            <CheckoutPaymentNotice />
            <div className="space-y-2">
              {PAYMENT_METHODS.map(({ value, label, body, icon: Icon }) => {
                const checked = form.payment === value
                const isEcoCash = value === "velocity-ecocash"
                return (
                  <label
                    key={value}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? "border-[#f06d43] bg-[#fff3ed] ring-1 ring-[#f06d43]/20"
                        : "border-[#0a2540]/15 bg-white hover:border-[#0a2540]/30 hover:bg-[#fbf7f0]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={value}
                      checked={checked}
                      onChange={(e) => setForm({ ...form, payment: e.target.value as PaymentMethodValue })}
                      className="sr-only"
                    />
                    <span className={`inline-flex w-9 h-9 items-center justify-center rounded-lg shrink-0 ${
                      checked ? "bg-[#f06d43] text-[#0a2540]" : "bg-[#f3eee5] text-[#0a2540]/65"
                    }`}>
                      <Icon size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
                        {label}
                        {isEcoCash && (
                          <span className="tp-fast-badge inline-flex items-center rounded-full bg-[#fff0e7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#c9522a] ring-1 ring-[#f06d43]/25">
                            Fast
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-ink-3">{body}</p>
                    </div>
                    {checked && <Check size={14} className="shrink-0 text-[#f06d43]" />}
                  </label>
                )
              })}
            </div>
          </div>}

          {/* Error state */}
          {submitError && (
            <div role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1">
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

          {/* Mobile CTA */}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-[#f06d43] px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#0a2540] shadow-sm transition hover:bg-[#ff8a62] active:scale-[0.99] disabled:opacity-80 lg:hidden"
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Processing…</>
            ) : isFree ? (
              <><Check size={14} /> Claim free tickets</>
            ) : form.payment === "velocity-card" ? (
              <><CreditCard size={14} /> Pay {formatCurrency(finalTotal, firstCurrency)} by card</>
            ) : (
              <><Smartphone size={14} /> Pay {formatCurrency(finalTotal, firstCurrency)} with EcoCash</>
            )}
          </button>
        </div>

        {/* Right: order summary */}
        <aside className="order-first lg:order-none">
          <div className="rounded-[1.25rem] border border-[#0a2540]/15 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(10,37,64,0.45)] lg:sticky lg:top-8 md:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-[#0a2540]/15 pb-5">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0a2540]/60">Order summary</h2>
                <p className="mt-1 text-[12px] text-[#0a2540]/55">{lineCount} {lineCount === 1 ? "ticket" : "tickets"}</p>
              </div>
              <span className="font-display text-[32px] font-black leading-none tracking-[-0.04em] text-[#0a2540]">{formatCurrency(finalTotal, firstCurrency)}</span>
            </div>

            <ul className="space-y-2.5 mb-4 max-h-64 overflow-y-auto">
              {items.map((line) => (
                <li key={line.key} className="flex items-start gap-3 text-[13px]">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-line-2 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium tracking-tight text-ink line-clamp-1">
                      {line.kind === "ticket" ? line.tierName
                        : line.kind === "merch" ? line.name
                        : `${line.vendorName} · ${line.packageName}`}
                    </p>
                    <p className="text-ink-3 text-[12px] line-clamp-1">{line.eventTitle} · ×{line.qty}</p>
                  </div>
                  <span className="font-semibold tracking-tight text-ink whitespace-nowrap">
                    {formatCurrency(line.price * line.qty, line.currency)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Promo code */}
            <div className="py-3.5 border-t border-line">
              {appliedPromo ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-green-700">
                      <Tag size={12} /> {appliedPromo.code}
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
                    <span className="font-semibold text-green-700">-{formatCurrency(appliedPromo.discount, firstCurrency)}</span>
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
                      className="flex-1 min-w-0 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
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
                          const ticketItem = items.find(i => i.kind === "ticket")
                          if (!ticketItem) return
                          const res = await fetch(`/api/checkout/validate-promo?eventSlug=${encodeURIComponent(ticketItem.eventSlug)}&code=${encodeURIComponent(code)}`)
                          const data = await res.json()
                          if (data.valid) {
                            let discount = 0
                            const val = Number(data.value)
                            if (data.type === "percent") {
                              discount = Math.round(rawTotal * (val / 100) * 100) / 100
                            } else {
                              discount = Math.min(val, rawTotal)
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
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-paper-2 border border-line px-3 py-2 text-[12px] font-semibold text-ink hover:bg-paper hover:border-line-2 active:scale-[0.99] transition disabled:opacity-50"
                    >
                      {promoLoading ? <Loader2 size={12} className="animate-spin" /> : <Percent size={12} />}
                      Apply
                    </button>
                  </div>
                  {promoError && <p className="text-[12px] text-red-500">{promoError}</p>}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="pt-3.5 border-t border-line space-y-1">
              {Object.entries(totalsByCurrency).map(([cur, total]) => {
                const lineTotal = appliedPromo ? Math.max(0, total - appliedPromo.discount) : total
                return (
                  <div key={cur} className="flex items-baseline justify-between">
                    <span className="text-[13px] text-ink-2">Total · {cur}</span>
                    <span className="text-[20px] font-bold tracking-tight text-ink">
                      {formatCurrency(lineTotal, cur)}
                    </span>
                  </div>
                )
              })}
              {appliedPromo && (
                <p className="text-[11px] text-ink-3 text-right">
                  Was {formatCurrency(rawTotal, firstCurrency)}
                </p>
              )}
            </div>

            {/* Desktop CTA */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 hidden w-full items-center justify-center gap-2 rounded-sm bg-[#f06d43] px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#0a2540] shadow-sm transition hover:bg-[#ff8a62] active:scale-[0.99] disabled:opacity-80 lg:inline-flex"
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Processing…</>
              ) : isFree ? (
                <><Check size={14} /> Claim free tickets</>
              ) : form.payment === "velocity-card" ? (
                <><CreditCard size={14} /> Pay {formatCurrency(finalTotal, firstCurrency)} by card</>
              ) : (
                <><Smartphone size={14} /> Pay {formatCurrency(finalTotal, firstCurrency)} with EcoCash</>
              )}
            </button>

            <p className="mt-3 text-[11px] text-ink-3 text-center inline-flex items-center justify-center gap-1.5 w-full">
              <Lock size={10} /> Secured by TicketPulse
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
  const isCard = method === "velocity-card"
  const [timeLeftMs, setTimeLeftMs] = useState<number>(POLL_TIMEOUT_MS)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onCancel])

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
  const isLow = timeLeftMs < 120_000

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2540]/95 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-sm text-center">
        {/* Pulse rings */}
        <div className="relative mx-auto mb-7 w-20 h-20">
          <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" style={{ animationDuration: "1.5s" }} />
          <span className="absolute inset-0 rounded-full bg-white/[0.07]" />
          <span className="relative z-10 inline-flex w-full h-full items-center justify-center rounded-full bg-white/15">
            {isCard ? <CreditCard size={30} className="text-white" /> : <Smartphone size={30} className="text-white" />}
          </span>
        </div>

        <p className="text-[11px] font-semibold tracking-[0.2em] text-white/40 uppercase mb-2">
          {isCard ? "Card payment" : "EcoCash"}
        </p>
        <h2 className="text-[24px] font-bold text-white tracking-tight">
          {isCard ? "Redirecting…" : "Check your phone"}
        </h2>
        <p className="mt-3 text-[15px] text-white/60 leading-relaxed max-w-xs mx-auto">
          {isCard
            ? "We're taking you to the secure card checkout. Come back here once you've completed payment."
            : <>Approve the EcoCash prompt sent to{" "}<span className="font-semibold text-white">{phone}</span></>
          }
        </p>

        <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] text-white/70">
          <Loader2 size={13} className="animate-spin text-white/50" />
          Waiting for confirmation…
        </div>

        {isLow && !isCard && (
          <div className="mt-4 rounded-xl bg-amber-500/15 border border-amber-400/20 px-4 py-3">
            <p className="text-[13px] font-semibold text-amber-300">
              Approve now — {countdownLabel} left
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-8 text-[12px] text-white/30 hover:text-white/60 transition-colors underline underline-offset-4"
        >
          Cancel payment
        </button>
      </div>
    </div>
  )
}
