import { NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { payouts, users, events } from "@/db/schema"
import { getOrganizerRevenueSummary } from "@/lib/revenue-summary"
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
      })
      .from(payouts)
      .leftJoin(events, eq(events.id, payouts.eventId))
      .where(eq(payouts.userId, userId))
      .orderBy(desc(payouts.createdAt))

    const { generatePayoutStatementPdfBuffer } = await import("@/lib/pdf/payout-statement-document")
    const pdfBuffer = await generatePayoutStatementPdfBuffer({
      organizerName: organizer.name ?? "Organiser",
      organizerEmail: organizer.email ?? "",
      generatedAt: new Date(),
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
