"use client"
import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowLeft, ArrowUpRight, Calendar, Mail, Smartphone, Download, Printer } from "lucide-react"
import QrCode from "@/components/QrCode"

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { ready, getOrder } = useCart()
  const [order, setOrder] = useState<OrderRecord | null>(null)

  useEffect(() => {
    if (!ready) return
    queueMicrotask(() => { setOrder(getOrder(id)) })
  }, [ready, id, getOrder])

  if (!ready) {
    return (
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-20">
        <div className="h-8 w-40 bg-paper-2 rounded animate-pulse mb-6" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 text-center">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Order not found</h1>
        <p className="mt-2 text-[14.5px] text-ink-2">No order with id <span className="font-mono">{id}</span>.</p>
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
                      <p className="mt-3 text-[12.5px] text-ink-3 inline-flex items-center gap-1.5">
                        <Calendar size={12} /> Issued {formatDate(order.createdAt)}
                      </p>
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
                      {line.kind === "ticket" ? line.tierName : line.kind === "merch" ? line.name : line.description}
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
          </div>
        </aside>
      </div>
    </div>
  )
}
