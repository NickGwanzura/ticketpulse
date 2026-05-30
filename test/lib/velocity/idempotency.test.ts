import { describe, it, expect, beforeEach } from "vitest"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"

describe("velocity idempotency", () => {
  beforeEach(async () => {
    await releaseLock("test-key")
    await releaseLock("test-key-2")
  })

  describe("acquireLock / releaseLock", () => {
    it("acquires and releases a lock", async () => {
      expect(await acquireLock("test-key")).toBe(true)
      expect(await acquireLock("test-key")).toBe(false)
      await releaseLock("test-key")
      expect(await acquireLock("test-key")).toBe(true)
    })

    it("releases lock after acquiring", async () => {
      expect(await acquireLock("test-key")).toBe(true)
      await releaseLock("test-key")
      expect(await acquireLock("test-key")).toBe(true)
    })
  })
})
