"use client"
import { Suspense } from "react"
import { useEffect, useState, useRef, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useCart, type OrderRecord, type CartLine } from "@/lib/cart-context"
import { useOrderTickets } from "@/lib/use-order-tickets"
import { orderAccessSignatureFor, orderAuthHeaders, orderOwnerQuery, rememberOrderAccess } from "@/lib/order-auth-client"
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, SUPPORT_WHATSAPP, isOrderPaid, paymentMethodLabel } from "@/lib/order-labels"
import { formatCurrency } from "@/lib/utils"
import {
  ArrowLeft, ArrowUpRight, Calendar, CalendarPlus, Clock, Mail, MapPin, Smartphone, Download, Printer, Loader2, Search, Send,
  RefreshCw, ArrowRightLeft, X, CheckCircle, Wallet, Share2, RotateCcw, Maximize2, MessageCircle,
} from "lucide-react"
import QrCode from "@/components/QrCode"
import AnimatedCheck from "@/components/AnimatedCheck"
import Confetti from "@/components/Confetti"
import Button from "@/components/ui/Button"

// How long to poll after a card payment return before giving up (ms)
const CARD_POLL_TIMEOUT_MS = 5 * 60 * 1000
const CARD_POLL_INTERVAL_MS = 4_000
const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000
const TIME_ZONE = "Africa/Harare"

function formatEventDate(iso: string | undefined) {
  if (!iso) return null
  return new Intl.DateTimeFormat("en-ZW", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE }).format(new Date(iso))
}

function formatEventTime(start: string | undefined, end: string | undefined) {
  if (!start) return null
  const fmt = new Intl.DateTimeFormat("en-ZW", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE })
  return end ? `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}` : fmt.format(new Date(start))
}

function calendarUrl(line: CartLine | undefined, orderId: string) {
  if (!line?.eventStartsAt) return null
  const start = new Date(line.eventStartsAt)
  const end = line.eventEndsAt ? new Date(line.eventEndsAt) : new Date(start.getTime() + 3 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "")
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: line.eventTitle,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: line.eventVenue ?? "",
    details: `Order ${orderId} · TicketPulse`,
  })
  return `https://www.google.com/calendar/render?${params.toString()}`
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-5 py-20"><div className="h-8 w-40 bg-paper-2 rounded animate-pulse" /></div>}>
      <OrderDetailInner params={params} />
    </Suspense>
  )
}

function OrderDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const welcomeFlag = searchParams.get("welcome") === "1"
  const cardCancelled = searchParams.get("error") === "cancelled"
  const urlSignature = searchParams.get("sig")
  const { ready, getOrder, saveOrder, restoreItems } = useCart()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [fetching, setFetching] = useState(true)
  const [resendingTickets, setResendingTickets] = useState(false)
  const [resendTicketNote, setResendTicketNote] = useState<string | null>(null)
  const [resendingWA, setResendingWA] = useState(false)
  const [resendWANote, setResendWANote] = useState<string | null>(null)
  const [pollingForCard, setPollingForCard] = useState(false)
  // Captured once per visit; decides refund/review/transfer eligibility.
  const [now] = useState(() => Date.now())
  const [enlargedQr, setEnlargedQr] = useState<{ value: string; label: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orderStatus = order?.status
  const ticketsEnabled = isOrderPaid(order?.status)
  const accessSignature = ready ? orderAccessSignatureFor(id, urlSignature) : urlSignature
  const { qrByTier, recordsByTier, loading: ticketsLoading } = useOrderTickets(id, ticketsEnabled, accessSignature)
  const [transferStates, setTransferStates] = useState<Record<string, {
    open: boolean; name: string; email: string; submitting: boolean; note: string | null; done: boolean
  }>>({})

  function getTransfer(ticketId: string) {
    return transferStates[ticketId] ?? { open: false, name: "", email: "", submitting: false, note: null, done: false }
  }
  function setTransfer(ticketId: string, patch: Partial<typeof transferStates[string]>) {
    setTransferStates((s) => ({ ...s, [ticketId]: { ...getTransfer(ticketId), ...patch } }))
  }

  async function submitTransfer(ticketId: string) {
    const t = getTransfer(ticketId)
    if (!t.name.trim() || !t.email.trim()) return
    setTransfer(ticketId, { submitting: true, note: null })
    try {
      const res = await fetch(`/api/tickets/${ticketId}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json", ...orderAuthHeaders(id, accessSignature) },
        body: JSON.stringify({ recipientName: t.name, recipientEmail: t.email, orderId: id }),
      })
      const data = await res.json()
      if (!res.ok) setTransfer(ticketId, { submitting: false, note: data.error ?? "Transfer failed" })
      else setTransfer(ticketId, { submitting: false, done: true, note: `Transfer email sent to ${t.email}` })
    } catch {
      setTransfer(ticketId, { submitting: false, note: "Something went wrong. Please try again." })
    }
  }

  async function cancelTransfer(ticketId: string) {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/transfer`, {
        method: "DELETE",
        headers: orderAuthHeaders(id, accessSignature),
      })
      if (!res.ok) {
        setTransfer(ticketId, { note: "Couldn't cancel the transfer. Please try again." })
        return
      }
      setTransfer(ticketId, { open: false, done: false, note: null, name: "", email: "" })
    } catch {
      setTransfer(ticketId, { note: "Couldn't cancel the transfer. Please try again." })
    }
  }

  // Load the order: show the copy saved on this device straight away, then
  // refresh from the server so statuses (paid, refunded…) are never stale.
  useEffect(() => {
    if (!ready) return
    if (urlSignature) rememberOrderAccess(id, urlSignature)

    const local = getOrder(id)
    const hasLocal = !!local && local.items.length > 0
    if (hasLocal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrates the order detail view from persisted checkout state.
      setOrder(local)
      setFetching(false)
    }

    const controller = new AbortController()
    fetch(`/api/orders/${id}/data`, { headers: orderAuthHeaders(id, urlSignature), signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OrderRecord | null) => {
        if (data && (data.items.length > 0 || !hasLocal)) {
          setOrder(data)
          saveOrder(data)
        }
        setFetching(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetching(false)
      })
    return () => controller.abort()
  }, [ready, id, getOrder, saveOrder, urlSignature])

  // Card payment recovery polling:
  // After a Velocity card redirect, the checkout page is gone and its polling
  // loop died. We restart a short poll here so the order flips to paid without
  // the user having to wait for the cron job.
  useEffect(() => {
    if (!welcomeFlag || cardCancelled || !orderStatus) return
    if (orderStatus !== "pending") return

    const startedAt = Date.now()
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts the visible recovery state for a returned card payment.
    setPollingForCard(true)

    const poll = async () => {
      if (cancelled) return
      if (Date.now() - startedAt > CARD_POLL_TIMEOUT_MS) {
        setPollingForCard(false)
        return
      }
      try {
        const res = await fetch(`/api/checkout/velocity/status/${id}`, {
          cache: "no-store",
          headers: orderAuthHeaders(id, accessSignature),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.paid) {
            setPollingForCard(false)
            // Re-fetch the order from the server to get the updated status
            const fresh = await fetch(`/api/orders/${id}/data`, { headers: orderAuthHeaders(id, accessSignature) })
            if (fresh.ok) {
              const updated: OrderRecord = await fresh.json()
              setOrder(updated)
              saveOrder(updated)
            }
            return
          } else if (["expired", "cancelled"].includes(data.status)) {
            setPollingForCard(false)
            setOrder((current) => current ? { ...current, status: "expired" } : current)
            return
          }
        }
      } catch {
        // silently continue polling
      }
      if (!cancelled) pollRef.current = setTimeout(poll, CARD_POLL_INTERVAL_MS)
    }

    pollRef.current = setTimeout(poll, CARD_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [welcomeFlag, cardCancelled, orderStatus, id, saveOrder, accessSignature])

  async function resendTickets() {
    if (resendingTickets) return
    setResendingTickets(true)
    setResendTicketNote(null)
    try {
      const res = await fetch(`/api/orders/${id}/resend-tickets`, { method: "POST", headers: orderAuthHeaders(id, accessSignature) })
      if (res.status === 429) setResendTicketNote("Please wait a moment before resending.")
      else if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Couldn't resend. Try again shortly." }))
        setResendTicketNote(body.error ?? "Couldn't resend. Try again shortly.")
      } else {
        setResendTicketNote("Sent! Check your inbox.")
      }
    } catch {
      setResendTicketNote("Couldn't resend. Try again shortly.")
    } finally {
      setResendingTickets(false)
    }
  }

  async function resendWhatsApp() {
    if (resendingWA) return
    setResendingWA(true)
    setResendWANote(null)
    try {
      const res = await fetch("/api/whatsapp/send-ticket", {
        method: "POST",
        headers: { "content-type": "application/json", ...orderAuthHeaders(id, accessSignature) },
        body: JSON.stringify({ orderId: id, mode: "manual_resend" }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setResendWANote(body.error ?? "Couldn't send. Try again shortly.")
      else setResendWANote("Sent to WhatsApp!")
    } catch {
      setResendWANote("Couldn't send. Try again shortly.")
    } finally {
      setResendingWA(false)
    }
  }

  // Put an unpaid order's lines back in the cart and reopen checkout.
  function tryAgain() {
    if (!order) return
    restoreItems(order.items)
    const slug = order.items[0]?.eventSlug
    router.push(slug ? `/checkout?event=${encodeURIComponent(slug)}` : "/cart")
  }

  if (!ready || (fetching && !order)) {
    return (
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-40 bg-paper-2 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 text-center">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-paper-2 ring-1 ring-line mb-5">
          <Search size={22} className="text-ink-3" />
        </div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">We can&apos;t open this order here</h1>
        <p className="mt-2 text-[15px] text-ink-2 max-w-md mx-auto">
          For your security, orders only open from the link in your confirmation email or on the device you bought on.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button href="/orders/lookup" size="lg">
            <Mail size={14} /> Email me my ticket links
          </Button>
          <Button href="/orders" variant="secondary" size="lg">
            <ArrowLeft size={14} /> Saved orders
          </Button>
        </div>
      </div>
    )
  }

  const tickets = order.items.filter((i) => i.kind === "ticket")
  const firstLine = order.items[0]
  const eventTitle = firstLine?.eventTitle ?? "Your event"
  const eventStartsAt = firstLine?.eventStartsAt
  const eventDate = formatEventDate(eventStartsAt)
  const eventTime = formatEventTime(eventStartsAt, firstLine?.eventEndsAt)
  const eventVenue = firstLine?.eventVenue
  const eventStarted = eventStartsAt ? new Date(eventStartsAt).getTime() <= now : false
  const canRequestRefund = ticketsEnabled && !!eventStartsAt && new Date(eventStartsAt).getTime() - now > REFUND_WINDOW_MS
  const isUnpaid = order.status === "pending" || order.status === "expired"
  const showWelcome = welcomeFlag && ticketsEnabled
  const calUrl = calendarUrl(firstLine, order.id)
  const orderQuery = orderOwnerQuery(order.id, accessSignature)
  const refundMessage = `Hi TicketPulse, I'd like a refund for order ${order.id} (${eventTitle}).`

  const shareEvent = async () => {
    const url = firstLine?.eventSlug ? `${window.location.origin}/events/${firstLine.eventSlug}` : `${window.location.origin}/events`
    const data = { title: `I'm going to ${eventTitle}`, text: `I'm going to ${eventTitle}. Get your ticket on TicketPulse:`, url }
    if (navigator.share) {
      try { await navigator.share(data) } catch { /* dismissed */ }
    } else {
      try { await navigator.clipboard.writeText(`${data.text} ${url}`) } catch { /* clipboard blocked */ }
    }
  }

  return (
    <div>
      {showWelcome && <Confetti count={70} />}

      {/* Card payment confirmation banner — shows while polling after Velocity redirect */}
      {pollingForCard && (
        <div role="status" className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-5 py-3 flex items-center justify-center gap-3">
          <RefreshCw size={14} className="text-amber-600 animate-spin shrink-0" />
          <p className="text-[13px] font-medium text-amber-800">
            Confirming your card payment. This usually takes a few seconds.
          </p>
        </div>
      )}

      {isUnpaid && !pollingForCard && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <p className="text-[13px] font-medium text-amber-900">
              {cardCancelled
                ? "Your card payment was cancelled. No money was taken and no tickets were issued."
                : order.status === "expired"
                ? "This payment wasn't completed, so no tickets were issued. If money was deducted, WhatsApp us with this order number before paying again."
                : "We're still waiting for this payment. Please don't pay again. Tickets are sent automatically once it's confirmed."}
            </p>
            {(cardCancelled || order.status === "expired") && (
              <Button type="button" onClick={tryAgain} size="sm" className="shrink-0">
                <RotateCcw size={13} /> Try again
              </Button>
            )}
          </div>
        </div>
      )}

      {showWelcome ? (
        <section className="relative overflow-hidden border-b border-line">
          <div className="absolute inset-0 -z-10 tp-success-wash" />
          <div className="max-w-3xl mx-auto px-5 md:px-8 pt-12 md:pt-16 pb-10 md:pb-12 text-center">
            <div className="mb-5 tp-pop-in flex justify-center">
              <AnimatedCheck size={64} />
            </div>
            <p className="tp-pop-in tp-pop-in-1 text-[11px] font-semibold tracking-[0.18em] text-ink-3 uppercase">Order confirmed</p>
            <h1 className="tp-pop-in tp-pop-in-2 mt-2 text-[30px] md:text-[42px] font-bold tracking-[-0.02em] leading-[1.05] text-ink">
              You&apos;re going to {eventTitle}!
            </h1>
            <p className="tp-pop-in tp-pop-in-3 mt-3 text-[15px] text-ink-2 max-w-lg mx-auto leading-relaxed">
              Your tickets are below and on their way to <span className="font-semibold text-ink">{order.contact.email}</span>.
              Show the QR code at the gate.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {calUrl && (
                <Button href={calUrl} variant="secondary" size="md" target="_blank" rel="noopener noreferrer">
                  <CalendarPlus size={14} /> Add to calendar
                </Button>
              )}
              <Button type="button" variant="secondary" size="md" onClick={shareEvent}>
                <Share2 size={14} /> Tell friends
              </Button>
              <Button href={`/orders/${order.id}/print${orderQuery ? `${orderQuery}&` : "?"}auto=1`} variant="secondary" size="md">
                <Download size={14} /> Save as PDF
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="border-b border-line bg-paper-2">
          <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-12">
            <Link href="/orders" className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors mb-3">
              <ArrowLeft size={13} /> My tickets
            </Link>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_TONE[order.status]}`}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                  <span className="font-mono text-[11px] text-ink-3">Order {order.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-tight text-ink">{eventTitle}</h1>
                {eventDate && <p className="mt-1.5 text-[14px] text-ink-2">{eventDate}{eventTime ? ` · ${eventTime}` : ""}</p>}
              </div>
              {ticketsEnabled && (
                <div className="flex flex-wrap gap-2">
                  <Button href={`/orders/${order.id}/print${orderQuery}`} variant="secondary" size="md">
                    <Printer size={14} /> Print
                  </Button>
                  <Button href={`/orders/${order.id}/print${orderQuery ? `${orderQuery}&` : "?"}auto=1`} size="md">
                    <Download size={14} /> Save as PDF
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 grid lg:grid-cols-[1.5fr_1fr] gap-8 md:gap-10">
        {/* Tickets */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Tickets</p>
          <h2 className="text-[20px] font-bold tracking-tight text-ink mb-5">{ticketsEnabled ? "Show this at the gate" : "Your tickets"}</h2>

          {!ticketsEnabled ? (
            <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-8 text-center text-[14px] text-ink-2">
              {order.status === "refunded"
                ? "This order was refunded, so its tickets are no longer valid."
                : order.status === "pending"
                ? "Your tickets will appear here as soon as the payment is confirmed."
                : "No tickets were issued for this order."}
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-8 text-center text-sm text-ink-2">
                  No ticketable items in this order.
                </div>
              )}
              {tickets.map((line) => (
                line.kind === "ticket" ? Array.from({ length: line.qty }).map((_, i) => {
                  const qrValue = qrByTier.get(line.tierId)?.[i]
                  const ticketRecord = recordsByTier.get(line.tierId)?.[i]
                  const ticketId = ticketRecord?.id
                  const isTransferred = !!ticketRecord?.transferredAt
                  const isPending = !!ticketRecord?.transferToEmail && !isTransferred
                  const holderName = ticketRecord?.holderName
                  const ts = ticketId ? getTransfer(ticketId) : null
                  const ticketLabel = `${line.tierName} · ticket ${i + 1} of ${line.qty}`

                  return (
                  <div key={`${line.key}-${i}`} className="relative rounded-2xl border border-line bg-paper overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-stretch">
                      <div className="flex-1 p-5 md:p-6 min-w-0">
                        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Ticket {i + 1} of {line.qty}</p>
                        <p className="mt-1.5 text-[15px] font-semibold tracking-tight text-ink line-clamp-1">{line.eventTitle}</p>
                        <p className="text-[13px] text-ink-2">{line.tierName}</p>
                        {holderName && (
                          <p className="mt-1 text-[12px] text-emerald-700 font-medium">Holder: {holderName}</p>
                        )}
                        <div className="mt-3 space-y-1 text-[13px] text-ink-3">
                          {eventDate && <p className="flex items-center gap-1.5"><Calendar size={12} aria-hidden /> {eventDate}</p>}
                          {eventTime && <p className="flex items-center gap-1.5"><Clock size={12} aria-hidden /> {eventTime}</p>}
                          {eventVenue && <p className="flex items-center gap-1.5"><MapPin size={12} aria-hidden /> <span className="line-clamp-1">{eventVenue}</span></p>}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <Link href={`/events/${line.eventSlug}`} className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-navy hover:gap-1.5 transition-all">
                            View event <ArrowUpRight size={12} />
                          </Link>
                          {eventStarted && (
                            <Link
                              href={`/reviews/new?event=${encodeURIComponent(line.eventSlug)}&order=${encodeURIComponent(order.id)}&name=${encodeURIComponent(order.contact.name)}&email=${encodeURIComponent(order.contact.email)}`}
                              className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-green-700 hover:gap-1.5 transition-all"
                            >
                              Leave a review <ArrowUpRight size={12} />
                            </Link>
                          )}
                        </div>

                        {/* Transfer section */}
                        {ticketId && !isTransferred && !eventStarted && (
                          <div className="mt-4 pt-4 border-t border-line">
                            {isPending && !ts?.done ? (
                              <div className="space-y-1.5">
                                <p className="text-[12px] text-amber-700 font-medium">
                                  Transfer pending: waiting for {ticketRecord.transferToName} to accept
                                </p>
                                <button
                                  type="button"
                                  onClick={() => cancelTransfer(ticketId)}
                                  className="min-h-9 text-[12px] text-ink-3 underline hover:text-red-500 transition"
                                >
                                  Cancel transfer
                                </button>
                                {ts?.note && <p role="alert" className="text-[12px] text-red-600">{ts.note}</p>}
                              </div>
                            ) : ts?.done ? (
                              <p className="text-[12px] text-green-700 font-medium inline-flex items-center gap-1.5">
                                <CheckCircle size={13} /> {ts.note}
                              </p>
                            ) : ts?.open ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[12px] font-semibold text-ink">Send this ticket to someone else</p>
                                  <button
                                    type="button"
                                    onClick={() => setTransfer(ticketId, { open: false })}
                                    aria-label="Close transfer form"
                                    className="-mr-2 inline-flex h-9 w-9 items-center justify-center text-ink-3 hover:text-ink transition"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                <label className="sr-only" htmlFor={`transfer-name-${ticketId}`}>Recipient name</label>
                                <input
                                  id={`transfer-name-${ticketId}`}
                                  type="text"
                                  placeholder="Recipient name"
                                  autoComplete="off"
                                  value={ts.name}
                                  onChange={(e) => setTransfer(ticketId, { name: e.target.value })}
                                  className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
                                />
                                <label className="sr-only" htmlFor={`transfer-email-${ticketId}`}>Recipient email</label>
                                <input
                                  id={`transfer-email-${ticketId}`}
                                  type="email"
                                  placeholder="Recipient email"
                                  autoComplete="off"
                                  value={ts.email}
                                  onChange={(e) => setTransfer(ticketId, { email: e.target.value })}
                                  className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
                                />
                                <p className="text-[11px] text-ink-3">Your QR code stops working once they accept.</p>
                                <button
                                  type="button"
                                  onClick={() => submitTransfer(ticketId)}
                                  disabled={ts.submitting || !ts.name.trim() || !ts.email.trim()}
                                  className="w-full min-h-11 inline-flex items-center justify-center gap-1.5 rounded-sm bg-navy px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-navy/90 disabled:opacity-50 transition"
                                >
                                  {ts.submitting ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={13} />}
                                  {ts.submitting ? "Sending…" : "Send transfer"}
                                </button>
                                {ts.note && (
                                  <p role="alert" className="text-[12px] text-red-600">{ts.note}</p>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setTransfer(ticketId, { open: true })}
                                className="inline-flex min-h-9 items-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-ink transition"
                              >
                                <ArrowRightLeft size={13} /> Transfer ticket
                              </button>
                            )}
                          </div>
                        )}

                        {isTransferred && (
                          <div className="mt-4 pt-4 border-t border-line">
                            <p className="text-[12px] text-ink-3 font-medium">
                              Transferred to {ticketRecord.holderName ?? "new holder"}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="relative hidden sm:flex items-center">
                        <span className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-paper-2 ring-1 ring-line" aria-hidden />
                        <span className="w-px h-full border-l-2 border-dashed border-line" aria-hidden />
                        <span className="absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-paper-2 ring-1 ring-line" aria-hidden />
                      </div>
                      <div className="border-t-2 border-dashed border-line sm:border-t-0 p-4 md:p-5 bg-paper-2 flex flex-col items-center justify-center gap-2">
                        {isTransferred ? (
                          <p className="flex h-[160px] w-[160px] items-center justify-center text-center text-[12px] text-ink-3 font-medium">Transferred</p>
                        ) : qrValue ? (
                          <button
                            type="button"
                            onClick={() => setEnlargedQr({ value: qrValue, label: ticketLabel })}
                            aria-label={`Show QR code full screen for ${ticketLabel}`}
                            className="group relative rounded-lg"
                          >
                            <QrCode value={qrValue} size={160} className="rounded-lg ring-1 ring-line" />
                            <span className="absolute bottom-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-paper/90 text-ink-2 shadow-sm ring-1 ring-line">
                              <Maximize2 size={13} aria-hidden />
                            </span>
                          </button>
                        ) : (
                          <div className="flex h-[160px] w-[160px] flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-paper p-3 text-center text-[11px] font-medium text-ink-3">
                            {ticketsLoading ? <><Loader2 size={14} className="animate-spin" /> Loading ticket…</> : "QR not available here. Use the ticket in your email."}
                          </div>
                        )}
                        <p className="text-[10px] font-mono text-ink-3 tabular-nums">
                          {order.id.slice(-6)}-{(i + 1).toString().padStart(2, "0")}
                        </p>
                      </div>
                    </div>
                  </div>
                  )
                }) : null
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <aside>
          <div className="sticky top-24 rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.04]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-semibold tracking-tight text-ink">Receipt</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_TONE[order.status]}`}>
                {ORDER_STATUS_LABEL[order.status]}
              </span>
            </div>

            <ul className="space-y-3 pb-5 border-b border-line">
              {order.items.map((line) => (
                <li key={line.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="font-medium text-ink line-clamp-1">
                      {line.kind === "ticket" ? line.tierName : line.kind === "merch" ? line.name : line.packageName}
                    </p>
                    <p className="text-ink-3 text-[12px]">×{line.qty}</p>
                  </div>
                  <span className="font-semibold tracking-tight text-ink whitespace-nowrap">
                    {formatCurrency(line.price * line.qty, line.currency)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="space-y-1 py-4">
              {Object.entries(order.totalsByCurrency).map(([cur, total]) => (
                <div key={cur} className="flex items-baseline justify-between">
                  <span className="text-[13px] text-ink-2">Total · {cur}</span>
                  <span className="text-[18px] font-bold tracking-tight text-ink">
                    {formatCurrency(total, cur)}
                  </span>
                </div>
              ))}
            </div>

            <dl className="space-y-2 pt-4 border-t border-line text-[13px]">
              <div className="flex items-center gap-2 text-ink-2"><Mail size={12} className="text-ink-3" aria-hidden /><dt className="sr-only">Email</dt><dd className="truncate">{order.contact.email}</dd></div>
              <div className="flex items-center gap-2 text-ink-2"><Wallet size={12} className="text-ink-3" aria-hidden /><dt className="sr-only">Paid with</dt><dd>{paymentMethodLabel(order.payment.method)}</dd></div>
              <div className="flex items-center gap-2 text-ink-2"><Calendar size={12} className="text-ink-3" aria-hidden /><dt className="sr-only">Ordered</dt><dd>Ordered {formatEventDate(order.createdAt)}</dd></div>
            </dl>

            {ticketsEnabled && (
              <div className="mt-4 pt-4 border-t border-line space-y-2">
                <button
                  type="button"
                  onClick={resendTickets}
                  disabled={resendingTickets}
                  className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-sm border border-line bg-paper px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink hover:border-line-2 hover:bg-paper-2 disabled:opacity-60 transition"
                >
                  {resendingTickets ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {resendingTickets ? "Sending…" : "Resend ticket email"}
                </button>
                {resendTicketNote && (
                  <p role="status" className={`text-[12px] text-center ${resendTicketNote.startsWith("Sent") ? "text-green-700" : "text-ink-3"}`}>
                    {resendTicketNote}
                  </p>
                )}
                {order.contact.phone && (
                  <>
                    <button
                      type="button"
                      onClick={resendWhatsApp}
                      disabled={resendingWA}
                      className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-sm border border-[#25D366] bg-[#25D366]/5 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#128C4A] hover:bg-[#25D366]/10 disabled:opacity-60 transition"
                    >
                      {resendingWA ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
                      {resendingWA ? "Sending…" : "Send PDF to WhatsApp"}
                    </button>
                    {resendWANote && (
                      <p role="status" className={`text-[12px] text-center ${resendWANote.startsWith("Sent") ? "text-green-700" : "text-ink-3"}`}>
                        {resendWANote}
                      </p>
                    )}
                  </>
                )}
                <WalletButtons orderId={order.id} signature={accessSignature} orderQuery={orderQuery} />

                {canRequestRefund && (
                  <a
                    href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(refundMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex min-h-11 items-center justify-center gap-1.5 text-[12px] font-medium text-ink-3 underline underline-offset-2 hover:text-ink"
                  >
                    <MessageCircle size={13} aria-hidden /> Can&apos;t make it? Request a refund
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {enlargedQr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={enlargedQr.label}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white p-6"
          onClick={() => setEnlargedQr(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setEnlargedQr(null) }}
        >
          <p className="text-center text-[14px] font-semibold text-ink">{eventTitle}</p>
          <QrCode value={enlargedQr.value} size={320} className="max-w-full h-auto" />
          <p className="text-center text-[13px] text-ink-2">{enlargedQr.label}</p>
          <p className="text-center text-[12px] text-ink-3">Turn your screen brightness up for scanning.</p>
          <button
            type="button"
            autoFocus
            onClick={() => setEnlargedQr(null)}
            className="min-h-11 rounded-sm border border-line px-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

function WalletButtons({ orderId, signature, orderQuery }: { orderId: string; signature?: string | null; orderQuery: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveGoogle() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/wallet/google`, { headers: orderAuthHeaders(orderId, signature) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Google Wallet isn't available right now."); return }
      window.open(data.url, "_blank")
    } catch {
      setError("Couldn't create the Google Wallet pass. Try again shortly.")
    } finally {
      setLoading(false)
    }
  }

  const cls = "flex-1 min-h-11 inline-flex items-center justify-center gap-1.5 rounded-sm border border-line bg-paper px-3 py-2 text-[12px] font-medium text-ink hover:border-line-2 disabled:opacity-60 transition"

  return (
    <div className="pt-1">
      <div className="flex gap-2">
        <a href={`/api/orders/${orderId}/wallet/apple${orderQuery}`} className={cls}>
          <Wallet size={13} /> Apple Wallet
        </a>
        <button type="button" onClick={saveGoogle} disabled={loading} className={cls}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
          Google Wallet
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-center text-[12px] text-ink-3">{error}</p>}
    </div>
  )
}
