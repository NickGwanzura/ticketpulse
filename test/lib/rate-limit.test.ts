import { describe, it, expect, beforeEach, vi } from "vitest"

// The rate-limiter module has module-level state (stores Map, GC timer).
// We import it fresh each test via dynamic import to isolate state.
async function freshLimiter() {
  return import("@/lib/rate-limit")
}

describe("rateLimit", () => {
  beforeEach(async () => {
    // Clear module registry so each test gets a fresh instance
    vi.resetModules()
  })

  it("allows requests within the limit", async () => {
    const { rateLimit } = await freshLimiter()
    const limiter = rateLimit({ windowMs: 60_000, max: 5 })

    for (let i = 0; i < 5; i++) {
      const result = limiter.check("user-1")
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBeGreaterThanOrEqual(0)
    }
  })

  it("blocks requests exceeding the limit", async () => {
    const { rateLimit } = await freshLimiter()
    const limiter = rateLimit({ windowMs: 60_000, max: 3 })

    // Use 3 allowed requests
    limiter.check("user-2")
    limiter.check("user-2")
    limiter.check("user-2")

    // 4th should be blocked
    const result = limiter.check("user-2")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it("tracks different keys independently", async () => {
    const { rateLimit } = await freshLimiter()
    const limiter = rateLimit({ windowMs: 60_000, max: 2 })

    limiter.check("alice")
    limiter.check("alice")
    // Alice should be at the limit
    expect(limiter.check("alice").allowed).toBe(false)

    // Bob should still be allowed
    expect(limiter.check("bob").allowed).toBe(true)
  })

  it("returns remaining count decreasing correctly", async () => {
    const { rateLimit } = await freshLimiter()
    const limiter = rateLimit({ windowMs: 60_000, max: 5 })

    expect(limiter.check("counter-test").remaining).toBe(4)
    expect(limiter.check("counter-test").remaining).toBe(3)
    expect(limiter.check("counter-test").remaining).toBe(2)
  })

  it("resets after the window elapses", async () => {
    const { rateLimit } = await freshLimiter()
    // Use a very short window so we can test expiry
    const limiter = rateLimit({ windowMs: 50, max: 1 })

    // First request — allowed
    expect(limiter.check("expiry-test").allowed).toBe(true)

    // Second request — blocked (within window)
    expect(limiter.check("expiry-test").allowed).toBe(false)

    // Wait for window to pass
    await new Promise((resolve) => setTimeout(resolve, 60))

    // Should be allowed again (new window)
    const result = limiter.check("expiry-test")
    expect(result.allowed).toBe(true)
  }, 10_000) // 10s timeout

  it("uses default config when no options passed", async () => {
    const { rateLimit } = await freshLimiter()
    const limiter = rateLimit()

    // Default max is 30, so 30 should be allowed
    for (let i = 0; i < 30; i++) {
      expect(limiter.check("default-test").allowed).toBe(true)
    }
    // 31st should be blocked
    expect(limiter.check("default-test").allowed).toBe(false)
  })
})
