"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react"

import {
  approveRefundRequestAction,
  confirmRefundRequestAction,
  failRefundRequestAction,
  rejectRefundRequestAction,
} from "@/app/admin/actions/refunds"
import { formatCurrency, formatDateShort } from "@/lib/utils"

export type RefundCaseView = {
  id: string
  status: "requested" | "approved" | "rejected" | "confirmed" | "failed"
  source: string
  requestedByEmail: string
  reason: string
  amount: string
  currency: string
  outsideStandardWindow: boolean
  requestedAt: Date | null
  reviewNote: string | null
  providerReference: string | null
  providerConfirmedAt: Date | null
  tickets: { id: string; tierName: string; amount: string }[]
}

export default function RefundCaseAdminPanel({ cases }: { cases: RefundCaseView[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [references, setReferences] = useState<Record<string, string>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmProvider, setConfirmProvider] = useState<Record<string, boolean>>({})
  const [confirmNoRefund, setConfirmNoRefund] = useState<Record<string, boolean>>({})

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id)
    setErrors((all) => ({ ...all, [id]: "" }))
    try {
      await action()
      router.refresh()
    } catch (error) {
      setErrors((all) => ({ ...all, [id]: error instanceof Error ? error.message : "Action failed" }))
    } finally {
      setBusyId(null)
    }
  }

  if (cases.length === 0) {
    return <p className="text-[13px] text-ink-3">No refund requests on this order.</p>
  }

  return (
    <div className="space-y-4">
      {cases.map((item) => (
        <article key={item.id} className="rounded-2xl border border-line bg-paper p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-ink">Refund {item.id.slice(0, 8).toUpperCase()}</p>
              <p className="mt-1 text-[11px] text-ink-3">{item.source === "event_cancellation" ? "Event cancellation" : `Requested by ${item.requestedByEmail}`} · {item.requestedAt ? formatDateShort(item.requestedAt) : "—"}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === "confirmed" ? "bg-emerald-50 text-emerald-800" : item.status === "rejected" || item.status === "failed" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>
              {item.status.replaceAll("_", " ")}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[18px] font-bold tracking-tight text-ink">{formatCurrency(Number(item.amount), item.currency)}</p>
            <p className="text-[11px] text-ink-3">{item.tickets.length} ticket{item.tickets.length === 1 ? "" : "s"}</p>
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {item.tickets.map((ticket) => (
              <li key={ticket.id} className="rounded-lg bg-paper-2 px-2 py-1 text-[11px] text-ink-2">{ticket.tierName} · {formatCurrency(Number(ticket.amount), item.currency)}</li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-5 text-ink-2">Reason: {item.reason}</p>
          {item.outsideStandardWindow && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900"><AlertTriangle size={13} className="mt-0.5 shrink-0" />Outside the standard 24-hour refund window; review as an exception and check applicable consumer rights.</p>
          )}
          {item.reviewNote && <p className="mt-2 text-[12px] text-ink-2">Admin note: {item.reviewNote}</p>}
          {item.providerReference && <p className="mt-2 font-mono text-[11px] text-ink-3">Velocity reference: {item.providerReference}{item.providerConfirmedAt ? ` · ${formatDateShort(item.providerConfirmedAt)}` : ""}</p>}

          {item.status === "requested" && (
            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row">
              <button
                type="button"
                onClick={() => void run(item.id, () => approveRefundRequestAction(item.id))}
                disabled={busyId === item.id}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {busyId === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Approve & hold tickets
              </button>
              <div className="flex min-w-0 flex-1 gap-2">
                <input
                  value={notes[item.id] ?? ""}
                  onChange={(event) => setNotes((all) => ({ ...all, [item.id]: event.target.value }))}
                  maxLength={1000}
                  placeholder="Reason if declining"
                  aria-label="Reason for declining refund"
                  className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-[12px] text-ink"
                />
                <button
                  type="button"
                  onClick={() => void run(item.id, () => rejectRefundRequestAction(item.id, notes[item.id] ?? ""))}
                  disabled={busyId === item.id || (notes[item.id] ?? "").trim().length < 5}
                  className="min-h-10 rounded-xl border border-rose-200 px-3 text-[12px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >Decline</button>
              </div>
            </div>
          )}

          {item.status === "approved" && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="rounded-xl bg-sky-50 px-3.5 py-3 text-[12px] leading-5 text-sky-950">
                <p className="font-semibold">Process in Velocity, then record the confirmed result</p>
                <ol className="mt-1 list-decimal pl-4 text-sky-900">
                  <li>Issue exactly {formatCurrency(Number(item.amount), item.currency)} to the original payment method.</li>
                  <li>Wait until Velocity shows the refund as successful, not pending.</li>
                  <li>Enter its provider reference and exact amount below.</li>
                </ol>
                <p className="mt-1">Tickets are temporarily held while the provider outcome is pending.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <input
                  value={references[item.id] ?? ""}
                  onChange={(event) => setReferences((all) => ({ ...all, [item.id]: event.target.value }))}
                  maxLength={120}
                  placeholder="Velocity refund reference"
                  aria-label="Velocity refund reference"
                  className="min-h-10 rounded-xl border border-line bg-paper px-3 text-[12px] text-ink"
                />
                <input
                  value={amounts[item.id] ?? item.amount}
                  onChange={(event) => setAmounts((all) => ({ ...all, [item.id]: event.target.value }))}
                  inputMode="decimal"
                  aria-label="Provider-confirmed amount"
                  className="min-h-10 rounded-xl border border-line bg-paper px-3 text-[12px] text-ink"
                />
                <button
                  type="button"
                  onClick={() => void run(item.id, () => confirmRefundRequestAction(item.id, { reference: references[item.id] ?? "", amount: amounts[item.id] ?? item.amount }))}
                  disabled={busyId === item.id || !confirmProvider[item.id] || (references[item.id] ?? "").trim().length < 3}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
                >
                  {busyId === item.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  Confirm refund
                </button>
              </div>
              <label className="flex items-start gap-2 text-[11px] leading-5 text-ink-2">
                <input
                  type="checkbox"
                  checked={confirmProvider[item.id] ?? false}
                  onChange={(event) => setConfirmProvider((all) => ({ ...all, [item.id]: event.target.checked }))}
                  className="mt-1 h-3.5 w-3.5 accent-emerald-700"
                />
                I verified in Velocity that this refund completed successfully for the amount above. I am not recording a pending or failed transaction.
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={notes[item.id] ?? ""}
                  onChange={(event) => setNotes((all) => ({ ...all, [item.id]: event.target.value }))}
                  maxLength={1000}
                  placeholder="Explain why the provider did not complete it"
                  aria-label="Reason provider refund failed"
                  className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-[12px] text-ink"
                />
                <button
                  type="button"
                  onClick={() => void run(item.id, () => failRefundRequestAction(item.id, { note: notes[item.id] ?? "", confirmedNoRefund: true }))}
                  disabled={busyId === item.id || !confirmNoRefund[item.id] || (notes[item.id] ?? "").trim().length < 5}
                  className="min-h-10 rounded-xl border border-rose-200 px-3 text-[12px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >Release tickets · provider failed</button>
              </div>
              <label className="flex items-start gap-2 text-[11px] leading-5 text-ink-2">
                <input
                  type="checkbox"
                  checked={confirmNoRefund[item.id] ?? false}
                  onChange={(event) => setConfirmNoRefund((all) => ({ ...all, [item.id]: event.target.checked }))}
                  className="mt-1 h-3.5 w-3.5 accent-rose-700"
                />
                I verified in Velocity that no refund was completed and no money was returned. Releasing these tickets will make them active again.
              </label>
            </div>
          )}

          {errors[item.id] && <p role="alert" className="mt-3 text-[12px] text-rose-700">{errors[item.id]}</p>}
        </article>
      ))}
    </div>
  )
}
