import "server-only"

/**
 * Shared fixed-window rate limiter with an in-memory fallback.
 *
 * Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to share
 * counters across application instances. Without them, local development and
 * emergency Redis outages retain a best-effort per-process guard.
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

type UpstashPipelineResult = Array<{ result?: unknown; error?: string }>

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

  async function checkDistributed(key: string): Promise<RateLimitResult> {
    const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "")
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return check(key)

    const now = Date.now()
    const bucket = Math.floor(now / windowMs)
    const redisKey = `${label}:${bucket}:${key}`
    try {
      const response = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["PEXPIRE", redisKey, String(windowMs), "NX"],
          ["PTTL", redisKey],
        ]),
        cache: "no-store",
      })
      if (!response.ok) throw new Error(`Redis HTTP ${response.status}`)

      const payload = await response.json() as UpstashPipelineResult
      if (payload.some((entry) => entry.error)) {
        throw new Error(payload.find((entry) => entry.error)?.error ?? "Redis pipeline failed")
      }
      const count = Number(payload[0]?.result)
      const ttl = Math.max(0, Number(payload[2]?.result) || windowMs)
      if (!Number.isFinite(count)) throw new Error("Redis returned an invalid counter")

      return {
        allowed: count <= max,
        remaining: Math.max(0, max - count),
        resetMs: now + ttl,
        retryAfterMs: count > max ? ttl : 0,
      }
    } catch (error) {
      // Preserve availability if Redis has an incident, while retaining a
      // per-instance abuse guard as a fallback.
      console.warn("[rate-limit] shared limiter unavailable; using local fallback", String(error))
      return check(key)
    }
  }

  /** Convenience: extract IP from a Request/NextRequest and check. */
  async function checkRequest(req: { headers: Headers }): Promise<RateLimitResult> {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown"
    return checkDistributed(ip)
  }

  return { check, checkDistributed, checkRequest }
}

/** Pre-built limiters for common use-cases. */
export const authLimiter = rateLimit({ windowMs: 60_000, max: 5 })
export const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 10 })
export const uploadLimiter = rateLimit({ windowMs: 60_000, max: 60 })
export const apiLimiter = rateLimit({ windowMs: 60_000, max: 30 })
