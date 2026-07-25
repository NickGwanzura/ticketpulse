import "server-only"

/**
 * Every payment_method value that means "the buyer paid the organiser
 * directly — no money passed through the platform." Any order carrying one
 * of these must be excluded from platform gross/net revenue (see
 * lib/revenue-summary.ts) and must have a matching organizer_fee_dues row so
 * the platform's commission on the sale is still tracked for collection.
 *
 * This list existed only as the literal string "organizer_direct" before —
 * offline orders created with "manual-cash", "bank_transfer", "mobile_money"
 * or "offline_cash" were silently falling through both checks, which is what
 * caused an event's direct sales to be counted as platform revenue while the
 * organiser also kept the cash (see the Olive Hour reconciliation).
 */
export const DIRECT_PAYMENT_METHODS = [
  "organizer_direct",
  "manual-cash",
  "offline_cash",
  "bank_transfer",
  "mobile_money",
] as const

export function isDirectSalePaymentMethod(method: string | null | undefined): boolean {
  if (!method) return false
  return (DIRECT_PAYMENT_METHODS as readonly string[]).includes(method)
}
