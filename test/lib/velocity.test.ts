import { describe, it, expect, beforeEach, vi } from "vitest"

// Helper to create a proper mock Response with text() + json()
function mockResponse(data: unknown, status = 200): Response {
  const body = JSON.stringify(data)
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as Response
}

describe("velocity", () => {
  let mod: typeof import("@/lib/velocity")

  beforeEach(async () => {
    vi.resetModules()
    process.env.VELOCITY_API_URL = "https://api.velocityafrica.net"
    process.env.VELOCITY_API_KEY = "test-key"
    process.env.VELOCITY_MERCHANT_PHONE = "+263771234567"
    process.env.VELOCITY_MERCHANT_ACCOUNT = "acc-001"
    process.env.VELOCITY_TICKET_ITEM_CODE = "TicketPulse Ticket"
    mod = await import("@/lib/velocity")
  })

  // ── velocityUrls ───────────────────────────────────────────────────────────

  describe("velocityUrls", () => {
    it("returns return and webhook URLs from origin", () => {
      const urls = mod.velocityUrls("order-abc", "https://ticketpulse.tech")
      expect(urls.returnUrl).toBe("https://ticketpulse.tech/api/checkout/velocity/return/order-abc")
      expect(urls.webhookUrl).toBe("https://ticketpulse.tech/api/checkout/velocity/webhook")
    })

    it("strips trailing slash from origin", () => {
      const urls = mod.velocityUrls("order-xyz", "https://ticketpulse.tech/")
      expect(urls.returnUrl).not.toContain("//api")
    })
  })

  // ── fetchVelocityItems (mock fetch) ────────────────────────────────────────

  describe("fetchVelocityItems", () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it("fetches all items when no itemCode given", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse([{ itemCode: "TicketPulse Ticket", itemName: "General", unitPrice: 10 }]),
      )

      const items = await mod.fetchVelocityItems()
      expect(items).toHaveLength(1)
      expect(items[0].itemCode).toBe("TicketPulse Ticket")
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/items"),
        expect.any(Object),
      )
    })

    it("fetches a specific item when itemCode is given", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse([{ itemCode: "VIP", itemName: "VIP Pass", unitPrice: 50 }]),
      )

      await mod.fetchVelocityItems("VIP")
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("itemCode=VIP"),
        expect.any(Object),
      )
    })
  })

  // ── fetchVelocityCustomer ──────────────────────────────────────────────────

  describe("fetchVelocityCustomer", () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it("returns customer when found", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse({ customerUid: "cust-001", customerName: "John" }),
      )

      const customer = await mod.fetchVelocityCustomer("263771234567")
      expect(customer).toBeDefined()
      expect(customer!.customerUid).toBe("cust-001")
    })

    it("returns null when customer not found (404)", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not found",
      } as Response)

      const customer = await mod.fetchVelocityCustomer("263770000000")
      expect(customer).toBeNull()
    })
  })

  // ── createVelocitySalesOrder ───────────────────────────────────────────────

  describe("createVelocitySalesOrder", () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it("posts to /sales-orders with correct payload", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse({ trace: "tr-001", workflowId: "wf-001", status: "DRAFT" }),
      )

      const order = await mod.createVelocitySalesOrder({
        currency: "USD",
        customerId: null,
        amount: 25,
      })

      expect(order.trace).toBe("tr-001")
      expect(order.status).toBe("DRAFT")

      const callArgs = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]!.body as string)
      expect(body.currencyCodeString).toBe("USD")
      expect(body.items[0].itemCode).toBe("TicketPulse Ticket")
      expect(body.items[0].unitPrice).toBe(25)
    })

    it("includes customerIdString when customerId is provided", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse({ trace: "tr-002", workflowId: "wf-002", status: "DRAFT" }),
      )

      await mod.createVelocitySalesOrder({
        currency: "ZWL",
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 5000,
      })

      const callArgs = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]!.body as string)
      expect(body.customerIdString).toBe("550e8400-e29b-41d4-a716-446655440000")
    })
  })

  // ── initiateVelocityTransaction ────────────────────────────────────────────

  describe("initiateVelocityTransaction", () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it("posts to /transactions with EcoCash (REMOTE) payload", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse({
          trace: "tx-001",
          paymentStatus: "PENDING",
          pollStatus: "PENDING",
        }),
      )

      const tx = await mod.initiateVelocityTransaction({
        amount: 25,
        processor: "ECOCASH",
        debitPhone: "263771234567",
        debitCurrency: "USD",
        authType: "REMOTE",
        salesOrderTrace: "tr-001",
      })

      expect(tx.pollStatus).toBe("PENDING")

      const callArgs = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]!.body as string)
      expect(body.paymentProcessorLabel).toBe("ECOCASH")
      expect(body.salesOrderTrace).toBe("tr-001")
      expect(body.debitPhone).toBe("263771234567")
      expect(body.authType).toBe("REMOTE")
      expect(body.callbackUrl).toBeUndefined()
    })

    it("posts to /transactions with card (WEB) payload including callback URL", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse({
          trace: "tx-002",
          paymentStatus: "PENDING",
          pollStatus: "PENDING",
          redirectUrl: "https://checkout.velocityafrica.net/pay/abc",
        }),
      )

      const tx = await mod.initiateVelocityTransaction({
        amount: 50,
        processor: "VMC",
        debitPhone: "263771234567",
        debitCurrency: "USD",
        authType: "WEB",
        salesOrderTrace: "tr-002",
        returnUrl: "https://ticketpulse.tech/return",
        customerEmail: "buyer@example.com",
      })

      expect(tx.redirectUrl).toBeDefined()

      const callArgs = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]!.body as string)
      expect(body.paymentProcessorLabel).toBe("VMC")
      expect(body.salesOrderTrace).toBe("tr-002")
      expect(body.callbackUrl).toBe("https://ticketpulse.tech/return")
      expect(body.customerEmail).toBe("buyer@example.com")
    })

    it("throws when merchant env vars are missing", async () => {
      vi.restoreAllMocks()
      vi.resetModules()
      delete process.env.VELOCITY_MERCHANT_PHONE
      delete process.env.VELOCITY_MERCHANT_ACCOUNT
      const { initiateVelocityTransaction } = await import("@/lib/velocity")

      await expect(
        initiateVelocityTransaction({
          amount: 10,
          processor: "ECOCASH",
          debitPhone: "263771234567",
          debitCurrency: "USD",
          authType: "REMOTE",
          salesOrderTrace: "tr-003",
        }),
      ).rejects.toThrow(/VELOCITY_MERCHANT/)
    })
  })

  // ── pollVelocityTransaction / completeVelocitySalesOrder ───────────────────

  describe("pollVelocityTransaction", () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it("sends PUT request to poll endpoint", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse({ paymentStatus: "PAID", pollStatus: "SUCCESS" }),
      )

      const result = await mod.pollVelocityTransaction("tr-001")
      expect(result.pollStatus).toBe("SUCCESS")
      expect(result.paymentStatus).toBe("PAID")

      expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain("/transactions/poll/tr-001")
      expect(vi.mocked(global.fetch).mock.calls[0][1]?.method).toBe("PUT")
    })
  })

  describe("completeVelocitySalesOrder", () => {
    beforeEach(() => {
      global.fetch = vi.fn()
    })

    it("sends PUT request to update-workflow endpoint", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        mockResponse({ status: "COMPLETED" }),
      )

      const result = await mod.completeVelocitySalesOrder("tr-001")
      expect(result.status).toBe("COMPLETED")
      expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain(
        "/sales-orders/update-workflow/tr-001",
      )
    })
  })
})
