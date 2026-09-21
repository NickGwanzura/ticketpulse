import { redirect } from "next/navigation"
import { desc, eq } from "drizzle-orm"
import { History } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { adminAuditLog, payoutAuditLog, payouts, users, events } from "@/db/schema"
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

type AdminActionRow = {
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

  let adminActions: AdminActionRow[] = []
  try {
    adminActions = await db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(500)
  } catch (err) {
    console.error("[admin/audit-log] Failed to load admin actions:", err)
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        subtitle="Who changed what: admin actions on accounts, orders and organisers, and every payout status change."
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

        <h2 className="mt-12 mb-1 text-[16px] font-semibold text-ink">Admin actions</h2>
        <p className="mb-4 text-[13px] text-ink-2">Approvals, role and verification changes, freezes, refunds, cancellations, manual completions and deletions.</p>
        {adminActions.length > 0 ? (
          <DataTable
            tableId="admin-actions-log"
            columns={ADMIN_ACTION_COLUMNS}
            rows={adminActions}
            getRowId={(r) => r.id}
            exportFilename="admin-actions-log"
          />
        ) : (
          <EmptyState
            icon={History}
            title="No admin actions recorded yet"
            body="Actions taken from now on are recorded here automatically."
            variant="inline"
          />
        )}
      </div>
    </div>
  )
}
