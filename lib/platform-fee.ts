/** The single, system-wide TicketPulse fee charged per ticket sold. */
export const PLATFORM_FEE_PERCENT = 7 as const
export const PLATFORM_FEE_RATE = PLATFORM_FEE_PERCENT / 100

export function calculatePlatformFee(grossAmount: number): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  return Number((grossAmount * PLATFORM_FEE_RATE).toFixed(2))
}

export function calculateOrganizerNet(grossAmount: number): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0
  return Number((grossAmount - calculatePlatformFee(grossAmount)).toFixed(2))
}
