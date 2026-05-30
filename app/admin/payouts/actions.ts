"use server"

import { revalidatePath } from "next/cache"
import { eq, desc, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, orders, events, users } from "@/db/schema"
import { log } from "@/lib/logger"

export async function getPayouts(status?: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const conditions = []
  if (status && status !== "all") {
    conditions.push(eq(payouts.status, status as "pending" | "approved" | "processing" | "paid" | "held"))
  }

  const whereClause = conditions.length > 0 ? conditions[0] : undefined

  const payoutRows = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      method: payouts.method,
      status: payouts.status,
      accountNumber: payouts.accountNumber,
      accountName: payouts.accountName,
      bankName: payouts.bankName,
      notes: payouts.notes,
      createdAt: payouts.createdAt,
      processedAt: payouts.processedAt,
      processedBy: payouts.processedBy,
      organizerName: users.name,
      organizerEmail: users.email,
      eventTitle: events.title,
    })
    .from(payouts)
    .leftJoin(users, eq(users.id, payouts.userId))
    .leftJoin(events, eq(events.id, payouts.eventId))
    .where(whereClause)
    .orderBy(desc(payouts.createdAt))
    .limit(200)

  // Stats
  const statsResult = await db
    .select({
      pending: sql<number>`count(case when ${payouts.status} = 'pending' then 1 end)`,
      approved: sql<number>`count(case when ${payouts.status} = 'approved' then 1 end)`,
      processing: sql<number>`count(case when ${payouts.status} = 'processing' then 1 end)`,
      paid: sql<number>`count(case when ${payouts.status} = 'paid' then 1 end)`,
      held: sql<number>`count(case when ${payouts.status} = 'held' then 1 end)`,
      pendingTotal: sql<number>`coalesce(sum(case when ${payouts.status} = 'pending' then ${payouts.amount} else 0 end), 0)`,
    })
    .from(payouts)

  return {
    payouts: payoutRows,
    stats: statsResult[0] ?? { pending: 0, approved: 0, processing: 0, paid: 0, held: 0, pendingTotal: 0 },
  }
}

export async function processPayoutAction(payoutId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  await db
    .update(payouts)
    .set({
      status: "paid",
      processedAt: new Date(),
      processedBy: session.user.email ?? session.user.id,
    })
    .where(eq(payouts.id, payoutId))

  log.info("Payout processed", { payoutId, by: session.user.email })
  revalidatePath("/admin/payouts")
  return { ok: true }
}

export async function updatePayoutStatusAction(payoutId: string, status: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }

  const validStatuses = ["pending", "approved", "processing", "paid", "held"]
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status")
  }

  await db
    .update(payouts)
    .set({
      status: status as "pending" | "approved" | "processing" | "paid" | "held",
      processedAt: status === "paid" ? new Date() : undefined,
      processedBy: status === "paid" ? (session.user.email ?? session.user.id) : undefined,
    })
    .where(eq(payouts.id, payoutId))

  log.info("Payout status updated", { payoutId, status, by: session.user.email })
  revalidatePath("/admin/payouts")
  return { ok: true }
}
