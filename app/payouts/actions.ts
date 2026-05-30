"use server"

import { eq, desc, sql, and, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, orders, events, users, platformSettings, payoutAuditLog } from "@/db/schema"
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
      rejectionReason: payouts.rejectionReason,
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

  // Get the user's commission rate (default 8% per schema, but the pricing says 5%)
  const [userRow] = await db
    .select({ commissionRate: users.commissionRate })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const commissionRate = Number(userRow?.commissionRate ?? 8)

  // Calculate gross revenue from completed/paid orders for this user's events
  const revenueResult = await db
    .select({
      total: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(
      and(
        eq(events.organizerId, userId),
        or(eq(orders.status, "paid"), eq(orders.status, "completed"))
      )
    )

  const grossRevenue = Number(revenueResult[0]?.total ?? 0)

  // Net revenue after deducting platform commission
  const totalEarned = grossRevenue * (1 - commissionRate / 100)

  // Calculate total paid out (only fully paid payouts)
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

  // Calculate pending holds (pending/approved/processing — not yet paid, not rejected/cancelled)
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
    commissionRate,
    grossRevenue,
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
  const ecocashNumber = (formData.get("ecocashNumber") as string) ?? undefined
  const accountNumber = (formData.get("accountNumber") as string) ?? undefined
  const accountName = (formData.get("accountName") as string) ?? undefined
  const bankName = (formData.get("bankName") as string) ?? undefined

  // Validate amount
  if (!amount || amount <= 0 || isNaN(amount)) {
    throw new Error("Invalid amount")
  }

  if (amount > 100000) {
    throw new Error("Maximum payout amount is $100,000")
  }

  // Validate payment method details
  if (method === "ecocash") {
    if (!ecocashNumber || !/^(\+?263|0)?7[1789]\d{7}$/.test(ecocashNumber.replace(/\s/g, ""))) {
      throw new Error("Please enter a valid EcoCash number (e.g. 0771 234 567)")
    }
  } else if (method === "bank_usd" || method === "bank_zar") {
    if (!accountNumber || accountNumber.length < 5) {
      throw new Error("Please enter a valid account number")
    }
    if (!accountName || accountName.trim().length < 2) {
      throw new Error("Please enter the full account holder name")
    }
    if (!bankName || bankName.trim().length < 2) {
      throw new Error("Please enter the bank name")
    }
  }

  // Check available balance
  const { availableBalance } = await getOrganizerBalance(userId)
  if (amount > availableBalance) {
    throw new Error("Insufficient balance")
  }

  if (availableBalance <= 0) {
    throw new Error("No funds available for payout")
  }

  // Prevent duplicate active payout
  const [existingPending] = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(
      and(
        eq(payouts.userId, userId),
        sql`${payouts.status} in ('pending', 'approved', 'processing')`
      )
    )
    .limit(1)

  if (existingPending) {
    throw new Error("You already have a pending payout request. Please wait for it to be processed before requesting another.")
  }

  // Insert the payout
  const [inserted] = await db
    .insert(payouts)
    .values({
      userId,
      amount: amount.toFixed(2),
      currency,
      method: method as "ecocash" | "bank_usd" | "bank_zar",
      status: "pending",
      accountNumber: ecocashNumber ?? accountNumber,
      accountName,
      bankName,
    })
    .returning({ id: payouts.id })

  // Create audit log entry
  await db.insert(payoutAuditLog).values({
    payoutId: inserted.id,
    action: "requested",
    toStatus: "pending",
    performedBy: session.user.email ?? userId,
    notes: `Payout of ${amount.toFixed(2)} ${currency} requested via ${method}`,
  })

  log.info("Payout requested", { userId, amount, currency, method, payoutId: inserted.id })
  revalidatePath("/payouts")
  return { ok: true, payoutId: inserted.id }
}
