import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), submit: vi.fn(), limit: vi.fn() }))
vi.mock("@/lib/mobile-organizer", () => ({ authenticateOrganizer: mocks.auth, privateHeaders: { "Cache-Control": "private, no-store" } }))
vi.mock("@/lib/payout-request", () => ({ submitPayoutRequest: mocks.submit }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ checkDistributed: mocks.limit }) }))
import { POST } from "@/app/api/mobile/organizer/payouts/route"

const request = (body: unknown) =>
  new Request("https://example.com/api/mobile/organizer/payouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ ok: true, userId: "org-1", role: "organizer", email: "org@example.com" })
  mocks.limit.mockResolvedValue({ allowed: true })
  mocks.submit.mockResolvedValue({ ok: true, message: "Payout request submitted.", payoutId: "p-1" })
})

describe("mobile payout request", () => {
  it("always requests for the signed-in organizer, ignoring any user in the body", async () => {
    const response = await POST(request({ userId: "someone-else", amount: 50, method: "ecocash", ecocashNumber: "0771234567" }))
    expect(response.status).toBe(201)
    expect(mocks.submit).toHaveBeenCalledWith("org-1", "org@example.com", expect.objectContaining({ amount: 50, method: "ecocash", currency: "USD" }))
    expect(await response.json()).toEqual({ ok: true, message: "Payout request submitted.", payoutId: "p-1" })
  })

  it("returns the validation message when the request is rejected", async () => {
    mocks.submit.mockResolvedValue({ ok: false, message: "You can request up to $20.00 right now." })
    const response = await POST(request({ amount: 50, method: "ecocash" }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: "You can request up to $20.00 right now." })
  })

  it("rejects unauthenticated callers before touching payouts", async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 401, error: "Sign in again" })
    const response = await POST(request({ amount: 50 }))
    expect(response.status).toBe(401)
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it("rate limits repeated attempts", async () => {
    mocks.limit.mockResolvedValue({ allowed: false })
    expect((await POST(request({ amount: 50 }))).status).toBe(429)
    expect(mocks.submit).not.toHaveBeenCalled()
  })
})
