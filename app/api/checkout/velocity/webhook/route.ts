import { NextResponse } from "next/server"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { pollVelocityTransaction, completeVelocitySalesOrder } from "@/lib/velocity"
import { startOrderVerification } from "@/lib/order-verification"
import { log } from "@/lib/logger"

// Timing-safe comparison to prevent timing attacks on webhook secret.
function verifyWebhookSecret(requestSignature: string | null): boolean {
  const secret = process.env.VELOCITY_WEBHOOK_SECRET
  if (!secret) {
    log.warn("velocity webhook — VELOCITY_WEBHOOK_SECRET not set, accepting all")
    return true
  }
  if (!requestSignature) return false
  if (requestSignature.length !== secret.length) return false
  let mismatch = 0
  for (let i = 0; i < requestSignature.length; i++) {
    mismatch |= requestSignature.charCodeAt(i) ^ secret.charCodeAt(i)
  }
  return mismatch === 0
}

export async function POST(req: Request) {
  const signature = req.headers.get("X-Velocity-Signature")
  if (!verifyWebhookSecret(signature)) {
    log.warn("velocity webhook — invalid signature")
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    const url = new URL(req.url)
    body = Object.fromEntries(url.searchParams)
  }

  const txTrace = (body.transactionTrace as string) || (body.trace as string)
  if (!txTrace) {
    return NextResponse.json({ error: "missing_transaction_trace" }, { status: 400 })
  }

  // Find the order by JSON-path query on metadata (O(1) with GIN index)
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        sql`${orders.metadata}->'velocity'->>'transactionTrace' = ${txTrace}`,
      ),
    )
    .limit(1)

  if (!order) {
    return NextResponse.json({ ok: true, note: "order_not_found_or_already_processed" })
  }

  // Atomic idempotency gate
  const [claimed] = await db
    .update(orders)
    .set({ status: "awaiting_verification", updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
    .returning({ id: orders.id })

  if (!claimed) {
    return NextResponse.json({ ok: true, status: "already_processed" })
  }

  // Independently verify via Velocity API
  try {
    const poll = await pollVelocityTransaction(txTrace)
    if (poll.pollStatus !== "SUCCESS") {
      await db
        .update(orders)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(orders.id, order.id))
      return NextResponse.json({ ok: true, status: "pending", verified: false })
    }
  } catch (err) {
    log.warn("velocity webhook — poll verification failed", { trace: txTrace, error: String(err) })
    await db
      .update(orders)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(orders.id, order.id))
    return NextResponse.json({ ok: false, message: String(err) }, { status: 200 })
  }

  // Complete sales order lifecycle
  const meta = (order.metadata ?? {}) as { velocity?: { salesOrderTrace: string } }
  try {
    if (meta.velocity?.salesOrderTrace) {
      await completeVelocitySalesOrder(meta.velocity.salesOrderTrace)
    }
  } catch (err) {
    log.warn("velocity webhook — completeSalesOrder failed (non-critical)", { orderId: order.id, error: String(err) })
  }

  await db
    .update(orders)
    .set({ paidAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, order.id))

  if (!order.guestEmail) {
    log.error("velocity webhook — order missing guestEmail", { orderId: order.id })
    return NextResponse.json({ error: "order_missing_email" }, { status: 500 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(req.url).origin
  await startOrderVerification({ orderId: order.id, email: order.guestEmail, origin })

  log.info("velocity webhook — verification started", { trace: txTrace, orderId: order.id })
  return NextResponse.json({ ok: true, status: "awaiting_verification" })
}
