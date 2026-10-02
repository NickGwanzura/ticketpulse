import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), scope: vi.fn(), select: vi.fn(), sales: vi.fn() }))
vi.mock("@/lib/mobile-organizer", () => ({
  authenticateOrganizer: mocks.authenticate,
  organizerEventScope: mocks.scope,
  privateHeaders: { "Cache-Control": "private, no-store" },
}))
vi.mock("@/db", () => ({ db: { select: mocks.select } }))
vi.mock("@/lib/ticket-tier-sales", () => ({ getTicketTierSales: mocks.sales }))
import { GET } from "@/app/api/mobile/organizer/events/route"

const request = new Request("https://example.com/api/mobile/organizer/events")
beforeEach(() => {
  vi.clearAllMocks()
  mocks.authenticate.mockResolvedValue({ ok: true, userId: "owner", role: "organizer" })
  mocks.scope.mockReturnValue("authorized-event-scope")
})

it.each([
  [{ ok: false, status: 401, error: "Unauthorized" }, 401],
  [{ ok: true, userId: "buyer", role: "attendee" }, 403],
])("rejects unauthorized tier sales reads", async (auth, status) => {
  mocks.authenticate.mockResolvedValue(auth)
  expect((await GET(request)).status).toBe(status)
  expect(mocks.select).not.toHaveBeenCalled()
  expect(mocks.sales).not.toHaveBeenCalled()
})

it("requests tiers only for scoped events and preserves private caching and currency", async () => {
  const where = vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([
    { id: "invited-event", title: "Concert", startsAt: new Date("2030-01-01"), endsAt: null },
  ]) })
  mocks.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where }) })
  mocks.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ checkedIn: 2 }]) }) })
  const tier = { id: "vip", eventId: "invited-event", name: "VIP", price: 50, currency: "ZWG", capacity: 100, sold: 8, complimentary: 2, reserved: 3, remaining: 87, revenue: 400 }
  mocks.sales.mockResolvedValue(new Map([["invited-event", [tier]]]))

  const response = await GET(request)
  expect(mocks.scope).toHaveBeenCalledWith("owner", "organizer")
  expect(where).toHaveBeenCalledWith("authorized-event-scope")
  expect(mocks.sales).toHaveBeenCalledWith(["invited-event"])
  expect((await response.json()).events[0]).toMatchObject({ totalCapacity: 100, totalSold: 10, tiers: [tier] })
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
})
