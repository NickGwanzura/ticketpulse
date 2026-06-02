import { eq, or, gte, type SQL } from "drizzle-orm"
import { orders } from "@/db/schema"

/**
 * Standardised condition for orders with confirmed payments.
 *
 * Only two statuses represent confirmed revenue:
 *   • "paid"       — Velocity confirmed payment via polling/callback
 *   • "completed"  — Admin manually completed the order
 *
 * Excludes: awaiting_verification, pending, cancelled, refunded, expired.
 *
 * Use this in every dashboard / report query so all pages report
 * the same revenue figures.
 */
export const confirmedOrderStatus: SQL<unknown> = or(
  eq(orders.status, "paid"),
  eq(orders.status, "completed"),
)!

/**
 * Time condition that works for both "paid" and "completed" orders.
 *
 * Paid orders store their payment timestamp in `paidAt`, completed
 * orders store theirs in `completedAt`.  This condition matches
 * whichever field is populated for each row.
 */
export function paymentTimeSince(since: Date): SQL<unknown> {
  return or(gte(orders.paidAt, since), gte(orders.completedAt, since))!
}
