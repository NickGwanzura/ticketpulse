"use client"
import { useEffect, useState, use } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowLeft, ArrowUpRight, Calendar, Mail, Smartphone, Download, Printer, MailCheck, RefreshCw, Loader2, Search, Send } from "lucide-react"
import QrCode from "@/components/QrCode"

type AwaitingStatus = {
  status: string
  sentTo: string | null
  expiresAt: string | null
}

function AwaitingVerification({ orderId }: { orderId: string }) {
  const [info, setInfo] = useState<AwaitingStatus | null>(null)
  const [resending, setResending] = useState(false)
  const [resendNote, setResendNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/orders/${orderId}/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setInfo(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [orderId])

  async function resend() {
    if (resending) return
    setResending(true)
    setResendNote(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/resend-verification`, { method: "POST" })
      if (res.status === 429) setResendNote("Hold on a moment. You can resend once per minute.")
      else if (!res.ok) setResendNote("Couldn't resend. Please try again shortly.")
      else setResendNote("Sent. Check your inbox.")
    } catch {
      setResendNote("Couldn't resend. Please try again shortly.")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-5 md:px-8 py-16 md:py-24">
      <div className="rounded-3xl border border-line bg-paper p-8 md:p-10 shadow-sm shadow-ink/[0.04]">
        <span className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-blue-soft ring-1 ring-blue/20 mb-5">
          <MailCheck size={20} className="text-blue" />
        </span>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Almost there</p>
        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight leading-[1.15] text-ink">
          Confirm your email to receive your tickets.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-ink">{info?.sentTo ?? "your email"}</span>. Tap it from your inbox and your tickets land here instantly.
        </p>

        <div className="mt-6 rounded-xl border border-line bg-paper-2 p-4 text-[13px] text-ink-2 leading-relaxed">
          The link expires in 24 hours. If you don&apos;t confirm in time, your purchase is automatically refunded.
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-[14px] font-semibold text-ink hover:border-line-2 transition disabled:opacity-60"
          >
            {resending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Resend email
          </button>
          <Link
            href="/events"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-[14px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 transition"
          >
            Browse more events
          </Link>
        </div>
        {resendNote && <p className="mt-3 text-[12.5px] text-ink-3">{resendNote}</p>}

        <p className="mt-8 text-[12px] text-ink-3 leading-relaxed">
          Wrong email? Reply to the confirmation email and we&apos;ll cancel and refund right away. Order ref{" "}
          <span className="font-mono">{orderId.slice(0, 8)}</span>.
        </p>
      </div>
    </div>
  )
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const search = useSearchParams()
  const awaitingFlag = search.get("awaiting") === "1"
  const { ready, getOrder } = useCart()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [fetching, setFetching] = useState(false)
  const [resendingTickets, setResendingTickets] = useState(false)
  const [resendTicketNote, setResendTicketNote] = useState<string | null>(null)

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

  if (awaitingFlag) {
    return <AwaitingVerification orderId={id} />
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
        <p className="mt-2 text-[14.5px] text-ink-2">No order with id <span className="font-mono">{id}</span>.</p>
        <p className="mt-1 text-[13px] text-ink-3">If you just purchased, check your email — it may take a moment to appear here.</p>
        <Link href="/orders" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy-700 transition">
          <ArrowLeft size={14} /> All orders
        </Link>
      </div>
    )
  }

  const tickets = order.items.filter((i) => i.kind === "ticket")
  const lineCount = order.items.reduce((s, i) => s + i.qty, 0)

  return (
    <div>
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-12">
          <Link href="/orders" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink transition-colors mb-5">
            <ArrowLeft size={13} /> All orders
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Order {order.id}</p>
              <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-tight text-ink">
                {lineCount} {lineCount === 1 ? "item" : "items"}
              </h1>
              <p className="mt-1.5 text-[13.5px] text-ink-2">{formatDate(order.createdAt)}</p>
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
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 transition"
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
              line.kind === "ticket" ? Array.from({ length: line.qty }).map((_, i) => (
                <div key={`${line.key}-${i}`} className="relative rounded-2xl border border-line bg-paper overflow-hidden">
                  <div className="flex items-stretch">
                    <div className="flex-1 p-5 md:p-6 min-w-0">
                      <p className="text-[10.5px] font-semibold tracking-[0.18em] text-blue uppercase">Ticket {i + 1} of {line.qty}</p>
                      <p className="mt-1.5 text-[15.5px] font-semibold tracking-tight text-ink line-clamp-1">{line.eventTitle}</p>
                      <p className="text-[13px] text-ink-2">{line.tierName}</p>
                      {order.status === "paid" && (
                        <p className="mt-3 text-[12.5px] text-ink-3 inline-flex items-center gap-1.5">
                          <Calendar size={12} /> Issued {formatDate(order.createdAt)}
                        </p>
                      )}
                      <Link href={`/events/${line.eventSlug}`} className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy hover:gap-1.5 transition-all">
                        View event <ArrowUpRight size={12} />
                      </Link>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-paper-2 ring-1 ring-line" aria-hidden />
                      <span className="w-px h-full border-l-2 border-dashed border-line" aria-hidden />
                      <span className="absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 rounded-full bg-paper-2 ring-1 ring-line" aria-hidden />
                    </div>
                    <div className="p-4 md:p-5 bg-paper-2 flex flex-col items-center justify-center gap-2">
                      <QrCode value={`${order.id}-${line.key}-${i}`} size={120} className="rounded-lg ring-1 ring-line" />
                      <p className="text-[10px] font-mono text-ink-3 tabular-nums">
                        {order.id.slice(-6)}-{(i + 1).toString().padStart(2, "0")}
                      </p>
                    </div>
                  </div>
                </div>
              )) : null
            ))}
          </div>
        </div>

        {/* Summary */}
        <aside>
          <div className="sticky top-24 rounded-2xl border border-line bg-paper p-6 shadow-sm shadow-ink/[0.04]">
            <h3 className="text-[16px] font-semibold tracking-tight text-ink mb-1">Receipt</h3>
            <p className="text-xs text-ink-3 mb-5">Status: <span className={`font-semibold ${order.status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>{order.status}</span></p>

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

            <div className="space-y-2 pt-4 border-t border-line text-[12.5px]">
              <p className="inline-flex items-center gap-2 text-ink-2"><Mail size={12} className="text-ink-3" /> {order.contact.email}</p>
              <p className="inline-flex items-center gap-2 text-ink-2"><Smartphone size={12} className="text-ink-3" /> {order.payment.method.toUpperCase()}</p>
            </div>

            {order.status === "paid" && (
              <div className="mt-4 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={resendTickets}
                  disabled={resendingTickets}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 disabled:opacity-60 transition"
                >
                  {resendingTickets ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {resendingTickets ? "Sending…" : "Resend ticket email"}
                </button>
                {resendTicketNote && (
                  <p className={`mt-2 text-[11.5px] text-center ${resendTicketNote.startsWith("Sent") ? "text-emerald-700" : "text-ink-3"}`}>
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
