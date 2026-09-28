import { describe, expect, it } from "vitest"
import { allocateTicketRefunds, isOutsideStandardRefundWindow } from "@/lib/refunds"

describe("allocateTicketRefunds", () => {
  it("allocates order-level discounts proportionally and preserves cents", () => {
    const allocations = allocateTicketRefunds(
      "90.00",
      [
        { id: "tickets", type: "ticket", tierId: "tier-a", quantity: 2, total: "60.00" },
        { id: "merch", type: "merch", tierId: null, quantity: 1, total: "40.00" },
      ],
      [{ id: "t1", tierId: "tier-a" }, { id: "t2", tierId: "tier-a" }],
    )

    expect(allocations.get("t1")).toBe(2700)
    expect(allocations.get("t2")).toBe(2700)
    expect([...allocations.values()].reduce((sum, value) => sum + value, 0)).toBe(5400)
  })

  it("distributes odd cents deterministically across tickets", () => {
    const allocations = allocateTicketRefunds(
      "10.00",
      [{ id: "tickets", type: "ticket", tierId: "tier-a", quantity: 3, total: "10.00" }],
      [{ id: "t1", tierId: "tier-a" }, { id: "t2", tierId: "tier-a" }, { id: "t3", tierId: "tier-a" }],
    )

    expect([...allocations.values()]).toEqual([334, 333, 333])
    expect([...allocations.values()].reduce((sum, value) => sum + value, 0)).toBe(1000)
  })

  it("does not allocate merchandise value to ticket refunds", () => {
    const allocations = allocateTicketRefunds(
      "20.00",
      [
        { id: "tickets", type: "ticket", tierId: "tier-a", quantity: 1, total: "10.00" },
        { id: "merch", type: "merch", tierId: null, quantity: 1, total: "10.00" },
      ],
      [{ id: "t1", tierId: "tier-a" }],
    )

    expect(allocations.get("t1")).toBe(1000)
  })

  it("rejects inconsistent totals instead of over-refunding", () => {
    expect(() => allocateTicketRefunds(
      "11.00",
      [{ id: "tickets", type: "ticket", tierId: "tier-a", quantity: 1, total: "10.00" }],
      [{ id: "t1", tierId: "tier-a" }],
    )).toThrow("Order totals are not valid for a refund")
  })
})

describe("isOutsideStandardRefundWindow", () => {
  const startsAt = new Date("2026-10-10T18:00:00.000Z")

  it("allows the standard policy through the exact 24-hour cutoff", () => {
    expect(isOutsideStandardRefundWindow(startsAt, new Date("2026-10-09T18:00:00.000Z"))).toBe(false)
  })

  it("flags requests inside the final 24 hours and missing event dates for review", () => {
    expect(isOutsideStandardRefundWindow(startsAt, new Date("2026-10-09T18:00:00.001Z"))).toBe(true)
    expect(isOutsideStandardRefundWindow(null, new Date("2026-10-01T00:00:00.000Z"))).toBe(true)
  })
})
