"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  ArrowRight, Mail, Smartphone, Calendar, Download, ArrowUpRight, Sparkles, Share2, CalendarPlus,
} from "lucide-react"
import QrCode from "@/components/QrCode"
import AnimatedCheck from "@/components/AnimatedCheck"
import Confetti from "@/components/Confetti"
import CheckoutSteps from "@/components/CheckoutSteps"

export default function CheckoutSuccessPage() {
  const params = useSearchParams()
  const id = params.get("id") ?? ""
  const { ready, getOrder } = useCart()
  const [order, setOrder] = useState<OrderRecord | null>(null)

  useEffect(() => {
    if (!ready) return
    setOrder(getOrder(id))
  }, [ready, id, getOrder])

  if (!ready) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 text-center">
        <div className="h-12 w-12 mx-auto bg-paper-2 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 text-center">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Order not found</h1>
        <p className="mt-2 text-[14.5px] text-ink-2">We couldn&apos;t find an order with id <span className="font-mono text-ink">{id}</span>.</p>
        <Link href="/orders" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy-700 transition">
          See your orders <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const tickets = order.items.filter((i) => i.kind === "ticket")
  const lineCount = order.items.reduce((s, i) => s + i.qty, 0)
  const eventTitle = order.items[0]?.eventTitle ?? "TicketPulse event"

  const calendarUrl = (() => {
    const start = new Date(order.createdAt)
    start.setDate(start.getDate() + 7)
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "")
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent("Order " + order.id + " · TicketPulse")}`
  })()

  const shareOrder = async () => {
    const data = {
      title: "I'm going to " + eventTitle,
      text: "Just got my ticket on TicketPulse, see you there!",
      url: typeof window !== "undefined" ? window.location.origin + "/events" : "",
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share(data) } catch {}
    } else if (typeof navigator !== "undefined") {
      try {
        await navigator.clipboard.writeText(`${data.text} ${data.url}`)
        alert("Copied to clipboard!")
      } catch {}
    }
  }

  return (
    <div className="relative">
      <Confetti count={70} />
      {/* Success hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 -z-10" style={{
          background: "radial-gradient(800px 320px at 50% -20%, #DBE8FB 0%, transparent 60%), radial-gradient(600px 240px at 50% 100%, rgba(16,185,129,0.10) 0%, transparent 60%), linear-gradient(180deg, #FFFFFF 0%, #F6F9FC 100%)",
        }} />
        <div className="max-w-3xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-12 md:pb-16 text-center">
          <div className="mb-6">
            <AnimatedCheck size={64} />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 mb-4 shadow-sm shadow-ink/5">
            <Sparkles size={12} className="text-blue" />
            <span className="text-[10.5px] font-semibold tracking-[0.18em] text-ink uppercase">Order confirmed</span>
          </div>
          <h1 className="text-[32px] md:text-[44px] font-bold tracking-[-0.02em] leading-[1.05] text-ink">
            You&apos;re going!
          </h1>
          <p className="mt-3 text-[15px] md:text-[16px] text-ink-2 max-w-lg mx-auto leading-relaxed">
            We sent a confirmation to <span className="font-semibold text-ink">{order.contact.email}</span>. Your tickets are also waiting in your account.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 text-[12px] text-ink-3 font-mono">
            <span>Order</span>
            <span className="bg-paper border border-line px-2 py-1 rounded text-ink">{order.id}</span>
          </p>

          <div className="mt-8 flex justify-center">
            <CheckoutSteps active="done" />
          </div>

          <div className="mt-7 flex flex-wrap gap-2 justify-center">
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-line-2 transition-colors"
            >
              <CalendarPlus size={14} className="text-blue" /> Add to calendar
            </a>
            <button
              onClick={shareOrder}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-line-2 transition-colors"
            >
              <Share2 size={14} className="text-blue" /> Share
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-12 md:py-14 space-y-8">
        {/* Tickets with QR */}
        {tickets.length > 0 && (
          <section>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Your tickets</p>
            <h2 className="text-[22px] font-bold tracking-tight text-ink mb-5">Present at the gate</h2>
            <div className="space-y-3">
              {tickets.map((line) => (
                line.kind === "ticket" ? Array.from({ length: line.qty }).map((_, i) => (
                  <div key={`${line.key}-${i}`} className="relative rounded-2xl border border-line bg-paper overflow-hidden">
                    <div className="flex items-stretch">
                      <div className="flex-1 p-5 md:p-6 min-w-0">
                        <p className="text-[10.5px] font-semibold tracking-[0.18em] text-blue uppercase">Ticket {i + 1} of {line.qty}</p>
                        <p className="mt-1.5 text-[16px] font-semibold tracking-tight text-ink line-clamp-1">{line.eventTitle}</p>
                        <p className="text-[13px] text-ink-2">{line.tierName}</p>
                        <p className="mt-3 text-[12.5px] text-ink-3 inline-flex items-center gap-1.5">
                          <Calendar size={12} /> {formatDate(order.createdAt)}
                        </p>
                        <Link
                          href={`/events/${line.eventSlug}`}
                          className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy hover:gap-1.5 transition-all"
                        >
                          View event <ArrowUpRight size={12} />
                        </Link>
                      </div>
                      {/* Stub divider with notches */}
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
          </section>
        )}

        {/* Order details */}
        <section className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-[16px] font-semibold tracking-tight text-ink mb-5">Order details</h2>

          <ul className="space-y-3 pb-5 border-b border-line">
            {order.items.map((line) => (
              <li key={line.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                <div className="min-w-0">
                  <p className="font-medium text-ink line-clamp-1">
                    {line.kind === "ticket" ? line.tierName : line.kind === "merch" ? line.name : line.description}
                  </p>
                  <p className="text-ink-3 text-[12px]">{line.eventTitle} · ×{line.qty}</p>
                </div>
                <span className="font-semibold tracking-tight text-ink whitespace-nowrap">
                  {formatCurrency(line.price * line.qty, line.currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-1 pt-4">
            {Object.entries(order.totalsByCurrency).map(([cur, total]) => (
              <div key={cur} className="flex items-baseline justify-between">
                <span className="text-[13px] text-ink-2">Total · {cur}</span>
                <span className="text-[18px] font-bold tracking-tight text-ink">
                  {formatCurrency(total, cur)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-[12.5px] pt-5 border-t border-line">
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-1">Name</p>
              <p className="text-ink font-medium">{order.contact.name}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-1">Email</p>
              <p className="text-ink font-medium truncate inline-flex items-center gap-1.5"><Mail size={11} className="text-ink-3" /> {order.contact.email}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-3 uppercase mb-1">Payment</p>
              <p className="text-ink font-medium inline-flex items-center gap-1.5"><Smartphone size={11} className="text-ink-3" /> {order.payment.method.toUpperCase()}</p>
            </div>
          </div>
        </section>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/orders/${order.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 transition"
          >
            <Download size={14} /> View / download tickets
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-5 py-3 text-sm font-medium text-ink hover:border-line-2 transition-colors"
          >
            Find more events <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
