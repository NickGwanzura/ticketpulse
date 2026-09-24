import { sql } from "drizzle-orm"

import { orders } from "@/db/schema"

/**
 * Keep unpaid expired orders out of operational order tables while preserving
 * any row with evidence of settlement for manual review.
 */
export const activeOrderListCondition = sql`NOT (
  ${orders.status} = 'expired'
  AND ${orders.paidAt} IS NULL
  AND COALESCE(${orders.metadata}->'velocity'->>'pollStatus', '') <> 'SUCCESS'
  AND COALESCE(${orders.metadata}->'velocity'->>'paymentStatus', '') <> 'SUCCESS'
  AND NOT EXISTS (
    SELECT 1
    FROM payment_ledger AS settled_ledger
    WHERE settled_ledger.order_id = ${orders.id}
      AND settled_ledger.local_status IN ('paid', 'completed', 'success', 'paid_success')
  )
)`
