/** Buyer-facing gateway fee: TicketPulse markup + the gateway's own fee, shown as one line. */
export const GATEWAY_FEE_PERCENT = 3

/** TicketPulse markup added to the ticket price before sending to Velocity. */
export const GATEWAY_MARKUP_PERCENT = 0.5

/** Velocity's own fee. Applied by Velocity on the amount we send; informational on our side. */
export const GATEWAY_PROVIDER_FEE_PERCENT = 2.5

/** Calculate the buyer-paid gateway fee on the discounted amount being charged. */
export function calculateGatewayFee(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const cents = Math.round(amount * 100)
  return Math.round(cents * (GATEWAY_FEE_PERCENT / 100)) / 100
}

/**
 * The amount actually sent to Velocity: ticket price + TicketPulse's 0.5% markup.
 * Velocity applies its own 2.5% fee on top of this, so the buyer still pays ~3% total.
 */
export function calculateGatewayCharge(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const cents = Math.round(amount * 100)
  return Math.round(cents * (1 + GATEWAY_MARKUP_PERCENT / 100)) / 100
}

/**
 * Read the gateway charge amount (ticket price + markup) persisted in order
 * metadata, falling back to the order total for legacy orders created before
 * the fee split.
 */
export function readGatewayChargeAmount(metadata: unknown, fallback: number): number {
  if (metadata && typeof metadata === "object") {
    const buyerFees = (metadata as Record<string, unknown>).buyerFees
    if (buyerFees && typeof buyerFees === "object") {
      const value = Number((buyerFees as Record<string, unknown>).gatewayAmount)
      if (Number.isFinite(value) && value > 0) return value
    }
  }
  const resolved = Number(fallback)
  return Number.isFinite(resolved) ? resolved : 0
}
