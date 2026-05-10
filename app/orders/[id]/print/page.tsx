"use client"
import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { formatDate, formatDateShort } from "@/lib/utils"
import { ArrowLeft, Printer, Download, Calendar, MapPin, ShieldCheck } from "lucide-react"
import QrCode from "@/components/QrCode"

function ticketCode(orderId: string, lineKey: string, idx: number) {
  return `${orderId}-${lineKey}-${idx + 1}`
}

function shortCode(orderId: string, idx: number) {
  return `${orderId.slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`
}

export default function PrintTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { ready, getOrder } = useCart()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [autoPrintQueued, setAutoPrintQueued] = useState(false)

  useEffect(() => {
    if (!ready) return
    queueMicrotask(() => setOrder(getOrder(id)))
  }, [ready, id, getOrder])

  useEffect(() => {
    if (!order) return
    if (autoPrintQueued) return
    const search = typeof window !== "undefined" ? window.location.search : ""
    if (!search.includes("auto=1")) return
    queueMicrotask(() => setAutoPrintQueued(true))
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [order, autoPrintQueued])

  if (!ready) {
    return (
      <main className="min-h-screen bg-paper-2 px-5 py-20">
        <div className="h-8 w-40 bg-paper-3 rounded animate-pulse mx-auto" />
      </main>
    )
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-paper-2 px-5 py-20 text-center">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Order not found</h1>
        <p className="mt-2 text-[14.5px] text-ink-2">No order with id <span className="font-mono">{id}</span>.</p>
        <Link href="/orders" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white hover:bg-navy-700 transition">
          <ArrowLeft size={14} /> All orders
        </Link>
      </main>
    )
  }

  const tickets = order.items.filter((i) => i.kind === "ticket")
  const flat = tickets.flatMap((line) =>
    line.kind === "ticket"
      ? Array.from({ length: line.qty }).map((_, i) => ({ line, i }))
      : []
  )

  return (
    <main className="bg-paper-2 min-h-screen">
      {/* Hide global Navbar + Footer on screen and on paper. The print page owns its frame. */}
      <style>{`
        body > div > nav,
        body > div > footer,
        body > nav,
        body > footer { display: none !important; }
        @page { size: A4; margin: 12mm; }
        @media print {
          html, body { background: #fff !important; }
          .tp-no-print { display: none !important; }
          .tp-print-page {
            page-break-after: always;
            break-after: page;
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
          }
          .tp-print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      {/* Toolbar (screen-only) */}
      <div className="tp-no-print sticky top-0 z-30 bg-paper/95 backdrop-blur border-b border-line">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/orders/${order.id}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors"
            >
              <ArrowLeft size={14} /> Back to order
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-ink-3">
              <ShieldCheck size={12} className="text-emerald-600" /> Verified TicketPulse ticket · {flat.length} {flat.length === 1 ? "page" : "pages"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:border-line-2 transition-colors"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 transition"
            >
              <Download size={14} /> Save as PDF
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-5 md:px-8 pb-3 -mt-1">
          <p className="text-[11.5px] text-ink-3">
            In the print dialog, choose <span className="font-semibold text-ink">Save as PDF</span> as the destination to download. Each ticket prints on its own page.
          </p>
        </div>
      </div>

      {/* Tickets */}
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6 print:space-y-0 print:max-w-none print:px-0 print:py-0">
        {flat.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-paper p-8 text-center text-sm text-ink-2">
            No ticketable items in this order.
          </div>
        )}
        {flat.map(({ line, i }, idx) => {
          if (line.kind !== "ticket") return null
          const code = ticketCode(order.id, line.key, i)
          const human = shortCode(order.id, idx)
          return (
            <article
              key={`${line.key}-${i}`}
              className="tp-print-page relative rounded-3xl border border-line bg-paper overflow-hidden shadow-[0_24px_60px_-32px_rgba(10,37,64,0.18)] print:rounded-none print:shadow-none print:border-0"
            >
              {/* Top stripe */}
              <div className="h-2 bg-gradient-to-r from-navy via-blue to-navy" aria-hidden />

              {/* Header band */}
              <div className="flex items-center justify-between px-7 md:px-9 pt-6">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-navy text-white text-[11px] font-bold tracking-tight">TP</span>
                  <div className="leading-tight">
                    <p className="text-[12.5px] font-semibold tracking-tight text-ink">TicketPulse</p>
                    <p className="text-[10.5px] text-ink-3">ticketpulse.co</p>
                  </div>
                </div>
                <div className="text-right leading-tight">
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-3 uppercase">Ticket</p>
                  <p className="text-[12px] font-mono text-ink tabular-nums">{human}</p>
                </div>
              </div>

              {/* Main body */}
              <div className="px-7 md:px-9 pt-5 pb-6 grid grid-cols-1 md:grid-cols-[1.3fr_auto_1fr] gap-5 md:gap-7 items-stretch">
                {/* Left: details */}
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">
                    {line.tierName}
                  </p>
                  <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight leading-[1.1] text-ink">
                    {line.eventTitle}
                  </h2>

                  <dl className="mt-5 space-y-2.5 text-[13px] text-ink-2">
                    <div className="flex items-start gap-2.5">
                      <Calendar size={14} className="text-ink-3 mt-0.5 shrink-0" />
                      <div>
                        <dt className="text-[10px] font-semibold tracking-wider text-ink-3 uppercase">Issued</dt>
                        <dd className="text-ink">{formatDate(order.createdAt)}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin size={14} className="text-ink-3 mt-0.5 shrink-0" />
                      <div>
                        <dt className="text-[10px] font-semibold tracking-wider text-ink-3 uppercase">Holder</dt>
                        <dd className="text-ink">{order.contact.name || order.contact.email}</dd>
                      </div>
                    </div>
                  </dl>

                  <div className="mt-5 grid grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <p className="text-ink-3 mb-0.5">Order</p>
                      <p className="font-mono text-ink tabular-nums">{order.id}</p>
                    </div>
                    <div>
                      <p className="text-ink-3 mb-0.5">Seat</p>
                      <p className="font-semibold text-ink">{i + 1} of {line.qty}</p>
                    </div>
                    <div>
                      <p className="text-ink-3 mb-0.5">Issued</p>
                      <p className="font-semibold text-ink">{formatDateShort(order.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Middle: perforation */}
                <div className="hidden md:flex relative items-center justify-center" aria-hidden>
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-paper-2 ring-1 ring-line" />
                  <span className="w-px h-full border-l-2 border-dashed border-line" />
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-paper-2 ring-1 ring-line" />
                </div>

                {/* Right: QR + scan code */}
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-paper-2 ring-1 ring-line p-5 print:bg-white print:ring-0">
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-3 uppercase">Scan at gate</p>
                  <QrCode value={code} size={170} className="rounded-xl ring-1 ring-line bg-white" />
                  <p className="text-[10px] font-mono text-ink-3 tabular-nums break-all text-center max-w-[170px]">
                    {code}
                  </p>
                </div>
              </div>

              {/* Footer strip */}
              <div className="border-t border-dashed border-line px-7 md:px-9 py-3.5 flex flex-wrap items-center justify-between gap-2 bg-paper-2/50 print:bg-white">
                <p className="text-[10.5px] text-ink-3 inline-flex items-center gap-1.5">
                  <ShieldCheck size={11} className="text-emerald-600" />
                  Verified by TicketPulse. Scanned at the gate by our reader app. Valid for one entry only.
                </p>
                <p className="text-[10px] font-mono text-ink-3 tabular-nums">{human}</p>
              </div>
            </article>
          )
        })}

        {/* Tail card (screen-only) */}
        <div className="tp-no-print rounded-2xl border border-line bg-paper p-5 flex items-start gap-3">
          <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13.5px] font-semibold text-ink">End-to-end on TicketPulse</p>
            <p className="text-[12.5px] text-ink-2 mt-0.5 leading-relaxed">
              We issue the ticket, you walk in. Our gate-scanner app reads the QR on this PDF, your phone, or printed page and checks you in instantly. No third-party scanners, no cross-platform fees.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
