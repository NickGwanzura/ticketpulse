import { describe, expect, it } from "vitest"
import { confirmedSalesOrder, protectedFromRecovery } from "@/lib/velocity/sales-order-recovery"
import { normalizeVelocityPollResponse } from "@/services/velocity"

describe("sales order recovery safeguards", () => {
  const remote = { id: "so-1", trace: "trace-1", currencyCodeString: "USD", status: "PAID", grandTotal: 40, paidAmount: 40, outstandingAmount: 0, name: "sale" }
  it("requires matching references and exact full payment", () => {
    expect(confirmedSalesOrder(remote, "so-1", "trace-1", "40", "USD")).toBe(true)
    for (const change of [{ id: "other" }, { trace: "other" }, { currencyCodeString: "ZWG" }, { paidAmount: 80 }, { paidAmount: 20 }, { outstandingAmount: 1 }, { status: "UNPAID" }, { grandTotal: undefined }]) {
      expect(confirmedSalesOrder({ ...remote, ...change }, "so-1", "trace-1", "40", "USD")).toBe(false)
    }
  })
  it("never reprocesses completed or manually completed orders", () => {
    for (const status of ["paid", "completed", "cancelled", "refunded"]) expect(protectedFromRecovery({ status, metadata: {} })).toBe(true)
    expect(protectedFromRecovery({ status: "pending", metadata: { manualCompletion: { completedBy: "admin" } } })).toBe(true)
    expect(protectedFromRecovery({ status: "expired", metadata: {} })).toBe(false)
  })
  it("does not confuse successful initiation with payment confirmation", () => {
    expect(normalizeVelocityPollResponse({ state: "poll", status: "waiting", workflowId: "1", body: { id: "1", trace: "1", amount: 40, paymentStatus: "SUCCESS", pollStatus: "PENDING" } }).localStatus).toBe("PENDING")
    expect(normalizeVelocityPollResponse({ state: "done", status: "finished", workflowId: "1", body: { id: "1", trace: "1", amount: 40, paymentStatus: "SUCCESS", pollStatus: "FAILED" } }).localStatus).toBe("FAILED")
  })
})
