import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import type { PollTransactionResponse } from "@/types/velocity"

const MOCK_SALES_ORDER_TRACE = "so-trace-001"
const MOCK_TRANSACTION_TRACE = "tx-trace-001"

function mockFetch(response: { status?: number; body: unknown }) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: (response.status ?? 200) < 400,
    status: response.status ?? 200,
    json: () => Promise.resolve(response.body),
    text: () => Promise.resolve(JSON.stringify(response.body)),
  })
}

function pollResponse(body: Omit<Partial<PollTransactionResponse["body"]>, "pollStatus"> & { pollStatus?: string }): PollTransactionResponse {
  return {
    state: "done",
    status: "finished",
    body: {
      id: "txn-1",
      trace: "trace-1",
      amount: 50,
      paymentStatus: "PENDING",
      pollStatus: "PENDING",
      ...body,
    } as PollTransactionResponse["body"],
    workflowId: "617",
  }
}

describe("velocity service", () => {
  let mod: typeof import("@/services/velocity")

  beforeEach(async () => {
    vi.resetModules()
    process.env.VELOCITY_API_KEY = "test-key-123"
    process.env.VELOCITY_BASE_URL = "https://api.velocity.test"
    process.env.VELOCITY_ITEM_CODE = "tp001"
    process.env.VELOCITY_MERCHANT_PHONE = "+263700000000"
    mod = await import("@/services/velocity")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("getConfig", () => {
    it("returns config from env vars", () => {
      const config = mod.getConfig()
      expect(config.apiKey).toBe("test-key-123")
      expect(config.baseUrl).toBe("https://api.velocity.test")
      expect(config.itemCode).toBe("tp001")
      expect(config.merchantPhone).toBe("+263700000000")
    })

    it("throws when API key is missing", async () => {
      delete process.env.VELOCITY_API_KEY
      const { getConfig } = await import("@/services/velocity")
      expect(() => getConfig()).toThrow("VELOCITY_API_KEY")
    })
  })

  describe("validatePhone", () => {
    it("validates international format", () => {
      expect(mod.validatePhone("+263771234567")).toBe(true)
    })
    it("rejects local format", () => {
      expect(mod.validatePhone("0771234567")).toBe(false)
    })
  })

  describe("getAuthType", () => {
    it("returns REMOTE for ECOCASH", () => {
      expect(mod.getAuthType("ECOCASH")).toBe("REMOTE")
    })
    it("returns WEB for VMC", () => {
      expect(mod.getAuthType("VMC")).toBe("WEB")
    })
  })


  describe("getProcessorLabel", () => {
    it("maps velocity-ecocash to ECOCASH", () => {
      expect(mod.getProcessorLabel("velocity-ecocash")).toBe("ECOCASH")
    })
    it("maps velocity-card to VMC", () => {
      expect(mod.getProcessorLabel("velocity-card")).toBe("VMC")
    })
    it("returns empty string for unknown", () => {
      expect(mod.getProcessorLabel("bitcoin")).toBe("")
    })
  })

  // ─── NORMALIZE VELOCITY POLL RESPONSE ────────────────────────────────

  describe("normalizeVelocityPollResponse", () => {
    it("returns PAID when body.pollStatus is SUCCESS", () => {
      const result = mod.normalizeVelocityPollResponse(pollResponse({
        paymentStatus: "SUCCESS", pollStatus: "SUCCESS",
      }))
      expect(result.localStatus).toBe("PAID")
      expect(result.velocityPollStatus).toBe("SUCCESS")
    })

    it("returns FAILED when body.pollStatus is FAILED", () => {
      const result = mod.normalizeVelocityPollResponse(pollResponse({
        paymentStatus: "FAILED", pollStatus: "FAILED",
      }))
      expect(result.localStatus).toBe("FAILED")
    })

    it("returns PENDING when body.pollStatus is PENDING", () => {
      const result = mod.normalizeVelocityPollResponse(pollResponse({
        paymentStatus: "PENDING", pollStatus: "PENDING",
      }))
      expect(result.localStatus).toBe("PENDING")
    })

    it("returns PAID when body.pollStatus is missing but paymentStatus is SUCCESS", () => {
      const result = mod.normalizeVelocityPollResponse(pollResponse({
        paymentStatus: "SUCCESS", pollStatus: undefined,
      }))
      expect(result.localStatus).toBe("PAID")
      expect(result.velocityPaymentStatus).toBe("SUCCESS")
    })

    it("returns FAILED when body.pollStatus is missing but paymentStatus is FAILED", () => {
      const result = mod.normalizeVelocityPollResponse(pollResponse({
        paymentStatus: "FAILED", pollStatus: undefined,
      }))
      expect(result.localStatus).toBe("FAILED")
    })

    it("returns UNKNOWN for null/undefined response", () => {
      const result = mod.normalizeVelocityPollResponse(null)
      expect(result.localStatus).toBe("UNKNOWN")
      expect(result.rawResponse).toBeNull()

      const result2 = mod.normalizeVelocityPollResponse(undefined)
      expect(result2.localStatus).toBe("UNKNOWN")
    })

    it("returns UNKNOWN for unexpected pollStatus value", () => {
      const result = mod.normalizeVelocityPollResponse(pollResponse({
        paymentStatus: "SOME_WEIRD_STATUS", pollStatus: "COMPLETED",
      }))
      expect(result.localStatus).toBe("UNKNOWN")
      expect(result.velocityPollStatus).toBe("COMPLETED")
    })

    it("includes rawResponse in the result", () => {
      const raw = pollResponse({
        paymentStatus: "SUCCESS", pollStatus: "SUCCESS",
      })
      const result = mod.normalizeVelocityPollResponse(raw)
      expect(result.rawResponse).toBe(raw)
    })
  })

  // ─── FULL FLOW INTEGRATION TESTS ──────────────────────────────────────

  describe("createSalesOrder", () => {
    it("returns sales order data on success", async () => {
      mockFetch({
        body: {
          state: "salesOrder",
          status: "manual",
          body: {
            paidAmount: 0,
            changeAmount: 0,
            outstandingAmount: 50,
            trace: MOCK_SALES_ORDER_TRACE,
            authorized: true,
            name: "SORD-00038",
            grandTotal: 50,
            status: "OPEN",
          },
          workflowId: "wf-001",
          externalId: null,
        },
      })

      const result = await mod.createSalesOrder({
        currencyCodeString: "USD",
        customerIdString: "550e8400-e29b-41d4-a716-446655440000",
        orderDate: "2026-05-28",
        dueDate: "2026-05-28",
        notes: "Test purchase",
        authorized: true,
        items: [{ itemCode: "tp001", qty: 2, unitPrice: 25, amount: 50 }],
      })

      expect(result.body.trace).toBe(MOCK_SALES_ORDER_TRACE)
      expect(result.workflowId).toBe("wf-001")
      expect(result.body.outstandingAmount).toBe(50)
      expect(result.body.status).toBe("OPEN")
    })

    it("throws on API error", async () => {
      mockFetch({ status: 400, body: { message: "Invalid item code" } })

      await expect(
        mod.createSalesOrder({
          currencyCodeString: "USD",
          customerIdString: "550e8400-e29b-41d4-a716-446655440001",
          orderDate: "2026-05-28",
          dueDate: "2026-05-28",
          notes: "Test",
          authorized: true,
          items: [{ itemCode: "bad", qty: 1, unitPrice: 10, amount: 10 }],
        }),
      ).rejects.toThrow()
    })
  })

  describe("initiateTransaction", () => {
    it("returns transaction data on success", async () => {
      mockFetch({
        body: {
          state: "gatewayPayment",
          status: "manual",
          body: {
            id: "txn-id-001",
            trace: MOCK_TRANSACTION_TRACE,
            amount: 50,
            paymentStatus: "INITIATED",
            pollStatus: "PENDING",
          },
          workflowId: "617",
        },
      })

      const result = await mod.initiateTransaction({
        amount: 50,
        paymentProcessorLabel: "ECOCASH",
        debitPhone: "+263771234567",
        debitRegion: "ZW",
        debitCurrency: "USD",
        debitRef: "ticketpulse",
        creditPhone: "+263700000000",
        creditRegion: "ZW",
        creditAccount: "+263700000000",
        type: "REQUEST",
        authType: "REMOTE",
        salesOrderId: MOCK_SALES_ORDER_TRACE,
      })

      expect(result.body.trace).toBe(MOCK_TRANSACTION_TRACE)
      expect(result.body.pollStatus).toBe("PENDING")
      expect(result.body.amount).toBe(50)
    })
  })

  describe("pollTransaction", () => {
    it("returns SUCCESS when payment is confirmed", async () => {
      mockFetch({
        body: {
          state: "done",
          status: "finished",
          body: {
            id: "txn-id-001",
            trace: MOCK_TRANSACTION_TRACE,
            amount: 50,
            paymentStatus: "SUCCESS",
            pollStatus: "SUCCESS",
          },
          workflowId: "617",
        },
      })

      const result = await mod.pollTransaction(MOCK_TRANSACTION_TRACE)
      expect(result.body.pollStatus).toBe("SUCCESS")
    })

    it("returns FAILED when payment fails", async () => {
      mockFetch({
        body: {
          state: "done",
          status: "finished",
          body: {
            id: "txn-id-001",
            trace: MOCK_TRANSACTION_TRACE,
            amount: 50,
            paymentStatus: "FAILED",
            pollStatus: "FAILED",
          },
          workflowId: "617",
        },
      })

      const result = await mod.pollTransaction(MOCK_TRANSACTION_TRACE)
      expect(result.body.pollStatus).toBe("FAILED")
    })

    it("returns PENDING when still waiting", async () => {
      mockFetch({
        body: {
          state: "done",
          status: "finished",
          body: {
            id: "txn-id-001",
            trace: MOCK_TRANSACTION_TRACE,
            amount: 50,
            paymentStatus: "PENDING",
            pollStatus: "PENDING",
          },
          workflowId: "617",
        },
      })

      const result = await mod.pollTransaction(MOCK_TRANSACTION_TRACE)
      expect(result.body.pollStatus).toBe("PENDING")
    })

    it("does NOT throw on HTTP 400 error – returns structured response", async () => {
      mockFetch({ status: 400, body: { message: "Transaction failed" } })

      const result = await mod.pollTransaction("bad-trace")
      expect(result.body.pollStatus).toBe("UNKNOWN")
      expect(result.body.paymentStatus).toBe("FAILED")
    })

    it("does NOT throw on HTTP 500 error – returns structured response", async () => {
      mockFetch({ status: 500, body: { message: "Internal server error" } })

      const result = await mod.pollTransaction("error-trace")
      expect(result.body.pollStatus).toBe("UNKNOWN")
    })

    it("handles network errors gracefully – returns structured response", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))

      const result = await mod.pollTransaction("network-fail")
      expect(result.state).toBe("network_error")
      expect(result.body.pollStatus).toBe("UNKNOWN")
    })

    it("handles non-JSON response gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("not json")),
        text: () => Promise.resolve("Bad Gateway HTML"),
      })

      const result = await mod.pollTransaction("bad-response")
      expect(result.body.pollStatus).toBe("UNKNOWN")
    })
  })

  describe("finalizeWorkflow", () => {
    it("returns invoice reference on success", async () => {
      mockFetch({
        body: {
          state: "done",
          status: "finished",
          body: {
            salesOrder: {
              id: "so-uuid",
              paidAmount: 5,
              outstandingAmount: 0,
              status: "PAID",
              name: "SORD-00038",
            },
            invoice: {
              id: "INV-001",
              name: "SINV-00017",
              status: "COMPLETE",
            },
          },
        },
      })

      const result = await mod.finalizeWorkflow(MOCK_SALES_ORDER_TRACE)
      expect(result.body.salesOrder.status).toBe("PAID")
      expect(result.body.invoice.id).toBe("INV-001")
    })
  })

  // ─── FULL FLOW END-TO-END ─────────────────────────────────────────────

  describe("full payment flow", () => {
    it("completes the full sales order → pay → poll → finalize cycle", async () => {
      mockFetch({
        body: {
          state: "salesOrder",
          status: "manual",
          body: {
            paidAmount: 0,
            changeAmount: 0,
            outstandingAmount: 50,
            trace: MOCK_SALES_ORDER_TRACE,
            authorized: true,
            name: "SORD-00039",
            grandTotal: 50,
            status: "OPEN",
          },
          workflowId: "wf-001",
          externalId: null,
        },
      })

      const salesOrder = await mod.createSalesOrder({
        currencyCodeString: "USD",
        customerIdString: "550e8400-e29b-41d4-a716-446655440002",
        orderDate: "2026-05-28",
        dueDate: "2026-05-28",
        notes: "Integration test",
        authorized: true,
        items: [{ itemCode: "tp001", qty: 2, unitPrice: 25, amount: 50 }],
      })

      expect(salesOrder.body.trace).toBe(MOCK_SALES_ORDER_TRACE)

      mockFetch({
        body: {
          state: "gatewayPayment",
          status: "manual",
          body: {
            id: "txn-id-001",
            trace: MOCK_TRANSACTION_TRACE,
            amount: 50,
            paymentStatus: "INITIATED",
            pollStatus: "PENDING",
          },
          workflowId: "617",
        },
      })

      const transaction = await mod.initiateTransaction({
        amount: salesOrder.body.outstandingAmount,
        paymentProcessorLabel: "ECOCASH",
        debitPhone: "+263771234567",
        debitRegion: "ZW",
        debitCurrency: "USD",
        debitRef: "ticketpulse",
        creditPhone: "+263700000000",
        creditRegion: "ZW",
        creditAccount: "+263700000000",
        type: "REQUEST",
        authType: "REMOTE",
        salesOrderId: salesOrder.body.trace,
      })

      expect(transaction.body.trace).toBe(MOCK_TRANSACTION_TRACE)

      mockFetch({
        body: {
          state: "done",
          status: "finished",
          body: {
            id: "txn-id-001",
            trace: MOCK_TRANSACTION_TRACE,
            amount: 50,
            paymentStatus: "SUCCESS",
            pollStatus: "SUCCESS",
          },
          workflowId: "617",
        },
      })

      const poll = await mod.pollTransaction(transaction.body.trace)
      expect(poll.body.pollStatus).toBe("SUCCESS")

      mockFetch({
        body: {
          state: "done",
          status: "finished",
          body: {
            salesOrder: {
              id: "so-uuid",
              paidAmount: 50,
              outstandingAmount: 0,
              status: "PAID",
              name: "SORD-00039",
            },
            invoice: {
              id: "INV-001",
              name: "SINV-00017",
              status: "COMPLETE",
            },
          },
        },
      })

      const finalize = await mod.finalizeWorkflow(salesOrder.body.trace)
      expect(finalize.body.salesOrder.status).toBe("PAID")
      expect(finalize.body.invoice.id).toBe("INV-001")
    })

    it("handles payment failure mid-flow", async () => {
      mockFetch({
        body: {
          state: "salesOrder",
          status: "manual",
          body: {
            paidAmount: 0,
            changeAmount: 0,
            outstandingAmount: 100,
            trace: "so-trace-002",
            authorized: true,
            name: "SORD-00040",
            grandTotal: 100,
            status: "OPEN",
          },
          workflowId: "wf-002",
          externalId: null,
        },
      })

      const salesOrder = await mod.createSalesOrder({
        currencyCodeString: "USD",
        customerIdString: "550e8400-e29b-41d4-a716-446655440003",
        orderDate: "2026-05-28",
        dueDate: "2026-05-28",
        notes: "Test failure",
        authorized: true,
        items: [{ itemCode: "tp001", qty: 1, unitPrice: 100, amount: 100 }],
      })
      expect(salesOrder.body.trace).toBe("so-trace-002")

      mockFetch({
        body: {
          state: "done",
          status: "finished",
          body: {
            id: "txn-id-002",
            trace: "tx-trace-002",
            amount: 100,
            paymentStatus: "FAILED",
            pollStatus: "FAILED",
          },
          workflowId: "617",
        },
      })

      const poll = await mod.pollTransaction("tx-trace-002")
      expect(poll.body.pollStatus).toBe("FAILED")
    })

    it("handles network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))

      await expect(
        mod.createSalesOrder({
          currencyCodeString: "USD",
          customerIdString: "550e8400-e29b-41d4-a716-446655440004",
          orderDate: "2026-05-28",
          dueDate: "2026-05-28",
          notes: "Test",
          authorized: true,
          items: [{ itemCode: "tp001", qty: 1, unitPrice: 10, amount: 10 }],
        }),
      ).rejects.toThrow("Network error communicating with Velocity Africa")
    })
  })
})
