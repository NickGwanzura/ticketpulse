import { describe, it, expect } from "vitest"
import { z } from "zod"

/**
 * Replicates the Zod schema from app/api/checkout/velocity/route.ts
 * so we can test validation in isolation.
 */
const TicketItem = z.object({
  kind: z.literal("ticket"),
  tierId: z.string().uuid(),
  quantity: z.number().int().positive().max(50),
})

const VendorAddonItem = z.object({
  kind: z.literal("vendor_addon"),
  listingId: z.string().uuid(),
  quantity: z.number().int().positive().max(10),
})

const Body = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(120).trim(),
  phone: z.string().max(40).trim().optional().default(""),
  paymentMethod: z.enum(["velocity-ecocash", "velocity-card"]),
  eventSlug: z.string().min(1).max(160),
  items: z
    .array(z.discriminatedUnion("kind", [TicketItem, VendorAddonItem]))
    .min(1)
    .max(30),
  promoCode: z.string().max(40).optional(),
  questionResponses: z.record(z.string().uuid(), z.string().min(0).max(2000)).optional(),
})

const VALID_TIER_ID = "550e8400-e29b-41d4-a716-446655440000"
const VALID_LISTING_ID = "660e8400-e29b-41d4-a716-446655440001"

describe("checkout Zod schema", () => {
  describe("valid payloads", () => {
    it("accepts a basic Ecocash checkout", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        phone: "+263771234567",
        paymentMethod: "velocity-ecocash",
        eventSlug: "summer-sounds-2026",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 2 }],
      })
      expect(result.success).toBe(true)
    })

    it("accepts VMC card checkout with phone", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        phone: "+263771234567",
        paymentMethod: "velocity-card",
        eventSlug: "summer-sounds-2026",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(true)
    })

    it("accepts VMC card checkout WITHOUT phone (defaults to empty string)", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        paymentMethod: "velocity-card",
        eventSlug: "summer-sounds-2026",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.phone).toBe("")
      }
    })

    it("accepts checkout with promo code", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        paymentMethod: "velocity-ecocash",
        eventSlug: "summer-sounds-2026",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
        promoCode: "SUMMER20",
      })
      expect(result.success).toBe(true)
    })

    it("accepts checkout with vendor addons", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        paymentMethod: "velocity-ecocash",
        eventSlug: "summer-sounds-2026",
        items: [
          { kind: "ticket", tierId: VALID_TIER_ID, quantity: 2 },
          { kind: "vendor_addon", listingId: VALID_LISTING_ID, quantity: 1 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it("accepts checkout with question responses", () => {
      const qId = "770e8400-e29b-41d4-a716-446655440002"
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        paymentMethod: "velocity-card",
        eventSlug: "summer-sounds-2026",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
        questionResponses: { [qId]: "Vegetarian" },
      })
      expect(result.success).toBe(true)
    })

    it("normalizes email to lowercase and trims", () => {
      // Zod .email() catches the spaces before transform runs
      const result = Body.safeParse({
        email: "Buyer@Example.COM",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe("buyer@example.com")
      }
    })
  })

  describe("phone field (made optional for VMC card)", () => {
    it("accepts empty phone string for card", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        phone: "",
        paymentMethod: "velocity-card",
        eventSlug: "summer-sounds-2026",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(true)
    })

    it("accepts empty phone string for Ecocash (will fail downstream)", () => {
      // Schema allows it — downstream validateTransactionPayload catches it
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        phone: "",
        paymentMethod: "velocity-ecocash",
        eventSlug: "summer-sounds-2026",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(true)
    })

    it("accepts missing phone field entirely", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John Buyer",
        paymentMethod: "velocity-card",
        eventSlug: "summer-sounds-2026",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(true)
    })
  })

  describe("rejected payloads", () => {
    it("rejects missing email", () => {
      const result = Body.safeParse({
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(false)
    })

    it("rejects invalid email", () => {
      const result = Body.safeParse({
        email: "not-an-email",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(false)
    })

    it("rejects empty name", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(false)
    })

    it("rejects invalid payment method", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John",
        paymentMethod: "paypal",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(false)
    })

    it("rejects non-UUID tierId", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: "not-a-uuid", quantity: 1 }],
      })
      expect(result.success).toBe(false)
    })

    it("rejects zero quantity", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 0 }],
      })
      expect(result.success).toBe(false)
    })

    it("rejects negative quantity", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: -1 }],
      })
      expect(result.success).toBe(false)
    })

    it("rejects quantity over 50", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 51 }],
      })
      expect(result.success).toBe(false)
    })

    it("rejects empty items array", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items: [],
      })
      expect(result.success).toBe(false)
    })

    it("rejects more than 30 items", () => {
      const items = Array.from({ length: 31 }, (_, i) => ({
        kind: "ticket" as const,
        tierId: VALID_TIER_ID,
        quantity: 1,
      }))
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "test",
        items,
      })
      expect(result.success).toBe(false)
    })

    it("rejects empty event slug", () => {
      const result = Body.safeParse({
        email: "buyer@example.com",
        name: "John",
        paymentMethod: "velocity-card",
        eventSlug: "",
        items: [{ kind: "ticket", tierId: VALID_TIER_ID, quantity: 1 }],
      })
      expect(result.success).toBe(false)
    })
  })
})
