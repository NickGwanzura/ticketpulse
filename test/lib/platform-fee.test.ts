import { describe, expect, it } from "vitest"

import {
  calculateOrganizerNet,
  calculatePlatformFee,
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_RATE,
} from "@/lib/platform-fee"

describe("system-wide platform fee", () => {
  it("is fixed at 6%", () => {
    expect(PLATFORM_FEE_PERCENT).toBe(6)
    expect(PLATFORM_FEE_RATE).toBe(0.06)
  })

  it.each([
    { gross: 1, fee: 0.06, net: 0.94 },
    { gross: 10, fee: 0.6, net: 9.4 },
    { gross: 99.99, fee: 6, net: 93.99 },
    { gross: 100, fee: 6, net: 94 },
  ])("deducts 6% from $gross", ({ gross, fee, net }) => {
    expect(calculatePlatformFee(gross)).toBe(fee)
    expect(calculateOrganizerNet(gross)).toBe(net)
  })

  it.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not create a fee for invalid gross amount %s",
    (gross) => {
      expect(calculatePlatformFee(gross)).toBe(0)
      expect(calculateOrganizerNet(gross)).toBe(0)
    },
  )
})
