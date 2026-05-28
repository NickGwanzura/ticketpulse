import { log } from "@/lib/logger"

const LOCK_TTL_MS = 30_000
const locks = new Map<string, { lockedAt: number }>()

function reap() {
  const now = Date.now()
  for (const [key, value] of locks) {
    if (now - value.lockedAt > LOCK_TTL_MS) {
      locks.delete(key)
    }
  }
}

export function acquireLock(key: string): boolean {
  reap()
  if (locks.has(key)) {
    log.warn("idempotency lock contention", { key })
    return false
  }
  locks.set(key, { lockedAt: Date.now() })
  return true
}

export function releaseLock(key: string): void {
  locks.delete(key)
}

export function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options?: { ttlMs?: number },
): Promise<T> {
  const acquired = acquireLock(key)
  if (!acquired) {
    return Promise.reject(new Error(`Operation in progress for key: ${key}`))
  }

  const ttl = options?.ttlMs ?? LOCK_TTL_MS
  const timeout = setTimeout(() => {
    releaseLock(key)
    log.warn("idempotency lock timeout", { key })
  }, ttl)

  return fn()
    .then((result) => {
      clearTimeout(timeout)
      releaseLock(key)
      return result
    })
    .catch((err) => {
      clearTimeout(timeout)
      releaseLock(key)
      throw err
    })
}
