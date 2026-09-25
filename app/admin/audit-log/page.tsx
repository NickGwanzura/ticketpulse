import { redirect } from "next/navigation"
import { desc, eq } from "drizzle-orm"
import { History } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { adminAuditLog, payoutAuditLog, payouts, users, events } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { AdminActionsTable, PayoutAuditTable, type AdminActionRow, type AuditRow } from "./AuditTables"

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
          <PayoutAuditTable rows={rows} />
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
          <AdminActionsTable rows={adminActions} />
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
