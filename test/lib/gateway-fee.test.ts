import { describe, expect, it } from "vitest"

import {
  calculateGatewayCharge,
  calculateGatewayFee,
  GATEWAY_FEE_PERCENT,
  GATEWAY_MARKUP_PERCENT,
  readGatewayChargeAmount,
} from "@/lib/gateway-fee"

describe("gateway fees", () => {
  it("keeps the buyer-facing fee at 3%", () => {
    expect(GATEWAY_FEE_PERCENT).toBe(3)
    expect(calculateGatewayFee(20)).toBe(0.6)
    expect(calculateGatewayFee(100)).toBe(3)
    expect(calculateGatewayFee(7.5)).toBe(0.23)
  })

  it("charges the gateway ticket price + 0.5% markup", () => {
    expect(GATEWAY_MARKUP_PERCENT).toBe(0.5)
    expect(calculateGatewayCharge(20)).toBe(20.1)
    expect(calculateGatewayCharge(100)).toBe(100.5)
    expect(calculateGatewayCharge(7.5)).toBe(7.54)
  })

  it("returns zero for non-positive or non-finite amounts", () => {
    expect(calculateGatewayCharge(0)).toBe(0)
    expect(calculateGatewayCharge(-5)).toBe(0)
    expect(calculateGatewayCharge(Number.NaN)).toBe(0)
    expect(calculateGatewayFee(0)).toBe(0)
  })

  it("reads the persisted gateway amount with a legacy fallback", () => {
    expect(readGatewayChargeAmount({ buyerFees: { gatewayAmount: 20.1 } }, 20.6)).toBe(20.1)
    expect(readGatewayChargeAmount({ buyerFees: { gatewayAmount: 0 } }, 20.6)).toBe(20.6)
    expect(readGatewayChargeAmount({ buyerFees: {} }, 20.6)).toBe(20.6)
    expect(readGatewayChargeAmount(null, 20.6)).toBe(20.6)
    expect(readGatewayChargeAmount(undefined, 20.6)).toBe(20.6)
  })
})
