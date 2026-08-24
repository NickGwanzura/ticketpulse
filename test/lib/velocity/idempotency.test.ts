import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
}))

vi.mock("@/db", () => ({
  db: { transaction: vi.fn() },
  dbPool: { connect: mocks.connect },
}))

import { acquireLock, orderMutationLockKey, releaseLock } from "@/lib/velocity/idempotency"

function client(acquired: boolean) {
  return {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ acquired }] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }),
    release: vi.fn(),
  }
}

describe("velocity session idempotency locks", () => {
  beforeEach(() => {
    mocks.connect.mockReset()
  })

  it("unlocks on the exact physical client that acquired the lock", async () => {
    const first = client(true)
    const second = client(true)
    mocks.connect.mockResolvedValueOnce(first).mockResolvedValueOnce(second)

    expect(await acquireLock("test-key")).toBe(true)
    await releaseLock("test-key")
    expect(first.query).toHaveBeenNthCalledWith(
      2,
      "SELECT pg_advisory_unlock(hashtext($1))",
      ["test-key"],
    )
    expect(first.release).toHaveBeenCalledOnce()

    expect(await acquireLock("test-key")).toBe(true)
    await releaseLock("test-key")
    expect(second.release).toHaveBeenCalledOnce()
  })

  it("releases a contended client immediately without registering it", async () => {
    const contended = client(false)
    mocks.connect.mockResolvedValueOnce(contended)

    expect(await acquireLock("test-key-2")).toBe(false)
    expect(contended.release).toHaveBeenCalledOnce()
    await releaseLock("test-key-2")
    expect(contended.query).toHaveBeenCalledOnce()
  })

  it("uses one shared mutation key for every order state transition", () => {
    expect(orderMutationLockKey("order-123")).toBe("order:order-123")
  })
})
