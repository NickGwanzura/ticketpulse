import { describe, it, expect } from "vitest"
import { acquireLock, releaseLock, withLock } from "@/lib/velocity/idempotency"

describe("velocity idempotency", () => {
  afterEach(() => {
    releaseLock("test-key")
    releaseLock("test-key-2")
  })

  describe("acquireLock / releaseLock", () => {
    it("acquires and releases a lock", () => {
      expect(acquireLock("test-key")).toBe(true)
      expect(acquireLock("test-key")).toBe(false)
      releaseLock("test-key")
      expect(acquireLock("test-key")).toBe(true)
    })
  })

  describe("withLock", () => {
    it("executes the function when lock is available", async () => {
      const result = await withLock("test-key", async () => "done")
      expect(result).toBe("done")
    })

    it("rejects when lock is held", async () => {
      acquireLock("test-key-2")
      await expect(
        withLock("test-key-2", async () => "should not run"),
      ).rejects.toThrow("Operation in progress")
    })

    it("releases lock after function completes", async () => {
      await withLock("test-key", async () => "ok")
      expect(acquireLock("test-key")).toBe(true)
    })

    it("releases lock after function throws", async () => {
      await expect(
        withLock("test-key", async () => { throw new Error("fail") }),
      ).rejects.toThrow("fail")
      expect(acquireLock("test-key")).toBe(true)
    })
  })
})
