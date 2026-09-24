"use client"

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable"
import Badge, { type BadgeTone } from "@/components/ui/Badge"
import { formatCurrency, formatDateShort } from "@/lib/utils"

// Column definitions hold render/sort functions, which cannot cross from a
// Server Component into the client DataTable — so they live here.

const ACTION_TONE: Record<string, BadgeTone> = {
  requested: "info",
  approved: "violet",
  processing: "info",
  paid: "success",
  rejected: "danger",
  cancelled: "neutral",
  status_updated: "neutral",
  recorded_manual: "success",
}

export type AuditRow = {
  id: string
  action: string
  fromStatus: string | null
  toStatus: string
  performedBy: string
  notes: string | null
  createdAt: Date | null
  payoutAmount: string | null
  payoutCurrency: string | null
  organizerName: string | null
  eventTitle: string | null
}

const COLUMNS: DataTableColumn<AuditRow>[] = [
  {
    key: "when",
    label: "When",
    hideable: false,
    sortable: true,
    sortValue: (r) => (r.createdAt ? new Date(r.createdAt).getTime() : 0),
    exportValue: (r) => (r.createdAt ? new Date(r.createdAt).toISOString() : ""),
    render: (r) => <span className="whitespace-nowrap text-[13px] text-ink-2">{r.createdAt ? formatDateShort(new Date(r.createdAt)) : "—"}</span>,
  },
  {
    key: "action",
    label: "Action",
    sortable: true,
    sortValue: (r) => r.action,
    exportValue: (r) => r.action,
    render: (r) => (
      <Badge tone={ACTION_TONE[r.action] ?? "neutral"}>
        {r.fromStatus ? `${r.fromStatus} → ${r.toStatus}` : r.action.replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    key: "organizer",
    label: "Organizer / Event",
    sortable: true,
    sortValue: (r) => r.organizerName ?? "",
    exportValue: (r) => `${r.organizerName ?? ""} / ${r.eventTitle ?? ""}`,
    render: (r) => (
      <>
        <p className="text-[13.5px] font-medium text-ink">{r.organizerName ?? "—"}</p>
        <p className="text-[12px] text-ink-3">{r.eventTitle ?? "General"}</p>
      </>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    sortable: true,
    sortValue: (r) => Number(r.payoutAmount ?? 0),
    exportValue: (r) => Number(r.payoutAmount ?? 0).toFixed(2),
    render: (r) => <span className="font-semibold tabular-nums">{r.payoutAmount ? formatCurrency(Number(r.payoutAmount), r.payoutCurrency ?? "USD") : "—"}</span>,
  },
  {
    key: "performedBy",
    label: "Performed by",
    sortable: true,
    sortValue: (r) => r.performedBy,
    exportValue: (r) => r.performedBy,
    render: (r) => <span className="text-[13px] text-ink-2">{r.performedBy}</span>,
  },
  {
    key: "notes",
    label: "Notes",
    exportValue: (r) => r.notes ?? "",
    render: (r) => <span className="text-[12.5px] text-ink-3 line-clamp-2 max-w-xs" title={r.notes ?? undefined}>{r.notes ?? "—"}</span>,
  },
]

export type AdminActionRow = {
  id: string
  actorEmail: string | null
  actorId: string
  action: string
  targetType: string
  targetId: string
  before: unknown
  after: unknown
  reason: string | null
  createdAt: Date
}

const summarize = (value: unknown) => (value == null ? "—" : typeof value === "string" ? value : JSON.stringify(value))

const ADMIN_ACTION_COLUMNS: DataTableColumn<AdminActionRow>[] = [
  {
    key: "when",
    label: "When",
    hideable: false,
    sortable: true,
    sortValue: (r) => new Date(r.createdAt).getTime(),
    exportValue: (r) => new Date(r.createdAt).toISOString(),
    render: (r) => <span className="whitespace-nowrap text-[13px] text-ink-2">{formatDateShort(new Date(r.createdAt))}</span>,
  },
  {
    key: "actor",
    label: "Admin",
    sortable: true,
    sortValue: (r) => r.actorEmail ?? r.actorId,
    exportValue: (r) => r.actorEmail ?? r.actorId,
    render: (r) => <span className="text-[13px] text-ink-2">{r.actorEmail ?? r.actorId}</span>,
  },
  {
    key: "action",
    label: "Action",
    sortable: true,
    sortValue: (r) => r.action,
    exportValue: (r) => r.action,
    render: (r) => <Badge tone={r.action.includes("reject") || r.action.includes("delete") || r.action.includes("refund") || r.action.includes("freeze") && !r.action.includes("unfreeze") ? "danger" : r.action.includes("approve") ? "success" : "neutral"}>{r.action.replace(/[._]/g, " ")}</Badge>,
  },
  {
    key: "target",
    label: "Target",
    sortable: true,
    sortValue: (r) => `${r.targetType}:${r.targetId}`,
    exportValue: (r) => `${r.targetType}:${r.targetId}`,
    render: (r) => (
      <>
        <p className="text-[12px] uppercase tracking-wide text-ink-3">{r.targetType}</p>
        <p className="text-[12.5px] font-mono text-ink-2 break-all">{r.targetId}</p>
      </>
    ),
  },
  {
    key: "change",
    label: "Change",
    exportValue: (r) => `${summarize(r.before)} -> ${summarize(r.after)}`,
    render: (r) => (
      <span className="text-[12px] text-ink-3 line-clamp-2 max-w-xs font-mono" title={`${summarize(r.before)} → ${summarize(r.after)}`}>
        {summarize(r.before)} → {summarize(r.after)}
      </span>
    ),
  },
  {
    key: "reason",
    label: "Reason",
    exportValue: (r) => r.reason ?? "",
    render: (r) => <span className="text-[12.5px] text-ink-3">{r.reason ?? "—"}</span>,
  },
]

export function PayoutAuditTable({ rows }: { rows: AuditRow[] }) {
  return <DataTable tableId="admin-audit-log" columns={COLUMNS} rows={rows} getRowId={(r) => r.id} exportFilename="payout-audit-log" />
}

export function AdminActionsTable({ rows }: { rows: AdminActionRow[] }) {
  return <DataTable tableId="admin-actions-log" columns={ADMIN_ACTION_COLUMNS} rows={rows} getRowId={(r) => r.id} exportFilename="admin-actions-log" />
}
