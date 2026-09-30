import { describe, expect, it } from "vitest"
import {
  MAX_PAYOUT_NOTIFICATION_ATTEMPTS,
  payoutNotificationMessage,
  payoutNotificationRetryDelayMs,
} from "@/lib/payout-notification-content"

const base = {
  payoutId: "1215fc44-a526-4184-a959-a00fedb5b9bb",
  amount: "460.00",
  currency: "USD",
  method: "ecocash",
}

describe("payout notification content and retry policy", () => {
  it("creates an organiser-facing request confirmation", () => {
    const message = payoutNotificationMessage({ ...base, eventType: "payout_requested" })

    expect(message.subject).toBe("TicketPulse: Payout request received")
    expect(message.message).toContain("USD 460.00 via EcoCash")
  })

  it("includes a rejection reason and paid proof reference in the matching updates", () => {
    const rejected = payoutNotificationMessage({ ...base, eventType: "payout_rejected", rejectionReason: "Please verify the account." })
    const paid = payoutNotificationMessage({ ...base, eventType: "payout_paid", proofReference: "NICK-REF-123" })

    expect(rejected.message).toContain("Please verify the account.")
    expect(paid.message).toContain("Reference: NICK-REF-123")
    expect(paid.reference).toBe("1215fc44")
  })

  it("backs off exponentially, caps the delay, and stops after a bounded number of attempts", () => {
    expect(payoutNotificationRetryDelayMs(1)).toBe(60_000)
    expect(payoutNotificationRetryDelayMs(3)).toBe(4 * 60_000)
    expect(payoutNotificationRetryDelayMs(8)).toBe(60 * 60_000)
    expect(MAX_PAYOUT_NOTIFICATION_ATTEMPTS).toBe(8)
  })
})
