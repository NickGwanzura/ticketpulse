"use client"

import { useEffect, useState, use, useRef, useCallback } from "react"
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
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null)
  const [downloadAll, setDownloadAll] = useState(false)
  const ticketRefs = useRef<(HTMLElement | null)[]>([])

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

  // ── Download single ticket as PDF ──────────────────────────────────────────

  const downloadTicketPdf = useCallback(async (idx: number) => {
    setDownloadingIndex(idx)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: html2canvas } = await import("html2canvas")

      const el = ticketRefs.current[idx]
      if (!el) return

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      })

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvas.height * pdfW) / canvas.width

      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH)
      pdf.save(`ticket-${shortCode(order!.id, idx)}.pdf`)
    } catch (err) {
      console.error("PDF download failed:", err)
      // Fallback to browser print
      window.print()
    } finally {
      setDownloadingIndex(null)
    }
  }, [order])

  // ── Download all tickets as single PDF ─────────────────────────────────────

  const downloadAllPdf = useCallback(async () => {
    setDownloadAll(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: html2canvas } = await import("html2canvas")

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const tickets = order!.items.filter((i) => i.kind === "ticket")
      const flat = tickets.flatMap((line) =>
        line.kind === "ticket"
          ? Array.from({ length: line.qty }).map((_, i) => ({ line, i }))
          : []
      )

      for (let idx = 0; idx < flat.length; idx++) {
        const el = ticketRefs.current[idx]
        if (!el) continue

        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: "#ffffff",
          logging: false,
          useCORS: true,
        })

        const imgData = canvas.toDataURL("image/png")
        const pdfW = pdf.internal.pageSize.getWidth()
        const pdfH = (canvas.height * pdfW) / canvas.width

        if (idx > 0) pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH)
      }

      pdf.save(`${order!.id.slice(0, 8)}-tickets.pdf`)
    } catch (err) {
      console.error("PDF download all failed:", err)
      window.print()
    } finally {
      setDownloadAll(false)
    }
  }, [order])

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
              <ShieldCheck size={12} className="text-green-600" /> {flat.length} {flat.length === 1 ? "ticket" : "tickets"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAllPdf}
              disabled={!allQrReady || downloadAll}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0a2540] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a3550] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {downloadAll ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <DownloadCloud size={14} />
              )}
              {downloadAll ? "Generating…" : "Download all as PDF"}
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
              {/* ── Ticket content (captured for PDF) ──────────────────── */}
              <article
                ref={(el) => { ticketRefs.current[idx] = el }}
                className="relative bg-white rounded-3xl border border-[#e2e8f0] overflow-hidden print:rounded-none print:shadow-none print:border-0"
              >
                {/* ── Compact header bar ─────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#0a2540]">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 283.46 283.46" className="w-5 h-5" fill="none" aria-hidden="true">
                      <path fill="#8DD32F" d="M124.27,165.85h-8.76v-32.73h13.77c2.5,0,4.77,0.44,6.81,1.32c2.04,0.88,3.66,2.21,4.86,3.99c1.2,1.78,1.8,3.94,1.8,6.47c0,2.5-0.64,4.61-1.93,6.33c-1.28,1.72-2.98,2.99-5.08,3.83c-2.1,0.83-4.39,1.25-6.86,1.25h-4.62V165.85z M128.99,140h-4.72v9.43h4.81c1.35,0,2.45-0.43,3.32-1.3s1.3-1.94,1.3-3.22c0-1.48-0.43-2.66-1.28-3.56C131.58,140.45,130.43,140,128.99,140z"/>
                      <path fill="#FFFFFF" d="M142.02,164.02c-1.05-2.02-2.06-4.03-3.02-6.08c-0.04,0.03-0.1,0.04-0.16,0.07c-2.5,0.98-5.24,1.5-8.12,1.53c1.39,3.01,2.87,5.99,4.41,8.96c0.47,0.54,0.38,2.36-0.27,2.54l-13.02,3.53c-1.15-2.17-2.65-4.03-4.43-5.51c-1.23-1.06-2.61-1.93-4.06-2.58c-3.53-1.62-7.55-2.04-11.47-1.05c-7.95,2.03-13.75,9.25-13.27,18.01l-15.66,3.99c-1.05-29.92-8.5-57.74-22.14-83.69c-0.26-1.02,0.24-2.81,0.97-2.99l14.34-3.72c3.79,7.92,12.05,11.6,19.8,9.62c7.86-2.02,13.24-9.45,12.59-18.31l14.39-3.72c0.09,2.34,0.21,4.68,0.38,7h8.19c-0.17-2.29-0.3-4.57-0.38-6.86c-0.21-5.61-5.89-9.43-11.06-8.05l-16.68,4.46c-3.04,0.82-3.86,3.96-3.19,6.67c1.19,4.87-1.79,9.68-6.19,10.86c-4.58,1.22-9.47-1.6-10.89-6.32c-1.01-3.31-3.59-4.93-6.94-3.99L49.6,92.96c-6.32,1.75-9.11,8.77-6.08,14.52c12.82,24.34,20.1,50.76,21.09,78.39c0.2,5.62,4.93,10.99,11.01,9.4l18.32-4.77c2.53-0.65,3.73-3.18,3.08-5.59c-1.41-5.18,1.96-10.29,6.73-11.45c5.35-1.32,10.04,1.67,11.58,7.01c0.6,2.09,3.21,3.48,5.25,2.92l16.71-4.54c2.92-0.79,5.21-3.79,5.95-5.98C144.35,169.65,143.51,166.86,142.02,164.02z"/>
                      <circle fill="#8DD32F" cx="242.85" cy="160.38" r="5.08"/>
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
                    <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[9px] font-semibold text-blue-700 mb-2">
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

              {/* ── Per-ticket download button — OUTSIDE article so it's not captured in PDF ── */}
              {qr && (
                <div className="tp-no-print pt-3 pb-1">
                  <button
                    onClick={() => downloadTicketPdf(idx)}
                    disabled={downloadingIndex === idx}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] px-4 py-2.5 text-[12px] font-medium text-[#0a2540] hover:bg-[#f1f5f9] disabled:opacity-50 transition"
                  >
                    {downloadingIndex === idx ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    {downloadingIndex === idx ? "Generating PDF…" : "Download this ticket as PDF"}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
