"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events, eventOrganisers } from "@/db/schema"

async function authorizeForOrder(orderId: string): Promise<{ userId: string; email: string }> {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  if (session.user.role === "admin") {
    return { userId: session.user.id, email: session.user.email ?? "admin" }
  }

  if (session.user.role === "organizer") {
    const [order] = await db
      .select({ eventId: orders.eventId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) throw new Error("Order not found")

    const isOwner = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, order.eventId), eq(events.organizerId, session.user.id)))
      .limit(1)

    if (isOwner.length > 0) {
      return { userId: session.user.id, email: session.user.email ?? "organizer" }
    }

    const isCollaborator = await db
      .select({ id: eventOrganisers.id })
      .from(eventOrganisers)
      .where(and(eq(eventOrganisers.eventId, order.eventId), eq(eventOrganisers.userId, session.user.id)))
      .limit(1)

    if (isCollaborator.length > 0) {
      return { userId: session.user.id, email: session.user.email ?? "organizer" }
    }
  }

  throw new Error("Unauthorized — you do not have access to this order")
}

export async function organizerMarkOrderCompleteAction(orderId: string) {
  const { userId, email } = await authorizeForOrder(orderId)
  const { markOrderCompleteAction } = await import("@/lib/order-recovery")
  const result = await markOrderCompleteAction(orderId, userId, email)
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
  const result = await completeAndSendAction(orderId, userId, email)
  revalidatePath("/organizer/orders")
  return result
}
