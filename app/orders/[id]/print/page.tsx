"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { formatDate } from "@/lib/utils"
import {
  ArrowLeft, Download, Calendar, MapPin, ShieldCheck, Ticket,
  DownloadCloud, Loader2,
} from "lucide-react"
import QRCode from "qrcode"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ticketCode(orderId: string, lineKey: string, idx: number) {
  return `${orderId}-${lineKey}-${idx + 1}`
}

function shortCode(orderId: string, idx: number) {
  return `${orderId.slice(-6)}-${(idx + 1).toString().padStart(2, "0")}`
}

// ─── QR code SVG generator ───────────────────────────────────────────────────

async function qrDataUrl(value: string): Promise<string> {
  try {
    return await QRCode.toDataURL(value, {
      width: 400,
      margin: 1,
      color: { dark: "#0a2540", light: "#ffffff" },
    })
  } catch {
    return ""
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PrintTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { ready, getOrder } = useCart()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [fetching, setFetching] = useState(false)
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({})
  const [downloading, setDownloading] = useState(false)

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

  // Generate real QR code data URLs for each ticket
  useEffect(() => {
    if (!order) return
    const tickets = order.items.filter((i) => i.kind === "ticket")
    const flat = tickets.flatMap((line) =>
      line.kind === "ticket"
        ? Array.from({ length: line.qty }).map((_, i) => ({ line, i }))
        : []
    )
    const generate = async () => {
      const map: Record<string, string> = {}
      for (let idx = 0; idx < flat.length; idx++) {
        const { line, i } = flat[idx]
        const code = ticketCode(order.id, line.key, i)
        map[`${idx}`] = await qrDataUrl(code)
      }
      setQrUrls(map)
    }
    generate()
  }, [order])

  // ── Download all tickets as PDF (server-side) ──────────────────────────────

  const downloadAllPdf = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/orders/${id}/pdf`)
      if (!res.ok) throw new Error(`PDF API returned ${res.status}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `tickets-${id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("PDF download failed:", err)
      window.print()
    } finally {
      setDownloading(false)
    }
  }

  if (!ready || fetching) {
    return (
      <main className="min-h-screen bg-[#f4f7fa] px-5 py-20">
        <div className="h-8 w-40 bg-white/60 rounded animate-pulse mx-auto" />
      </main>
    )
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-[#f4f7fa] px-5 py-20 text-center">
        <h1 className="text-[26px] font-bold tracking-tight text-[#0a2540]">Order not found</h1>
        <p className="mt-2 text-[14px] text-[#5a6d7c]">No order with id <span className="font-mono">{id}</span>.</p>
        <p className="mt-1 text-[13px] text-[#5a6d7c]">If you just purchased, check your email — it may take a moment to appear here.</p>
        <Link href="/orders" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0a2540] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1a3550] transition">
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

  const allQrReady = flat.length > 0 && flat.every((_, i) => qrUrls[`${i}`])

  return (
    <main className="bg-[#f4f7fa] min-h-screen">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          main { background: #fff !important; padding: 0 !important; }
          .max-w-\[210mm\] { max-width: none !important; padding: 0 !important; }
          .tp-no-print { display: none !important; }
          .tp-print-page {
            page-break-after: always;
            break-after: page;
          }
          .tp-print-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          /* Strip all decorative styling from tickets in print */
          article { box-shadow: none !important; border-radius: 0 !important; border: 0 !important; }
          article [class*="rounded"]:not([class*="bg-"]) { border-radius: 0 !important; }
          article [class*="shadow"] { box-shadow: none !important; }
          article [class*="ring"] { box-shadow: none !important; }
          article [class*="gap-"] { gap: 0 !important; }
          article [class*="space-y"] { margin-top: 0 !important; }
          article [class*="p-"] { padding: 0 !important; }
          article [class*="px-"] { padding-left: 0 !important; padding-right: 0 !important; }
          article [class*="py-"] { padding-top: 0 !important; padding-bottom: 0 !important; }
          article [class*="pt-"] { padding-top: 0 !important; }
          article [class*="pb-"] { padding-bottom: 0 !important; }
          article [class*="pl-"] { padding-left: 0 !important; }
          article [class*="pr-"] { padding-right: 0 !important; }
          article [class*="mt-"] { margin-top: 0 !important; }
          article [class*="mb-"] { margin-bottom: 0 !important; }
          article [class*="ml-"] { margin-left: 0 !important; }
          article [class*="mr-"] { margin-right: 0 !important; }
        }
      `}</style>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="tp-no-print sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/orders/${order.id}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5a6d7c] hover:text-[#0a2540] transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11.5px] text-[#5a6d7c]">
              <ShieldCheck size={12} className="text-brand-600" /> {flat.length} {flat.length === 1 ? "ticket" : "tickets"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAllPdf}
              disabled={!allQrReady || downloading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0a2540] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a3550] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {downloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <DownloadCloud size={14} />
              )}
              {downloading ? "Generating…" : "Download all as PDF"}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#0a2540] hover:border-[#cbd5e1] transition-colors"
            >
              <Download size={14} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* ── Tickets ──────────────────────────────────────────────────────── */}
      <div className="max-w-[210mm] mx-auto px-4 md:px-8 py-8 md:py-10 space-y-6 print:space-y-0 print:max-w-none print:px-0 print:py-0">
        {flat.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#e2e8f0] bg-white p-8 text-center text-sm text-[#5a6d7c]">
            No ticketable items in this order.
          </div>
        )}

        {flat.map(({ line, i }, idx) => {
          if (line.kind !== "ticket") return null
          const code = ticketCode(order.id, line.key, i)
          const human = shortCode(order.id, idx)
          const qr = qrUrls[`${idx}`]

          return (
            <div key={`${line.key}-${i}`} className="tp-print-page">
              {/* ── Ticket content ─────────────────────────────────────── */}
              <article className="relative bg-white rounded-3xl border border-[#e2e8f0] overflow-hidden print:rounded-none print:shadow-none print:border-0">
                {/* ── Compact header bar ─────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#131132]">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none" aria-hidden="true">
                      <rect x="2" y="4" width="28" height="24" rx="3" fill="#909090"/>
                      <rect x="0" y="10" width="4" height="12" rx="2" fill="#131132"/>
                      <rect x="28" y="10" width="4" height="12" rx="2" fill="#131132"/>
                      <rect x="19" y="4" width="1.5" height="24" rx="0.5" fill="#FFFFFF" fillOpacity={0.2}/>
                      <rect x="5" y="14" width="2" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.45}/>
                      <rect x="8" y="14" width="1.5" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.3}/>
                      <rect x="10.5" y="14" width="2" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.45}/>
                      <rect x="13.5" y="14" width="1.5" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.3}/>
                      <circle cx="24" cy="16" r="2" fill="#FFFFFF" fillOpacity={0.55}/>
                    </svg>
                    <span className="text-[11px] font-bold text-white tracking-tight">TicketPulse</span>
                  </div>
                  <span className="text-[9px] font-mono text-white/70 tabular-nums">{human}</span>
                </div>

                {/* ── Body: compact side-by-side layout ──────────────── */}
                <div className="flex items-stretch">
                  {/* Left: event info */}
                  <div className="flex-1 min-w-0 px-5 py-4">
                    {/* Tier badge */}
                    <span className="inline-block rounded-full bg-green-50 px-2.5 py-0.5 text-[9px] font-semibold text-green-700 mb-2">
                      {line.tierName}
                    </span>

                    {/* Event title */}
                    <h2 className="text-[17px] font-bold leading-[1.2] text-[#0a2540] break-words">
                      {line.eventTitle}
                    </h2>

                    {/* Detail rows — compact */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px] text-[#5a6d7c]">
                        <Calendar size={11} className="shrink-0 text-[#8a9caa]" />
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#5a6d7c]">
                        <MapPin size={11} className="shrink-0 text-[#8a9caa]" />
                        <span className="truncate">{order.contact.name || order.contact.email}</span>
                      </div>
                    </div>

                    {/* Order reference */}
                    <div className="mt-3 pt-3 border-t border-[#e2e8f0]">
                      <span className="text-[7.5px] font-semibold tracking-[0.15em] text-[#8a9caa] uppercase">Order</span>
                      <p className="text-[9px] font-mono text-[#0a2540] tabular-nums mt-0.5 break-all">{order.id}</p>
                    </div>
                  </div>

                  {/* Right: QR code */}
                  <div className="flex flex-col items-center justify-center gap-1.5 w-[130px] shrink-0 border-l border-dashed border-[#e2e8f0] px-4 py-4">
                    {qr ? (
                      <img
                        src={qr}
                        alt={`QR code for ${code}`}
                        className="w-[110px] h-[110px]"
                      />
                    ) : (
                      <div className="w-[110px] h-[110px] bg-[#e2e8f0] animate-pulse rounded" />
                    )}
                    <p className="text-[7px] font-mono text-[#8a9caa] tabular-nums truncate max-w-full">{code}</p>
                  </div>
                </div>
              </article>
            </div>
          )
        })}
      </div>
    </main>
  )
}
