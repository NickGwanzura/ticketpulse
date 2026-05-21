"use client"

import { useEffect, useState, use, useRef, useCallback } from "react"
import Link from "next/link"
import { useCart, type OrderRecord } from "@/lib/cart-context"
import { formatDate } from "@/lib/utils"
import {
  ArrowLeft, Download, Calendar, MapPin, ShieldCheck, Ticket,
  Smartphone, DownloadCloud, Loader2,
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
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({})
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null)
  const [downloadAll, setDownloadAll] = useState(false)
  const ticketRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    if (!ready) return
    queueMicrotask(() => setOrder(getOrder(id)))
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

  if (!ready) {
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
        @page { size: A4; margin: 0; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .tp-no-print { display: none !important; }
          .tp-print-page {
            page-break-after: always;
            break-after: page;
          }
          .tp-print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
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
              <ShieldCheck size={12} className="text-emerald-600" /> {flat.length} {flat.length === 1 ? "ticket" : "tickets"}
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
            <article
              key={`${line.key}-${i}`}
              ref={(el) => { ticketRefs.current[idx] = el }}
              className="tp-print-page relative bg-white rounded-3xl border border-[#e2e8f0] overflow-hidden shadow-[0_20px_60px_-20px_rgba(10,37,64,0.15)] print:rounded-none print:shadow-none print:border-0"
            >
              {/* ── Gradient top bar ─────────────────────────────────────── */}
              <div className="h-1.5 bg-gradient-to-r from-[#0a2540] via-[#2563eb] to-[#0a2540]" aria-hidden />

              {/* ── Header ───────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-6 md:px-8 pt-6 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#0a2540] flex items-center justify-center">
                    <Ticket size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold tracking-tight text-[#0a2540]">TicketPulse</p>
                    <p className="text-[9.5px] text-[#8a9caa]">Verified digital ticket</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold tracking-[0.2em] text-[#8a9caa] uppercase">Ticket</p>
                  <p className="text-[12px] font-mono text-[#0a2540] tabular-nums tracking-tight">{human}</p>
                </div>
              </div>

              {/* ── Divider ──────────────────────────────────────────────── */}
              <div className="mx-6 md:mx-8 border-t border-dashed border-[#e2e8f0]" />

              {/* ── Body ─────────────────────────────────────────────────── */}
              <div className="px-6 md:px-8 py-5 grid grid-cols-1 md:grid-cols-[1.4fr_auto_1fr] gap-5 items-stretch">
                {/* Left: event info */}
                <div className="min-w-0">
                  {/* Tier badge */}
                  <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold text-blue-700 mb-3">
                    {line.tierName}
                  </span>

                  {/* Event title */}
                  <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight leading-[1.15] text-[#0a2540]">
                    {line.eventTitle}
                  </h2>

                  {/* Details */}
                  <dl className="mt-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <Calendar size={13} className="text-[#8a9caa] mt-0.5 shrink-0" />
                      <div>
                        <dt className="text-[8.5px] font-semibold tracking-[0.15em] text-[#8a9caa] uppercase">Issued</dt>
                        <dd className="text-[12.5px] text-[#0a2540] font-medium">{formatDate(order.createdAt)}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin size={13} className="text-[#8a9caa] mt-0.5 shrink-0" />
                      <div>
                        <dt className="text-[8.5px] font-semibold tracking-[0.15em] text-[#8a9caa] uppercase">Holder</dt>
                        <dd className="text-[12.5px] text-[#0a2540] font-medium">{order.contact.name || order.contact.email}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Smartphone size={13} className="text-[#8a9caa] mt-0.5 shrink-0" />
                      <div>
                        <dt className="text-[8.5px] font-semibold tracking-[0.15em] text-[#8a9caa] uppercase">Payment</dt>
                        <dd className="text-[12.5px] text-[#0a2540] font-medium">{order.payment.method.toUpperCase()}</dd>
                      </div>
                    </div>
                  </dl>

                  {/* Meta grid */}
                  <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <div>
                      <p className="text-[8.5px] font-semibold tracking-[0.15em] text-[#8a9caa] uppercase">Order</p>
                      <p className="text-[11px] font-mono text-[#0a2540] tabular-nums">{order.id}</p>
                    </div>
                    <div>
                      <p className="text-[8.5px] font-semibold tracking-[0.15em] text-[#8a9caa] uppercase">Seat</p>
                      <p className="text-[11px] font-semibold text-[#0a2540]">{i + 1} of {line.qty}</p>
                    </div>
                  </div>
                </div>

                {/* Middle: perforation (desktop only) */}
                <div className="hidden md:flex relative items-center justify-center" aria-hidden>
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#f4f7fa] ring-1 ring-[#e2e8f0]" />
                  <span className="w-px h-full border-l-2 border-dashed border-[#e2e8f0]" />
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#f4f7fa] ring-1 ring-[#e2e8f0]" />
                </div>

                {/* Right: real QR code */}
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#f8fafc] ring-1 ring-[#e2e8f0] p-5 print:bg-white print:ring-0">
                  <p className="text-[9px] font-semibold tracking-[0.2em] text-[#8a9caa] uppercase">Scan at gate</p>
                  {qr ? (
                    <img
                      src={qr}
                      alt={`QR code for ${code}`}
                      className="w-[160px] h-[160px] rounded-xl ring-1 ring-[#e2e8f0] bg-white"
                    />
                  ) : (
                    <div className="w-[160px] h-[160px] rounded-xl bg-[#e2e8f0] animate-pulse flex items-center justify-center">
                      <Loader2 size={20} className="text-[#8a9caa] animate-spin" />
                    </div>
                  )}
                  <p className="text-[8.5px] font-mono text-[#8a9caa] tabular-nums break-all text-center max-w-[160px] leading-relaxed">
                    {code}
                  </p>
                </div>
              </div>

              {/* ── Per-ticket download button (screen only) ─────────────── */}
              {qr && (
                <div className="tp-no-print px-6 md:px-8 pb-5">
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

              {/* ── Footer ───────────────────────────────────────────────── */}
              <div className="border-t border-dashed border-[#e2e8f0] px-6 md:px-8 py-3 flex flex-wrap items-center justify-between gap-2 bg-[#f8fafc]/70 print:bg-white">
                <p className="text-[9px] text-[#8a9caa] inline-flex items-center gap-1.5">
                  <ShieldCheck size={10} className="text-emerald-600" />
                  Verified by TicketPulse. One entry only. Valid with photo ID.
                </p>
                <p className="text-[9px] font-mono text-[#8a9caa] tabular-nums">{human}</p>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}
