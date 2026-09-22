import "server-only"

import { db } from "@/db"
import { systemHeartbeats } from "@/db/schema"
import { log } from "@/lib/logger"

export async function recordHeartbeatSuccess(key: string) {
  const now = new Date()
  try {
    await db
      .insert(systemHeartbeats)
      .values({ key, lastSuccessAt: now, lastError: null, updatedAt: now })
      .onConflictDoUpdate({
        target: systemHeartbeats.key,
        set: { lastSuccessAt: now, lastError: null, updatedAt: now },
      })
  } catch (error) {
    log.error("heartbeat success write failed", { key, error: String(error) })
  }
}

export async function recordHeartbeatError(key: string, error: unknown) {
  const now = new Date()
  const message = String(error).slice(0, 2000)
  try {
    await db
      .insert(systemHeartbeats)
      .values({ key, lastErrorAt: now, lastError: message, updatedAt: now })
      .onConflictDoUpdate({
        target: systemHeartbeats.key,
        set: { lastErrorAt: now, lastError: message, updatedAt: now },
      })
  } catch (writeError) {
    log.error("heartbeat error write failed", { key, error: String(writeError) })
  }
}
