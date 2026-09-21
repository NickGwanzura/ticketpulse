import { sql, type SQL } from "drizzle-orm"

import { orders } from "@/db/schema"

/**
 * The single definition of an "order issue". Dashboards count with these and
 * order lists filter with these, so a badge number and the rows it opens can
 * never disagree — and the admin and organizer views can't drift apart.
 *
 * Every issue is about a *confirmed* order (paid/completed).
 */
export const ORDER_ISSUES = ["paid_no_tickets", "delivery_failed", "duplicate_ledger"] as const
export type OrderIssue = (typeof ORDER_ISSUES)[number]

export const ORDER_ISSUE_LABEL: Record<OrderIssue, string> = {
  paid_no_tickets: "Paid, no tickets issued",
  delivery_failed: "Ticket delivery failed",
  duplicate_ledger: "Duplicate payment records",
}

/** Ledger states that mean money actually settled. Two of these on one order is a real duplicate. */
export const SETTLED_LEDGER_STATUSES = ["paid", "completed", "success", "paid_success"] as const

/** Platform-wide (admin) issue counts look back this far, so the overview never scans all history. */
export const ORDER_ISSUE_WINDOW_DAYS = 180

export function isOrderIssue(value: unknown): value is OrderIssue {
  return typeof value === "string" && (ORDER_ISSUES as readonly string[]).includes(value)
}

const confirmed = sql`${orders.status} IN ('paid', 'completed')`

export function orderIssueCondition(issue: OrderIssue): SQL {
  switch (issue) {
    case "paid_no_tickets":
      return sql`${confirmed} AND NOT EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.order_id = ${orders.id}
          AND t.is_staff_ticket = false
          AND t.status NOT IN ('cancelled', 'refunded')
      )`
    case "delivery_failed":
      return sql`${confirmed} AND COALESCE(${orders.metadata}->'delivery'->>'status', '') IN ('FAILED', 'EMAIL_FAILED')`
    case "duplicate_ledger":
      return sql`${confirmed} AND ${orders.id} IN (
        SELECT order_id FROM payment_ledger
        WHERE local_status IN (${sql.join(SETTLED_LEDGER_STATUSES.map((s) => sql`${s}`), sql`, `)})
        GROUP BY order_id
        HAVING COUNT(*) > 1
      )`
  }
}

export function orderIssueWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - ORDER_ISSUE_WINDOW_DAYS * 86_400_000)
}
