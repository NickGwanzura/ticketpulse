import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { pollTransaction, finalizeWorkflow } from "@/services/velocity"
import { startOrderVerification } from "@/lib/order-verification"
import { notifyPaymentSuccess } from "@/lib/payment-notifications"
import { acquireLock, releaseLock } from "@/lib/velocity/idempotency"
import { log } from "@/lib/logger"
import { trackEvent } from "@/lib/analytics"
import type { VelocityOrderMetadata, VelocityPollStatus } from "@/types/velocity"

const POLL_TIMEOUT_MS = 5 * 60 * 1000

type Params = { id: string }

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const paidStatuses = new Set(["paid", "awaiting_verification"])
  if (paidStatuses.has(order.status ?? "")) {
    return NextResponse.json({
      orderId: id,
      status: order.status,
      paid: true,
      sentTo: order.guestEmail,
    })
  }

  if (order.status !== "pending") {
    return NextResponse.json({
      orderId: id,
      status: order.status,
      paid: false,
    })
  }

  const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
  const velocityMeta = meta.velocity

  if (!velocityMeta?.transactionTrace) {
    return NextResponse.json({ error: "missing_velocity_transaction" }, { status: 400 })
  }

  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : Date.now()
  if (Date.now() - createdAt > POLL_TIMEOUT_MS) {
    return NextResponse.json({
      orderId: id,
      status: "expired",
      paid: false,
      pollStatus: "TIMEOUT",
      error: "Payment window expired",
    })
  }

  try {
    const pollResult = await pollTransaction(velocityMeta.transactionTrace)
    const pollStatus = pollResult.body.pollStatus

    const updatedMeta = {
      ...meta,
      velocity: {
        ...velocityMeta,
        pollStatus,
      },
    }

    await db
      .update(orders)
      .set({ metadata: updatedMeta, updatedAt: new Date() })
      .where(eq(orders.id, id))

    if (pollStatus === "SUCCESS") {
      const lockKey = `velocity-finalize:${velocityMeta.salesOrderTrace}`
      if (!acquireLock(lockKey)) {
        return NextResponse.json({
          orderId: id,
          status: "pending",
          paid: false,
          pollStatus: "PENDING",
          message: "Finalization in progress",
        })
      }

      try {
        log.info("velocity status - poll success, finalizing workflow", {
          orderId: id,
          salesOrderTrace: velocityMeta.salesOrderTrace,
        })

        const finalizeResult = await finalizeWorkflow(velocityMeta.salesOrderTrace)
        const invoiceId = finalizeResult.body.invoice.id

        trackEvent({ event: "PAYMENT_CONFIRMED", eventId: order.eventId, orderId: id, paymentMethod: order.paymentMethod, amount: Number(order.totalAmount) })

        const finalMeta = {
          ...meta,
          velocity: {
            ...velocityMeta,
            pollStatus: "SUCCESS" as VelocityPollStatus,
            paymentRef: invoiceId,
            invoiceRef: invoiceId,
            finalizedAt: new Date().toISOString(),
          },
        }

        const [claimed] = await db
          .update(orders)
          .set({
            status: "awaiting_verification",
            paidAt: new Date(),
            paymentRef: invoiceId,
            metadata: finalMeta,
            updatedAt: new Date(),
          })
          .where(and(eq(orders.id, id), eq(orders.status, "pending")))
          .returning({ id: orders.id })

        if (claimed && order.guestEmail) {
          const origin = new URL(req.url).origin
          await startOrderVerification({
            orderId: id,
            email: order.guestEmail,
            origin,
          })
          notifyPaymentSuccess(id)
        }

        return NextResponse.json({
          orderId: id,
          status: "awaiting_verification",
          paid: true,
          pollStatus: "SUCCESS",
          sentTo: order.guestEmail,
          invoiceRef: invoiceId,
        })
      } finally {
        releaseLock(lockKey)
      }
    }

    if (pollStatus === "FAILED") {
      trackEvent({ event: "PAYMENT_FAILED", eventId: order.eventId, orderId: id, paymentMethod: order.paymentMethod, amount: Number(order.totalAmount) })
      return NextResponse.json({
        orderId: id,
        status: "pending",
        paid: false,
        pollStatus: "FAILED",
      })
    }

    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      pollStatus: pollStatus ?? "PENDING",
    })
  } catch (err) {
    log.error("velocity status polling error", { orderId: id, error: String(err) })
    return NextResponse.json({
      orderId: id,
      status: "pending",
      paid: false,
      pollStatus: "PENDING",
      message: err instanceof Error ? err.message : "Polling failed",
    })
  }
}
