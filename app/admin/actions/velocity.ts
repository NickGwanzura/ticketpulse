"use server"

import { and, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import { orders } from "@/db/schema"
import { requireAdmin } from "@/lib/auth-guard"
import { deliverTicketForPaidOrder } from "@/lib/delivery"
import { reconcileVelocityOrder } from "@/lib/velocity/reconciliation"
import { recheckOrderPayment, type RecheckResult } from "@/lib/payment-recheck"

function revalidateVelocityViews() {
  revalidatePath("/admin")
  revalidatePath("/admin/orders")
  revalidatePath("/admin/payments")
  revalidatePath("/admin/velocity")
}

export async function recheckPaymentAction(orderId: string): Promise<RecheckResult> {
  const session = await requireAdmin()
  const result = await recheckOrderPayment(orderId, { source: "admin_recheck", actorEmail: session.user.email })
  revalidateVelocityViews()
  return result
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
