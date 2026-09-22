import "server-only"

import { db } from "@/db"
import { adminAuditLog } from "@/db/schema"
import { log } from "@/lib/logger"

type ActingAdmin = { user: { id?: string | null; email?: string | null } }

export type AdminAuditEntry = {
  action: string
  targetType: "user" | "organizer" | "event" | "order" | "payout" | "settings" | string
  targetId: string
  before?: unknown
  after?: unknown
  reason?: string | null
}

type AuditSnapshot = Record<string, unknown> | null

export async function recordAdminAudit(input: {
  actorId: string
  actorEmail?: string | null
  action: string
  targetType: string
  targetId: string
  before?: AuditSnapshot
  after?: AuditSnapshot
  reason?: string | null
}) {
  try {
    await db.insert(adminAuditLog).values({
      actorId: input.actorId,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before ?? null,
      after: input.after ?? null,
      reason: input.reason ?? null,
    })
  } catch (error) {
    log.error("admin audit write failed", {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error: String(error),
    })
  }
}

/** Compatibility wrapper used by the existing admin actions. */
export async function recordAdminAction(session: ActingAdmin, entry: AdminAuditEntry): Promise<void> {
  await recordAdminAudit({
    actorId: session.user.id ?? "unknown",
    actorEmail: session.user.email ?? null,
    ...entry,
    before: entry.before as AuditSnapshot,
    after: entry.after as AuditSnapshot,
  })
}
