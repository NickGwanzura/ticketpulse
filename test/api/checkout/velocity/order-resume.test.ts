import { describe, it, expect } from "vitest"

/**
 * Tests the order resumption / idempotency logic from the checkout route.
 *
 * When a buyer double-clicks, refreshes, or retries a card payment,
 * the checkout route should find the existing pending order and
 * return it rather than creating a duplicate.
 */
describe("checkout order resume logic", () => {
  // Simulates findResumableOrder — looks for existing pending orders
  // from the same email/event within 30 minutes with a velocity trace.
  function simulateFindResumable(
    orders: Array<{
      id: string
      status: string
      email: string
      eventId: string
      createdAt: Date
      metadata: Record<string, unknown> | null
    }>,
    email: string,
    eventId: string,
  ) {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    const pending = orders.filter(
      (o) =>
        o.status === "pending" &&
        o.email === email &&
        o.eventId === eventId &&
        o.createdAt > thirtyMinAgo &&
        (o.metadata as Record<string, unknown>)?.velocity !== undefined &&
        (o.metadata as Record<string, unknown>)?.velocity !== null &&
        ((o.metadata as Record<string, unknown>)?.velocity as Record<string, unknown>)?.transactionTrace !== undefined,
    )
    // Return most recent
    pending.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return pending[0] ?? null
  }

  it("finds an existing pending order from same email and event", () => {
    const orders = [
      {
        id: "order-existing",
        status: "pending",
        email: "buyer@example.com",
        eventId: "event-uuid",
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        metadata: { velocity: { transactionTrace: "trace-uuid" } },
      },
    ]
    const result = simulateFindResumable(orders, "buyer@example.com", "event-uuid")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("order-existing")
  })

  it("returns null when no matching order exists", () => {
    const result = simulateFindResumable([], "buyer@example.com", "event-uuid")
    expect(result).toBeNull()
  })

  it("ignores orders from a different email", () => {
    const orders = [
      {
        id: "order-other",
        status: "pending",
        email: "other@example.com",
        eventId: "event-uuid",
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        metadata: { velocity: { transactionTrace: "trace-uuid" } },
      },
    ]
    const result = simulateFindResumable(orders, "buyer@example.com", "event-uuid")
    expect(result).toBeNull()
  })

  it("ignores orders older than 30 minutes", () => {
    const orders = [
      {
        id: "order-old",
        status: "pending",
        email: "buyer@example.com",
        eventId: "event-uuid",
        createdAt: new Date(Date.now() - 35 * 60 * 1000), // 35 min ago
        metadata: { velocity: { transactionTrace: "trace-uuid" } },
      },
    ]
    const result = simulateFindResumable(orders, "buyer@example.com", "event-uuid")
    expect(result).toBeNull()
  })

  it("ignores orders without velocity transaction trace in metadata", () => {
    const orders = [
      {
        id: "order-no-trace",
        status: "pending",
        email: "buyer@example.com",
        eventId: "event-uuid",
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        metadata: null,
      },
    ]
    const result = simulateFindResumable(orders, "buyer@example.com", "event-uuid")
    expect(result).toBeNull()
  })

  it("ignores non-pending orders", () => {
    const orders = [
      {
        id: "order-paid",
        status: "paid",
        email: "buyer@example.com",
        eventId: "event-uuid",
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        metadata: { velocity: { transactionTrace: "trace-uuid" } },
      },
    ]
    const result = simulateFindResumable(orders, "buyer@example.com", "event-uuid")
    expect(result).toBeNull()
  })

  it("returns the most recent order when multiple pending exist", () => {
    const orders = [
      {
        id: "order-older",
        status: "pending",
        email: "buyer@example.com",
        eventId: "event-uuid",
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
        metadata: { velocity: { transactionTrace: "trace-old" } },
      },
      {
        id: "order-newer",
        status: "pending",
        email: "buyer@example.com",
        eventId: "event-uuid",
        createdAt: new Date(Date.now() - 2 * 60 * 1000),
        metadata: { velocity: { transactionTrace: "trace-new" } },
      },
    ]
    const result = simulateFindResumable(orders, "buyer@example.com", "event-uuid")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("order-newer")
  })

  describe("VMC card redirect URL recovery", () => {
    /**
     * Simulates recoverCardRedirectUrl from the checkout route.
     * On page refresh during a card payment, the redirect URL may be lost.
     * The function attempts to get a new one by re-polling or re-initiating.
     */
    function simulateRecoverRedirect(
      transactionTrace: string | null,
      salesOrderTrace: string,
      salesOrderId: string | undefined,
      mockPollRedirect: string | null,
      mockReinitRedirect: string | null,
    ): string | null {
      if (!transactionTrace) return null

      // First try: poll the existing transaction
      if (mockPollRedirect) return mockPollRedirect

      // Second try: re-initiate a new transaction
      if (salesOrderId && mockReinitRedirect) return mockReinitRedirect

      return null
    }

    it("recovers redirect URL from poll response", () => {
      const url = simulateRecoverRedirect(
        "trace-uuid",
        "so-trace-uuid",
        "so-uuid-123",
        "https://checkout.velocityafrica.net/pay/session-abc",
        null,
      )
      expect(url).toBe("https://checkout.velocityafrica.net/pay/session-abc")
    })

    it("recovers redirect URL by re-initiating transaction when poll fails", () => {
      const url = simulateRecoverRedirect(
        "trace-uuid",
        "so-trace-uuid",
        "so-uuid-123",
        null,
        "https://checkout.velocityafrica.net/pay/session-def",
      )
      expect(url).toBe("https://checkout.velocityafrica.net/pay/session-def")
    })

    it("returns null when both poll and re-init fail", () => {
      const url = simulateRecoverRedirect(
        "trace-uuid",
        "so-trace-uuid",
        "so-uuid-123",
        null,
        null,
      )
      expect(url).toBeNull()
    })

    it("returns null when transactionTrace is null", () => {
      const url = simulateRecoverRedirect(
        null,
        "so-trace-uuid",
        "so-uuid-123",
        "https://checkout.velocityafrica.net/pay/session-abc",
        null,
      )
      expect(url).toBeNull()
    })

    it("returns null when no salesOrderId for re-init", () => {
      const url = simulateRecoverRedirect(
        "trace-uuid",
        "so-trace-uuid",
        undefined,
        null,
        "https://checkout.velocityafrica.net/pay/session-ghi",
      )
      expect(url).toBeNull()
    })
  })

  describe("VMC redirect retry logic", () => {
    /**
     * Simulates the VMC_REDIRECT_RETRIES logic.
     * When Velocity returns a card payment result without a hosted checkout URL,
     * we retry up to VMC_REDIRECT_RETRIES times with a fresh transaction.
     */
    function simulateRetryRedirect(
      maxRetries: number,
      // Simulates initiateTransaction returning an object with extractRedirectUrl result
      initiateResults: Array<string | null>,
    ): string | null {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const url = initiateResults[attempt] ?? null
        if (url) return url
      }
      return null
    }

    it("returns redirect on first attempt", () => {
      const url = simulateRetryRedirect(2, [
        "https://checkout.velocityafrica.net/pay/session-abc",
      ])
      expect(url).toBe("https://checkout.velocityafrica.net/pay/session-abc")
    })

    it("retries if first attempt has no redirect URL", () => {
      const url = simulateRetryRedirect(2, [
        null,
        "https://checkout.velocityafrica.net/pay/session-abc",
      ])
      expect(url).toBe("https://checkout.velocityafrica.net/pay/session-abc")
    })

    it("retries up to maxRetries times", () => {
      const url = simulateRetryRedirect(2, [
        null,
        null,
        null, // third attempt (0-indexed: attempt 2)
        "https://checkout.velocityafrica.net/pay/session-abc", // should not be reached
      ])
      expect(url).toBeNull()
    })

    it("returns on the last retry", () => {
      const url = simulateRetryRedirect(2, [
        null,
        null,
        "https://checkout.velocityafrica.net/pay/session-abc",
      ])
      expect(url).toBe("https://checkout.velocityafrica.net/pay/session-abc")
    })
  })
})
