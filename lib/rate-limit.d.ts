import "server-only";
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
    windowMs?: number;
    /** Maximum number of requests allowed within the window (default: 30). */
    max?: number;
}
interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetMs: number;
    retryAfterMs: number;
}
export declare function rateLimit(config?: RateLimitConfig): {
    check: (key: string) => RateLimitResult;
    checkRequest: (req: {
        headers: Headers;
    }) => RateLimitResult;
};
/** Pre-built limiters for common use-cases. */
export declare const authLimiter: {
    check: (key: string) => RateLimitResult;
    checkRequest: (req: {
        headers: Headers;
    }) => RateLimitResult;
};
export declare const checkoutLimiter: {
    check: (key: string) => RateLimitResult;
    checkRequest: (req: {
        headers: Headers;
    }) => RateLimitResult;
};
export declare const uploadLimiter: {
    check: (key: string) => RateLimitResult;
    checkRequest: (req: {
        headers: Headers;
    }) => RateLimitResult;
};
export declare const apiLimiter: {
    check: (key: string) => RateLimitResult;
    checkRequest: (req: {
        headers: Headers;
    }) => RateLimitResult;
};
export {};
