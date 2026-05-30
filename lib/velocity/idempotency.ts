import { sql } from "drizzle-orm"
import { db } from "@/db"
import { log } from "@/lib/logger"

const memoryLocks = new Map<string, number>()
const MEMORY_LOCK_TTL = 30_000

function acquireMemoryLock(key: string): boolean {
  const now = Date.now()
  const existing = memoryLocks.get(key)
  if (existing && now - existing < MEMORY_LOCK_TTL) return false
  memoryLocks.set(key, now)
  return true
}

function releaseMemoryLock(key: string): void {
  memoryLocks.delete(key)
}

const useDatabaseLocks = typeof process !== "undefined" && !!process.env.DATABASE_URL

export async function acquireLock(key: string): Promise<boolean> {
  if (!useDatabaseLocks) {
    const acquired = acquireMemoryLock(key)
    if (!acquired) log.warn("idempotency lock contention (memory)", { key })
    return acquired
  }

  try {
    const result = await db.execute(sql`
      SELECT pg_try_advisory_lock(hashtext(${key})) as acquired
    `)
    const acquired = (result.rows?.[0] as Record<string, unknown> | undefined)?.acquired ?? false
    if (!acquired) {
      log.warn("idempotency lock contention", { key })
    }
    return Boolean(acquired)
  } catch (err) {
    log.error("idempotency acquireLock error", { key, error: String(err) })
    return false
  }
}

export async function releaseLock(key: string): Promise<void> {
  if (!useDatabaseLocks) {
    releaseMemoryLock(key)
    return
  }

  try {
    await db.execute(sql`
      SELECT pg_advisory_unlock(hashtext(${key}))
    `)
  } catch (err) {
    log.error("idempotency releaseLock error", { key, error: String(err) })
  }
}
