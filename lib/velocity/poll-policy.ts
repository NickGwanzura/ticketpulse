export const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000
/** How long an unpaid order may hold seats. Payment polling continues for PAYMENT_WINDOW_MS. */
export const SEAT_HOLD_MS = 30 * 60 * 1000
export const POLL_INTERVAL_MS = 60_000

export function paymentWindowExpired(createdAt: Date | null, now = Date.now()): boolean {
  return Boolean(createdAt && now - createdAt.getTime() >= PAYMENT_WINDOW_MS)
}

export function isAutomaticPoll(source: string): boolean {
  return ["cron", "poll", "poll_before_expiry", "expiry_cron"].includes(source)
}
