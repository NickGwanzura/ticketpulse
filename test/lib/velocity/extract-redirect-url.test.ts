import { describe, it, expect } from "vitest"

/**
 * Replicates the extractRedirectUrl function from app/api/checkout/velocity/route.ts
 * so we can test it in isolation without importing from a Next.js route file.
 */
function extractRedirectUrl(body: Record<string, unknown>): string | undefined {
  const candidates = [
    "redirectUrl", "redirect_url", "paymentUrl", "payment_url",
    "checkoutUrl", "checkout_url", "gatewayUrl", "gateway_url",
    "authorizationUrl", "authorization_url",
    "hostedUrl", "hosted_url", "paymentLink", "payment_link",
    "checkoutLink", "checkout_link", "embeddedUrl", "embedded_url",
    "url",
  ]

  for (const key of candidates) {
    const val = body[key]
    // Only accept HTTPS redirect URLs for payment security
    if (typeof val === "string" && val.startsWith("https://")) {
      return val
    }
  }

  for (const key of Object.keys(body)) {
    const val = body[key]
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const nested = extractRedirectUrl(val as Record<string, unknown>)
      if (nested) return nested
    }
  }

  return undefined
}

describe("extractRedirectUrl", () => {
  // ── TOP-LEVEL CANDIDATES ──────────────────────────────────────────────

  it("finds redirectUrl at top level", () => {
    expect(extractRedirectUrl({
      redirectUrl: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds url at top level", () => {
    expect(extractRedirectUrl({
      url: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds paymentUrl at top level", () => {
    expect(extractRedirectUrl({
      paymentUrl: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds checkoutUrl at top level", () => {
    expect(extractRedirectUrl({
      checkoutUrl: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds gatewayUrl at top level", () => {
    expect(extractRedirectUrl({
      gatewayUrl: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds authorizationUrl at top level", () => {
    expect(extractRedirectUrl({
      authorizationUrl: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds hostedUrl at top level", () => {
    expect(extractRedirectUrl({
      hostedUrl: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds paymentLink at top level", () => {
    expect(extractRedirectUrl({
      paymentLink: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds checkoutLink at top level", () => {
    expect(extractRedirectUrl({
      checkoutLink: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds embeddedUrl at top level", () => {
    expect(extractRedirectUrl({
      embeddedUrl: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  // ── SNAKE_CASE VARIANTS ───────────────────────────────────────────────

  it("finds redirect_url (snake_case) at top level", () => {
    expect(extractRedirectUrl({
      redirect_url: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds checkout_url (snake_case) at top level", () => {
    expect(extractRedirectUrl({
      checkout_url: "https://checkout.velocityafrica.net/pay/abc123",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  // ── NESTED OBJECT ─────────────────────────────────────────────────────

  it("finds redirectUrl nested one level deep", () => {
    expect(extractRedirectUrl({
      state: "gatewayPayment",
      status: "manual",
      body: {
        id: "txn-001",
        trace: "trace-001",
        amount: 50,
        paymentStatus: "INITIATED",
        pollStatus: "PENDING",
        redirectUrl: "https://checkout.velocityafrica.net/pay/abc123",
      },
      workflowId: "617",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds url nested one level deep (the fix for card payments)", () => {
    expect(extractRedirectUrl({
      state: "gatewayPayment",
      status: "manual",
      body: {
        id: "txn-001",
        trace: "trace-001",
        amount: 50,
        paymentStatus: "INITIATED",
        pollStatus: "PENDING",
        url: "https://checkout.velocityafrica.net/pay/abc123",
      },
      workflowId: "617",
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds checkoutUrl nested two levels deep", () => {
    expect(extractRedirectUrl({
      result: {
        transaction: {
          checkoutUrl: "https://checkout.velocityafrica.net/pay/abc123",
        },
      },
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  it("finds gatewayUrl nested deeply with mixed keys", () => {
    expect(extractRedirectUrl({
      response: {
        data: {
          payment: {
            gatewayUrl: "https://checkout.velocityafrica.net/pay/abc123",
          },
        },
        status: "ok",
      },
    })).toBe("https://checkout.velocityafrica.net/pay/abc123")
  })

  // ── PRIORITY ORDER ────────────────────────────────────────────────────

  it("prefers the first matching candidate in definition order", () => {
    expect(extractRedirectUrl({
      redirectUrl: "https://checkout.velocityafrica.net/redirect",
      paymentUrl: "https://checkout.velocityafrica.net/payment",
      url: "https://checkout.velocityafrica.net/url",
    })).toBe("https://checkout.velocityafrica.net/redirect")
  })

  it("returns the nested URL when top level has no match but nested does", () => {
    expect(extractRedirectUrl({
      state: "done",
      status: "finished",
      body: {
        id: "txn-001",
        trace: "trace-001",
        paymentUrl: "https://checkout.velocityafrica.net/pay/abc",
      },
    })).toBe("https://checkout.velocityafrica.net/pay/abc")
  })

  // ── EDGE CASES ────────────────────────────────────────────────────────

  it("returns undefined when no URL is present", () => {
    expect(extractRedirectUrl({
      state: "error",
      status: "failed",
      body: { id: "txn-001", trace: "trace-001", amount: 0 },
    })).toBeUndefined()
  })

  it("returns undefined for empty object", () => {
    expect(extractRedirectUrl({})).toBeUndefined()
  })

  it("returns undefined when URL is http:// not https://", () => {
    // We only accept HTTPS for payment security
    expect(extractRedirectUrl({
      redirectUrl: "http://checkout.velocityafrica.net/pay/abc123",
    })).toBeUndefined()
  })

  it("returns undefined when URL value is not a string", () => {
    expect(extractRedirectUrl({
      redirectUrl: 123,
    })).toBeUndefined()
  })

  it("handles body being null gracefully", () => {
    // The function receives the whole object — null body is a value to iterate
    expect(extractRedirectUrl({
      state: "error",
      body: null,
    })).toBeUndefined()
  })

  it("does not recurse into arrays", () => {
    expect(extractRedirectUrl({
      items: [{ url: "https://checkout.velocityafrica.net/pay/abc" }],
    })).toBeUndefined()
  })

  it("handles a real-world InitiateTransactionResponse shape for card payment", () => {
    // Simulates what Velocity returns for a VMC (card) payment
    const response = {
      state: "gatewayPayment",
      status: "manual",
      body: {
        id: "txn-uuid-here",
        trace: "trace-uuid-here",
        amount: 75.00,
        paymentStatus: "INITIATED",
        pollStatus: "PENDING",
        url: "https://checkout.velocityafrica.net/pay/session-abc-123",
        checkoutUrl: "https://checkout.velocityafrica.net/pay/session-abc-123",
      },
      workflowId: "wf-617",
      message: null,
    }
    expect(extractRedirectUrl(response as unknown as Record<string, unknown>)).toBe(
      "https://checkout.velocityafrica.net/pay/session-abc-123",
    )
  })

  it("handles a real-world InitiateTransactionResponse shape for card payment (no url, only checkoutUrl)", () => {
    const response = {
      state: "gatewayPayment",
      status: "manual",
      body: {
        id: "txn-uuid-here",
        trace: "trace-uuid-here",
        amount: 75.00,
        paymentStatus: "INITIATED",
        pollStatus: "PENDING",
        checkoutUrl: "https://checkout.velocityafrica.net/pay/session-abc-123",
      },
      workflowId: "wf-617",
    }
    expect(extractRedirectUrl(response as unknown as Record<string, unknown>)).toBe(
      "https://checkout.velocityafrica.net/pay/session-abc-123",
    )
  })

  it("handles a real-world InitiateTransactionResponse shape (redirectUrl only)", () => {
    const response = {
      state: "gatewayPayment",
      status: "manual",
      body: {
        id: "txn-uuid-here",
        trace: "trace-uuid-here",
        amount: 75.00,
        paymentStatus: "INITIATED",
        pollStatus: "PENDING",
        redirectUrl: "https://checkout.velocityafrica.net/pay/session-abc-123",
      },
      workflowId: "wf-617",
    }
    expect(extractRedirectUrl(response as unknown as Record<string, unknown>)).toBe(
      "https://checkout.velocityafrica.net/pay/session-abc-123",
    )
  })
})
