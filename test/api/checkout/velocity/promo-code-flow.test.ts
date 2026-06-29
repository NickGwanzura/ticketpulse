import { describe, it, expect } from "vitest"

/**
 * Tests for the promo code validation logic inside the checkout flow.
 *
 * The checkout route validates promos at lines 306-331 of route.ts.
 * This test replicates that logic so we can test it in isolation.
 */

interface PromoCode {
  id: string
  code: string
  type: "percent" | "fixed"
  value: number
  active: boolean
  maxUses: number | null
  usedCount: number | null
  minPurchaseAmount: number | null
  expiresAt: Date | null
}

function applyPromoCheck(
  promo: PromoCode | null,
  total: number,
  now: Date,
): { applied: boolean; discount: number; finalTotal: number } {
  if (!promo || !promo.active) {
    return { applied: false, discount: 0, finalTotal: total }
  }

  const isExpired = promo.expiresAt && promo.expiresAt < now
  const isMaxed =
    (promo.maxUses ?? 0) > 0 && (promo.usedCount ?? 0) >= (promo.maxUses ?? 0)
  const meetsMin =
    !promo.minPurchaseAmount ||
    Number(promo.minPurchaseAmount) <= 0 ||
    total >= Number(promo.minPurchaseAmount)

  if (isExpired || isMaxed || !meetsMin) {
    return { applied: false, discount: 0, finalTotal: total }
  }

  let discount = 0
  if (promo.type === "percent") {
    discount = Math.round(total * (Number(promo.value) / 100) * 100) / 100
  } else {
    discount = Math.min(Number(promo.value), total)
  }

  const finalTotal = Math.max(0, Math.round((total - discount) * 100) / 100)
  return { applied: true, discount, finalTotal }
}

describe("checkout promo code flow", () => {
  const now = new Date("2026-06-29T12:00:00Z")

  describe("percent discount", () => {
    it("applies 20% discount correctly", () => {
      const promo: PromoCode = {
        id: "promo-1",
        code: "SUMMER20",
        type: "percent",
        value: 20,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 100, now)
      expect(result.applied).toBe(true)
      expect(result.discount).toBe(20)
      expect(result.finalTotal).toBe(80)
    })

    it("rounds discount to 2 decimal places", () => {
      const promo: PromoCode = {
        id: "promo-2",
        code: "PROMO15",
        type: "percent",
        value: 15,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 99.99, now)
      expect(result.applied).toBe(true)
      expect(result.discount).toBe(15.0) // 99.99 * 0.15 = 14.9985 → rounds to 15.00
      expect(result.finalTotal).toBeCloseTo(84.99, 2)
    })
  })

  describe("fixed discount", () => {
    it("applies fixed discount correctly", () => {
      const promo: PromoCode = {
        id: "promo-3",
        code: "FLAT10",
        type: "fixed",
        value: 10,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 50, now)
      expect(result.applied).toBe(true)
      expect(result.discount).toBe(10)
      expect(result.finalTotal).toBe(40)
    })

    it("caps discount at total amount (free order)", () => {
      const promo: PromoCode = {
        id: "promo-4",
        code: "FREE",
        type: "fixed",
        value: 100,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 25, now)
      expect(result.applied).toBe(true)
      expect(result.discount).toBe(25) // capped at total
      expect(result.finalTotal).toBe(0) // free order
    })
  })

  describe("promo expiry", () => {
    it("rejects expired promo", () => {
      const promo: PromoCode = {
        id: "promo-5",
        code: "EXPIRED",
        type: "percent",
        value: 50,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: new Date("2026-06-01T00:00:00Z"), // expired
      }
      const result = applyPromoCheck(promo, 100, now)
      expect(result.applied).toBe(false)
      expect(result.discount).toBe(0)
      expect(result.finalTotal).toBe(100)
    })

    it("accepts non-expired promo", () => {
      const promo: PromoCode = {
        id: "promo-6",
        code: "VALID",
        type: "percent",
        value: 10,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: new Date("2026-12-31T00:00:00Z"), // not expired
      }
      const result = applyPromoCheck(promo, 100, now)
      expect(result.applied).toBe(true)
      expect(result.finalTotal).toBe(90)
    })
  })

  describe("max uses", () => {
    it("rejects promo that has reached max uses", () => {
      const promo: PromoCode = {
        id: "promo-7",
        code: "MAXED",
        type: "fixed",
        value: 5,
        active: true,
        maxUses: 10,
        usedCount: 10,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 100, now)
      expect(result.applied).toBe(false)
    })

    it("accepts promo with remaining uses", () => {
      const promo: PromoCode = {
        id: "promo-8",
        code: "AVAILABLE",
        type: "fixed",
        value: 5,
        active: true,
        maxUses: 10,
        usedCount: 3,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 100, now)
      expect(result.applied).toBe(true)
    })

    it("accepts promo with unlimited uses (maxUses is 0 or null)", () => {
      const promo: PromoCode = {
        id: "promo-9",
        code: "UNLIMITED",
        type: "percent",
        value: 10,
        active: true,
        maxUses: 0, // 0 means unlimited
        usedCount: 999,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 100, now)
      expect(result.applied).toBe(true)
    })
  })

  describe("minimum purchase amount", () => {
    it("rejects promo when total is below minPurchaseAmount", () => {
      const promo: PromoCode = {
        id: "promo-10",
        code: "MIN50",
        type: "fixed",
        value: 5,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: 50,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 30, now)
      expect(result.applied).toBe(false)
    })

    it("accepts promo when total meets minPurchaseAmount", () => {
      const promo: PromoCode = {
        id: "promo-11",
        code: "MIN50",
        type: "fixed",
        value: 5,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: 50,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 50, now)
      expect(result.applied).toBe(true)
    })

    it("accepts promo when minPurchaseAmount is 0 or negative", () => {
      const promo: PromoCode = {
        id: "promo-12",
        code: "NOMIN",
        type: "percent",
        value: 10,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: 0,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 5, now)
      expect(result.applied).toBe(true)
    })
  })

  describe("inactive promo", () => {
    it("rejects inactive promo code", () => {
      const promo: PromoCode = {
        id: "promo-13",
        code: "DISABLED",
        type: "percent",
        value: 20,
        active: false,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 100, now)
      expect(result.applied).toBe(false)
    })
  })

  describe("free order flow (total becomes 0)", () => {
    it("handles 100% discount resulting in zero total", () => {
      const promo: PromoCode = {
        id: "promo-14",
        code: "FREE100",
        type: "percent",
        value: 100,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 75, now)
      expect(result.applied).toBe(true)
      expect(result.discount).toBe(75)
      expect(result.finalTotal).toBe(0)
    })

    it("handles fixed discount larger than total", () => {
      const promo: PromoCode = {
        id: "promo-15",
        code: "BIGFIXED",
        type: "fixed",
        value: 200,
        active: true,
        maxUses: null,
        usedCount: 0,
        minPurchaseAmount: null,
        expiresAt: null,
      }
      const result = applyPromoCheck(promo, 50, now)
      expect(result.applied).toBe(true)
      expect(result.discount).toBe(50)
      expect(result.finalTotal).toBe(0)
    })
  })
})
