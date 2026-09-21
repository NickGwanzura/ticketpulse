import { timingSafeEqual } from "crypto"
import { and, eq, inArray, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/db"
import { orders, paymentLedger } from "@/db/schema"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { log } from "@/lib/logger"
import { HEARTBEAT_KEYS, recordHeartbeat } from "@/lib/heartbeat"
import { alertCallbackOrderNotFound, alertPaymentAnomaly } from "@/lib/payment-alerts"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"
import { reconcileVelocityOrder } from "@/lib/velocity/reconciliation"
import { isValidVelocityTrace } from "@/lib/velocity/validation"
import type { VelocityOrderMetadata } from "@/types/velocity"

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

const CallbackBody = z.object({
  transactionTrace: z.string().min(1),
  salesOrderTrace: z.string().min(1),
  pollStatus: z.string().min(1),
})

export async function POST(req: Request) {
  const webhookSecret = process.env.VELOCITY_WEBHOOK_SECRET
  if (!webhookSecret) {
    log.error("velocity callback - VELOCITY_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "webhook not configured" }, { status: 401 })
  }

  const providedSignature = req.headers.get("x-webhook-signature") ?? req.headers.get("x-api-key") ?? ""
  if (!providedSignature || !safeEqual(providedSignature, webhookSecret)) {
    log.warn("velocity callback - invalid webhook signature")
    void recordHeartbeat(HEARTBEAT_KEYS.velocityWebhook, { ok: false, error: "Callback rejected: invalid signature" })
    alertPaymentAnomaly({
      type: "CALLBACK_INVALID_SIGNATURE",
      severity: "critical",
      title: "Velocity callback received with an invalid signature",
      detail: "A callback failed signature verification. Check the provider webhook configuration.",
    }).catch(() => {})
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = CallbackBody.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", detail: parsed.error.flatten() }, { status: 400 })
  }

  // A correctly signed, well-formed callback reached us: the webhook is configured and alive.
  void recordHeartbeat(HEARTBEAT_KEYS.velocityWebhook, { ok: true })

  const { transactionTrace, salesOrderTrace } = parsed.data
  if (!isValidVelocityTrace(transactionTrace) || !isValidVelocityTrace(salesOrderTrace)) {
    return NextResponse.json({ error: "invalid_trace" }, { status: 400 })
  }

  const [order] = await db
    .select({ id: orders.id, metadata: orders.metadata })
    .from(orders)
    .where(sql`${orders.metadata}->'velocity'->>'salesOrderTrace' = ${salesOrderTrace}`)
    .limit(1)

  if (!order) {
    log.error("velocity callback - order not found", { transactionTrace, salesOrderTrace })
    alertCallbackOrderNotFound(transactionTrace, salesOrderTrace, rawBody as Record<string, unknown>)
    return NextResponse.json(
      { error: "order_not_ready" },
      { status: 503, headers: { "Retry-After": "10" } },
    )
  }

  const velocity = ((order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }).velocity
  const knownTraces = new Set([
    velocity?.transactionTrace,
    ...(velocity?.transactionTraces ?? []),
  ].filter((trace): trace is string => Boolean(trace)))
  if (knownTraces.size > 0 && !knownTraces.has(transactionTrace)) {
    alertPaymentAnomaly({
      type: "VELOCITY_API_UNEXPECTED_FORMAT",
      severity: "critical",
      title: "Velocity callback trace does not belong to the order",
      detail: `Callback trace ${transactionTrace} was not found in order ${order.id} metadata.`,
      orderId: order.id,
      context: { transactionTrace, salesOrderTrace, knownTraces: [...knownTraces] },
    }).catch(() => {})
    return NextResponse.json({ error: "transaction_trace_mismatch" }, { status: 409 })
  }

  const [settled] = await db
    .select({ id: paymentLedger.id })
    .from(paymentLedger)
    .where(and(
      eq(paymentLedger.orderId, order.id),
      eq(paymentLedger.transactionTrace, transactionTrace),
      inArray(paymentLedger.localStatus, ["paid", "completed", "success", "paid_success"]),
    ))
    .limit(1)
  if (settled) {
    return NextResponse.json({ status: "acknowledged", note: "Already settled" })
  }

  const lockKey = `velocity-finalize:${salesOrderTrace}`
  if (!await acquireLock(lockKey)) {
    log.info("velocity callback - lock contended; requesting provider retry", { orderId: order.id })
    return NextResponse.json(
      { error: "settlement_in_progress" },
      { status: 503, headers: { "Retry-After": "5" } },
    )
  }

  try {
    const result = await reconcileVelocityOrder({
      orderId: order.id,
      source: "callback",
      rawPayload: rawBody as Record<string, unknown>,
      transactionTrace,
    })

    if (result.paid) {
      deliverTicketForPaidOrder(order.id).catch((error) =>
        log.error("velocity callback - delivery failed; cron will retry", { orderId: order.id, error: String(error) }),
      )
      return NextResponse.json({ status: "acknowledged", paid: true, invoiceId: result.invoiceId })
    }

    if (["NETWORK_ERROR", "PROVIDER_ERROR", "FINALIZE_ERROR", "FINALIZE_PENDING"].includes(result.state)) {
      return NextResponse.json(
        { error: "velocity_reconciliation_incomplete", state: result.state },
        { status: 503, headers: { "Retry-After": "15" } },
      )
    }

    return NextResponse.json({ status: "acknowledged", paid: false, state: result.state })
  } catch (error) {
    log.error("velocity callback - reconciliation error", {
      orderId: order.id,
      transactionTrace,
      salesOrderTrace,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  } finally {
    await releaseLock(lockKey)
  }
}
