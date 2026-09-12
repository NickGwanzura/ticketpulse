"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Ticket, CheckCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react"

type TransferInfo = {
  recipientName: string | null
  recipientEmail: string | null
  tierName: string | null
  eventTitle: string | null
  eventSlug: string | null
  expiresAt: string | null
}

export default function ClaimTransferPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<TransferInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [newQrCode, setNewQrCode] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/tickets/transfer/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setInfo(data)
      })
      .catch(() => setError("Couldn't load transfer details. Please try again."))
      .finally(() => setLoading(false))
  }, [token])

  async function claim() {
    setClaiming(true)
    try {
      const res = await fetch(`/api/tickets/transfer/${token}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? "Failed to claim ticket")
      else {
        setClaimed(true)
        if (data.newQrCode) setNewQrCode(data.newQrCode)
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 flex flex-col items-center gap-3 text-ink-2">
        <Loader2 size={28} className="animate-spin text-ink-3" />
        <p className="text-[14px]">Loading transfer details…</p>
      </div>
    )
  }

  if (claimed) {
    return (
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <span className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-green-50 ring-1 ring-green-200 mb-5">
          <CheckCircle size={28} className="text-green-600" />
        </span>
        <h1 className="text-[24px] font-bold tracking-tight text-ink mb-2">Ticket claimed!</h1>
        <p className="text-[14px] text-ink-2 mb-6">
          Your ticket for <strong>{info?.eventTitle}</strong> is now yours. Present the QR below at the door.
        </p>

        {newQrCode && (
          <div className="mb-6 inline-block rounded-2xl border border-line bg-paper p-5 shadow-sm">
            {newQrCode.startsWith("data:image") ? (
              <img src={newQrCode} alt="Your ticket QR code" className="w-48 h-48 rounded-lg" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center bg-paper-2 rounded-lg text-[11px] text-ink-3 font-mono break-all p-2">
                {newQrCode}
              </div>
            )}
            <p className="mt-2 text-[12px] text-ink-3">Screenshot this QR code</p>
          </div>
        )}

        <p className="text-[13px] text-ink-3 mb-6">A confirmation email has been sent to you.</p>

        {info?.eventSlug && (
          <Link
            href={`/events/${info.eventSlug}`}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-brand-700 transition"
          >
            View event <ArrowRight size={14} />
          </Link>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-5 py-20 text-center">
        <span className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100 mb-5">
          <AlertCircle size={28} className="text-red-500" />
        </span>
        <h1 className="text-[22px] font-bold tracking-tight text-ink mb-2">Transfer unavailable</h1>
        <p className="text-[14px] text-ink-2 mb-6">{error}</p>
        <Link href="/" className="text-[13px] text-ink-3 underline hover:text-ink transition">Go to homepage</Link>
      </div>
    )
  }

  const expiryDate = info?.expiresAt
    ? new Date(info.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <div className="text-center mb-8">
        <span className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-paper-2 ring-1 ring-line mb-5">
          <Ticket size={26} className="text-navy" />
        </span>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Ticket transfer</p>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">You&apos;ve been sent a ticket</h1>
        <p className="mt-2 text-[14px] text-ink-2">
          Claim it below to add it to your name.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6 space-y-4 mb-6">
        <div className="flex items-start gap-4">
          <span className="shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
            <Ticket size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">{info?.eventTitle ?? "Event"}</p>
            <p className="text-[13px] text-ink-2">{info?.tierName ?? "Ticket"}</p>
          </div>
        </div>

        <div className="border-t border-line pt-4 space-y-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="text-ink-3">Transferred to</span>
            <span className="font-medium text-ink">{info?.recipientName}</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-ink-3">Email</span>
            <span className="font-medium text-ink">{info?.recipientEmail}</span>
          </div>
          {expiryDate && (
            <div className="flex justify-between text-[13px]">
              <span className="text-ink-3">Offer expires</span>
              <span className="text-ink">{expiryDate}</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={claim}
        disabled={claiming}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-60 transition"
      >
        {claiming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
        {claiming ? "Claiming…" : "Accept this ticket"}
      </button>

      <p className="mt-4 text-[12px] text-ink-3 text-center">
        By accepting you confirm this ticket is for you. The sender&apos;s QR code will be invalidated.
      </p>
    </div>
  )
}
