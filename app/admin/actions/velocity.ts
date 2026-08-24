"use server"

import { and, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { orders } from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { log } from "@/lib/logger"
import { reconcileVelocityOrder } from "@/lib/velocity/reconciliation"

function revalidateVelocityViews() {
  revalidatePath("/admin")
  revalidatePath("/admin/orders")
  revalidatePath("/admin/payments")
  revalidatePath("/admin/velocity")
}

export async function recheckPaymentAction(
  orderId: string,
): Promise<{ fixed: boolean; message: string; details?: Record<string, unknown> }> {
  const session = await requireAdmin()
  const result = await reconcileVelocityOrder({
    orderId,
    source: "admin_recheck",
    actorEmail: session.user.email,
  })

  if (!result.paid) {
    revalidateVelocityViews()
    return {
      fixed: false,
      message: `${result.state}: ${result.message ?? "Payment was not confirmed"}`,
      details: {
        state: result.state,
        transactionTrace: result.transactionTrace,
        salesOrderTrace: result.salesOrderTrace,
        providerHttpStatus: result.providerHttpStatus,
      },
    }
  }

  try {
    const delivery = await deliverTicketForPaidOrder(orderId)
    revalidateVelocityViews()
    return {
      fixed: true,
      message: `Payment confirmed and every local completion field was updated atomically. Delivery: ${delivery.status}; tickets: ${delivery.ticketCount}; email: ${delivery.emailSent ? "sent" : delivery.error ?? "pending retry"}.`,
      details: {
        invoiceId: result.invoiceId,
        transactionTrace: result.transactionTrace,
        newlySettled: result.newlySettled,
      },
    }
  } catch (error) {
    log.error("recheckPaymentAction - delivery failed after atomic settlement", { orderId, error: String(error) })
    revalidateVelocityViews()
    return {
      fixed: true,
      message: `Payment and ledger were fixed, but ticket delivery failed and will be retried by cron: ${error instanceof Error ? error.message : String(error)}`,
      details: { invoiceId: result.invoiceId, transactionTrace: result.transactionTrace },
    }
  }
}

export async function pollAllVelocityOrdersAction(): Promise<{
  checked: number
  fixed: number
  errors: number
  results: Array<{ orderId: string; action: string; message: string }>
}> {
  const session = await requireAdmin()
  const targetOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(
      sql`${orders.metadata}->>'velocity' IS NOT NULL`,
      inArray(orders.status, ["pending", "awaiting_verification", "expired"]),
    ))
    .limit(30)

  const results: Array<{ orderId: string; action: string; message: string }> = []
  let fixed = 0
  let errors = 0

  for (const order of targetOrders) {
    try {
      const result = await reconcileVelocityOrder({
        orderId: order.id,
        source: "admin_poll_all",
        actorEmail: session.user.email,
      })
      if (!result.paid) {
        const isError = ["PROVIDER_ERROR", "NETWORK_ERROR", "FINALIZE_ERROR", "FINALIZE_PENDING", "AMOUNT_MISMATCH", "CONFLICT"].includes(result.state)
        if (isError) errors++
        results.push({ orderId: order.id, action: isError ? "error" : "skipped", message: `${result.state}: ${result.message ?? "not settled"}` })
        continue
      }

      const delivery = await deliverTicketForPaidOrder(order.id)
      if (result.newlySettled) fixed++
      results.push({
        orderId: order.id,
        action: result.newlySettled ? "fixed" : "verified",
        message: `Invoice ${result.invoiceId}; delivery ${delivery.status}; email ${delivery.emailSent ? "sent" : delivery.error ?? "pending retry"}`,
      })
    } catch (error) {
      errors++
      results.push({ orderId: order.id, action: "error", message: error instanceof Error ? error.message : String(error) })
    }
  }

  revalidateVelocityViews()
  return { checked: targetOrders.length, fixed, errors, results }
}
