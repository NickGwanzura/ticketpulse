import "server-only"

import { and, desc, eq, gte, lte } from "drizzle-orm"

import { db } from "@/db"
import { events, payouts, users } from "@/db/schema"
import { getEventRevenueSummaries, getOrganizerRevenueSummary } from "@/lib/revenue-summary"
import type { PayoutStatementData } from "@/lib/pdf/payout-statement-document"

/** Gather everything the payout statement PDF needs for one organiser. */
export async function buildPayoutStatementData(
  userId: string,
  period: { from?: Date | null; to?: Date | null } = {},
): Promise<PayoutStatementData | null> {
  const periodFrom = period.from ?? null
  const periodTo = period.to ?? null

  const [organizer] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!organizer) return null

  const summary = await getOrganizerRevenueSummary(userId)

  const payoutRows = await db
    .select({
      id: payouts.id,
      amount: payouts.amount,
      currency: payouts.currency,
      status: payouts.status,
      method: payouts.method,
      eventTitle: events.title,
      createdAt: payouts.createdAt,
      processedAt: payouts.processedAt,
      reference: payouts.proofReference,
    })
    .from(payouts)
    .leftJoin(events, eq(events.id, payouts.eventId))
    .where(and(
      eq(payouts.userId, userId),
      periodFrom ? gte(payouts.createdAt, periodFrom) : undefined,
      periodTo ? lte(payouts.createdAt, periodTo) : undefined,
    ))
    .orderBy(desc(payouts.createdAt))

  const eventRows = await db
    .select({ id: events.id, title: events.title, startsAt: events.startsAt })
    .from(events)
    .where(eq(events.organizerId, userId))
    .orderBy(desc(events.startsAt))
  const eventSummaries = await getEventRevenueSummaries(eventRows.map((e) => e.id))
  const eventBreakdown = eventRows
    .map((e) => ({ row: e, s: eventSummaries.get(e.id) }))
    .filter((e) => e.s && (e.s.grossRevenue > 0 || e.s.paidOut > 0 || e.s.pendingPayouts > 0))
    .map(({ row, s }) => ({
      title: row.title,
      startsAt: row.startsAt,
      grossRevenue: s!.grossRevenue,
      platformFee: s!.platformFee,
      netRevenue: s!.netRevenue,
      paidOut: s!.paidOut,
      availableBalance: s!.availableBalance,
      confirmedTicketCount: s!.confirmedTicketCount,
    }))

  const now = new Date()
  return {
    organizerName: organizer.name ?? "Organiser",
    organizerEmail: organizer.email ?? "",
    generatedAt: now,
    statementNumber: `TP-ST-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${organizer.id.slice(0, 6).toUpperCase()}`,
    periodFrom,
    periodTo,
    events: eventBreakdown,
    grossRevenue: summary.grossRevenue,
    platformFee: summary.platformFee,
    platformFeePercent: summary.commissionRate,
    netRevenue: summary.netRevenue,
    paidOut: summary.paidOut,
    pendingPayouts: summary.pendingPayouts,
    outstandingClawbacks: summary.outstandingClawbacks,
    availableBalance: summary.availableBalance,
    confirmedTicketCount: summary.confirmedTicketCount,
    confirmedOrderCount: summary.confirmedOrderCount,
    payouts: payoutRows.map((p) => ({ ...p, amount: Number(p.amount), currency: p.currency ?? "USD" })),
  }
}
