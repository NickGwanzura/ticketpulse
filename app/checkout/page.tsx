"use client"
import Link from "next/link"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import CheckoutPaymentNotice from "@/app/checkout/CheckoutPaymentNotice"
import { useCart } from "@/lib/cart-context"
import { orderAuthHeaders, rememberOrderAccess, orderOwnerQuery } from "@/lib/order-auth-client"
import { formatCurrency } from "@/lib/utils"
import { hasAnalyticsConsent } from "@/lib/cookie-preferences"
import { useCookiePreferences } from "@/lib/use-cookie-preferences"
import { calculateGatewayFee } from "@/lib/gateway-fee"
import {
  ArrowRight, Lock, Smartphone, CreditCard, Mail, User, Phone, Loader2, ChevronLeft, Check,
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
  accessSignature: string
  resumed?: boolean
}

type PaymentMethodValue = "velocity-ecocash" | "velocity-card"

const PAYMENT_METHODS: {
  value: PaymentMethodValue
  label: string
  body: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}[] = [
  { value: "velocity-ecocash", label: "EcoCash", body: "Approve a secure prompt on your phone", icon: Smartphone },
  { value: "velocity-card",    label: "VISA / Mastercard", body: "Pay by card on a secure checkout page", icon: CreditCard },
]

const POLL_INTERVAL_MS = 5000
// Foreground checking window; server reconciliation can continue for 24 hours.
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

export default function CheckoutPage() { return <Suspense fallback={<p className="p-8">Loading checkout…</p>}><CheckoutInner /></Suspense> }
function CheckoutInner() {
  const analytics = useCookiePreferences()
  const router = useRouter()
  const params = useSearchParams()
  const selectedEvent = params.get('event'), selectedCurrency = params.get('currency')
  const { items: cartItems, ready, saveOrder, removeItem } = useCart()
  const items = useMemo(() => cartItems.filter(item => (!selectedEvent || item.eventSlug === selectedEvent) && (!selectedCurrency || item.currency === selectedCurrency)), [cartItems, selectedEvent, selectedCurrency])
  const totalsByCurrency = useMemo(() => items.reduce<Record<string, number>>((totals, item) => { totals[item.currency] = (totals[item.currency] ?? 0) + item.qty * item.price; return totals }, {}), [items])
  const checkoutEventSlug = items.find(i => i.kind === 'ticket')?.eventSlug
  useEffect(() => {
    if (!ready || !checkoutEventSlug || analytics !== true || !hasAnalyticsConsent()) return
    void fetch('/api/analytics/track', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({event:'CHECKOUT_STARTED',eventSlug:checkoutEventSlug,sessionId:getAnalyticsSessionId()}) }).catch(() => {})
  }, [ready, checkoutEventSlug, analytics])
  const [serverQuote, setServerQuote] = useState<{ amount: number; subtotal: number; gatewayFee: number; gatewayFeePercent: number; currency: string; normalizedPhone: string; lines?: { tierId: string; quantity: number; unitPrice: number }[]; inputKey: string } | null>(null)
  const requestId = useRef<string | null>(null)
  const submittedCart = useRef<string | null>(null)
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])
  const [pollMessage, setPollMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errorOrderId, setErrorOrderId] = useState<string | null>(null)
  const [pollingOrderId, setPollingOrderId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    payment: "velocity-ecocash" as PaymentMethodValue,
  })
  // ── Restore polling session after page refresh ───────────────────────────
  useEffect(() => {
    try {
      const savedOrderId = sessionStorage.getItem(`${POLL_SESSION_KEY}:orderId`)
      if (savedOrderId) {
        const name = sessionStorage.getItem(`${POLL_SESSION_KEY}:name`)
        const email = sessionStorage.getItem(`${POLL_SESSION_KEY}:email`)
        const phone = sessionStorage.getItem(`${POLL_SESSION_KEY}:phone`)
        const method = sessionStorage.getItem(`${POLL_SESSION_KEY}:method`)
        if (name && email && phone !== null && method) {
          queueMicrotask(() => {
            setForm({ name, email, phone, payment: method as PaymentMethodValue })
            setPollingOrderId(savedOrderId)
            setSubmitting(true)
          })
        }
      }
    } catch { /* sessionStorage may be unavailable */ }
  }, [])

  const [eventQuestions, setEventQuestions] = useState<{ id: string; question: string; required: boolean }[]>([])
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({})

  async function saveCanonicalOrder(orderId: string) {
    const response = await fetch("/api/orders/" + orderId + "/data", { cache: "no-store", headers: orderAuthHeaders(orderId) })
    if (response.ok) saveOrder(await response.json())
    if (submittedCart.current === JSON.stringify(itemsRef.current)) itemsRef.current.forEach(item => removeItem(item.key))
  }
  function getRequestId() {
    if (requestId.current) return requestId.current
    try { requestId.current = sessionStorage.getItem("tp_checkout_request") } catch { /* storage optional */ }
    requestId.current ??= crypto.randomUUID()
    try { sessionStorage.setItem("tp_checkout_request", requestId.current) } catch { /* storage optional */ }
    return requestId.current
  }
  function finishRequest() {
    requestId.current = null
    try { sessionStorage.removeItem("tp_checkout_request"); sessionStorage.removeItem("tp_checkout_request_order") } catch { /* storage optional */ }
  }

  // Drives the "Check your phone" overlay for seamless mobile-money payments.
  // Polls the Velocity transaction status with a 2s pause between completed
  // requests until a terminal state (never overlapping slow provider calls).
  // Page-refresh safe: stores startedAt in sessionStorage so the timer survives navigation.
  useEffect(() => {
    if (!pollingOrderId) return

    const startedAtKey = `poll_started:${pollingOrderId}`
    let stored: string | null = null
    try { stored = sessionStorage.getItem(startedAtKey) } catch { /* storage optional */ }
    const startedAt = stored ? Number(stored) : Date.now()
    if (!stored) { try { sessionStorage.setItem(startedAtKey, String(startedAt)) } catch { /* storage optional */ } }

    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null
    const statusEndpoint = `/api/checkout/velocity/status/${pollingOrderId}`

    const poll = async () => {
      if (!active) return

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (timer) clearTimeout(timer)
        safeSessionRemove(startedAtKey)
        clearPollingSession()
        setPollingOrderId(null)
        setSubmitting(false)
        router.replace("/checkout/expired?ref=" + pollingOrderId + "&" + orderOwnerQuery(pollingOrderId).slice(1))
        return
      }

      try {
        controller = new AbortController()
        const res = await fetch(statusEndpoint, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
          headers: orderAuthHeaders(pollingOrderId, null),
        })
        if (!res.ok) {
          setPollMessage(res.status === 403 ? "Open your secure order link to continue checking this payment." : "Connection is delayed. Your payment may still complete; please do not pay again.")
          if (res.status === 429) {
            if (active) timer = setTimeout(() => void poll(), Math.max(5000, Number(res.headers.get("Retry-After") ?? 5) * 1000))
            return
          }
          throw new Error("Status temporarily unavailable")
        }
        const data = await res.json()
        if (!active) return

        if (data.paid) {
          if (timer) clearTimeout(timer)
          safeSessionRemove(startedAtKey)
          clearPollingSession()
          await saveCanonicalOrder(pollingOrderId)
          finishRequest()
          router.push("/orders/" + pollingOrderId + orderOwnerQuery(pollingOrderId))
          return
        }

        const terminalPollStatuses = ["CANCELLED", "EXPIRED"]
        const terminalOrderStatuses = ["cancelled", "expired"]

        if (
          terminalOrderStatuses.includes(data.status) ||
          terminalPollStatuses.includes(data.pollStatus) ||
          data.status === "refunded"
        ) {
          if (timer) clearTimeout(timer)
          safeSessionRemove(startedAtKey)
          clearPollingSession()
          const isExpired = data.status === "expired" || data.pollStatus === "TIMEOUT" || data.pollStatus === "EXPIRED"
          setPollingOrderId(null)
          setSubmitting(false)
          if (isExpired || data.pollStatus === "EVENT_ENDED") {
            router.replace("/checkout/expired?ref=" + pollingOrderId + "&" + orderOwnerQuery(pollingOrderId).slice(1))
          } else {
            clearPollingSession()
            setSubmitError("This order is closed. If money was deducted, contact support before paying again.")
            setErrorOrderId(pollingOrderId)
          }
          return
        }

        if (data.pollStatus === "UNKNOWN") {
          setPollMessage("We couldn't confirm your payment status. If money was deducted, your tickets will be sent once confirmed. Contact support.")
        }

        if (data.pollStatus === "ERROR") {
          setPollMessage(`An error occurred: ${data.message ?? "Unknown error"}. Your payment may still complete — we'll keep checking.`)
        }
      } catch {
        setPollMessage("Connection is delayed. We are still checking; please do not pay again.")
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
  // The poll lifetime follows the order, while cart contents are read through itemsRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingOrderId, saveOrder, removeItem, router])

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

  const checkoutGroups = [...new Map(items.filter(i => i.kind === 'ticket').map(i => [i.eventSlug + ':' + i.currency, i])).values()]
  if (checkoutGroups.length > 1) return <div className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-xl font-bold">Choose an order to check out</h1><p>Each event and currency has its own payment.</p>{checkoutGroups.map(item => <Link key={item.key} className="block rounded-lg border border-line p-4" href={'/checkout?event=' + encodeURIComponent(item.eventSlug) + '&currency=' + encodeURIComponent(item.currency)}>{item.eventTitle} · {item.currency} <ArrowRight size={14} /></Link>)}</div>
  const lineCount = items.reduce((s, i) => s + i.qty, 0)
  const firstEventTitle = items[0]?.eventTitle ?? ""

  // Compute the final total for the CTA label
  const firstCurrency = Object.keys(totalsByCurrency)[0] ?? "USD"
  const rawTotal = totalsByCurrency[firstCurrency] ?? 0
  const estimatedSubtotal = rawTotal
  const estimatedGatewayFee = calculateGatewayFee(estimatedSubtotal)
  const inputKey = JSON.stringify({ form, items, questionAnswers })
  const currentQuote = serverQuote?.inputKey === inputKey ? serverQuote : null
  const finalTotal = currentQuote?.amount ?? estimatedSubtotal + estimatedGatewayFee
  const displayedSubtotal = currentQuote?.subtotal ?? estimatedSubtotal
  const displayedGatewayFee = currentQuote?.gatewayFee ?? estimatedGatewayFee
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
        checkoutRequestId: getRequestId(),
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
      if (eventQuestions.length > 0) body.questionResponses = questionAnswers

      if (!currentQuote) {
        if (hasAnalyticsConsent()) {
          for (const event of ['BUYER_DETAILS_SUBMITTED','PAYMENT_METHOD_SELECTED']) void fetch('/api/analytics/track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,eventSlug:ticketLines[0].eventSlug,sessionId:getAnalyticsSessionId()})}).catch(() => {})
        }
        const quoted = await fetch("/api/checkout/velocity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, quoteOnly: true }), signal: AbortSignal.timeout(30_000) })
        const result = await quoted.json()
        if (!quoted.ok) throw new Error(result.error ?? "Could not confirm the current price")
        setServerQuote({ ...result.quote, inputKey })
        if (result.quote.questions) setEventQuestions(result.quote.questions)
        setSubmitting(false)
        return
      }
      body.expectedAmount = currentQuote.amount
      body.expectedCurrency = currentQuote.currency
      submittedCart.current = JSON.stringify(items)
      const res = await fetch("/api/checkout/velocity", {
        signal: AbortSignal.timeout(60_000),
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-session-id": getAnalyticsSessionId(),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let errorMsg = "Checkout failed"
        try {
          const errBody = await res.json()
          errorMsg = errBody.error ?? errorMsg
          if (errBody.orderId && errBody.accessSignature) {
            rememberOrderAccess(errBody.orderId, errBody.accessSignature)
            setErrorOrderId(errBody.orderId)
            try { sessionStorage.setItem("tp_checkout_request_order", errBody.orderId) } catch { /* optional storage */ }
          }
          if (errBody.quote) setServerQuote({ ...errBody.quote, inputKey })
        } catch { /* use default */ }
        if (res.status === 502) throw new Error(errorMsg || "Payment service is temporarily unavailable. Please try again.")
        throw new Error(errorMsg)
      }
      const data = (await res.json()) as CheckoutResponse
      rememberOrderAccess(data.orderId, data.accessSignature)
      try { sessionStorage.setItem("tp_checkout_request_order", data.orderId) } catch { /* optional storage */ }

      const contactData = { name: form.name, email: form.email, phone: form.phone, method: form.payment }

      if (data.flow === "free") {
        await saveCanonicalOrder(data.orderId)
        finishRequest()
        router.push("/orders/" + data.orderId + orderOwnerQuery(data.orderId))
        return
      }

      if (data.flow === "velocity-seamless") {
        savePollingSession(data.orderId, contactData)
        setPollingOrderId(data.orderId)
        return
      }

      if (data.flow === "velocity-redirect") {
        if (data.redirectUrl) {
          await saveCanonicalOrder(data.orderId)
          window.location.href = data.redirectUrl
          return
        }
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
    <div className="min-h-screen bg-paper text-ink">
      {pollingOrderId && (
        <PaymentWaitingOverlay
          method={form.payment}
          phone={form.phone}
          message={pollMessage}
          orderId={pollingOrderId}
          onCancel={() => {
            clearPollingSession()
            setPollingOrderId(null)
            setSubmitting(false)
            router.push("/orders/" + pollingOrderId + orderOwnerQuery(pollingOrderId))
          }}
        />
      )}

      {/* Header */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto max-w-5xl px-5 pb-8 pt-12 md:px-8 md:pb-12 md:pt-16">
          <Link
            href="/cart"
            className="mb-8 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
          >
            <ChevronLeft size={12} /> Back to cart
          </Link>
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-3">TicketPulse checkout</p>
            <h1 className="mt-4 font-display text-[58px] font-black uppercase leading-[0.84] tracking-[-0.04em] text-ink sm:text-[76px] md:text-[104px]">
              Your event.<br /><span className="text-cta">Your ticket.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-ink-2 md:text-[15px]">
              {firstEventTitle ? <>You&apos;re booking <strong className="font-semibold text-ink">{firstEventTitle}</strong>. Complete your details below and choose how you&apos;d like to pay.</> : "Complete your details below and choose how you&apos;d like to pay."}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-5 py-8 md:px-8 md:py-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6">
        {/* Left: form fields */}
        <div className="space-y-5">
          {/* Contact */}
          <div className="rounded-[1.25rem] border border-line-2 bg-paper p-5 shadow-[0_12px_35px_-28px_rgba(10,37,64,0.45)] md:p-7">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">Your details</h2>
            <p className="mb-5 text-[13px] text-ink-3">Where should we send your ticket?</p>

            <div className="space-y-3.5">
              <div>
                    <label htmlFor="checkout-name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2">Full name</label>
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
                    className="w-full rounded-md border border-input bg-paper py-3 pl-9 pr-4 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/10"
                  />
                </div>
              </div>

              <div className={`grid grid-cols-1 gap-3.5 ${!isFree && form.payment === "velocity-ecocash" ? "sm:grid-cols-2" : ""}`}>
                <div>
                  <label htmlFor="checkout-email" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2">Email for your ticket</label>
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
                      className="w-full rounded-md border border-input bg-paper py-3 pl-9 pr-4 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/10"
                    />
                  </div>
                </div>
                {!isFree && form.payment === "velocity-ecocash" && (
                  <div>
                    <label htmlFor="checkout-phone" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2">EcoCash number</label>
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
                        className="w-full rounded-md border border-input bg-paper py-3 pl-9 pr-4 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/10"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Event questions */}
          {eventQuestions.length > 0 && (
            <div className="rounded-[1.25rem] border border-line-2 bg-paper p-5 md:p-7">
              <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">A few quick questions</h2>
              <p className="mb-4 text-[12px] text-ink-3">The organiser would like to know a bit more about you.</p>

              <div className="space-y-3.5">
                {eventQuestions.map((q) => (
                  <div key={q.id}>
                    <label htmlFor={`checkout-question-${q.id}`} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2">
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
                      className="w-full rounded-md border border-input bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/10"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment method — hidden for free orders */}
          {!isFree && <div className="rounded-[1.25rem] border border-line-2 bg-paper p-5 md:p-7">
            <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">Choose how to pay</h2>
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
                        ? "border-cta bg-brand-50 ring-1 ring-cta/20"
                        : "border-line-2 bg-paper hover:border-ink/40 hover:bg-paper-2"
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
                      checked ? "bg-cta text-chrome" : "bg-paper-3 text-ink-2"
                    }`}>
                      <Icon size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
                        {label}
                        {isEcoCash && (
                          <span className="tp-fast-badge inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent ring-1 ring-cta/25">
                            Fast
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-ink-3">{body}</p>
                    </div>
                    {checked && <Check size={14} className="shrink-0 text-cta" />}
                  </label>
                )
              })}
            </div>
          </div>}

          {/* Error state */}
          {currentQuote && (
            <div role="status" className="rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm">
              <p className="font-semibold">Review your payment: {formatCurrency(currentQuote.amount, currentQuote.currency)}</p>
              <p className="mt-1">Ticket price {formatCurrency(currentQuote.subtotal, currentQuote.currency)} + gateway fees {formatCurrency(currentQuote.gatewayFee, currentQuote.currency)}.</p>
              {!isFree && form.payment === "velocity-ecocash" && <p className="mt-1">Approval prompt goes to {currentQuote.normalizedPhone}. Check this number before paying.</p>}
              {!isFree && <p className="mt-1 text-xs text-ink-2">Gateway fees are included in the total shown above.</p>}
            </div>
          )}
          {submitError && (
            <div role="alert" className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1">
              <p>{submitError}</p>
              {errorOrderId && (
                <Link
                  href={"/orders/" + errorOrderId + orderOwnerQuery(errorOrderId)}
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-cta px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.12em] text-chrome shadow-sm transition hover:bg-cta-hover active:scale-[0.99] disabled:opacity-80 lg:hidden"
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Processing…</>
            ) : !currentQuote ? (
                <>Review order <ArrowRight size={14} /></>
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
          <div className="rounded-[1.25rem] border border-line-2 bg-paper p-5 shadow-[0_12px_35px_-28px_rgba(10,37,64,0.45)] lg:sticky lg:top-8 md:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-line-2 pb-5">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">Order summary</h2>
                <p className="mt-1 text-[12px] text-ink-3">{lineCount} {lineCount === 1 ? "ticket" : "tickets"}</p>
              </div>
              <span className="font-display text-[32px] font-black leading-none tracking-[-0.04em] text-ink">{formatCurrency(finalTotal, firstCurrency)}</span>
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
                    {formatCurrency((line.kind === "ticket" ? currentQuote?.lines?.find(item => item.tierId === line.tierId)?.unitPrice ?? line.price : line.price) * line.qty, line.currency)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Price and gateway fee are shown before the buyer submits payment. */}
            <div className="pt-3.5 border-t border-line space-y-2">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink-2">{items.every(item => item.kind === "ticket") ? "Ticket price" : "Items subtotal"}</span>
                <span>{formatCurrency(displayedSubtotal, firstCurrency)}</span>
              </div>
              {finalTotal > 0 && <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink-2">Gateway fees</span>
                <span>{formatCurrency(displayedGatewayFee, firstCurrency)}</span>
              </div>}
              {Object.entries(totalsByCurrency).map(([cur, total]) => {
                const lineTotal = currentQuote?.currency === cur ? currentQuote.amount : cur === firstCurrency ? finalTotal : total + calculateGatewayFee(total)
                return (
                  <div key={cur} className="flex items-baseline justify-between">
                    <span className="text-[13px] text-ink-2">Total · {cur}</span>
                    <span className="text-[20px] font-bold tracking-tight text-ink">
                      {formatCurrency(lineTotal, cur)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Desktop CTA */}
            <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
              By placing your order, you agree to our <Link href="/legal/terms" className="font-semibold text-ink underline underline-offset-4">Terms of Service</Link>.
              {" "}Read our <Link href="/legal/privacy" className="font-semibold text-ink underline underline-offset-4">Privacy Policy</Link> for how we use your information.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 hidden w-full items-center justify-center gap-2 rounded-sm bg-cta px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.12em] text-chrome shadow-sm transition hover:bg-cta-hover active:scale-[0.99] disabled:opacity-80 lg:inline-flex"
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Processing…</>
              ) : !currentQuote ? (
                <>Review order <ArrowRight size={14} /></>
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

function getAnalyticsSessionId() {
  const key = "tp_analytics_session"
  let existing: string | null = null
  try { existing = sessionStorage.getItem(key) } catch { /* storage optional */ }
  if (existing) return existing
  const created = crypto.randomUUID()
  try { sessionStorage.setItem(key, created) } catch { /* storage optional */ }
  return created
}

function PaymentWaitingOverlay({
  method, phone, orderId, message, onCancel,
}: { method: string; phone: string; orderId: string; message?: string | null; onCancel: () => void }) {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialog.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  const isCard = method === "velocity-card"
  const [timeLeftMs, setTimeLeftMs] = useState<number>(POLL_TIMEOUT_MS)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onCancel])

  useEffect(() => {
    const key = `poll_started:${orderId}`
    let stored: string | null = null
    try { stored = sessionStorage.getItem(key) } catch { /* storage optional */ }
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-chrome/95 backdrop-blur-sm px-4">
      <div role="dialog" aria-modal="true" aria-label="Payment confirmation" tabIndex={-1} ref={dialog} onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const nodes = dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
        if (!nodes?.length) { event.preventDefault(); return }
        const first = nodes[0], last = nodes[nodes.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }} className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto py-4 text-center">
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
          {isCard ? "Checking card payment" : "Check your phone"}
        </h2>
        <p className="mt-3 text-[15px] text-white/60 leading-relaxed max-w-xs mx-auto">
          {isCard
            ? "Your order is recorded. Open your order or contact support if the hosted payment page did not open."
            : <>Approve the EcoCash prompt sent to{" "}<span className="font-semibold text-white">{phone}</span></>
          }
        </p>

        <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] text-white/70">
          <Loader2 size={13} className="animate-spin text-white/50" />
          Waiting for confirmation…
        </div>

        <p role="status" className="mt-4 text-sm text-white/70">{message ?? "Your payment can continue if you leave this page. Please do not pay again."}</p>
        <a href={"https://wa.me/263788689923?text=" + encodeURIComponent("Please help with payment " + orderId)} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-white underline">WhatsApp support</a>
        {isLow && !isCard && (
          <div className="mt-4 rounded-xl bg-amber-500/15 border border-amber-400/20 px-4 py-3">
            <p className="text-[13px] font-semibold text-amber-300">
              We’ll keep this screen open for {countdownLabel}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-8 text-[12px] text-white/30 hover:text-white/60 transition-colors underline underline-offset-4"
        >
          View order · keep checking
        </button>
      </div>
    </div>
  )
}

function safeSessionRemove(key: string) { try { sessionStorage.removeItem(key) } catch { /* storage optional */ } }
