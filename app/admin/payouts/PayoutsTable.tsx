"use client"

import {
  Banknote, Building2, CheckCircle2, Send, Smartphone, XCircle,
} from "lucide-react"
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable"
import Badge, { type BadgeTone } from "@/components/ui/Badge"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import PayoutsBulkActions from "./PayoutsBulkActions"
import { handlePayoutTableAction, type AdminPayoutRow } from "./actions"

type PayoutStatus = "pending" | "approved" | "processing" | "paid" | "held" | "rejected" | "failed" | "cancelled"

const STATUS_TONE: Record<PayoutStatus, BadgeTone> = {
  pending: "warning",
  approved: "violet",
  processing: "info",
  paid: "success",
  held: "danger",
  rejected: "danger",
  failed: "warning",
  cancelled: "neutral",
}

const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  processing: "Processing",
  paid: "Paid",
  held: "Held",
  rejected: "Rejected",
  failed: "Failed",
  cancelled: "Cancelled",
}

function payoutMethodLabel(payout: { method: string }) {
  if (payout.method === "cash") return "Manual cash"
  if (payout.method === "ecocash") return "EcoCash"
  if (payout.method === "bank_zar") return "Legacy ZAR bank transfer"
  return "USD Bank"
}

function hiddenFields(payoutId: string, action: string) {
  return (
    <>
      <input type="hidden" name="payoutId" value={payoutId} />
      <input type="hidden" name="action" value={action} />
    </>
  )
}

function payoutActionsCell(p: AdminPayoutRow) {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      {p.status === "pending" && (
        <>
          <form action={handlePayoutTableAction}>
            {hiddenFields(p.id, "approve")}
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700 transition-colors">
              <CheckCircle2 size={11} /> Approve
            </button>
          </form>
          <form action={handlePayoutTableAction}>
            {hiddenFields(p.id, "reject")}
            <div className="flex items-center gap-1">
              <input name="reason" type="text" placeholder="Reason..." required minLength={5} className="w-24 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-brand-600/20 focus:border-brand-600" />
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors">
                <XCircle size={10} /> Reject
              </button>
            </div>
          </form>
          <form action={handlePayoutTableAction}>
            {hiddenFields(p.id, "paid")}
            <div className="flex items-center gap-1">
              <input name="proofReference" type="text" placeholder="Ref..." required minLength={3} maxLength={200} className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-brand-600/20 focus:border-brand-600" />
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors">
                <CheckCircle2 size={10} /> Already paid
              </button>
            </div>
          </form>
        </>
      )}

      {p.status === "approved" && (
        <>
          <form action={handlePayoutTableAction}>
            {hiddenFields(p.id, "processing")}
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 transition-colors">
              <Send size={11} /> Process
            </button>
          </form>
          <form action={handlePayoutTableAction}>
            {hiddenFields(p.id, "paid")}
            <div className="flex items-center gap-1">
              <input name="proofReference" type="text" placeholder="Ref..." required minLength={3} maxLength={200} className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-brand-600/20 focus:border-brand-600" />
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors">
                <CheckCircle2 size={10} /> Pay
              </button>
            </div>
          </form>
        </>
      )}

      {p.status === "processing" && (
        <form action={handlePayoutTableAction}>
          {hiddenFields(p.id, "paid")}
          <div className="flex items-center gap-1">
            <input name="proofReference" type="text" placeholder="Ref..." required minLength={3} maxLength={200} className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-1 focus:ring-brand-600/20 focus:border-brand-600" />
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors">
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

const PAYOUT_COLUMNS: DataTableColumn<AdminPayoutRow>[] = [
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
    render: (p) => <Badge tone={STATUS_TONE[p.status as PayoutStatus]}>{STATUS_LABEL[p.status as PayoutStatus]}</Badge>,
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sortable: true,
    hideable: false,
    sortValue: (p) => Number(p.amount),
    exportValue: (p) => Number(p.amount).toFixed(2),
    render: (p) => <span className="text-[14px] font-bold tracking-tight text-ink whitespace-nowrap tabular-nums">{formatCurrency(Number(p.amount), p.currency ?? "USD")}</span>,
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

export default function PayoutsTable({ rows }: { rows: AdminPayoutRow[] }) {
  return (
    <DataTable
      tableId="admin-payouts"
      columns={PAYOUT_COLUMNS}
      rows={rows}
      getRowId={(p) => p.id}
      exportFilename="payouts"
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
