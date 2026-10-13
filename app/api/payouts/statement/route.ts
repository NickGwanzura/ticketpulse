import { NextResponse } from "next/server"
import { and, eq, desc, gte, lte } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, users, events } from "@/db/schema"
import { getEventRevenueSummaries, getOrganizerRevenueSummary } from "@/lib/revenue-summary"
import { log } from "@/lib/logger"

/**
 * Organiser-facing financial statement — the piece that was missing before:
 * the A6 ticket PDF is for buyers, this is the itemized gross/fee/net/paid
 * breakdown an organiser actually needs for their own accounting.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const requestedUserId = url.searchParams.get("userId")
  const userId = requestedUserId && session.user.role === "admin" ? requestedUserId : session.user.id

  // Optional ledger period (YYYY-MM-DD). Summary figures are always all-time.
  const parseDay = (value: string | null, endOfDay: boolean) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const periodFrom = parseDay(url.searchParams.get("from"), false)
  const periodTo = parseDay(url.searchParams.get("to"), true)

  try {
    const [organizer] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!organizer) {
      return NextResponse.json({ error: "Organizer not found" }, { status: 404 })
    }

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

    const { generatePayoutStatementPdfBuffer } = await import("@/lib/pdf/payout-statement-document")
    const pdfBuffer = await generatePayoutStatementPdfBuffer({
      organizerName: organizer.name ?? "Organiser",
      organizerEmail: organizer.email ?? "",
      generatedAt: new Date(),
      statementNumber: `TP-ST-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${organizer.id.slice(0, 6).toUpperCase()}`,
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
      payouts: payoutRows.map((p) => ({
        ...p,
        amount: Number(p.amount),
        currency: p.currency ?? "USD",
      })),
    })

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TicketPulse_Payout_Statement_${date}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    })
  } catch (err) {
    log.error("payout statement pdf generation failed", { error: String(err) })
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 })
  }
}
