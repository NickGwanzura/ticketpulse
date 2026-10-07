"use server"

import { revalidatePath } from "next/cache"
import { sql } from "drizzle-orm"

import { requireAdmin } from "@/lib/auth-guard"
import { recordAdminAction } from "@/lib/admin-audit"
import { db } from "@/db"

export type SyncResult = { ok: boolean; message: string }

/**
 * Sets a tier's sold counter to what really exists: live buyer tickets plus
 * stock held by open reserved orders. The number is recomputed here, in one
 * statement, and never taken from the browser. A counter that is too low
 * reopens sold-out tiers; too high hides tickets that could still be sold.
 */
export async function syncTierCounterAction(tierId: string): Promise<SyncResult> {
  const session = await requireAdmin()

  const result = await db.execute(sql`
    WITH expected AS (
      SELECT
        (SELECT COUNT(*)::int FROM tickets x
          WHERE x.tier_id = ${tierId}
            AND COALESCE(x.is_staff_ticket, false) = false
            AND x.status NOT IN ('cancelled', 'refunded'))
        +
        (SELECT COALESCE(SUM(oi.quantity), 0)::int
          FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE oi.tier_id = ${tierId} AND oi.type = 'ticket'
            AND o.status IN ('pending', 'awaiting_verification')
            AND o.metadata->>'inventoryReserved' = 'true'
            AND NOT EXISTS (SELECT 1 FROM tickets t2 WHERE t2.order_id = o.id))
        AS n
    ),
    before AS (SELECT sold_quantity AS old FROM ticket_tiers WHERE id = ${tierId})
    UPDATE ticket_tiers
    SET sold_quantity = (SELECT n FROM expected)
    WHERE id = ${tierId}
    RETURNING sold_quantity AS new_value, (SELECT old FROM before) AS old_value
  `)

  const row = result.rows[0] as { new_value: number; old_value: number | null } | undefined
  if (!row) return { ok: false, message: "Tier not found" }

  await recordAdminAction(session, {
    action: "tier.sync_sold_counter",
    targetType: "tier",
    targetId: tierId,
    before: { soldQuantity: row.old_value },
    after: { soldQuantity: row.new_value },
  })

  revalidatePath("/admin/stock-audit")
  return { ok: true, message: `Counter set from ${row.old_value ?? 0} to ${row.new_value}` }
}
