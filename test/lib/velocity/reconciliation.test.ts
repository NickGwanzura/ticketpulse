import { describe, expect, it } from "vitest"

import { buildObservedVelocityMetadata } from "@/lib/velocity/reconciliation"
import type { PollTransactionResponse, VelocityOrderMetadata } from "@/types/velocity"

const current: VelocityOrderMetadata = {
  salesOrderTrace: "sales-1",
  salesOrderId: "sales-id-1",
  transactionTrace: "trace-old",
  transactionId: "transaction-id-1",
  transactionSessionId: "session-1",
  transactionTraces: ["trace-old"],
  outstandingAmount: 25,
  paymentProcessor: "VMC",
  pollStatus: "PENDING",
  paymentStatus: "PENDING",
  paymentRef: null,
  invoiceRef: null,
  initiatedAt: "2026-01-01T00:00:00.000Z",
  finalizedAt: null,
  consecutiveProviderErrors: 2,
}

describe("Velocity reconciliation metadata", () => {
  it("preserves every provider reference and records the latest paid observation", () => {
    const poll: PollTransactionResponse = {
      state: "done",
      status: "finished",
      body: {
        id: "transaction-id-2",
        trace: "trace-new",
        amount: 25,
        paymentStatus: "SUCCESS",
        pollStatus: "PENDING",
      },
      workflowId: "workflow-1",
      httpStatus: 200,
      errorMessage: null,
    }

    const observed = buildObservedVelocityMetadata(current, poll, "trace-new", "2026-08-24T10:00:00.000Z")

    expect(observed.transactionId).toBe("transaction-id-2")
    expect(observed.transactionSessionId).toBe("session-1")
    expect(observed.transactionTrace).toBe("trace-new")
    expect(observed.transactionTraces).toEqual(["trace-old", "trace-new"])
    expect(observed.paymentStatus).toBe("SUCCESS")
    expect(observed.lastPolledAt).toBe("2026-08-24T10:00:00.000Z")
    expect(observed.consecutiveProviderErrors).toBe(0)
  })

  it("increments provider error streaks without recording a payment failure", () => {
    const poll: PollTransactionResponse = {
      state: "provider_error",
      status: "error",
      body: { id: "", trace: "trace-old", amount: 0, paymentStatus: "UNKNOWN", pollStatus: "UNKNOWN" },
      workflowId: "",
      httpStatus: 400,
      errorMessage: "Missing poll reference",
    }

    const observed = buildObservedVelocityMetadata(current, poll, "trace-old", "2026-08-24T10:00:00.000Z")
    expect(observed.consecutiveProviderErrors).toBe(3)
    expect(observed.failedAt).toBeUndefined()
    expect(observed.failureReason).toBeUndefined()
  })

  it("clears stale failure metadata after a valid non-failed poll", () => {
    const poll: PollTransactionResponse = {
      state: "done",
      status: "waiting",
      body: { id: "transaction-id-1", trace: "trace-old", amount: 25, paymentStatus: "PENDING", pollStatus: "PENDING" },
      workflowId: "workflow-1",
      httpStatus: 200,
      errorMessage: null,
    }
    const observed = buildObservedVelocityMetadata(
      { ...current, failedAt: "2026-08-23T10:00:00.000Z", failureReason: "old failure" },
      poll,
      "trace-old",
      "2026-08-24T10:00:00.000Z",
    )
    expect(observed.failedAt).toBeNull()
    expect(observed.failureReason).toBeNull()
  })

  it("records a historical failure without replacing the active transaction", () => {
    const poll: PollTransactionResponse = {
      state: "done",
      status: "finished",
      body: {
        id: "historical-transaction-id",
        trace: "trace-historical",
        amount: 25,
        paymentStatus: "FAILED",
        pollStatus: "FAILED",
      },
      workflowId: "workflow-old",
      httpStatus: 200,
      errorMessage: null,
    }

    const observed = buildObservedVelocityMetadata(
      current,
      poll,
      "trace-historical",
      "2026-08-24T10:00:00.000Z",
      { preserveActiveReference: true },
    )

    expect(observed.transactionTrace).toBe("trace-old")
    expect(observed.transactionId).toBe("transaction-id-1")
    expect(observed.pollStatus).toBe("PENDING")
    expect(observed.paymentStatus).toBe("PENDING")
    expect(observed.transactionTraces).toEqual(["trace-old", "trace-historical"])
    expect(observed.transactionObservations).toContainEqual(expect.objectContaining({
      transactionTrace: "trace-historical",
      transactionId: "historical-transaction-id",
      pollStatus: "FAILED",
      paymentStatus: "FAILED",
    }))
  })
})
