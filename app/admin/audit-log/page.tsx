import { redirect } from "next/navigation"
import { desc, eq } from "drizzle-orm"
import { History } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { payoutAuditLog, payouts, users, events } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import DataTable, { type DataTableColumn } from "@/components/ui/DataTable"
import Badge, { type BadgeTone } from "@/components/ui/Badge"
import { formatCurrency, formatDateShort } from "@/lib/utils"

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

type AuditRow = {
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

export default async function AdminAuditLogPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") redirect("/auth/signin?callbackUrl=/admin/audit-log")

  let rows: AuditRow[] = []
  try {
    const raw = await db
      .select({
        id: payoutAuditLog.id,
        action: payoutAuditLog.action,
        fromStatus: payoutAuditLog.fromStatus,
        toStatus: payoutAuditLog.toStatus,
        performedBy: payoutAuditLog.performedBy,
        notes: payoutAuditLog.notes,
        createdAt: payoutAuditLog.createdAt,
        payoutAmount: payouts.amount,
        payoutCurrency: payouts.currency,
        organizerName: users.name,
        eventTitle: events.title,
      })
      .from(payoutAuditLog)
      .leftJoin(payouts, eq(payouts.id, payoutAuditLog.payoutId))
      .leftJoin(users, eq(users.id, payouts.userId))
      .leftJoin(events, eq(events.id, payouts.eventId))
      .orderBy(desc(payoutAuditLog.createdAt))
      .limit(500)
    rows = raw as AuditRow[]
  } catch (err) {
    console.error("[admin/audit-log] Failed to load audit log:", err)
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Admin"
        title="Payout audit log"
        subtitle="Every status change on every payout — who did it, when, and why. This data was already being recorded; it just didn't have a page."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10">
        {rows.length > 0 ? (
          <DataTable
            tableId="admin-audit-log"
            columns={COLUMNS}
            rows={rows}
            getRowId={(r) => r.id}
            exportFilename="payout-audit-log"
          />
        ) : (
          <EmptyState
            icon={History}
            title="No audit log entries yet"
            body="Every payout approval, rejection, and status change will be recorded here automatically."
            variant="inline"
          />
        )}
      </div>
    </div>
  )
}
