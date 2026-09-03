import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(), access: vi.fn(), scan: vi.fn(), rate: vi.fn(),
  summary: vi.fn(), select: vi.fn(),
}))
vi.mock("@/lib/mobile-organizer", () => ({
  authenticateOrganizer: mocks.authenticate,
  privateHeaders: { "Cache-Control": "private, no-store" },
  organizerEventScope: vi.fn(() => "scoped-events"),
}))
vi.mock("@/lib/event-access", () => ({ requireEventAccessForUser: mocks.access }))
vi.mock("@/lib/ticket-scan", () => ({ markTicketScanned: mocks.scan }))
vi.mock("@/lib/rate-limit", () => ({ apiLimiter: { checkRequest: mocks.rate } }))
vi.mock("@/lib/revenue-summary", () => ({ getOrganizerRevenueSummary: mocks.summary }))
vi.mock("@/db", () => ({ db: { select: mocks.select } }))
import { POST } from "@/app/api/mobile/organizer/scan/route"
import { GET as orders } from "@/app/api/mobile/organizer/orders/route"
import { GET as payments } from "@/app/api/mobile/organizer/payments/route"

const eventId = "8aeecc15-9aa2-4a70-8b25-52949fa17b83"
const request = (body: unknown) => new Request("https://example.com/api/mobile/organizer/scan", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authenticate.mockResolvedValue({ ok: true, userId: "organizer-1", role: "organizer" })
  mocks.rate.mockReturnValue({ allowed: true })
  mocks.access.mockResolvedValue({ allowed: true, role: "owner", userId: "organizer-1", eventId })
})

describe("organizer bearer routes", () => {
  it("rejects unauthenticated scans before accessing tickets", async () => {
    mocks.authenticate.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })
    expect((await POST(request({ eventId, code: "abc" }))).status).toBe(401)
    expect(mocks.scan).not.toHaveBeenCalled()
  })
  it("requires an explicit valid event ID", async () => {
    expect((await POST(request({ code: "abc" }))).status).toBe(400)
    expect(mocks.scan).not.toHaveBeenCalled()
  })
  it("prevents scanning another organizer's event", async () => {
    mocks.access.mockResolvedValue({ allowed: false })
    expect((await POST(request({ eventId, code: "abc" }))).status).toBe(403)
    expect(mocks.scan).not.toHaveBeenCalled()
  })
  it("preserves duplicate status and verifies the actual ticket event with bearer identity", async () => {
    mocks.scan.mockImplementation(async (_code, _context, authorize) => {
      await authorize(eventId)
      return { ok: true, status: "duplicate", ticket: { eventTitle: "Concert", tierName: "General" } }
    })
    const response = await POST(request({ eventId, code: "abc" }))
    expect((await response.json()).status).toBe("duplicate")
    expect(mocks.access).toHaveBeenLastCalledWith(eventId, { id: "organizer-1", role: "organizer" })
    expect(mocks.scan.mock.calls[0][1]).toMatchObject({ eventId, scannerUserId: "organizer-1" })
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })
  it("returns rejected ticket results without reporting success", async () => {
    mocks.scan.mockResolvedValue({ ok: false, error: "Order not paid" })
    const response = await POST(request({ eventId, code: "abc" }))
    expect(response.status).toBe(400)
    expect((await response.json()).ok).toBe(false)
  })
  it("rate limits before ticket lookup", async () => {
    mocks.rate.mockReturnValue({ allowed: false, retryAfterMs: 2200 })
    const response = await POST(request({ eventId, code: "abc" }))
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("3")
    expect(mocks.scan).not.toHaveBeenCalled()
  })
  it.each(["limit=0", "limit=101", "offset=-1", "offset=NaN", "status=unknown"])("rejects invalid pagination/filter %s", async query => {
    expect((await orders(new Request(`https://example.com/api/mobile/organizer/orders?${query}`))).status).toBe(400)
    expect(mocks.select).not.toHaveBeenCalled()
  })
  it("paginates organizer orders without returning the sentinel row", async () => {
    const query = { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), offset: vi.fn().mockResolvedValue([
      { id: "a", totalAmount: "10.25", currency: "USD" }, { id: "b", totalAmount: "20", currency: "USD" },
    ]) }
    mocks.select.mockReturnValue(query)
    const result = await (await orders(new Request("https://example.com/api/mobile/organizer/orders?limit=1&offset=2"))).json()
    expect(result).toMatchObject({ hasMore: true, orders: [{ id: "a", totalAmount: 10.25 }] })
    expect(query.limit).toHaveBeenCalledWith(2)
    expect(query.offset).toHaveBeenCalledWith(2)
  })
  it("binds payout revenue to the authenticated user, ignoring supplied user IDs", async () => {
    mocks.summary.mockResolvedValue({ availableBalance: 42 })
    const query = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }
    mocks.select.mockReturnValue(query)
    const result = await (await payments(new Request("https://example.com/api/mobile/organizer/payments?userId=other"))).json()
    expect(mocks.summary).toHaveBeenCalledWith("organizer-1")
    expect(result.summary.availableBalance).toBe(42)
  })
})
