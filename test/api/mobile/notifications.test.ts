import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), select: vi.fn(), update: vi.fn() }))
vi.mock("@/lib/mobile-auth", () => ({ authenticateRequest: mocks.authenticate }))
vi.mock("@/db", () => ({ db: { select: mocks.select, update: mocks.update } }))
vi.mock("@/db/schema", () => ({ notifications: { userId: "userId", read: "read", id: "id", createdAt: "createdAt" } }))
vi.mock("drizzle-orm", () => ({
  and: (...values: unknown[]) => values,
  desc: (value: unknown) => value,
  eq: (left: unknown, right: unknown) => [left, right],
  inArray: (left: unknown, right: unknown[]) => [left, right],
  sql: Object.assign(() => "count", { raw: () => "count" }),
}))
import { GET, POST } from "@/app/api/mobile/notifications/route"

const request = (url: string, init?: RequestInit) => new Request(`https://example.com${url}`, init)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authenticate.mockResolvedValue({ ok: true, userId: "user-1", role: "admin" })
})

describe("mobile notifications", () => {
  it("rejects requests without bearer identity", async () => {
    mocks.authenticate.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })
    expect((await GET(request("/api/mobile/notifications"))).status).toBe(401)
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it("returns the user's notifications and unread count", async () => {
    const rows = [{ id: "n1", userId: "user-1", title: "Order paid", read: false }]
    const query = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn() }
    query.limit.mockResolvedValue(rows)
    const countQuery = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ count: 1 }]) }
    mocks.select.mockReturnValueOnce(query).mockReturnValueOnce(countQuery)
    const response = await GET(request("/api/mobile/notifications?limit=10"))
    expect(await response.json()).toMatchObject({ ok: true, notifications: rows, unreadCount: 1 })
    expect(query.limit).toHaveBeenCalledWith(10)
  })

  it("marks all unread notifications as read", async () => {
    const where = vi.fn().mockResolvedValue(undefined)
    mocks.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where }) })
    const response = await POST(request("/api/mobile/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }),
    }))
    expect(response.status).toBe(200)
    expect(where).toHaveBeenCalled()
  })
})
