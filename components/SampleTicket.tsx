"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Download, Loader2, Ticket, Calendar, ShieldCheck, Smartphone, QrCode, Eye, X } from "lucide-react"
import QRCode from "qrcode"
import { formatCurrency } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortCode(tierId: string) {
  return `TEST-${tierId.slice(-6)}`
}

function qrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    width: 400,
    margin: 1,
    color: { dark: "#0a2540", light: "#ffffff" },
  })
}

// ─── Props ───────────────────────────────────────────────────────────────────

type SampleTicketProps = {
  eventId: string
  eventTitle: string
  tier: {
    id: string
    name: string
    description: string | null
    price: string
    currency: string | null
  }
  /** Called when the user closes the preview panel */
  onClose?: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SampleTicket({ eventId, eventTitle, tier, onClose }: SampleTicketProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const ticketRef = useRef<HTMLDivElement | null>(null)

  const testCode = shortCode(tier.id)
  const price = Number.parseFloat(tier.price) || 0

  // Generate real QR code
  useEffect(() => {
    let cancelled = false
    qrDataUrl(testCode).then((url) => {
      if (!cancelled) setQrUrl(url)
    })
    return () => { cancelled = true }
  }, [testCode])

  // Download sample ticket as PDF
  const downloadPdf = useCallback(async () => {
    setDownloading(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: html2canvas } = await import("html2canvas")

      const el = ticketRef.current
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
      pdf.save(`sample-${tier.name.replace(/\s+/g, "-").toLowerCase()}-ticket.pdf`)
    } catch (err) {
      console.error("Sample PDF download failed:", err)
    } finally {
      setDownloading(false)
    }
  }, [tier.name])

  return (
    <div className="border-t border-line bg-gradient-to-b from-paper-2/30 to-paper/60">
      <div className="p-5 md:p-6 max-w-3xl mx-auto">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy/10 flex items-center justify-center">
              <Eye size={14} className="text-navy" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-ink">Sample ticket preview</p>
              <p className="text-[11px] text-ink-3">
                This is what a <span className="font-semibold text-ink-2">{tier.name}</span> ticket will look like
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPdf}
              disabled={!qrUrl || downloading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {downloading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              {downloading ? "Generating PDF…" : "Download sample PDF"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-lg border border-line bg-paper p-2 text-ink-2 hover:text-ink hover:border-line-2 transition"
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── Ticket card ──────────────────────────────────────────────── */}
        <div
          ref={ticketRef}
          className="relative bg-white rounded-2xl border border-[#e3e8ee] overflow-hidden shadow-sm"
        >
          {/* Gradient top bar */}
          <div className="h-1 bg-gradient-to-r from-[#0a2540] via-[#2563eb] to-[#0a2540]" aria-hidden />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0a2540] flex items-center justify-center">
                <Ticket size={14} className="text-white" />
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-tight text-[#0a2540]">TicketPulse</p>
                <p className="text-[8.5px] text-[#697386]">Verified digital ticket</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-semibold tracking-[0.2em] text-[#697386] uppercase">Sample</p>
              <p className="text-[10px] font-mono text-[#0a2540] tabular-nums">{shortCode(tier.id)}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-dashed border-[#e3e8ee]" />

          {/* Body */}
          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1.4fr_auto_1fr] gap-4 items-stretch">
            {/* Left: event info */}
            <div className="min-w-0">
              {/* Tier badge */}
              <span className="inline-block rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[9px] font-semibold text-[#1d4ed8] mb-2.5">
                {tier.name}
              </span>

              {/* Event title */}
              <h3 className="text-[18px] md:text-[22px] font-bold tracking-tight leading-[1.15] text-[#0a2540]">
                {eventTitle}
              </h3>

              {/* Details */}
              <dl className="mt-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Calendar size={11} className="text-[#697386] mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[7.5px] font-semibold tracking-[0.15em] text-[#697386] uppercase">Sample date</dt>
                    <dd className="text-[11px] text-[#0a2540] font-medium">Preview ticket</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck size={11} className="text-[#697386] mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[7.5px] font-semibold tracking-[0.15em] text-[#697386] uppercase">Price</dt>
                    <dd className="text-[11px] text-[#0a2540] font-medium">{formatCurrency(price, tier.currency ?? "USD")}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Smartphone size={11} className="text-[#697386] mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[7.5px] font-semibold tracking-[0.15em] text-[#697386] uppercase">Gate</dt>
                    <dd className="text-[11px] text-[#0a2540] font-medium">Standard entry</dd>
                  </div>
                </div>
              </dl>

              {/* Meta grid */}
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-[7.5px] font-semibold tracking-[0.15em] text-[#697386] uppercase">Event ID</p>
                  <p className="text-[10px] font-mono text-[#0a2540] tabular-nums">{eventId.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-[7.5px] font-semibold tracking-[0.15em] text-[#697386] uppercase">Tier</p>
                  <p className="text-[10px] font-mono text-[#0a2540] tabular-nums">{tier.id.slice(0, 8)}</p>
                </div>
              </div>
            </div>

            {/* Middle: perforation (desktop only) */}
            <div className="hidden md:flex relative items-center justify-center" aria-hidden>
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white ring-1 ring-[#e3e8ee]" />
              <span className="w-px h-full border-l-2 border-dashed border-[#e3e8ee]" />
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white ring-1 ring-[#e3e8ee]" />
            </div>

            {/* Right: QR code */}
            <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl bg-[#f6f9fc] ring-1 ring-[#e3e8ee] p-4">
              <p className="text-[8px] font-semibold tracking-[0.2em] text-[#697386] uppercase">Scan test</p>
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`Test QR for ${tier.name}`}
                  className="w-[140px] h-[140px] rounded-lg ring-1 ring-[#e3e8ee] bg-white"
                />
              ) : (
                <div className="w-[140px] h-[140px] rounded-lg bg-[#e3e8ee] animate-pulse flex items-center justify-center">
                  <Loader2 size={16} className="text-[#697386] animate-spin" />
                </div>
              )}
              <p className="text-[7.5px] font-mono text-[#697386] tabular-nums break-all text-center max-w-[140px] leading-relaxed">
                {testCode}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-dashed border-[#e3e8ee] px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-[#f6f9fc]">
            <p className="text-[8px] text-[#697386] inline-flex items-center gap-1">
              <ShieldCheck size={8} className="text-[#059669]" />
              Sample ticket — not valid for entry
            </p>
            <p className="text-[8px] font-mono text-[#697386] tabular-nums">{shortCode(tier.id)}</p>
          </div>
        </div>

        {/* ── QR test hint ──────────────────────────────────────────────── */}
        {qrUrl && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[12.5px] text-blue-800 flex items-start gap-2.5">
            <QrCode size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-0.5">Scan to test</p>
              <p className="text-blue-700">
                Open the scan page on your phone and point it at the QR code above. It encodes{" "}
                <code className="text-[11px] bg-white/60 px-1 py-0.5 rounded font-mono">{testCode}</code>
                — the same format real tickets use.
              </p>
            </div>
          </div>
        )}

        {/* ── Description ───────────────────────────────────────────────── */}
        {tier.description && (
          <div className="mt-4 text-[12.5px] text-ink-2 leading-relaxed">
            <span className="font-semibold text-ink">Tier description:</span> {tier.description}
          </div>
        )}
      </div>
    </div>
  )
}
