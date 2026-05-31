"use client"
import { Suspense } from "react"
import { useEffect, useState, useRef, use } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { useOrderTickets } from "@/lib/use-order-tickets"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowLeft, ArrowUpRight, Calendar, Mail, Smartphone, Download, Printer, Loader2, Search, Send, RefreshCw } from "lucide-react"
import QrCode from "@/components/QrCode"

// How long to poll after a card payment return before giving up (ms)
const CARD_POLL_TIMEOUT_MS = 5 * 60 * 1000
const CARD_POLL_INTERVAL_MS = 4_000

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-5 py-20"><div className="h-8 w-40 bg-paper-2 rounded animate-pulse" /></div>}>
      <OrderDetailInner params={params} />
    </Suspense>
  )
}

function OrderDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const welcomeFlag = searchParams.get("welcome") === "1"
  const { ready, getOrder, placeOrder } = useCart()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [fetching, setFetching] = useState(false)
  const [resendingTickets, setResendingTickets] = useState(false)
  const [resendTicketNote, setResendTicketNote] = useState<string | null>(null)
  const [pollingForCard, setPollingForCard] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { qrByTier, loading: ticketsLoading } = useOrderTickets(id, order?.status === "paid")

  useEffect(() => {
    if (!ready) return

    // Try localStorage first
    const local = getOrder(id)
    if (local) {
      setOrder(local)
      return
    }

    // Fall back to server-side API
    setFetching(true)
    fetch(`/api/orders/${id}/data`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: OrderRecord | null) => {
        setOrder(data)
        setFetching(false)
      })
      .catch(() => setFetching(false))
  }, [ready, id, getOrder])

  // Card payment recovery polling:
  // After a Velocity card redirect, the checkout page is gone and its polling
  // loop died. We restart a short poll here so the order flips to paid without
  // the user having to wait for the cron job.
  useEffect(() => {
    if (!welcomeFlag || !order) return
    if (order.status === "paid") return   // already confirmed, nothing to do

    const startedAt = Date.now()
    setPollingForCard(true)

    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > CARD_POLL_TIMEOUT_MS) {
        clearInterval(pollRef.current!)
        setPollingForCard(false)
        return
      }
      try {
        const res = await fetch(`/api/checkout/velocity/status/${id}`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (data.paid) {
          clearInterval(pollRef.current!)
          setPollingForCard(false)
          // Re-fetch the order from the server to get the updated status
          const fresh = await fetch(`/api/orders/${id}/data`)
          if (fresh.ok) {
            const updated: OrderRecord = await fresh.json()
            setOrder(updated)
            placeOrder(
              { name: updated.contact.name, email: updated.contact.email, phone: updated.contact.phone },
              { method: updated.payment.method },
              id,
              "paid",
            )
          }
        }
      } catch {
        // silently continue polling
      }
    }, CARD_POLL_INTERVAL_MS)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [welcomeFlag, order?.status, id])

  async function resendTickets() {
    if (resendingTickets) return
    setResendingTickets(true)
    setResendTicketNote(null)
    try {
      const res = await fetch(`/api/orders/${id}/resend-tickets`, { method: "POST" })
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

  if (!ready || fetching) {
    return (
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 text-center">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-paper-2 ring-1 ring-line mb-5">
          <Search size={22} className="text-ink-3" />
        </div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Order not found</h1>
        <p className="mt-2 text-[15px] text-ink-2">No order with id <span className="font-mono">{id}</span>.</p>
        <p className="mt-1 text-[13px] text-ink-3">If you just purchased, check your email — it may take a moment to appear here.</p>
        <Link href="/orders" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition">
          <ArrowLeft size={14} /> All orders
        </Link>
      </div>
    )
  }

  const tickets = order.items.filter((i) => i.kind === "ticket")
  const lineCount = order.items.reduce((s, i) => s + i.qty, 0)

  return (
    <div>
      {/* Card payment confirmation banner — shows while polling after Velocity redirect */}
      {pollingForCard && (
        <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50 px-5 py-3 flex items-center gap-3">
          <RefreshCw size={14} className="text-amber-600 animate-spin shrink-0" />
          <p className="text-[13px] font-medium text-amber-800">
            Confirming your card payment — this usually takes a few seconds.
          </p>
        </div>
      )}
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-12">
          <Link href="/orders" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors mb-5">
            <ArrowLeft size={13} /> All orders
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Order {order.id}</p>
              <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-tight text-ink">
                {lineCount} {lineCount === 1 ? "item" : "items"}
              </h1>
              <p className="mt-1.5 text-[14px] text-ink-2">{formatDate(order.createdAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/orders/${order.id}/print`}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-line-2 transition-colors"
              >
                <Printer size={14} /> Print
              </Link>
              <Link
                href={`/orders/${order.id}/print?auto=1`}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition"
              >
                <Download size={14} /> Save as PDF
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 grid lg:grid-cols-[1.5fr_1fr] gap-8 md:gap-10">
        {/* Tickets */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Tickets</p>
          <h2 className="text-[20px] font-bold tracking-tight text-ink mb-5">Present at the gate</h2>

          <div className="space-y-3">
            {tickets.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line bg-paper-2 p-8 text-center text-sm text-ink-2">
                No ticketable items in this order.
              </div>
            )}
            {tickets.map((line) => (
              line.kind === "ticket" ? Array.from({ length: line.qty }).map((_, i) => {
                const qrValue = qrByTier.get(line.tierId)?.[i] ?? `${order.id}-${line.key}-${i}`
                const hasRealQr = !!qrByTier.get(line.tierId)?.[i]
                return (
                <div key={`${line.key}-${i}`} className="relative rounded-2xl border border-line bg-paper overflow-hidden">
                  <div className="flex items-stretch">
                    <div className="flex-1 p-5 md:p-6 min-w-0">
                      <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">Ticket {i + 1} of {line.qty}</p>
                      <p className="mt-1.5 text-[15px] font-semibold tracking-tight text-ink line-clamp-1">{line.eventTitle}</p>
                      <p className="text-[13px] text-ink-2">{line.tierName}</p>
                      {order.status === "paid" && (
                        <p className="mt-3 text-[13px] text-ink-3 inline-flex items-center gap-1.5">
                          <Calendar size={12} /> Issued {formatDate(order.createdAt)}
                        </p>
                      )}
                      <Link href={`/events/${line.eventSlug}`} className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-navy hover:gap-1.5 transition-all">
                        View event <ArrowUpRight size={12} />
                      </Link>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-paper-2 ring-1 ring-line" aria-hidden />
                      <span className="w-px h-full border-l-2 border-dashed border-line" aria-hidden />
                      <span className="absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-paper-2 ring-1 ring-line" aria-hidden />
                    </div>
                    <div className="p-4 md:p-5 bg-paper-2 flex flex-col items-center justify-center gap-2">
                      <QrCode value={qrValue} size={120} className="rounded-lg ring-1 ring-line" />
                      {!hasRealQr && order.status === "paid" && ticketsLoading && (
                        <p className="text-[10px] text-ink-3 inline-flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> Generating ticket…
                        </p>
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
        </div>

        {/* Summary */}
        <aside>
          <div className="sticky top-24 rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.04]">
            <h3 className="text-[16px] font-semibold tracking-tight text-ink mb-1">Receipt</h3>
            <p className="text-xs text-ink-3 mb-5">Status: <span className={`font-semibold ${order.status === "paid" ? "text-green-700" : "text-amber-700"}`}>{order.status}</span></p>

            <ul className="space-y-3 pb-5 border-b border-line">
              {order.items.map((line) => (
                <li key={line.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="font-medium text-ink line-clamp-1">
                      {line.kind === "ticket" ? line.tierName : line.kind === "merch" ? line.name : line.kind === "shuttle" ? line.description : line.packageName}
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

            <div className="space-y-2 pt-4 border-t border-line text-[13px]">
              <p className="inline-flex items-center gap-2 text-ink-2"><Mail size={12} className="text-ink-3" /> {order.contact.email}</p>
              <p className="inline-flex items-center gap-2 text-ink-2"><Smartphone size={12} className="text-ink-3" /> {order.payment.method.toUpperCase()}</p>
            </div>

            {order.status === "paid" && (
              <div className="mt-4 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={resendTickets}
                  disabled={resendingTickets}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-60 transition"
                >
                  {resendingTickets ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {resendingTickets ? "Sending…" : "Resend ticket email"}
                </button>
                {resendTicketNote && (
                  <p className={`mt-2 text-[12px] text-center ${resendTicketNote.startsWith("Sent") ? "text-green-700" : "text-ink-3"}`}>
                    {resendTicketNote}
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
