"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react"

import { orderAuthHeaders, rememberOrderAccess } from "@/lib/order-auth-client"
import { formatCurrency } from "@/lib/utils"

type RefundTicket = {
  id: string
  tierName: string
  amount: string
  eligible: boolean
  status: string
}

type RefundRequest = {
  id: string
  status: "requested" | "approved" | "rejected" | "confirmed" | "failed"
  source: string
  reason: string
  amount: string
  currency: string
  outsideStandardWindow: boolean
  reviewNote: string | null
  providerReference: string | null
  requestedAt: string
  providerConfirmedAt: string | null
}

type RefundState = {
  eventTitle: string
  eventStatus: string | null
  currency: string
  outsideStandardWindow: boolean
  canRequest: boolean
  unavailableReason: string | null
  tickets: RefundTicket[]
  requests: RefundRequest[]
}

const statusLabel: Record<RefundRequest["status"], string> = {
  requested: "Under review",
  approved: "Approved · provider processing not yet confirmed",
  rejected: "Not approved",
  confirmed: "Refund confirmed by provider",
  failed: "Provider refund not completed",
}

export default function RefundRequestPanel({
  orderId,
  signature,
}: {
  orderId: string
  signature?: string | null
}) {
  const [data, setData] = useState<RefundState | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    rememberOrderAccess(orderId, signature)
    try {
      const response = await fetch(`/api/orders/${orderId}/refunds`, {
        cache: "no-store",
        headers: orderAuthHeaders(orderId, signature),
      })
      if (!response.ok) throw new Error("Refund information is temporarily unavailable.")
      setData(await response.json() as RefundState)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refund information is temporarily unavailable.")
    } finally {
      setLoading(false)
    }
  }, [orderId, signature])

  useEffect(() => {
    // Loads server-owned request state after the order view becomes available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  async function submit() {
    if (submitting || !data || selected.length === 0 || reason.trim().length < 5) return
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(`/api/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "content-type": "application/json", ...orderAuthHeaders(orderId, signature) },
        body: JSON.stringify({ ticketIds: selected, reason: reason.trim() }),
      })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error ?? "Could not submit your request.")
      setMessage("Request received. No money has moved yet; we’ll update you after review and provider confirmation.")
      setReason("")
      setSelected([])
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your request.")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTotal = data?.tickets
    .filter((ticket) => selected.includes(ticket.id))
    .reduce((sum, ticket) => sum + Number(ticket.amount), 0) ?? 0

  return (
    <section className="mt-5 rounded-2xl border border-line bg-paper p-5" aria-labelledby="refund-request-title">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
          <RotateCcw size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="refund-request-title" className="text-[15px] font-semibold tracking-tight text-ink">Request a ticket refund</h3>
          <p className="mt-1 text-[12px] leading-5 text-ink-2">
            Select unused tickets. Standard requests are available until 24 hours before the event. Each request is reviewed; TicketPulse only marks a refund complete after Velocity confirms it.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-[12px] text-ink-3"><Loader2 size={13} className="animate-spin" /> Loading refund options…</p>
      ) : error && !data ? (
        <p className="mt-4 text-[12px] text-rose-700">{error}</p>
      ) : data ? (
        <>
          {data.eventStatus === "cancelled" ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-800">This event is cancelled. Refunds are queued for provider processing.</p>
          ) : data.outsideStandardWindow ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">
              This is inside the final 24 hours or after the event. You may still submit a request for exception review; this policy does not limit any rights under applicable law.
            </p>
          ) : null}

          {!data.canRequest && data.unavailableReason && (
            <p className="mt-4 text-[12px] text-ink-3">{data.unavailableReason}</p>
          )}

          {data.canRequest && data.tickets.some((ticket) => ticket.eligible) ? (
            <div className="mt-4 space-y-3">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-[12px] font-semibold text-ink-2">Choose one or more tickets</legend>
                {data.tickets.map((ticket, index) => (
                  <label key={ticket.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${ticket.eligible ? "border-line hover:border-amber-300" : "border-line bg-paper-2 opacity-70"}`}>
                    <input
                      type="checkbox"
                      checked={selected.includes(ticket.id)}
                      disabled={!ticket.eligible || submitting}
                      onChange={(event) => setSelected((current) => event.target.checked
                        ? [...current, ticket.id]
                        : current.filter((id) => id !== ticket.id))}
                      className="h-4 w-4 accent-amber-600"
                    />
                    <span className="min-w-0 flex-1 text-[12px] text-ink">
                      Ticket {index + 1} · {ticket.tierName}
                      {!ticket.eligible && <span className="ml-1 text-ink-3">· already requested, used, transferred, or unavailable</span>}
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-ink-2">{formatCurrency(Number(ticket.amount), data.currency)}</span>
                  </label>
                ))}
              </fieldset>
              <label className="block text-[12px] font-medium text-ink-2" htmlFor={`refund-reason-${orderId}`}>Reason for the request</label>
              <textarea
                id={`refund-reason-${orderId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Tell us briefly why you need a refund."
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20"
              />
              <p className="text-[11px] leading-5 text-ink-3">Estimated amount: {formatCurrency(selectedTotal, data.currency)}. The final amount is verified against the original payment. Submitting this request does not return money or cancel your ticket.</p>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || selected.length === 0 || reason.trim().length < 5}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {submitting ? "Submitting…" : "Submit refund request"}
              </button>
            </div>
          ) : data.canRequest ? (
            <p className="mt-4 text-[12px] text-ink-3">No unused tickets are available to request. Used or transferred tickets cannot be refunded through this form.</p>
          ) : null}

          {message && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] leading-5 text-emerald-800"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />{message}</p>}
          {error && data && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-[12px] leading-5 text-rose-800"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</p>}

          {data.requests.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h4 className="text-[12px] font-semibold text-ink">Refund request history</h4>
              <ul className="mt-2 space-y-2">
                {data.requests.map((refund) => (
                  <li key={refund.id} className="rounded-xl bg-paper-2 px-3 py-2.5 text-[12px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{statusLabel[refund.status]}</span>
                      <span className="font-semibold text-ink-2">{formatCurrency(Number(refund.amount), refund.currency)}</span>
                    </div>
                    <p className="mt-1 text-ink-3">{refund.reason}</p>
                    {refund.providerReference && <p className="mt-1 font-mono text-[11px] text-ink-3">Provider ref: {refund.providerReference}</p>}
                    {refund.reviewNote && <p className="mt-1 text-ink-2">{refund.reviewNote}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
