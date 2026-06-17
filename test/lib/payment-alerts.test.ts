import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock modules before importing
const mockSendEmail = vi.fn().mockResolvedValue({ id: "mock-email-id" })
const mockSendAdminAlert = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  adminEmail: "admin@test.ticketpulse.tech",
}))

vi.mock("@/lib/whatsapp", () => ({
  sendAdminAlert: (...args: unknown[]) => mockSendAdminAlert(...args),
}))

vi.mock("@/lib/url-config", () => ({
  getBaseUrl: () => "https://ticketpulse.tech",
}))

// Import after mocks
import { alertPaymentAnomaly, alertFinalizeNonPaid, alertRecheckHighErrorRate, alertPollUnknownStatus, alertCallbackOrderNotFound } from "@/lib/payment-alerts"

describe("payment-alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── DEDUPLICATION ─────────────────────────────────────────────────

  describe("deduplication", () => {
    it("sends the same alert type for different orders both times", async () => {
      await alertPaymentAnomaly({
        type: "POLL_UNKNOWN_STATUS",
        severity: "medium",
        title: "Test unknown",
        detail: "Order A",
        orderId: "order-a",
      })
      await alertPaymentAnomaly({
        type: "POLL_UNKNOWN_STATUS",
        severity: "medium",
        title: "Test unknown",
        detail: "Order B",
        orderId: "order-b",
      })
      // Both should be sent since they have different orderIds
      expect(mockSendEmail).toHaveBeenCalledTimes(2)
    })

    it("suppresses duplicate alerts within cooldown window", async () => {
      await alertPaymentAnomaly({
        type: "POLL_UNKNOWN_STATUS",
        severity: "medium",
        title: "Test unknown",
        detail: "First call",
        orderId: "order-1",
        transactionTrace: "trace-1",
      })

      await alertPaymentAnomaly({
        type: "POLL_UNKNOWN_STATUS",
        severity: "medium",
        title: "Test unknown",
        detail: "Second call (duplicate)",
        orderId: "order-1",
        transactionTrace: "trace-1",
      })

      // Only the first should trigger email (second suppressed by dedup)
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
    })

    it("allows the same alert after cooldown expires", async () => {
      await alertPaymentAnomaly({
        type: "POLL_UNKNOWN_STATUS",
        severity: "medium",
        title: "Test unknown",
        detail: "First",
        orderId: "order-1",
      })

      // Advance time past the 5 min cooldown
      vi.advanceTimersByTime(6 * 60 * 1000)

      await alertPaymentAnomaly({
        type: "POLL_UNKNOWN_STATUS",
        severity: "medium",
        title: "Test unknown",
        detail: "Second after cooldown",
        orderId: "order-1",
      })

      expect(mockSendEmail).toHaveBeenCalledTimes(2)
    })
  })

  // ── SEVERITY LEVELS ───────────────────────────────────────────────

  describe("severity levels", () => {
    it("sends email for medium severity alerts", async () => {
      await alertPaymentAnomaly({
        type: "POLL_UNKNOWN_STATUS",
        severity: "medium",
        title: "Medium severity test",
        detail: "Medium severity",
        orderId: "order-1",
      })
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
    })

    it("sends email and WhatsApp for high severity alerts", async () => {
      await alertPaymentAnomaly({
        type: "CALLBACK_ORDER_NOT_FOUND",
        severity: "high",
        title: "High severity test",
        detail: "High severity",
        orderId: "order-1",
      })
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1)
    })

    it("sends email and WhatsApp for critical severity alerts", async () => {
      await alertPaymentAnomaly({
        type: "CALLBACK_ORDER_NOT_FOUND",
        severity: "critical",
        title: "Critical severity test",
        detail: "Critical severity",
        orderId: "order-1",
      })
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1)
    })

    it("does not send email for low severity alerts", async () => {
      await alertPaymentAnomaly({
        type: "POLL_NETWORK_ERROR",
        severity: "low",
        title: "Low severity test",
        detail: "Low severity",
        orderId: "order-1",
      })
      // Low severity only logs — no email or WhatsApp
      expect(mockSendEmail).toHaveBeenCalledTimes(0)
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(0)
    })
  })

  // ── CONVENIENCE FUNCTIONS ─────────────────────────────────────────

  describe("alertFinalizeNonPaid", () => {
    it("sends a high severity alert", async () => {
      await alertFinalizeNonPaid("order-1", "so-trace-001", "PARTIAL", 25.50)
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1)
      // Check the email was sent with appropriate subject
      const emailCall = mockSendEmail.mock.calls[0][0]
      expect(emailCall.subject).toContain("non-PAID")
    })
  })

  describe("alertPollUnknownStatus", () => {
    it("sends a medium severity alert", async () => {
      await alertPollUnknownStatus("order-1", "tx-trace-001", "WEIRD_STATUS", "SUCCESS", "done")
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(0) // medium = no WhatsApp
      const emailCall = mockSendEmail.mock.calls[0][0]
      expect(emailCall.subject).toContain("unknown status")
    })
  })

  describe("alertCallbackOrderNotFound", () => {
    it("sends a high severity alert with transaction context", async () => {
      await alertCallbackOrderNotFound("tx-trace-001", "so-trace-001", { someField: "value" })
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1)
      const emailCall = mockSendEmail.mock.calls[0][0]
      expect(emailCall.subject).toContain("unknown order")
    })
  })

  describe("alertRecheckHighErrorRate", () => {
    it("does not alert when error rate is low", async () => {
      await alertRecheckHighErrorRate(20, 1, 19, [{ orderId: "order-1", reason: "timeout" }])
      // 1 error out of 20 = 5% — below the 20% threshold
      expect(mockSendEmail).toHaveBeenCalledTimes(0)
    })

    it("alerts when error rate exceeds 20%", async () => {
      await alertRecheckHighErrorRate(10, 5, 5, [
        { orderId: "order-1", reason: "timeout" },
        { orderId: "order-2", reason: "auth failed" },
        { orderId: "order-3", reason: "network error" },
        { orderId: "order-4", reason: "invalid response" },
        { orderId: "order-5", reason: "timeout" },
      ])
      // 5 errors out of 10 = 50% — well above threshold
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1)
      const emailCall = mockSendEmail.mock.calls[0][0]
      expect(emailCall.subject).toContain("50%")
    })

    it("alerts with critical severity when error rate exceeds 50%", async () => {
      await alertRecheckHighErrorRate(10, 7, 3, [
        { orderId: "order-1", reason: "timeout" },
        { orderId: "order-2", reason: "auth failed" },
        { orderId: "order-3", reason: "network error" },
        { orderId: "order-4", reason: "invalid response" },
        { orderId: "order-5", reason: "timeout" },
        { orderId: "order-6", reason: "rate limited" },
        { orderId: "order-7", reason: "timeout" },
      ])
      // 7 errors out of 10 = 70% — critical severity
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendAdminAlert).toHaveBeenCalledTimes(1)
    })
  })
})
