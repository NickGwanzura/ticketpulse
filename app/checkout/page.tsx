"use client"
import Link from "next/link"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import CheckoutPaymentNotice from "@/app/checkout/CheckoutPaymentNotice"
import { useCart } from "@/lib/cart-context"
import { orderAuthHeaders, rememberOrderAccess } from "@/lib/order-auth-client"
import { formatCurrency } from "@/lib/utils"
import Button from "@/components/ui/Button"
import {
  ArrowRight, Lock, Smartphone, CreditCard, Mail, User, Phone, Loader2, Tag, Percent, ChevronLeft, Check, AlertTriangle,
} from "lucide-react"

type CheckoutResponse = {
  success: true
  paymentMethod: "CARD" | "ECOCASH" | "FREE"
  flow: "velocity-seamless" | "velocity-redirect" | "free"
  orderId: string
  accessSignature?: string
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
  { value: "velocity-ecocash", label: "EcoCash", body: "Mobile money · approve the prompt on your phone", icon: Smartphone },
  { value: "velocity-card",    label: "Visa / Mastercard", body: "Pay by card on a secure checkout page", icon: CreditCard },
]

// Messages for the `?error=` codes other pages send buyers back here with.
const RETURN_ERRORS: Record<string, string> = {
  not_found: "We couldn't find that payment. Nothing was charged for it. Please try again.",
  cancelled: "The card payment was cancelled. You can try again below.",
}

const POLL_INTERVAL_MS = 2000
// Must match POLL_TIMEOUT_MS in app/api/checkout/velocity/status/[id]/route.ts.
// Client uses slightly longer window to account for network latency on the final poll.
const POLL_TIMEOUT_MS = 5.5 * 60 * 1000

// Key prefix used to persist polling state across page refresh.
const POLL_SESSION_KEY = "polling"

const INPUT_CLASS = "w-full rounded-md border border-input bg-paper py-3 pl-9 pr-4 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/10"
const LABEL_CLASS = "mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2"

function clearPollingSession() {
  try {
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:orderId`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:name`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:email`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:phone`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:method`)
    sessionStorage.removeItem(`${POLL_SESSION_KEY}:event`)
  } catch { /* sessionStorage may be unavailable */ }
}

type PollingContact = { name: string; email: string; phone: string; method: string; eventSlug: string }

function savePollingSession(orderId: string, contact: PollingContact) {
  try {
    sessionStorage.setItem(`${POLL_SESSION_KEY}:orderId`, orderId)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:name`, contact.name)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:email`, contact.email)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:phone`, contact.phone)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:method`, contact.method)
    sessionStorage.setItem(`${POLL_SESSION_KEY}:event`, contact.eventSlug)
  } catch { /* sessionStorage may be unavailable */ }
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutInner />
    </Suspense>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-20">
      <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
      <div className="h-64 bg-paper-2 rounded-2xl animate-pulse" />
    </div>
  )
}

function CheckoutInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { items: cartItems, ready, placeOrder } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errorOrderId, setErrorOrderId] = useState<string | null>(null)
  const [pollingOrderId, setPollingOrderId] = useState<string | null>(null)
  const [pollNotice, setPollNotice] = useState<string | null>(null)
  const pollingContact = useRef<PollingContact | null>(null)
  // Render-safe copy of what the waiting overlay shows (refs can't be read during render).
  const [waitingFor, setWaitingFor] = useState<{ method: string; phone: string } | null>(null)

  // Checkout is scoped to one event: payments are per event, so a cart with
  // several events is paid one event at a time.
  const eventSlugs = useMemo(() => Array.from(new Set(cartItems.map((i) => i.eventSlug))), [cartItems])
  const requestedEvent = searchParams.get("event")
  const activeEvent = requestedEvent && eventSlugs.includes(requestedEvent)
    ? requestedEvent
    : eventSlugs.length === 1 ? eventSlugs[0] : null
  const items = useMemo(() => cartItems.filter((i) => i.eventSlug === activeEvent), [cartItems, activeEvent])
  const totalsByCurrency = useMemo(() => items.reduce<Record<string, number>>((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.price * i.qty
    return acc
  }, {}), [items])

  const returnError = searchParams.get("error")

  // ── Restore polling session after page refresh ───────────────────────────
  useEffect(() => {
    try {
      const savedOrderId = sessionStorage.getItem(`${POLL_SESSION_KEY}:orderId`)
      if (savedOrderId) {
        const name = sessionStorage.getItem(`${POLL_SESSION_KEY}:name`)
        const email = sessionStorage.getItem(`${POLL_SESSION_KEY}:email`)
        const phone = sessionStorage.getItem(`${POLL_SESSION_KEY}:phone`) ?? ""
        const method = sessionStorage.getItem(`${POLL_SESSION_KEY}:method`)
        const eventSlug = sessionStorage.getItem(`${POLL_SESSION_KEY}:event`) ?? ""
        if (name && email && method) {
          pollingContact.current = { name, email, phone, method, eventSlug }
          queueMicrotask(() => {
            setWaitingFor({ method, phone })
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
        const res = await fetch(statusEndpoint, {
          cache: "no-store",
          signal: controller.signal,
          headers: orderAuthHeaders(pollingOrderId),
        })
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
            contact.eventSlug || undefined,
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
          setPollNotice(null)
          setSubmitting(false)
          if (isExpired || data.pollStatus === "EVENT_ENDED") {
            router.replace(`/checkout/expired?ref=${pollingOrderId}`)
          } else {
            setSubmitError("Payment was cancelled or declined. Nothing was charged. Please try again.")
          }
          return
        }

        // Non-terminal problems are shown inside the waiting overlay, where
        // the buyer is looking, and polling continues.
        if (data.pollStatus === "UNKNOWN") {
          setPollNotice("We can't confirm your payment status yet. If money was deducted, your tickets will be sent once it's confirmed. Please don't pay again.")
        } else if (data.pollStatus === "ERROR") {
          setPollNotice("The payment provider is slow to respond. Your payment may still complete, and we're still checking.")
        } else {
          setPollNotice(null)
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

  // Fetch event questions once the event is known
  useEffect(() => {
    if (!ready || !activeEvent) return
    fetch(`/api/checkout/questions?eventSlug=${encodeURIComponent(activeEvent)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.questions) setEventQuestions(data.questions)
      })
      .catch(() => { /* questions are optional */ })
  }, [ready, activeEvent])

  if (!ready) return <CheckoutSkeleton />

  // An in-flight payment must keep its overlay even though the cart is empty
  // (e.g. after a refresh while waiting for EcoCash approval).
  if (cartItems.length === 0 && !pollingOrderId) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 text-center">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Nothing to check out yet</h1>
        <p className="mt-2 text-[15px] text-ink-2">Add tickets to your cart first.</p>
        <Button href="/events" size="lg" className="mt-6">
          Browse events <ArrowRight size={14} />
        </Button>
      </div>
    )
  }

  if (!activeEvent && !pollingOrderId) {
    const groups = eventSlugs.map((slug) => {
      const lines = cartItems.filter((i) => i.eventSlug === slug)
      return { slug, title: lines[0]?.eventTitle ?? slug, count: lines.reduce((s, i) => s + i.qty, 0) }
    })
    return (
      <div className="max-w-2xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Which event are you paying for?</h1>
        <p className="mt-2 text-[15px] text-ink-2">Each event is paid separately. Pick one to check out now; the rest stay in your cart.</p>
        <ul className="mt-6 space-y-3">
          {groups.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/checkout?event=${encodeURIComponent(g.slug)}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper p-5 transition hover:border-line-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">{g.title}</span>
                  <span className="text-[13px] text-ink-3">{g.count} {g.count === 1 ? "item" : "items"}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const lineCount = items.reduce((s, i) => s + i.qty, 0)
  const eventTitle = items[0]?.eventTitle ?? ""
  const otherEventCount = eventSlugs.length - 1

  // Compute the final total for the CTA label
  const firstCurrency = Object.keys(totalsByCurrency)[0] ?? "USD"
  const rawTotal = totalsByCurrency[firstCurrency] ?? 0
  const finalTotal = appliedPromo ? Math.max(0, rawTotal - appliedPromo.discount) : rawTotal
  const isFree = finalTotal === 0
  const isEcoCash = !isFree && form.payment === "velocity-ecocash"

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase()
    if (!code || !activeEvent || promoLoading) return
    setPromoLoading(true)
    setPromoError(null)
    try {
      const res = await fetch(`/api/checkout/validate-promo?eventSlug=${encodeURIComponent(activeEvent)}&code=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (data.valid) {
        const val = Number(data.value)
        const discount = data.type === "percent"
          ? Math.round(rawTotal * (val / 100) * 100) / 100
          : Math.min(val, rawTotal)
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || !activeEvent) return
    setSubmitError(null)
    setErrorOrderId(null)
    setSubmitting(true)

    const ticketLines = items.filter((i) => i.kind === "ticket")
    const merchLines = items.filter((i) => i.kind === "merch")
    const vendorAddonLines = items.filter((i) => i.kind === "vendor_addon")
    if (ticketLines.length === 0) {
      setSubmitError("Your order has no tickets. Add a ticket to continue.")
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
        eventSlug: activeEvent,
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
        headers: {
          "content-type": "application/json",
          "x-session-id": getAnalyticsSessionId(),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let errorMsg = "Checkout failed. Please try again."
        try {
          const errBody = await res.json()
          errorMsg = errBody.error ?? errorMsg
          // A recoverable failure still created an order: link to it so the
          // buyer can check its status instead of paying twice.
          if (errBody.orderId && errBody.accessSignature) {
            rememberOrderAccess(errBody.orderId, errBody.accessSignature)
            setErrorOrderId(errBody.orderId)
          }
        } catch { /* use default */ }
        throw new Error(errorMsg)
      }
      const data = (await res.json()) as CheckoutResponse
      rememberOrderAccess(data.orderId, data.accessSignature)

      const contactData: PollingContact = { name: form.name, email: form.email, phone: form.phone, method: form.payment, eventSlug: activeEvent }

      if (data.flow === "free") {
        placeOrder(
          { name: form.name, email: form.email, phone: form.phone },
          { method: "free" },
          data.orderId,
          "paid",
          activeEvent,
        )
        router.push(`/orders/${data.orderId}?welcome=1`)
        return
      }

      if (data.flow === "velocity-redirect" && data.redirectUrl) {
        // The order is recorded as pending; its lines leave the cart and are
        // restored from the order page if the card payment is cancelled.
        placeOrder(
          { name: form.name, email: form.email, phone: form.phone },
          { method: form.payment },
          data.orderId,
          "pending",
          activeEvent,
        )
        window.location.href = data.redirectUrl
        return
      }

      pollingContact.current = contactData
      savePollingSession(data.orderId, contactData)
      setWaitingFor({ method: contactData.method, phone: contactData.phone })
      setPollNotice(null)
      setPollingOrderId(data.orderId)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "We couldn't process your order. Please try again.",
      )
      setSubmitting(false)
    }
  }

  const payLabel = isFree
    ? <><Check size={14} /> Claim free tickets</>
    : form.payment === "velocity-card"
    ? <><CreditCard size={14} /> Pay {formatCurrency(finalTotal, firstCurrency)} by card</>
    : <><Smartphone size={14} /> Pay {formatCurrency(finalTotal, firstCurrency)} with EcoCash</>

  const payButtonClass = "inline-flex w-full items-center justify-center gap-2 rounded-sm bg-cta px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.12em] text-chrome shadow-sm transition hover:bg-cta-hover active:scale-[0.99] disabled:opacity-80"

  return (
    <div className="min-h-screen bg-paper text-ink">
      {pollingOrderId && (
        <PaymentWaitingOverlay
          method={waitingFor?.method ?? form.payment}
          phone={waitingFor?.phone ?? form.phone}
          orderId={pollingOrderId}
          notice={pollNotice}
          onStopWaiting={() => {
            const orderId = pollingOrderId
            clearPollingSession()
            setPollingOrderId(null)
            setPollNotice(null)
            setSubmitting(false)
            // Stopping the page's check does not cancel the EcoCash prompt:
            // approving it later still completes the order.
            setErrorOrderId(orderId)
            setSubmitError("We stopped waiting, but the EcoCash prompt on your phone may still be active. If you approve it, your payment will go through and your tickets will be sent. Check the order below before paying again.")
          }}
        />
      )}

      {/* Header */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto max-w-5xl px-5 pb-6 pt-8 md:px-8 md:pb-10 md:pt-12">
          <Link
            href="/cart"
            className="mb-5 inline-flex min-h-11 items-center gap-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
          >
            <ChevronLeft size={12} /> Back to cart
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-3">Checkout</p>
          <h1 className="mt-2 font-display text-[34px] font-black uppercase leading-[0.9] tracking-[-0.03em] text-ink md:text-[56px]">
            {eventTitle || "Your tickets"}
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-2">
            Add your details and choose how to pay. Your tickets arrive by email as soon as payment clears.
          </p>
          {otherEventCount > 0 && (
            <p className="mt-3 text-[13px] text-ink-3">
              You also have items for {otherEventCount} other {otherEventCount === 1 ? "event" : "events"} in your cart. They stay there for a separate checkout.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-5 py-8 md:px-8 md:py-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6">
        {/* Left: form fields */}
        <div className="space-y-5">
          {returnError && RETURN_ERRORS[returnError] && !submitError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
              <p>{RETURN_ERRORS[returnError]}</p>
            </div>
          )}

          {/* Contact */}
          <div className="rounded-[1.25rem] border border-line-2 bg-paper p-5 shadow-[0_12px_35px_-28px_rgba(10,37,64,0.45)] md:p-7">
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">Your details</h2>
            <p className="mb-5 text-[13px] text-ink-3">Where should we send your tickets?</p>

            <div className="space-y-3.5">
              <div>
                <label htmlFor="checkout-name" className={LABEL_CLASS}>Full name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                  <input
                    id="checkout-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tendai Moyo"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="checkout-email" className={LABEL_CLASS}>Email for your tickets</label>
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
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="checkout-phone" className={LABEL_CLASS}>
                    {isEcoCash ? "EcoCash number" : <>WhatsApp number <span className="font-medium normal-case tracking-normal text-ink-3">(optional)</span></>}
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                    <input
                      id="checkout-phone"
                      type="tel"
                      required={isEcoCash}
                      autoComplete="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="077 123 4567"
                      aria-describedby="checkout-phone-hint"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <p id="checkout-phone-hint" className="mt-1 text-[11px] text-ink-3">
                    {isEcoCash ? "The wallet that gets the payment prompt. We also send your tickets here on WhatsApp." : "Add it to get your tickets on WhatsApp too."}
                  </p>
                </div>
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
                    <label htmlFor={`checkout-question-${q.id}`} className={LABEL_CLASS}>
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
          {!isFree && (
            <fieldset className="rounded-[1.25rem] border border-line-2 bg-paper p-5 md:p-7">
              <legend className="sr-only">Payment method</legend>
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">Choose how to pay</h2>
              {form.payment === "velocity-ecocash" && <CheckoutPaymentNotice />}
              <div className="space-y-2">
                {PAYMENT_METHODS.map(({ value, label, body, icon: Icon }) => {
                  const checked = form.payment === value
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-cta/20 ${
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
                        <p className="text-[13px] font-semibold text-ink">{label}</p>
                        <p className="text-[12px] text-ink-3">{body}</p>
                      </div>
                      {checked && <Check size={14} className="shrink-0 text-cta" />}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {/* Error state */}
          {submitError && (
            <div role="alert" className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1">
              <p>{submitError}</p>
              {errorOrderId && (
                <Link
                  href={`/orders/${errorOrderId}?welcome=1`}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-red-800 transition-colors"
                >
                  Check order status <ArrowRight size={12} />
                </Link>
              )}
            </div>
          )}

          {/* Mobile CTA */}
          <div className="lg:hidden">
            <button type="submit" disabled={submitting} className={payButtonClass}>
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : payLabel}
            </button>
            <TermsNote />
          </div>
        </div>

        {/* Right: order summary */}
        <aside className="order-first lg:order-none">
          <div className="rounded-[1.25rem] border border-line-2 bg-paper p-5 shadow-[0_12px_35px_-28px_rgba(10,37,64,0.45)] lg:sticky lg:top-8 md:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-line-2 pb-5">
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-3">Order summary</h2>
                <p className="mt-1 text-[12px] text-ink-3">{lineCount} {lineCount === 1 ? "item" : "items"}</p>
              </div>
              <span className="font-display text-[32px] font-black leading-none tracking-[-0.04em] text-ink">{formatCurrency(finalTotal, firstCurrency)}</span>
            </div>

            <ul className="space-y-2.5 my-4 max-h-64 overflow-y-auto">
              {items.map((line) => (
                <li key={line.key} className="flex items-start gap-3 text-[13px]">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-line-2 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium tracking-tight text-ink line-clamp-1">
                      {line.kind === "ticket" ? line.tierName
                        : line.kind === "merch" ? line.name
                        : `${line.vendorName} · ${line.packageName}`}
                    </p>
                    <p className="text-ink-3 text-[12px]">×{line.qty}</p>
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
                      className="min-h-9 px-1 text-[12px] text-ink-3 hover:text-red-500 transition"
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
                    <label htmlFor="checkout-promo" className="sr-only">Promo code</label>
                    <input
                      id="checkout-promo"
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        // Enter would otherwise submit the whole form and start the payment.
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void applyPromo()
                        }
                      }}
                      placeholder="Promo code"
                      autoComplete="off"
                      className="flex-1 min-w-0 rounded-lg border border-line bg-paper px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    />
                    <button
                      type="button"
                      disabled={promoLoading || !promoInput.trim()}
                      onClick={() => void applyPromo()}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-paper-2 border border-line px-3 py-2.5 text-[12px] font-semibold text-ink hover:bg-paper hover:border-line-2 active:scale-[0.99] transition disabled:opacity-50"
                    >
                      {promoLoading ? <Loader2 size={12} className="animate-spin" /> : <Percent size={12} />}
                      Apply
                    </button>
                  </div>
                  {promoError && <p role="alert" className="text-[12px] text-red-600">{promoError}</p>}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="pt-3.5 border-t border-line space-y-1">
              {Object.entries(totalsByCurrency).map(([cur, total]) => {
                const lineTotal = appliedPromo && cur === firstCurrency ? Math.max(0, total - appliedPromo.discount) : total
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
            <div className="mt-5 hidden lg:block">
              <button type="submit" disabled={submitting} className={payButtonClass}>
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : payLabel}
              </button>
              <TermsNote />
            </div>

            <p className="mt-3 text-[11px] text-ink-3 text-center inline-flex items-center justify-center gap-1.5 w-full">
              <Lock size={10} /> Payments processed securely. Card details never touch TicketPulse.
            </p>
          </div>
        </aside>
      </form>
    </div>
  )
}

function TermsNote() {
  return (
    <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ink-3">
      By paying you agree to the <Link href="/legal/terms" className="underline underline-offset-2 hover:text-ink">terms</Link>.
      Full refunds up to 24 hours before the event.
    </p>
  )
}

function getAnalyticsSessionId() {
  const key = "tp_analytics_session"
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  sessionStorage.setItem(key, created)
  return created
}

function PaymentWaitingOverlay({
  method, phone, orderId, notice, onStopWaiting,
}: { method: string; phone: string; orderId: string; notice: string | null; onStopWaiting: () => void }) {
  const isCard = method === "velocity-card"
  const [timeLeftMs, setTimeLeftMs] = useState<number>(POLL_TIMEOUT_MS)
  const [confirmingStop, setConfirmingStop] = useState(false)

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
    <div role="dialog" aria-modal="true" aria-labelledby="payment-waiting-title" className="fixed inset-0 z-50 flex items-center justify-center bg-chrome/95 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-sm text-center">
        {/* Pulse rings */}
        <div className="relative mx-auto mb-7 w-20 h-20">
          <span className="absolute inset-0 rounded-full bg-white/10 animate-ping motion-reduce:animate-none" style={{ animationDuration: "1.5s" }} />
          <span className="absolute inset-0 rounded-full bg-white/[0.07]" />
          <span className="relative z-10 inline-flex w-full h-full items-center justify-center rounded-full bg-white/15">
            {isCard ? <CreditCard size={30} className="text-white" /> : <Smartphone size={30} className="text-white" />}
          </span>
        </div>

        <p className="text-[11px] font-semibold tracking-[0.2em] text-white/50 uppercase mb-2">
          {isCard ? "Card payment" : "EcoCash"}
        </p>
        <h2 id="payment-waiting-title" className="text-[24px] font-bold text-white tracking-tight">
          {isCard ? "Confirming your card payment" : "Check your phone"}
        </h2>
        <p className="mt-3 text-[15px] text-white/70 leading-relaxed max-w-xs mx-auto">
          {isCard
            ? "This usually takes a few seconds. Keep this page open."
            : <>Approve the EcoCash prompt sent to{" "}<span className="font-semibold text-white">{phone}</span> and enter your PIN.</>
          }
        </p>

        <div role="status" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] text-white/75">
          <Loader2 size={13} className="animate-spin text-white/60" />
          Waiting for confirmation…
        </div>

        {notice && (
          <div role="alert" className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/15 px-4 py-3 text-left">
            <p className="text-[13px] leading-relaxed text-amber-200">{notice}</p>
          </div>
        )}

        {isLow && !isCard && !notice && (
          <div className="mt-4 rounded-xl bg-amber-500/15 border border-amber-400/20 px-4 py-3">
            <p className="text-[13px] font-semibold text-amber-300">
              Approve now — {countdownLabel} left
            </p>
          </div>
        )}

        {confirmingStop ? (
          <div className="mt-8 rounded-xl border border-white/15 bg-white/5 p-4 text-left">
            <p className="text-[13px] leading-relaxed text-white/80">
              Stopping only closes this screen. It can&apos;t cancel the prompt on your phone: if you approve it, you&apos;ll still be charged and get your tickets.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onStopWaiting}
                className="min-h-11 flex-1 rounded-lg bg-white/15 px-3 text-[13px] font-semibold text-white hover:bg-white/25 transition"
              >
                Stop waiting
              </button>
              <button
                type="button"
                onClick={() => setConfirmingStop(false)}
                className="min-h-11 flex-1 rounded-lg bg-white px-3 text-[13px] font-semibold text-chrome hover:bg-white/90 transition"
              >
                Keep waiting
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingStop(true)}
            className="mt-8 min-h-11 px-3 text-[12px] text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
          >
            Didn&apos;t get a prompt? Stop waiting
          </button>
        )}
      </div>
    </div>
  )
}
