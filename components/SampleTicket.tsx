"use client"

import { useEffect, useState } from "react"
import { Download, Loader2, Calendar, MapPin, ShieldCheck, Smartphone, QrCode, Eye, X } from "lucide-react"
import QRCode from "qrcode"
import { formatCurrency, formatDate } from "@/lib/utils"

// Helpers

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


type SampleTicketProps = {
  eventId: string
  eventTitle: string
  eventStartsAt: Date | string
  eventVenue: string
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


export default function SampleTicket({ eventId, eventTitle, eventStartsAt, eventVenue, tier, onClose }: SampleTicketProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)

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

  return (
    <div className="border-t border-line bg-gradient-to-b from-paper-2/30 to-paper/60">
      <div className="p-5 md:p-6 max-w-3xl mx-auto">
        {/* Header */}
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
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-700 transition"
            >
              <Download size={13} />
              Print preview
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

        {/* Ticket card */}
        <div className="relative bg-white rounded-2xl border border-line overflow-hidden shadow-sm">
          {/* Gradient top bar */}
          <div className="h-1 bg-gradient-to-r from-navy via-blue-600 to-navy" aria-hidden />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none" aria-hidden="true">
                <rect x="2" y="4" width="28" height="24" rx="3" fill="#909090"/>
                <rect x="0" y="10" width="4" height="12" rx="2" fill="#0a2540"/>
                <rect x="28" y="10" width="4" height="12" rx="2" fill="#0a2540"/>
                <rect x="19" y="4" width="1.5" height="24" rx="0.5" fill="#FFFFFF" fillOpacity={0.2}/>
                <rect x="5" y="14" width="2.5" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.4}/>
                <rect x="8.5" y="14" width="2" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.25}/>
                <rect x="11.5" y="14" width="2.5" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.4}/>
                <rect x="15" y="14" width="2" height="8" rx="0.5" fill="#FFFFFF" fillOpacity={0.25}/>
                <circle cx="24" cy="16" r="2.5" fill="#FFFFFF" fillOpacity={0.5}/>
              </svg>
              <div>
                <p className="text-[11px] font-bold tracking-tight text-ink">TicketPulse</p>
                <p className="text-[9px] text-ink-3">Verified digital ticket</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-semibold tracking-[0.2em] text-ink-3 uppercase">Sample</p>
              <p className="text-[10px] font-mono text-ink tabular-nums">{shortCode(tier.id)}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-dashed border-line" />

          {/* Body */}
          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1.4fr_auto_1fr] gap-4 items-stretch">
            {/* Left: event info */}
            <div className="min-w-0">
              {/* Tier badge */}
              <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[9px] font-semibold text-blue-700 mb-2.5">
                {tier.name}
              </span>

              {/* Event title */}
              <h3 className="text-[18px] md:text-[22px] font-bold tracking-tight leading-[1.15] text-ink">
                {eventTitle}
              </h3>

              {/* Details */}
              <dl className="mt-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Calendar size={11} className="text-ink-3 mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[7.5px] font-semibold tracking-[0.15em] text-ink-3 uppercase">Starts</dt>
                    <dd className="text-[11px] text-ink font-medium">{formatDate(eventStartsAt, { timeZone: "Africa/Harare" })}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={11} className="text-ink-3 mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[7.5px] font-semibold tracking-[0.15em] text-ink-3 uppercase">Venue</dt>
                    <dd className="text-[11px] text-ink font-medium">{eventVenue}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck size={11} className="text-ink-3 mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[7.5px] font-semibold tracking-[0.15em] text-ink-3 uppercase">Price</dt>
                    <dd className="text-[11px] text-ink font-medium">{formatCurrency(price, tier.currency ?? "USD")}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Smartphone size={11} className="text-ink-3 mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-[7.5px] font-semibold tracking-[0.15em] text-ink-3 uppercase">Gate</dt>
                    <dd className="text-[11px] text-ink font-medium">Standard entry</dd>
                  </div>
                </div>
              </dl>

              {/* Meta grid */}
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-[7.5px] font-semibold tracking-[0.15em] text-ink-3 uppercase">Event ID</p>
                  <p className="text-[10px] font-mono text-ink tabular-nums">{eventId.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-[7.5px] font-semibold tracking-[0.15em] text-ink-3 uppercase">Tier</p>
                  <p className="text-[10px] font-mono text-ink tabular-nums">{tier.id.slice(0, 8)}</p>
                </div>
              </div>
            </div>

            {/* Middle: perforation (desktop only) */}
            <div className="hidden md:flex relative items-center justify-center" aria-hidden>
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white ring-1 ring-line" />
              <span className="w-px h-full border-l-2 border-dashed border-line" />
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white ring-1 ring-line" />
            </div>

            {/* Right: QR code */}
            <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl bg-paper-2 ring-1 ring-line p-4">
              <p className="text-[8px] font-semibold tracking-[0.2em] text-ink-3 uppercase">Scan test</p>
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`Test QR for ${tier.name}`}
                  className="w-[140px] h-[140px] rounded-lg ring-1 ring-line bg-white"
                />
              ) : (
                <div className="w-[140px] h-[140px] rounded-lg bg-paper-2 animate-pulse flex items-center justify-center">
                  <Loader2 size={16} className="text-ink-3 animate-spin" />
                </div>
              )}
              <p className="text-[7.5px] font-mono text-ink-3 tabular-nums break-all text-center max-w-[140px] leading-relaxed">
                {testCode}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-dashed border-line px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-paper-2">
            <p className="text-[8px] text-ink-3 inline-flex items-center gap-1">
              <ShieldCheck size={8} className="text-brand-600" />
              Sample ticket — not valid for entry
            </p>
            <p className="text-[8px] font-mono text-ink-3 tabular-nums">{shortCode(tier.id)}</p>
          </div>
        </div>

        {/* QR test hint */}
        {qrUrl && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-green-50 px-4 py-3 text-[13px] text-green-800 flex items-start gap-2.5">
            <QrCode size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-0.5">Scan to test</p>
              <p className="text-green-700">
                Open the scan page on your phone and point it at the QR code above. It encodes{" "}
                <code className="text-[11px] bg-white/60 px-1 py-0.5 rounded font-mono">{testCode}</code>
                — the same format real tickets use.
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        {tier.description && (
          <div className="mt-4 text-[13px] text-ink-2 leading-relaxed">
            <span className="font-semibold text-ink">Tier description:</span> {tier.description}
          </div>
        )}
      </div>
    </div>
  )
}
