import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), transition: vi.fn(), select: vi.fn(), update: vi.fn(), insert: vi.fn() }))
vi.mock("@/lib/mobile-organizer", () => ({ authenticateOrganizer: mocks.auth, privateHeaders: { "Cache-Control": "private, no-store" } }))
vi.mock("@/lib/payout-transitions", () => ({ transitionPayout: mocks.transition, PAYABLE_FROM: ["approved", "processing"] }))
vi.mock("@/db", () => ({ db: { select: mocks.select, update: mocks.update, insert: mocks.insert } }))
vi.mock("@/db/schema", () => ({ users: { id: "id", name: "name", approvedAt: "approvedAt", updatedAt: "updatedAt" }, notifications: {} }))
vi.mock("drizzle-orm", () => ({ eq: (a: unknown, b: unknown) => [a, b] }))
vi.mock("@/lib/notification-priority", () => ({ defaultNotificationPriority: () => "normal" }))
import { POST as payout } from "@/app/api/mobile/admin/payouts/[id]/route"
import { POST as organizer } from "@/app/api/mobile/admin/organizers/[id]/route"

const id = "8aeecc15-9aa2-4a70-8b25-52949fa17b83"
const context = { params: Promise.resolve({ id }) }
const request = (body: unknown) => new Request("https://example.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin", email: "admin@example.com" })
  mocks.transition.mockResolvedValue({ ok: true })
  mocks.select.mockReturnValue({ from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id, name: "Org", approvedAt: null }]) })
  mocks.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) })
  mocks.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
})

describe("mobile admin mutations", () => {
  it("routes payout approval through the audited transition", async () => {
    expect((await payout(request({ action: "approve" }), context)).status).toBe(200)
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ payoutId: id, toStatus: "approved", performedBy: "admin@example.com" }))
  })
  it("requires a reason when rejecting a payout", async () => {
    expect((await payout(request({ action: "reject" }), context)).status).toBe(400)
    expect(mocks.transition).not.toHaveBeenCalled()
  })
  it("updates organizer approval and records a notification", async () => {
    expect((await organizer(request({ action: "approve" }), context)).status).toBe(200)
    expect(mocks.update).toHaveBeenCalled()
    expect(mocks.insert).toHaveBeenCalled()
  })
})
