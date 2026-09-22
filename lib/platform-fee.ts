/** Default TicketPulse fee used when an event has no explicit fee policy. */
export const PLATFORM_FEE_PERCENT = 6 as const
export const PLATFORM_FEE_RATE = PLATFORM_FEE_PERCENT / 100

export function normalizePlatformFeePercent(value: number | string | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return PLATFORM_FEE_PERCENT
  return Number(parsed.toFixed(2))
}

export function calculatePlatformFee(grossAmount: number, feeRate = PLATFORM_FEE_RATE): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  const rate = Number.isFinite(feeRate) && feeRate >= 0 && feeRate <= 1 ? feeRate : PLATFORM_FEE_RATE
  return Number((grossAmount * rate).toFixed(2))
}

export function calculateOrganizerNet(grossAmount: number, feeRate = PLATFORM_FEE_RATE): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  return Number((grossAmount - calculatePlatformFee(grossAmount, feeRate)).toFixed(2))
}
