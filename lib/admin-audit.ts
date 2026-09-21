import "server-only"

import { db } from "@/db"
import { adminAuditLog } from "@/db/schema"

type ActingAdmin = { user: { id?: string | null; email?: string | null } }

export type AdminAuditEntry = {
  /** Verb, dotted by area: "organizer.approve", "user.role_change", "order.complete"… */
  action: string
  targetType: "user" | "organizer" | "event" | "order" | "payout" | "settings"
  targetId: string
  before?: unknown
  after?: unknown
  reason?: string | null
}

/**
 * Records who changed what. Best-effort by design: an audit-write failure is
 * logged loudly but never blocks the admin action itself, so shipping this
 * before the migration has run can't take the admin tools down.
 */
export async function recordAdminAction(session: ActingAdmin, entry: AdminAuditEntry): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      actorId: session.user.id ?? "unknown",
      actorEmail: session.user.email ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      before: entry.before ?? null,
      after: entry.after ?? null,
      reason: entry.reason ?? null,
    })
  } catch (error) {
    console.error("[admin-audit] failed to record", entry.action, entry.targetId, error)
  }
}
