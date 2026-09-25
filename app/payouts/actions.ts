"use server"

import { eq, desc, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, events } from "@/db/schema"
import { log } from "@/lib/logger"
import { fetchBalanceForUser, submitPayoutRequest } from "@/lib/payout-request"

export async function getOrganizerPayouts(userId: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Users can only see their own payouts
  if (session.user.id !== userId && session.user.role !== "admin") {
    throw new Error("Unauthorized")
  }
  // Note: This throw is intentional — getOrganizerPayouts is called during
  // server-component render (app/payouts/page.tsx) which already has its
  // own session guard + redirect(). The throw is a safety net.

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
      proofReference: payouts.proofReference,
      notes: payouts.notes,
      balanceSnapshot: payouts.balanceSnapshot,
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
      pending: sql<string>`count(case when ${payouts.status} = 'pending' then 1 end)`.mapWith(Number),
      paid: sql<string>`count(case when ${payouts.status} = 'paid' then 1 end)`.mapWith(Number),
      totalPaid: sql<string>`coalesce(sum(case when ${payouts.status} = 'paid' then ${payouts.amount} else 0 end), 0)`.mapWith(Number),
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
  // Note: This throw is intentional — getOrganizerBalance is called during
  // server-component render (app/payouts/page.tsx) which has its own session
  // guard + redirect(). The throw is a safety net.

  return fetchBalanceForUser(userId)
}

export type PayoutActionResult = {
  ok: boolean
  message: string
  payoutId?: string
}

function payoutActionError(message: string): PayoutActionResult {
  revalidatePath("/payouts")
  return { ok: false, message }
}

export async function requestPayoutAction(formData: FormData): Promise<PayoutActionResult> {
  const session = await auth()
  if (!session?.user) {
    log.warn("[request-payout] Unauthorized")
    return payoutActionError("Please sign in again before requesting a payout.")
  }

  const result = await submitPayoutRequest(session.user.id, session.user.email ?? session.user.id, {
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    method: formData.get("method"),
    ecocashNumber: formData.get("ecocashNumber"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
    bankName: formData.get("bankName"),
  })
  revalidatePath("/payouts")
  if (result.ok) revalidatePath("/admin/payouts")
  return result
}
