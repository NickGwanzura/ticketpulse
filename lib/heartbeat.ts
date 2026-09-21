import "server-only"

import { inArray } from "drizzle-orm"

import { db } from "@/db"
import { systemHeartbeats } from "@/db/schema"

export const HEARTBEAT_KEYS = {
  cronTick: "cron.tick",
  velocityWebhook: "velocity.webhook",
} as const

/**
 * Records that a job/integration just succeeded or failed. Fire-and-forget:
 * a heartbeat write must never slow down or break the thing it observes (and
 * is safe before the migration has run — the failure is only logged).
 */
export async function recordHeartbeat(key: string, result: { ok: true } | { ok: false; error: string }): Promise<void> {
  const now = new Date()
  try {
    await db
      .insert(systemHeartbeats)
      .values(
        result.ok
          ? { key, lastSuccessAt: now, updatedAt: now }
          : { key, lastErrorAt: now, lastError: result.error.slice(0, 500), updatedAt: now },
      )
      .onConflictDoUpdate({
        target: systemHeartbeats.key,
        set: result.ok
          ? { lastSuccessAt: now, updatedAt: now }
          : { lastErrorAt: now, lastError: result.error.slice(0, 500), updatedAt: now },
      })
  } catch (error) {
    console.error("[heartbeat] failed to record", key, error)
  }
}

export type HeartbeatStatus = {
  key: string
  lastSuccessAt: Date | null
  lastErrorAt: Date | null
  lastError: string | null
}

export async function getHeartbeats(keys: string[]): Promise<Map<string, HeartbeatStatus>> {
  const rows = await db.select().from(systemHeartbeats).where(inArray(systemHeartbeats.key, keys))
  return new Map(rows.map((r) => [r.key, r]))
}

/** "3 min ago" / "2 h ago" / "never". */
export function ageLabel(date: Date | null | undefined, now = new Date()): string {
  if (!date) return "never"
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000))
  if (seconds < 90) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}
