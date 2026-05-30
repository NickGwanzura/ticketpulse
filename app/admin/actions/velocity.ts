"use server"

import { revalidatePath } from "next/cache"
import { eq, and, inArray, or, sql } from "drizzle-orm"

import { auth, signIn } from "@/auth"
import { db } from "@/db"
import { events, orders, orderItems, paymentLedger, ticketTiers, tickets, users } from "@/db/schema"
import {
  sendEmail,
  adminEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email"
import { eventPublishedNotificationEmail } from "@/lib/email-templates"
import { log } from "@/lib/logger"
import type { VelocityOrderMetadata } from "@/types/velocity"

export async function recheckPaymentAction(
  orderId: string,
): Promise<{ fixed: boolean; message: string; details?: Record<string, unknown> }> {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order) throw new Error("Order not found")

  if (order.status === "paid") {
    return { fixed: false, message: "Order is already paid." }
  }

  const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
  const velocityMeta = meta.velocity

  if (!velocityMeta?.transactionTrace || !velocityMeta?.salesOrderTrace) {
    return { fixed: false, message: "No Velocity transaction traces found on this order." }
  }

  const { pollTransaction, finalizeWorkflow, normalizeVelocityPollResponse } = await import(
    "@/services/velocity"
  )

  // ── Step 1: Poll the transaction ────────────────────────────────────────
  // pollTransaction no longer throws — it always returns a structured response.
  const pollResult = await pollTransaction(velocityMeta.transactionTrace)
  const normalized = normalizeVelocityPollResponse(pollResult)

  log.info("recheckPaymentAction - poll result", {
    orderId,
    transactionTrace: velocityMeta.transactionTrace,
    localStatus: normalized.localStatus,
    velocityPollStatus: normalized.velocityPollStatus,
    velocityPaymentStatus: normalized.velocityPaymentStatus,
    velocityWorkflowStatus: normalized.velocityWorkflowStatus,
    fullBody: JSON.stringify(pollResult).slice(0, 3000),
  })

  // ── Not SUCCESS → store failure, do not delete order ────────────────────
  if (normalized.localStatus !== "PAID") {
    const failureReason =
      normalized.localStatus === "FAILED"
        ? `Velocity returned pollStatus: ${normalized.velocityPollStatus}, paymentStatus: ${normalized.velocityPaymentStatus}`
        : normalized.localStatus === "UNKNOWN"
          ? `Unknown payment status – pollStatus: ${normalized.velocityPollStatus ?? "missing"}, paymentStatus: ${normalized.velocityPaymentStatus ?? "missing"}`
          : "Payment still pending in Velocity"

    const failedMeta = {
      ...meta,
      velocity: {
        ...velocityMeta,
        pollStatus: (normalized.velocityPollStatus as VelocityOrderMetadata["pollStatus"]) ?? "UNKNOWN",
        failedAt: new Date().toISOString(),
        failureReason,
        recheckedAt: new Date().toISOString(),
        recheckedBy: session.user.email,
        velocityRawPollResponse: {
          state: pollResult.state,
          status: pollResult.status,
          body: {
            trace: pollResult.body?.trace,
            amount: pollResult.body?.amount,
            paymentStatus: pollResult.body?.paymentStatus,
            pollStatus: pollResult.body?.pollStatus,
          },
        },
      },
    }

    await db
      .update(orders)
      .set({ metadata: failedMeta, updatedAt: new Date() })
      .where(eq(orders.id, orderId))

    revalidatePath("/admin/orders")
    revalidatePath("/admin")

    return {
      fixed: false,
      message:
        normalized.localStatus === "PENDING"
          ? `Payment is still pending in Velocity (pollStatus: ${normalized.velocityPollStatus}). Try again later.`
          : `Payment status in Velocity is "${normalized.velocityPollStatus}" (${normalized.localStatus}). Not confirmed yet. Admin recheck recorded.`,
      details: {
        localStatus: normalized.localStatus,
        pollStatus: normalized.velocityPollStatus,
        paymentStatus: normalized.velocityPaymentStatus,
        amount: pollResult.body?.amount,
        failureReason,
      },
    }
  }

  // ── Step 2: Finalize the workflow ───────────────────────────────────────
  let finalizeResult
  try {
    finalizeResult = await finalizeWorkflow(velocityMeta.salesOrderTrace)
  } catch (err) {
    return {
      fixed: false,
      message: `Poll succeeded but workflow finalization failed: ${err instanceof Error ? err.message : String(err)}. You can retry.`,
      details: { localStatus: "PAID", salesOrderTrace: velocityMeta.salesOrderTrace },
    }
  }

  if (finalizeResult.body.salesOrder.status !== "PAID") {
    return {
      fixed: false,
      message: `Workflow finalization returned status "${finalizeResult.body.salesOrder.status}" instead of "PAID".`,
      details: {
        salesOrderStatus: finalizeResult.body.salesOrder.status,
        outstandingAmount: finalizeResult.body.salesOrder.outstandingAmount,
        paidAmount: finalizeResult.body.salesOrder.paidAmount,
      },
    }
  }

  const invoiceId = finalizeResult.body.invoice.id

  // ── Step 3: Update local DB directly to PAID ────────────────────────────
  const finalMeta = {
    ...meta,
    velocity: {
      ...velocityMeta,
      pollStatus: "SUCCESS" as const,
      paymentRef: invoiceId,
      invoiceRef: invoiceId,
      finalizedAt: new Date().toISOString(),
      recheckedAt: new Date().toISOString(),
      recheckedBy: session.user.email,
      recoveryMode: true,
    },
  }

  try {
    await db
      .update(orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        paymentRef: invoiceId,
        metadata: finalMeta,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
  } catch (err) {
    return {
      fixed: true,
      message: `Payment confirmed in Velocity and workflow finalized, but local DB update failed: ${err instanceof Error ? err.message : String(err)}. Please try again or check logs.`,
      details: { salesOrderTrace: velocityMeta.salesOrderTrace, invoiceId },
    }
  }

  // Record in payment ledger
  try {
    await db.insert(paymentLedger).values({
      orderId,
      eventId: order.eventId,
      transactionTrace: velocityMeta.transactionTrace ?? "",
      salesOrderTrace: velocityMeta.salesOrderTrace,
      invoiceId,
      amount: order.totalAmount,
      currency: order.currency ?? "USD",
      processor: "velocity",
      velocityPollStatus: "SUCCESS",
      localStatus: "paid",
      source: "admin_recheck",
      rawPayload: null,
    })
  } catch (err) {
    log.warn("recheckPaymentAction - failed to record paymentLedger", {
      orderId,
      error: String(err),
    })
  }

  // ── Step 4: Generate tickets and deliver ────────────────────────────────
  let deliveryResult: string
  try {
    const { deliverTicketForPaidOrder } = await import("@/lib/delivery")
    const delivery = await deliverTicketForPaidOrder(orderId)
    const emailStatus = delivery.emailSent ? "Email sent." : "Email issue: " + (delivery.error ?? "unknown")
    deliveryResult = `Delivery: ${delivery.status}, tickets: ${delivery.ticketCount}, ${emailStatus}`
    log.info("recheckPaymentAction - delivery result", {
      orderId,
      deliveryStatus: delivery.status,
      ticketCount: delivery.ticketCount,
    })
  } catch (err) {
    deliveryResult = `Delivery failed: ${err instanceof Error ? err.message : String(err)}`
    log.error("recheckPaymentAction - delivery failed", {
      orderId,
      error: String(err),
    })
  }

  revalidatePath("/admin/orders")
  revalidatePath("/admin")

  return {
    fixed: true,
    message: `Payment confirmed, workflow finalized, order moved to paid. ${deliveryResult} Invoice: ${invoiceId}.`,
    details: { salesOrderTrace: velocityMeta.salesOrderTrace, invoiceId, pollStatus: "SUCCESS" },
  }
}

/**
 * Poll all pending/awaiting_verification Velocity orders and fix any
 * transactions that have completed in Velocity but not locally.
 *
 * Returns a summary of checked, fixed, and failed orders.
 */

export async function pollAllVelocityOrdersAction(): Promise<{
  checked: number
  fixed: number
  errors: number
  results: Array<{ orderId: string; action: string; message: string }>
}> {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const hasVelocity = sql`${orders.metadata}->>'velocity' IS NOT NULL`

  const targetOrders = await db
    .select({ id: orders.id, status: orders.status, metadata: orders.metadata, guestEmail: orders.guestEmail, eventId: orders.eventId, totalAmount: orders.totalAmount, currency: orders.currency })
    .from(orders)
    .where(
      and(hasVelocity, inArray(orders.status, ["pending", "awaiting_verification"])),
    )
    .limit(30)

  const results: Array<{ orderId: string; action: string; message: string }> = []
  let fixedCount = 0
  let errorCount = 0

  for (const order of targetOrders) {
    try {
      const meta = (order.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
      const velocityMeta = meta.velocity

      if (!velocityMeta?.transactionTrace || !velocityMeta?.salesOrderTrace) {
        results.push({
          orderId: order.id,
          action: "skipped",
          message: "No Velocity traces in metadata",
        })
        continue
      }

      const { pollTransaction, finalizeWorkflow, normalizeVelocityPollResponse } = await import("@/services/velocity")
      const { deliverTicketForPaidOrder } = await import("@/lib/delivery")

      const pollResult = await pollTransaction(velocityMeta.transactionTrace)
      const normalized = normalizeVelocityPollResponse(pollResult)

      log.info("pollAllVelocityOrdersAction — poll result", {
        orderId: order.id,
        localStatus: normalized.localStatus,
        velocityPollStatus: normalized.velocityPollStatus,
        paymentStatus: normalized.velocityPaymentStatus,
      })

      if (normalized.localStatus === "UNKNOWN") {
        await db
          .update(orders)
          .set({
            updatedAt: new Date(),
            metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{velocity,pollStatus}', ${JSON.stringify(normalized.velocityPollStatus)}::jsonb)`,
          })
          .where(eq(orders.id, order.id))

        results.push({
          orderId: order.id,
          action: "unknown",
          message: `Unknown payment status — pollStatus: ${normalized.velocityPollStatus ?? "missing"}, paymentStatus: ${normalized.velocityPaymentStatus ?? "missing"}. Requires admin review.`,
        })
        continue
      }

      if (normalized.localStatus !== "PAID") {
        await db
          .update(orders)
          .set({
            updatedAt: new Date(),
            metadata: sql`jsonb_set(COALESCE(${orders.metadata}, '{}'::jsonb), '{velocity,pollStatus}', ${JSON.stringify(normalized.velocityPollStatus)}::jsonb)`,
          })
          .where(eq(orders.id, order.id))

        results.push({
          orderId: order.id,
          action: "pending",
          message: `Status: ${normalized.velocityPollStatus ?? "unknown"}`,
        })
        continue
      }

      // Finalize the workflow
      const finalizeResult = await finalizeWorkflow(velocityMeta.salesOrderTrace)
      const salesOrderStatus = finalizeResult.body.salesOrder.status

      if (salesOrderStatus !== "PAID") {
        results.push({
          orderId: order.id,
          action: "skipped",
          message: `Finalization returned ${salesOrderStatus} instead of PAID`,
        })
        continue
      }

      const invoiceId = finalizeResult.body.invoice.id
      const updatedMeta = {
        ...meta,
        velocity: {
          ...velocityMeta,
          pollStatus: "SUCCESS" as const,
          paymentRef: invoiceId,
          invoiceRef: invoiceId,
          finalizedAt: new Date().toISOString(),
          recheckedAt: new Date().toISOString(),
          polledNow: true,
        },
      }

      await db
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          paymentRef: invoiceId,
          metadata: updatedMeta,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))

      await db.insert(paymentLedger).values({
        orderId: order.id,
        eventId: order.eventId ?? "00000000-0000-0000-0000-000000000000",
        transactionTrace: velocityMeta.transactionTrace ?? "",
        salesOrderTrace: velocityMeta.salesOrderTrace,
        invoiceId,
        amount: order.totalAmount ?? "0",
        currency: order.currency ?? "USD",
        processor: "velocity",
        velocityPollStatus: "SUCCESS",
        localStatus: "paid",
        source: "admin",
        rawPayload: null,
      })

      // Generate tickets and send confirmation
      const delivery = await deliverTicketForPaidOrder(order.id)

      log.info("pollAllVelocityOrdersAction — delivery result", {
        orderId: order.id,
        deliveryStatus: delivery.status,
        ticketCount: delivery.ticketCount,
      })

      fixedCount++
      results.push({
        orderId: order.id,
        action: "fixed",
        message: `Confirmed, delivered. Invoice: ${invoiceId}. ${delivery.emailSent ? "Email sent." : "Email issue: " + (delivery.error ?? "unknown")}`,
      })
    } catch (err) {
      errorCount++
      results.push({
        orderId: order.id,
        action: "error",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  revalidatePath("/admin")
  revalidatePath("/admin/velocity")
  revalidatePath("/admin/orders")

  return {
    checked: targetOrders.length,
    fixed: fixedCount,
    errors: errorCount,
    results,
  }
}

/**
 * Refund a paid order — marks order as refunded, all tickets as refunded,
 * and restores inventory for each affected tier.
 */
/**
 * Mark an order as manually completed (admin).
 * Sets order status to "completed" and records payment as paid.
 */
