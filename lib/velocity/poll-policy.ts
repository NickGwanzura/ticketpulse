export const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000
export const POLL_INTERVAL_MS = 60_000

export function paymentWindowExpired(createdAt: Date | null, now = Date.now()): boolean {
  return Boolean(createdAt && now - createdAt.getTime() >= PAYMENT_WINDOW_MS)
}

export function isAutomaticPoll(source: string): boolean {
  return ["cron", "poll", "poll_before_expiry", "expiry_cron"].includes(source)
}
