import { describe, expect, it } from "vitest"

import {
  calculateOrganizerNet,
  calculatePlatformFee,
  normalizePlatformFeePercent,
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_RATE,
} from "@/lib/platform-fee"

describe("platform fee calculations", () => {
  it("uses a 5% default and supports event-specific rates", () => {
    expect(PLATFORM_FEE_PERCENT).toBe(5)
    expect(PLATFORM_FEE_RATE).toBe(0.05)
    expect(normalizePlatformFeePercent("6.00")).toBe(6)
  })

  it.each([
    { gross: 1, fee: 0.05, net: 0.95 },
    { gross: 10, fee: 0.5, net: 9.5 },
    { gross: 99.99, fee: 5, net: 94.99 },
    { gross: 100, fee: 5, net: 95 },
  ])("deducts the default 5% from $gross", ({ gross, fee, net }) => {
    expect(calculatePlatformFee(gross)).toBe(fee)
    expect(calculateOrganizerNet(gross)).toBe(net)
  })

  it("deducts an event-specific 6% fee", () => {
    expect(calculatePlatformFee(100, 0.06)).toBe(6)
    expect(calculateOrganizerNet(100, 0.06)).toBe(94)
  })

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not create a fee for invalid gross amount %s",
    (gross) => {
      expect(calculatePlatformFee(gross)).toBe(0)
      expect(calculateOrganizerNet(gross)).toBe(0)
    },
  )
})
