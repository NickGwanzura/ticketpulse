import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Manual completion turns an order into payable organiser revenue. An unpaid
 * EcoCash/card order must never be completed on an organiser's word — only an
 * admin with the provider's transaction reference can override, while direct
 * sales keep working.
 */

const mocks = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  update: vi.fn(),
  insert: vi.fn(),
}))

function selectChain() {
  return { from: () => ({ where: () => ({ limit: async () => (mocks.order ? [mocks.order] : []) }) }) }
}

vi.mock("server-only", () => ({}))
vi.mock("@/db", () => {
  const tx = {
    select: () => selectChain(),
    update: (...args: unknown[]) => {
      mocks.update(...args)
      return { set: () => ({ where: async () => undefined }) }
    },
    insert: (...args: unknown[]) => {
      mocks.insert(...args)
      return { values: () => ({ onConflictDoNothing: async () => undefined }) }
    },
  }
  return {
    db: {
      select: () => selectChain(),
      transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  }
})
vi.mock("@/lib/velocity/idempotency", () => ({ lockOrderMutation: async () => undefined }))
vi.mock("@/lib/delivery", () => ({ deliverTicketForPaidOrder: vi.fn(), readDeliveryStatus: vi.fn() }))
vi.mock("@/lib/email", () => ({ sendOrderConfirmationEmail: vi.fn() }))
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }))
vi.mock("@/lib/order-expiry", () => ({ restoreExpiredOrderInventory: vi.fn() }))
vi.mock("@/lib/url-config", () => ({ getBaseUrl: () => "https://ticketpulse.test" }))
vi.mock("@/lib/platform-fee", () => ({
  calculatePlatformFee: (gross: number, rate: number) => gross * rate,
  normalizePlatformFeePercent: (v: unknown) => Number(v ?? 6),
}))

import { markOrderCompleteAction, UNCONFIRMED_PAYMENT_MESSAGE } from "@/lib/order-recovery"

const ID = "11111111-1111-1111-1111-111111111111"

function pendingOrder(paymentMethod: string, totalAmount = "20.00") {
  return {
    id: ID,
    eventId: "22222222-2222-2222-2222-222222222222",
    status: "pending",
    paymentMethod,
    totalAmount,
    currency: "USD",
    paymentRef: null,
    paidAt: null,
    metadata: {},
    guestEmail: "buyer@example.com",
  }
}

beforeEach(() => {
  mocks.update.mockReset()
  mocks.insert.mockReset()
})

describe("markOrderCompleteAction", () => {
  it("refuses an organiser completing an unpaid EcoCash order", async () => {
    mocks.order = pendingOrder("velocity-ecocash")
    const result = await markOrderCompleteAction(ID, "org-1", "org@example.com", { actor: "organizer" })
    expect(result).toEqual({ success: false, message: UNCONFIRMED_PAYMENT_MESSAGE })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it("ignores a provider reference supplied by an organiser", async () => {
    mocks.order = pendingOrder("velocity-card")
    const result = await markOrderCompleteAction(ID, "org-1", "org@example.com", { actor: "organizer", providerReference: "TXN-12345" })
    expect(result.success).toBe(false)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("defaults to the strict rule when no authority is given", async () => {
    mocks.order = pendingOrder("velocity-ecocash")
    const result = await markOrderCompleteAction(ID, "u-1", "u@example.com")
    expect(result.success).toBe(false)
  })

  it("requires an admin to supply the provider reference", async () => {
    mocks.order = pendingOrder("velocity-ecocash")
    const result = await markOrderCompleteAction(ID, "admin-1", "admin@example.com", { actor: "admin" })
    expect(result.success).toBe(false)
  })

  it("lets an admin complete with a verified provider reference", async () => {
    mocks.order = pendingOrder("velocity-ecocash")
    const result = await markOrderCompleteAction(ID, "admin-1", "admin@example.com", { actor: "admin", providerReference: "TXN-12345" })
    expect(result.success).toBe(true)
    expect(mocks.update).toHaveBeenCalled()
  })

  it("still lets organisers complete direct sales", async () => {
    mocks.order = pendingOrder("organizer_direct")
    const result = await markOrderCompleteAction(ID, "org-1", "org@example.com", { actor: "organizer" })
    expect(result.success).toBe(true)
  })

  it("still completes free orders", async () => {
    mocks.order = pendingOrder("velocity-ecocash", "0.00")
    const result = await markOrderCompleteAction(ID, "org-1", "org@example.com", { actor: "organizer" })
    expect(result.success).toBe(true)
  })
})
