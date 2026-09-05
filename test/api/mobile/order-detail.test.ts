import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), select: vi.fn(), complete: vi.fn(), resend: vi.fn(), rate: vi.fn() }))
vi.mock("@/lib/mobile-organizer", () => ({ authenticateOrganizer: mocks.auth, organizerEventScope: mocks.scope, privateHeaders: { "Cache-Control": "private, no-store" } }))
vi.mock("@/db", () => ({ db: { select: mocks.select } }))
vi.mock("@/lib/order-recovery", () => ({ markOrderCompleteAction: mocks.complete }))
vi.mock("@/app/api/orders/[id]/resend-tickets/route", () => ({ POST: mocks.resend }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ check: mocks.rate }) }))
import { GET, POST } from "@/app/api/mobile/organizer/orders/[id]/route"

const id = "8aeecc15-9aa2-4a70-8b25-52949fa17b83"
const context = { params: Promise.resolve({ id }) }
const request = (body: unknown) => new Request(`https://example.com/api/mobile/organizer/orders/${id}`, { method: "POST", body: JSON.stringify(body) })
let rows: unknown[]
beforeEach(() => {
  vi.clearAllMocks()
  rows = [{ id, status: "paid", totalAmount: "24.00", guestEmail: "buyer@example.com" }]
  mocks.auth.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin", email: "admin@example.com" })
  mocks.scope.mockReturnValue(undefined)
  mocks.rate.mockReturnValue({ allowed: true })
  mocks.select.mockImplementation(() => ({ from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn(async () => rows), then: (resolve: (v: unknown[]) => unknown) => Promise.resolve([]).then(resolve) }))
  mocks.complete.mockResolvedValue({ success: true, message: "Order completed" })
  mocks.resend.mockResolvedValue(Response.json({ ok: true, sentTo: "buyer@example.com" }))
})
describe("mobile order details and actions", () => {
  it("requires authentication before loading order data", async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 401, error: "Sign in" })
    expect((await GET(request({}), context)).status).toBe(401)
    expect(mocks.select).not.toHaveBeenCalled()
  })
  it("uses current organizer scope and denies inaccessible orders before any action", async () => {
    mocks.auth.mockResolvedValue({ ok: true, userId: "org-1", role: "organizer" })
    rows = []
    expect((await POST(request({ action: "resend" }), context)).status).toBe(404)
    expect(mocks.scope).toHaveBeenCalledWith("org-1", "organizer")
    expect(mocks.resend).not.toHaveBeenCalled()
  })
  it("denies payment completion to organizers", async () => {
    mocks.auth.mockResolvedValue({ ok: true, userId: "org-1", role: "organizer" })
    expect((await POST(request({ action: "complete", confirmPayment: true }), context)).status).toBe(403)
    expect(mocks.complete).not.toHaveBeenCalled()
  })
  it("requires explicit payment confirmation", async () => {
    expect((await POST(request({ action: "complete" }), context)).status).toBe(409)
    expect(mocks.complete).not.toHaveBeenCalled()
  })
  it.each(["refunded", "cancelled", "expired", "completed"])("blocks manual completion of %s orders", async status => {
    rows = [{ id, status }]
    expect((await POST(request({ action: "complete", confirmPayment: true }), context)).status).toBe(409)
    expect(mocks.complete).not.toHaveBeenCalled()
  })
  it("records the authenticated admin identity through the existing audited workflow", async () => {
    expect((await POST(request({ action: "complete", confirmPayment: true }), context)).status).toBe(200)
    expect(mocks.complete).toHaveBeenCalledWith(id, "admin-1", "admin@example.com")
  })
  it("preserves delivery failure and throttling responses", async () => {
    mocks.resend.mockResolvedValue(Response.json({ error: "Delivery failed" }, { status: 500 }))
    const response = await POST(request({ action: "resend" }), context)
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, error: "Delivery failed" })
    mocks.rate.mockReturnValue({ allowed: false })
    expect((await POST(request({ action: "resend" }), context)).status).toBe(429)
  })
  it("supplies explicit lists and action eligibility for detail views", async () => {
    const response = await GET(request({}), context)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toMatchObject({ items: [], tickets: [], actions: { resend: true, complete: true } })
  })
})
