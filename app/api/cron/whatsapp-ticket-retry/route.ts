import { NextResponse } from "next/server"
import { and, inArray, isNotNull, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { verifyCronSecret } from "@/lib/cron-auth"
import { sendWhatsAppTicketAndWait } from "@/lib/delivery"
import { log } from "@/lib/logger"

const RETRY_COOLDOWN_MS = 10 * 60_000
const MAX_PER_RUN = 3

/** Retry incomplete paid-order WhatsApp deliveries on the server, even when no browser is open. */
export async function POST(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError
  if (!process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "INTERNAL_API_KEY is required for WhatsApp delivery retries" }, { status: 503 })
  }

  const candidates = await db.select({ id: orders.id, metadata: orders.metadata })
    .from(orders)
    .where(and(
      inArray(orders.status, ["paid", "completed"]),
      isNotNull(orders.guestPhone),
      sql`length(trim(${orders.guestPhone})) > 0`,
      sql`COALESCE(${orders.paidAt}, ${orders.completedAt}, ${orders.createdAt}) >= now() - interval '7 days'`,
      sql`(COALESCE((${orders.metadata}->'delivery'->>'whatsappSent')::boolean, false) = false
        OR COALESCE((${orders.metadata}->'delivery'->>'whatsappPdfSent')::boolean, false) = false)`,
      sql`EXISTS (SELECT 1 FROM tickets WHERE tickets.order_id = ${orders.id} AND tickets.status NOT IN ('cancelled', 'refunded'))`,
    ))
    .orderBy(sql`COALESCE(${orders.metadata}->'delivery'->>'whatsappLastAttemptAt', '') ASC`)
    .limit(60)

  let attempted = 0
  let completed = 0
  let pending = 0
  const now = Date.now()
  for (const order of candidates) {
    if (attempted >= MAX_PER_RUN) break
    const metadata = (order.metadata ?? {}) as { delivery?: { whatsappLastAttemptAt?: string } }
    const lastAttempt = metadata.delivery?.whatsappLastAttemptAt ? Date.parse(metadata.delivery.whatsappLastAttemptAt) : 0
    if (Number.isFinite(lastAttempt) && now - lastAttempt < RETRY_COOLDOWN_MS) continue
    attempted++
    const result = await sendWhatsAppTicketAndWait(order.id)
    if (result.ok && !result.pending) completed++
    else if (result.pending) pending++
    else log.warn("cron/whatsapp-ticket-retry — send deferred", { orderId: order.id, error: result.error })
  }
  return NextResponse.json({ ok: true, candidates: candidates.length, attempted, completed, pending })
}
