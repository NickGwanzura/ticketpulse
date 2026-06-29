import { describe, it, expect } from "vitest"

/**
 * Replicates the normalizeVelocityPollResponse function from services/velocity.ts
 * so we can test it in isolation.
 */
interface PollBody {
  trace?: string | null
  amount?: number | null
  paymentStatus?: string | null
  pollStatus?: string | null
}

interface PollResponse {
  state?: string
  status?: string
  body?: PollBody | null
}

interface NormalizedPollResponse {
  localStatus: "PAID" | "PENDING" | "FAILED" | "UNKNOWN"
  velocityPaymentStatus: string | null
  velocityPollStatus: string | null
  velocityWorkflowStatus: string | null
  rawResponse: PollResponse | null
}

function normalizeVelocityPollResponse(
  response: PollResponse | null | undefined,
): NormalizedPollResponse {
  if (!response) {
    return {
      localStatus: "UNKNOWN",
      velocityPaymentStatus: null,
      velocityPollStatus: null,
      velocityWorkflowStatus: null,
      rawResponse: null,
    }
  }

  const pollStatus = response.body?.pollStatus
  const paymentStatus = response.body?.paymentStatus
  const workflowStatus = response.status

  let localStatus: NormalizedPollResponse["localStatus"]

  if (pollStatus === "SUCCESS") {
    localStatus = "PAID"
  } else if (paymentStatus === "SUCCESS") {
    localStatus = "PAID"
  } else if (pollStatus === "FAILED") {
    localStatus = "FAILED"
  } else if (paymentStatus === "FAILED") {
    localStatus = "FAILED"
  } else if (pollStatus === "PENDING") {
    localStatus = "PENDING"
  } else {
    localStatus = "UNKNOWN"
  }

  return {
    localStatus,
    velocityPaymentStatus: paymentStatus ?? null,
    velocityPollStatus: pollStatus ?? null,
    velocityWorkflowStatus: workflowStatus ?? null,
    rawResponse: response,
  }
}

describe("normalizeVelocityPollResponse", () => {
  describe("PAID scenarios", () => {
    it("returns PAID when pollStatus is SUCCESS", () => {
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: "SUCCESS", paymentStatus: "SUCCESS" },
      })
      expect(result.localStatus).toBe("PAID")
    })

    it("returns PAID when paymentStatus is SUCCESS even if pollStatus is PENDING", () => {
      // Gateway confirmed settlement — promote to PAID
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: "PENDING", paymentStatus: "SUCCESS" },
      })
      expect(result.localStatus).toBe("PAID")
    })

    it("returns PAID when paymentStatus is SUCCESS even if pollStatus is FAILED", () => {
      // The async poll workflow can lag behind gateway settlement
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: "FAILED", paymentStatus: "SUCCESS" },
      })
      expect(result.localStatus).toBe("PAID")
    })
  })

  describe("FAILED scenarios", () => {
    it("returns FAILED when pollStatus is FAILED and paymentStatus is not SUCCESS", () => {
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: "FAILED", paymentStatus: "FAILED" },
      })
      expect(result.localStatus).toBe("FAILED")
    })

    it("returns FAILED when pollStatus is FAILED and paymentStatus is null", () => {
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: "FAILED" },
      })
      expect(result.localStatus).toBe("FAILED")
    })

    it("returns FAILED when paymentStatus is FAILED and pollStatus is null", () => {
      const result = normalizeVelocityPollResponse({
        body: { paymentStatus: "FAILED" },
      })
      expect(result.localStatus).toBe("FAILED")
    })
  })

  describe("PENDING scenarios", () => {
    it("returns PENDING when pollStatus is PENDING with no paymentStatus", () => {
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: "PENDING" },
      })
      expect(result.localStatus).toBe("PENDING")
    })

    it("returns PENDING when pollStatus is PENDING and paymentStatus is INITIATED", () => {
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: "PENDING", paymentStatus: "INITIATED" },
      })
      expect(result.localStatus).toBe("PENDING")
    })
  })

  describe("UNKNOWN scenarios", () => {
    it("returns UNKNOWN for null response", () => {
      const result = normalizeVelocityPollResponse(null)
      expect(result.localStatus).toBe("UNKNOWN")
    })

    it("returns UNKNOWN for undefined response", () => {
      const result = normalizeVelocityPollResponse(undefined)
      expect(result.localStatus).toBe("UNKNOWN")
    })

    it("returns UNKNOWN when pollStatus and paymentStatus are both null", () => {
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: null, paymentStatus: null },
      })
      expect(result.localStatus).toBe("UNKNOWN")
    })

    it("returns UNKNOWN when body is null", () => {
      const result = normalizeVelocityPollResponse({ body: null })
      expect(result.localStatus).toBe("UNKNOWN")
    })

    it("returns UNKNOWN for unrecognized status values", () => {
      const result = normalizeVelocityPollResponse({
        body: { pollStatus: "CANCELLED", paymentStatus: "REFUNDED" },
      })
      expect(result.localStatus).toBe("UNKNOWN")
    })
  })

  describe("field passthrough", () => {
    it("passes through payment status, poll status, and workflow status", () => {
      const result = normalizeVelocityPollResponse({
        state: "gatewayPayment",
        status: "manual",
        body: {
          pollStatus: "PENDING",
          paymentStatus: "INITIATED",
          amount: 75,
        },
      })
      expect(result.velocityPollStatus).toBe("PENDING")
      expect(result.velocityPaymentStatus).toBe("INITIATED")
      expect(result.velocityWorkflowStatus).toBe("manual")
    })

    it("stores raw response", () => {
      const resp = { body: { pollStatus: "SUCCESS" } }
      const result = normalizeVelocityPollResponse(resp)
      expect(result.rawResponse).toBe(resp)
    })
  })
})
