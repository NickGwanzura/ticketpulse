import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Regression tests for the ownership checks added to the order/ticket
 * endpoints. Before these fixes a bare UUID was treated as authority, which
 * let an anonymous caller read live QR codes and buyer PII, redirect ticket
 * transfers to their own inbox, and trigger resends.
 */

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  select: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/db", () => ({ db: { select: mocks.select } }))
vi.mock("server-only", () => ({}))

import { authorizeOrderAccess } from "@/lib/order-access"
import { signTicketPayload } from "@/lib/tickets"

const ORDER = {
  id: "11111111-1111-1111-1111-111111111111",
  eventId: "22222222-2222-2222-2222-222222222222",
  userId: null as string | null,
  guestEmail: "buyer@example.com",
  guestName: "Buyer",
  status: "paid",
  buyerEmail: null as string | null,
}

/** Make the drizzle chain resolve to a single order row. */
function orderRows(value: unknown[] | null) {
  mocks.select.mockReturnValueOnce({
    from: () => ({ leftJoin: () => ({ where: () => ({ limit: async () => value ?? [] }) }) }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  delete process.env.TICKET_QR_SECRET
  process.env.AUTH_SECRET = "test-secret"
})

describe("authorizeOrderAccess", () => {
  it("rejects an anonymous caller with neither session nor proof", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue(null)
    const result = await authorizeOrderAccess(ORDER.id)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("forbidden")
  })

  it("reports not_found for a missing order", async () => {
    orderRows([])
    mocks.auth.mockResolvedValue(null)
    const result = await authorizeOrderAccess("missing")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("not_found")
  })

  it("accepts a guest who proves the order email", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue(null)
    const result = await authorizeOrderAccess(ORDER.id, { email: "buyer@example.com" })
    expect(result.ok).toBe(true)
  })

  it("matches the claimed email case-insensitively and trims it", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue(null)
    const result = await authorizeOrderAccess(ORDER.id, { email: "  BUYER@Example.COM  " })
    expect(result.ok).toBe(true)
  })

  it("rejects a guest claiming someone else's email", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue(null)
    const result = await authorizeOrderAccess(ORDER.id, { email: "attacker@example.com" })
    expect(result.ok).toBe(false)
  })

  it("accepts a valid signed ticket payload", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue(null)
    const sig = signTicketPayload(ORDER.id, ORDER.id)
    const result = await authorizeOrderAccess(ORDER.id, { signature: sig })
    expect(result.ok).toBe(true)
  })

  it("rejects a forged signature", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue(null)
    const result = await authorizeOrderAccess(ORDER.id, { signature: "a".repeat(64) })
    expect(result.ok).toBe(false)
  })

  it("rejects a malformed signature without throwing", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue(null)
    const result = await authorizeOrderAccess(ORDER.id, { signature: "not-hex" })
    expect(result.ok).toBe(false)
  })

  it("accepts the authenticated owner by user id", async () => {
    orderRows([{ ...ORDER, userId: "user-1" }])
    mocks.auth.mockResolvedValue({ user: { id: "user-1", role: "attendee", email: "buyer@example.com" } })
    const result = await authorizeOrderAccess(ORDER.id)
    expect(result.ok).toBe(true)
  })

  it("accepts an admin", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "admin", email: "admin@example.com" } })
    const result = await authorizeOrderAccess(ORDER.id)
    expect(result.ok).toBe(true)
  })

  it("rejects a different signed-in user", async () => {
    orderRows([{ ...ORDER, userId: "user-1" }])
    mocks.auth.mockResolvedValue({ user: { id: "user-2", role: "attendee", email: "other@example.com" } })
    const result = await authorizeOrderAccess(ORDER.id)
    expect(result.ok).toBe(false)
  })

  it("accepts organizer-scoped callers who already applied the event predicate", async () => {
    orderRows([ORDER])
    mocks.auth.mockResolvedValue(null)
    const result = await authorizeOrderAccess(ORDER.id, { organizerScoped: true })
    expect(result.ok).toBe(true)
  })
})
