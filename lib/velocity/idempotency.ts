import "server-only"
import { sql } from "drizzle-orm"
import type { PoolClient } from "pg"
import { db, dbPool } from "@/db"
import { log } from "@/lib/logger"

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export function orderMutationLockKey(orderId: string): string {
  return `order:${orderId}`
}

/**
 * Serialize every state or inventory mutation for one order. Payment
 * settlement, expiry, and manual completion must all use this exact lock key.
 */
export async function lockOrderMutation(tx: DbTx, orderId: string): Promise<void> {
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${orderMutationLockKey(orderId)}))
  `)
}

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

// Session locks must be acquired and released on the same physical PostgreSQL
// connection. Retain that dedicated client until releaseLock is called; using
// separate pooled db.execute calls can leak a lock or unlock the wrong session.
const heldSessionLocks = new Map<string, PoolClient>()

export async function acquireLock(key: string): Promise<boolean> {
  if (!dbPool) {
    log.error("idempotency acquireLock error", { key, error: "DATABASE_URL is not configured" })
    throw new Error("Payment coordination unavailable: DATABASE_URL is not configured")
  }

  let client: PoolClient | null = null
  try {
    client = await dbPool.connect()
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      [key],
    )
    const acquired = Boolean(result.rows[0]?.acquired)
    if (!acquired) {
      client.release()
      log.warn("idempotency lock contention", { key })
      return false
    }
    heldSessionLocks.set(key, client)
    return acquired
  } catch (err) {
    client?.release()
    log.error("idempotency acquireLock error", { key, error: String(err) })
    throw new Error("Payment coordination unavailable; retry shortly", { cause: err })
  }
}

export async function releaseLock(key: string): Promise<void> {
  const client = heldSessionLocks.get(key)
  if (!client) return
  heldSessionLocks.delete(key)
  try {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key])
  } catch (err) {
    log.error("idempotency releaseLock error", { key, error: String(err) })
  } finally {
    client.release()
  }
}
