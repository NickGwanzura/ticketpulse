import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { log } from "@/lib/logger"

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Run `fn` while holding a PostgreSQL transaction-scoped advisory lock.
 *
 * Uses pg_try_advisory_xact_lock (transaction-scoped) rather than the session-scoped
 * pg_try_advisory_lock. The lock auto-releases when the wrapping transaction commits or
 * rolls back — it cannot leak under Neon's connection pool even if the caller crashes.
 *
 * Returns null immediately if the lock is already held (concurrent request in progress).
 * All DB writes inside `fn` share the same transaction and commit atomically.
 *
 * Keep external HTTP calls OUTSIDE `fn` — the transaction (and lock) should not span
 * network I/O.
 */
export async function withLock<T>(
  key: string,
  fn: (tx: DbTx) => Promise<T>,
): Promise<T | null> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS acquired
    `)
    const acquired = Boolean(
      (result.rows?.[0] as Record<string, unknown> | undefined)?.acquired,
    )
    if (!acquired) {
      log.warn("idempotency lock contention", { key })
      return null
    }
    return fn(tx)
  })
}

// ── Legacy session-scoped lock API ────────────────────────────────────────────
// Used by webhook/callback routes that can't be refactored to withLock.
// Session-scoped locks are safe in those contexts because webhook calls are
// serialized by the external caller and the critical idempotency guard is the
// CAS update on order status. Prefer withLock for new code.

export async function acquireLock(key: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT pg_try_advisory_lock(hashtext(${key})) AS acquired
    `)
    const acquired = Boolean(
      (result.rows?.[0] as Record<string, unknown> | undefined)?.acquired,
    )
    if (!acquired) log.warn("idempotency lock contention", { key })
    return acquired
  } catch (err) {
    log.error("idempotency acquireLock error", { key, error: String(err) })
    return false
  }
}

export async function releaseLock(key: string): Promise<void> {
  try {
    await db.execute(sql`
      SELECT pg_advisory_unlock(hashtext(${key}))
    `)
  } catch (err) {
    log.error("idempotency releaseLock error", { key, error: String(err) })
  }
}
