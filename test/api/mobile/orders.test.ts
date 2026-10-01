import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), select: vi.fn() }))
vi.mock("@/lib/mobile-auth", () => ({ authenticateRequest: mocks.auth }))
vi.mock("@/db", () => ({ db: { select: mocks.select } }))

import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { GET } from "@/app/api/mobile/orders/route"

const buyerEmail = "buyer@example.com"
let ownerCondition: SQL | undefined
const orderRows = [
  {
    id: "order-1",
    status: "paid",
    totalAmount: "55.00",
    currency: "USD",
    createdAt: new Date("2026-09-24T10:00:00.000Z"),
    eventTitle: "KAOS",
    eventId: "event-1",
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  ownerCondition = undefined
  mocks.auth.mockResolvedValue({
    ok: true,
    userId: "buyer-1",
    role: "attendee",
    email: buyerEmail,
  })
  mocks.select.mockImplementation(() => {
    return {
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn((condition: SQL) => {
            ownerCondition = condition
            return {
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  offset: vi.fn(async () => orderRows),
                })),
              })),
            }
          }),
        })),
      })),
    }
  })
})

describe("mobile buyer orders", () => {
  it("includes orders created as guest for the authenticated account email", async () => {
    const response = await GET(new Request("https://example.com/api/mobile/orders"))
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toMatchObject({
      ok: true,
      orders: [{ id: "order-1", eventTitle: "KAOS", totalAmount: 55 }],
    })
    const query = new PgDialect().sqlToQuery(ownerCondition!)
    expect(query.sql).toContain('"user_id"')
    expect(query.sql).toContain("LOWER")
    expect(query.params).toContain("buyer-1")
    expect(query.params).toContain(buyerEmail)
  })

  it("does not query order details when bearer authentication fails", async () => {
    mocks.auth.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Invalid or expired token",
    })
    const response = await GET(new Request("https://example.com/api/mobile/orders"))
    expect(response.status).toBe(401)
    expect(mocks.select).not.toHaveBeenCalled()
  })
})
