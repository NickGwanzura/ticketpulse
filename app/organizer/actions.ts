"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders } from "@/db/schema"
import { requireEventAccessForUser } from "@/lib/event-access"

/**
 * Order actions for the organizer orders page. Access follows the shared
 * event rule (owner, invited co-organiser, or admin; frozen accounts blocked).
 *
 * Organizers can complete orders whose money did not pass through the payment
 * gateway, and paid orders. An unpaid EcoCash/card order can only be settled
 * by "Recheck payment" (the provider confirms it) — never marked complete by
 * hand, since that would count as payable revenue.
 */
async function authorizeForOrder(orderId: string): Promise<{ userId: string; email: string }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Please sign in again.")

  const [order] = await db
    .select({ eventId: orders.eventId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
  if (!order) throw new Error("Order not found")

  const access = await requireEventAccessForUser(order.eventId, session.user)
  if (!access.allowed) throw new Error("You don't have access to this order.")

  return { userId: session.user.id, email: session.user.email ?? "organizer" }
}

// Organizers never get the admin provider-reference override.
export async function organizerMarkOrderCompleteAction(orderId: string) {
  const { userId, email } = await authorizeForOrder(orderId)
  const { markOrderCompleteAction } = await import("@/lib/order-recovery")
  const result = await markOrderCompleteAction(orderId, userId, email, { actor: "organizer" })
  revalidatePath("/organizer/orders")
  return result
}

export async function organizerSendTicketsAction(orderId: string) {
  await authorizeForOrder(orderId)
  const { sendTicketsAction } = await import("@/lib/order-recovery")
  const result = await sendTicketsAction(orderId)
  revalidatePath("/organizer/orders")
  return result
}

export async function organizerCompleteAndSendAction(orderId: string) {
  const { userId, email } = await authorizeForOrder(orderId)
  const { completeAndSendAction } = await import("@/lib/order-recovery")
  const result = await completeAndSendAction(orderId, userId, email, {}, { actor: "organizer" })
  revalidatePath("/organizer/orders")
  return result
}

export async function organizerRecheckPaymentAction(orderId: string) {
  const { email } = await authorizeForOrder(orderId)
  const { recheckOrderPayment } = await import("@/lib/payment-recheck")
  const result = await recheckOrderPayment(orderId, { source: "organizer_recheck", actorEmail: email })
  revalidatePath("/organizer/orders")
  return result
}
