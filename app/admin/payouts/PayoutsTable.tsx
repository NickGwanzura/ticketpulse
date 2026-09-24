"use client"

import { CheckCircle2, Send, Smartphone, Building2, XCircle, Banknote } from "lucide-react"
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable"
import Badge, { type BadgeTone } from "@/components/ui/Badge"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import {
  approvePayoutAction, rejectPayoutAction, markPayoutPaidAction, markPayoutProcessingAction,
  type getPayouts,
} from "./actions"
import PayoutsBulkActions from "./PayoutsBulkActions"

// The table's column render/sort functions cannot be passed from a Server
// Component to the client DataTable (that was crashing /admin/payouts), so
// the table and its row actions live client-side and call the server actions.

export type PayoutStatus = "pending" | "approved" | "processing" | "paid" | "held" | "rejected" | "failed" | "cancelled"

export const STATUS_TONE: Record<PayoutStatus, BadgeTone> = {
  pending:    "warning",
  approved:   "violet",
  processing: "info",
  paid:       "success",
  held:       "danger",
  rejected:   "danger",
  failed:     "warning",
  cancelled:  "neutral",
}

export const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending:    "Pending",
  approved:   "Approved",
  processing: "Processing",
  paid:       "Paid",
  held:       "Held",
  rejected:   "Rejected",
  failed:     "Failed",
  cancelled:  "Cancelled",
}


export function payoutMethodLabel(payout: { method: string }) {
  if (payout.method === "cash") return "Manual cash"
  if (payout.method === "ecocash") return "EcoCash"
  return "USD Bank"
}

export type PayoutRow = Awaited<ReturnType<typeof getPayouts>>["payouts"][number]

function payoutActionsCell(p: PayoutRow) {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      {p.status === "pending" && (
        <>
          <form action={async () => { await approvePayoutAction(p.id) }}>
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700 transition-colors">
              <CheckCircle2 size={11} /> Approve
            </button>
          </form>
          <form action={async (formData: FormData) => { const reason = formData.get("reason") as string; await rejectPayoutAction(p.id, reason) }}>
            <div className="flex items-center gap-1">
              <input name="reason" type="text" placeholder="Reason..." required minLength={5} className="w-24 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-brand-600/20 focus:border-brand-600" />
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors">
                <XCircle size={10} /> Reject
              </button>
            </div>
          </form>
        </>
      )}

      {p.status === "approved" && (
        <>
          <form action={async () => { await markPayoutProcessingAction(p.id) }}>
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 transition-colors">
              <Send size={11} /> Process
            </button>
          </form>
          <form action={async (formData: FormData) => { const ref = formData.get("proofRef") as string; await markPayoutPaidAction(p.id, ref || undefined) }}>
            <div className="flex items-center gap-1">
              <input name="proofRef" type="text" required minLength={3} aria-label="Transfer or receipt reference" placeholder="Proof ref" className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-brand-600/20 focus:border-brand-600" />
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors">
                <CheckCircle2 size={10} /> Pay
              </button>
            </div>
          </form>
        </>
      )}

      {p.status === "processing" && (
        <form action={async (formData: FormData) => { const ref = formData.get("proofRef") as string; await markPayoutPaidAction(p.id, ref || undefined) }}>
          <div className="flex items-center gap-1">
            <input name="proofRef" type="text" required minLength={3} aria-label="Transfer or receipt reference" placeholder="Proof ref" className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-brand-600/20 focus:border-brand-600" />
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors">
              <CheckCircle2 size={10} /> Pay
            </button>
          </div>
        </form>
      )}

      {p.status === "paid" && p.proofReference && (
        <span className="text-[11px] text-ink-3 font-medium">Ref: {p.proofReference}</span>
      )}

      {p.status === "rejected" && p.rejectionReason && (
        <span className="text-[11px] text-red-600 max-w-[120px] truncate" title={p.rejectionReason}>
          {p.rejectionReason}
        </span>
      )}
    </div>
  )
}

const PAYOUT_COLUMNS: DataTableColumn<PayoutRow>[] = [
  {
    key: "organizer",
    label: "Organizer / Event",
    sortable: true,
    sortValue: (p) => p.organizerName ?? "",
    exportValue: (p) => p.organizerName ?? "",
    hideable: false,
    render: (p) => (
      <>
        <p className="text-[14px] font-semibold tracking-tight text-ink">{p.organizerName ?? "—"}</p>
        <p className="text-[12px] text-ink-3 mt-0.5 line-clamp-1">
          {p.eventTitle ?? "General"} · {p.id.slice(0, 8)}
          {p.rejectionReason && <span className="text-red-500 ml-2">Rejected: {p.rejectionReason}</span>}
        </p>
      </>
    ),
  },
  {
    key: "method",
    label: "Method",
    sortable: true,
    sortValue: (p) => payoutMethodLabel(p),
    exportValue: (p) => payoutMethodLabel(p),
    render: (p) => (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
          {p.method === "cash" ? <Banknote size={12} className="text-emerald-700" /> : p.method === "ecocash" ? <Smartphone size={12} className="text-emerald-700" /> : <Building2 size={12} className="text-sky-700" />}
          {payoutMethodLabel(p)}
        </span>
        <p className="text-[11px] text-ink-3 leading-4">
          {p.method === "cash" ? p.proofReference : p.method === "ecocash" ? p.accountNumber : [p.bankName, p.accountName, p.accountNumber].filter(Boolean).join(" · ")}
        </p>
      </div>
    ),
  },
  {
    key: "requested",
    label: "Requested",
    sortable: true,
    sortValue: (p) => (p.createdAt ? new Date(p.createdAt).getTime() : 0),
    exportValue: (p) => (p.createdAt ? new Date(p.createdAt).toISOString() : ""),
    render: (p) => <span className="whitespace-nowrap text-[13px] text-ink-2">{p.createdAt ? formatDateShort(new Date(p.createdAt)) : "—"}</span>,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    sortValue: (p) => p.status,
    exportValue: (p) => p.status,
    render: (p) => (
      <Badge tone={STATUS_TONE[p.status as PayoutStatus]}>{STATUS_LABEL[p.status as PayoutStatus]}</Badge>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sortable: true,
    hideable: false,
    sortValue: (p) => Number(p.amount),
    exportValue: (p) => Number(p.amount).toFixed(2),
    render: (p) => (
      <span className="text-[14px] font-bold tracking-tight text-ink whitespace-nowrap tabular-nums">
        {formatCurrency(Number(p.amount), p.currency)}
      </span>
    ),
  },
  {
    key: "actions",
    label: "Actions",
    align: "right",
    hideable: false,
    exportValue: () => "",
    render: payoutActionsCell,
  },
]

export default function PayoutsTable({ rows, exportFilename }: { rows: PayoutRow[]; exportFilename: string }) {
  return (
    <DataTable
      tableId="admin-payouts"
      columns={PAYOUT_COLUMNS}
      rows={rows}
      getRowId={(p) => p.id}
      exportFilename={exportFilename}
      renderBulkActions={(selectedIds, clearSelection) => (
        <PayoutsBulkActions
          selectedIds={selectedIds}
          clearSelection={clearSelection}
          allPending={selectedIds.every((id) => rows.find((p) => p.id === id)?.status === "pending")}
        />
      )}
    />
  )
}
