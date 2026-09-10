import { describe, expect, it } from "vitest"
import { isAutomaticPoll, paymentWindowExpired, PAYMENT_WINDOW_MS } from "@/lib/velocity/poll-policy"

describe("payment poll policy", () => {
  it("closes at 24 hours, but allows pending payments before that boundary", () => {
    const created = new Date("2026-09-10T00:00:00Z")
    expect(paymentWindowExpired(created, created.getTime() + PAYMENT_WINDOW_MS - 1)).toBe(false)
    expect(paymentWindowExpired(created, created.getTime() + PAYMENT_WINDOW_MS)).toBe(true)
    expect(paymentWindowExpired(null)).toBe(false)
  })
  it("applies automatic limits to browser and cron without preventing explicit reconciliation", () => {
    for (const source of ["cron", "poll", "poll_before_expiry", "expiry_cron"]) expect(isAutomaticPoll(source)).toBe(true)
    for (const source of ["callback", "admin_recheck"]) expect(isAutomaticPoll(source)).toBe(false)
  })
})
