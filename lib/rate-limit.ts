import "server-only"

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Intended for API routes that need per-IP or per-user throttling.  Because
 * serverless environments have no shared memory across instances, this is a
 * **best-effort** guard — enough to stop casual abuse but not a determined
 * attacker.  For production-critical rate limiting, swap the store for Redis
 * or KV (e.g. Upstash / Vercel KV).
 *
 * Usage
 * -----
 * ```ts
 * const limiter = rateLimit({ windowMs: 60_000, max: 10 })
 *
 * const ip = req.headers.get("x-forwarded-for") ?? "unknown"
 * const result = limiter.check(ip)
 * if (!result.allowed) {
 *   return NextResponse.json({ error: "Too many requests" }, {
 *     status: 429,
 *     headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) },
 *   })
 * }
 * ```
 */

interface RateLimitConfig {
  /** Time window in milliseconds (default: 60_000 = 1 minute). */
  windowMs?: number
  /** Maximum number of requests allowed within the window (default: 30). */
  max?: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
  retryAfterMs: number
}

interface Entry {
  count: number
  resetAt: number
}

const stores = new Map<string, Map<string, Entry>>()

/** Garbage-collect expired entries every 5 minutes. */
const GC_INTERVAL_MS = 300_000
let gcTimer: ReturnType<typeof setInterval> | null = null

function scheduleGc(store: Map<string, Entry>): void {
  if (gcTimer) return
  gcTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
    // If the store is empty, clear the interval so Node can exit cleanly.
    if (store.size === 0 && gcTimer) {
      clearInterval(gcTimer)
      gcTimer = null
    }
  }, GC_INTERVAL_MS) as unknown as ReturnType<typeof setInterval>
}

export function rateLimit(config: RateLimitConfig = {}) {
  const { windowMs = 60_000, max = 30 } = config
  const label = `rl:${windowMs}:${max}`

  let store = stores.get(label)
  if (!store) {
    store = new Map()
    stores.set(label, store)
    scheduleGc(store)
  }

  function check(key: string): RateLimitResult {
    const now = Date.now()
    let entry = store!.get(key)

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs }
      store!.set(key, entry)
      return { allowed: true, remaining: max - 1, resetMs: entry.resetAt, retryAfterMs: 0 }
    }

    entry.count++
    if (entry.count > max) {
      const retryAfterMs = entry.resetAt - now
      return { allowed: false, remaining: 0, resetMs: entry.resetAt, retryAfterMs }
    }

    return { allowed: true, remaining: max - entry.count, resetMs: entry.resetAt, retryAfterMs: 0 }
  }

  /** Convenience: extract IP from a Request/NextRequest and check. */
  function checkRequest(req: { headers: Headers }): RateLimitResult {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown"
    return check(ip)
  }

  return { check, checkRequest }
}

/** Pre-built limiters for common use-cases. */
export const authLimiter = rateLimit({ windowMs: 60_000, max: 5 })
export const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 10 })
export const uploadLimiter = rateLimit({ windowMs: 60_000, max: 60 })
export const apiLimiter = rateLimit({ windowMs: 60_000, max: 30 })
