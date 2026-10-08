export const GATEWAY_FEE_PERCENT = 3

/** Calculate the buyer-paid gateway fee on the discounted amount being charged. */
export function calculateGatewayFee(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const cents = Math.round(amount * 100)
  return Math.round(cents * (GATEWAY_FEE_PERCENT / 100)) / 100
}
