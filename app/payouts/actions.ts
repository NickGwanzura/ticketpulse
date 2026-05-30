"use server"

import { eq, desc, sql, and } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, orders, events } from "@/db/schema"
import { log } from "@/lib/logger"

export async function getOrganizerPayouts(userId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Users can only see their own payouts
  if (session.user.id !== userId && session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const payoutRows = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      method: payouts.method,
      status: payouts.status,
      createdAt: payouts.createdAt,
      processedAt: payouts.processedAt,
      eventTitle: events.title,
    })
    .from(payouts)
    .leftJoin(events, eq(events.id, payouts.eventId))
    .where(eq(payouts.userId, userId))
    .orderBy(desc(payouts.createdAt))
    .limit(100)

  const stats = await db
    .select({
      pending: sql<number>`count(case when ${payouts.status} = 'pending' then 1 end)`,
      paid: sql<number>`count(case when ${payouts.status} = 'paid' then 1 end)`,
      totalPaid: sql<number>`coalesce(sum(case when ${payouts.status} = 'paid' then ${payouts.amount} else 0 end), 0)`,
    })
    .from(payouts)
    .where(eq(payouts.userId, userId))

  return {
    payouts: payoutRows,
    stats: stats[0] ?? { pending: 0, paid: 0, totalPaid: 0 },
  }
}

export async function getOrganizerBalance(userId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  if (session.user.id !== userId && session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  // Calculate total revenue from completed/paid orders for this user's events
  const revenueResult = await db
    .select({
      total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(
      and(
        eq(events.organizerId, userId),
        eq(orders.status, "completed")
      )
    )

  const totalEarned = Number(revenueResult[0]?.total ?? 0)

  // Calculate total paid out
  const paidOutResult = await db
    .select({
      total: sql<number>`coalesce(sum(${payouts.amount}), 0)`,
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.userId, userId),
        eq(payouts.status, "paid")
      )
    )

  const totalPaidOut = Number(paidOutResult[0]?.total ?? 0)

  // Available = earned - paid out - pending
  const pendingResult = await db
    .select({
      total: sql<number>`coalesce(sum(${payouts.amount}), 0)`,
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.userId, userId),
        sql`${payouts.status} in ('pending', 'approved', 'processing')`
      )
    )

  const pendingTotal = Number(pendingResult[0]?.total ?? 0)
  const availableBalance = Math.max(0, totalEarned - totalPaidOut - pendingTotal)

  return {
    availableBalance,
    totalEarned,
    totalPaidOut,
    pendingTotal,
  }
}

export async function requestPayoutAction(formData: FormData) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const userId = session.user.id
  const amount = parseFloat(formData.get("amount") as string)
  const currency = (formData.get("currency") as string) ?? "USD"
  const method = (formData.get("method") as string) ?? "ecocash"
  const accountNumber = (formData.get("accountNumber") as string) ?? undefined
  const accountName = (formData.get("accountName") as string) ?? undefined
  const bankName = (formData.get("bankName") as string) ?? undefined

  if (!amount || amount <= 0) {
    throw new Error("Invalid amount")
  }

  // Check available balance
  const { availableBalance } = await getOrganizerBalance(userId)
  if (amount > availableBalance) {
    throw new Error("Insufficient balance")
  }

  await db.insert(payouts).values({
    userId,
    amount: amount.toFixed(2),
    currency,
    method: method as "ecocash" | "bank_usd" | "bank_zar",
    status: "pending",
    accountNumber,
    accountName,
    bankName,
  })

  log.info("Payout requested", { userId, amount, currency, method })
  return { ok: true }
}
