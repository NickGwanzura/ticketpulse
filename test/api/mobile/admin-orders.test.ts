import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ auth: vi.fn(), select: vi.fn(), limit: vi.fn(), pdf: vi.fn() }))
vi.mock("@/lib/mobile-organizer", () => ({ authenticateOrganizer: mocks.auth, privateHeaders: { "Cache-Control": "private, no-store" } }))
vi.mock("@/db", () => ({ db: { select: mocks.select } }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ checkDistributed: mocks.limit }) }))
vi.mock("@/lib/order-pdf", () => ({ buildOrderTicketsPdf: mocks.pdf }))
import { GET as search } from "@/app/api/mobile/admin/orders/route"
import { GET as download } from "@/app/api/mobile/admin/orders/[id]/pdf/route"

const id = "8aeecc15-9aa2-4a70-8b25-52949fa17b83"
const find = (qs: string) => search(new Request(`https://example.com/api/mobile/admin/orders${qs}`))
const pdfRequest = () => new Request(`https://example.com/api/mobile/admin/orders/${id}/pdf`)
let rows: unknown[]
beforeEach(() => {
  vi.clearAllMocks()
  rows = [{ id, status: "pending", totalAmount: "30.00", currency: "USD", paymentMethod: "velocity-ecocash", createdAt: new Date("2026-10-05"), guestName: "Danielle", guestEmail: "d@example.com", guestPhone: "+263788908470", buyerName: null, buyerEmail: null, eventTitle: "Sunset", deliveryStatus: "EMAIL_FAILED" }]
  mocks.auth.mockResolvedValue({ ok: true, userId: "admin-1", role: "admin", email: "admin@example.com" })
  mocks.limit.mockResolvedValue({ allowed: true })
  mocks.select.mockImplementation(() => ({ from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn(async () => rows) }))
  mocks.pdf.mockResolvedValue({ ok: true, buffer: Buffer.from("%PDF-1.4"), filename: "tickets-8aeecc15.pdf" })
})

describe("mobile support order search", () => {
  it("requires sign-in and never queries without it", async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 401, error: "Sign in" })
    expect((await find("?q=danielle")).status).toBe(401)
    expect(mocks.select).not.toHaveBeenCalled()
  })
  it("is admin only", async () => {
    mocks.auth.mockResolvedValue({ ok: true, userId: "org-1", role: "organizer" })
    expect((await find("?q=danielle")).status).toBe(403)
    expect(mocks.select).not.toHaveBeenCalled()
  })
  it("rejects searches that are too short", async () => {
    expect((await find("?q=a")).status).toBe(400)
    expect((await find("")).status).toBe(400)
    expect(mocks.select).not.toHaveBeenCalled()
  })
  it("rejects an unknown status filter", async () => {
    expect((await find("?q=danielle&status=bogus")).status).toBe(400)
  })
  it("is rate limited per admin", async () => {
    mocks.limit.mockResolvedValue({ allowed: false })
    expect((await find("?q=danielle")).status).toBe(429)
    expect(mocks.limit).toHaveBeenCalledWith("admin-1")
    expect(mocks.select).not.toHaveBeenCalled()
  })
  it("returns support-friendly rows without caching", async () => {
    const response = await find("?q=%239871B5C9&status=pending")
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect((await response.json()).orders[0]).toMatchObject({ id, ref: "8AEECC15", totalAmount: 30, buyerName: "Danielle", buyerPhone: "+263788908470", deliveryStatus: "EMAIL_FAILED" })
  })
})

describe("mobile support ticket download", () => {
  const context = () => ({ params: Promise.resolve({ id }) })
  it("is admin only and never builds a PDF for others", async () => {
    mocks.auth.mockResolvedValue({ ok: true, userId: "org-1", role: "organizer" })
    expect((await download(pdfRequest(), context())).status).toBe(403)
    expect(mocks.pdf).not.toHaveBeenCalled()
  })
  it("rejects a malformed order id", async () => {
    expect((await download(pdfRequest(), { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(400)
    expect(mocks.pdf).not.toHaveBeenCalled()
  })
  it("streams the PDF privately as a download", async () => {
    const response = await download(pdfRequest(), context())
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(response.headers.get("Content-Disposition")).toContain("tickets-8aeecc15.pdf")
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })
  it("passes through a missing-tickets error", async () => {
    mocks.pdf.mockResolvedValue({ ok: false, status: 404, error: "No tickets found for this order" })
    const response = await download(pdfRequest(), context())
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ ok: false, error: "No tickets found for this order" })
  })
})
