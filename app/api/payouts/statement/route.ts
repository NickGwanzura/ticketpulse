import { NextResponse } from "next/server"
import { and, eq, desc } from "drizzle-orm"

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
  const eventId = url.searchParams.get("eventId")
  let userId = requestedUserId && session.user.role === "admin" ? requestedUserId : session.user.id
  let eventTitle: string | undefined

  try {
    if (eventId) {
      // `events.id` is a UUID column; reject malformed input before it reaches Postgres.
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
        return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
      }

      const [event] = await db
        .select({ id: events.id, title: events.title, organizerId: events.organizerId })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1)

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 })
      }
      if (session.user.role !== "admin" && event.organizerId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      if (requestedUserId && session.user.role === "admin" && requestedUserId !== event.organizerId) {
        return NextResponse.json({ error: "Event does not belong to the requested organiser" }, { status: 400 })
      }

      userId = event.organizerId
      eventTitle = event.title
    }

    const [organizer] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!organizer) {
      return NextResponse.json({ error: "Organizer not found" }, { status: 404 })
    }

    const summary = eventId
      ? (await getEventRevenueSummaries([eventId])).get(eventId)
      : await getOrganizerRevenueSummary(userId)

    if (!summary) {
      return NextResponse.json({ error: "Statement data not found" }, { status: 404 })
    }

    const payoutRows = await db
      .select({
        id: payouts.id,
        amount: payouts.amount,
        currency: payouts.currency,
        status: payouts.status,
        method: payouts.method,
        recipientName: payouts.accountName,
        reference: payouts.proofReference,
        eventTitle: events.title,
        createdAt: payouts.createdAt,
        processedAt: payouts.processedAt,
      })
      .from(payouts)
      .leftJoin(events, eq(events.id, payouts.eventId))
      .where(eventId
        ? and(eq(payouts.userId, userId), eq(payouts.eventId, eventId))
        : eq(payouts.userId, userId))
      .orderBy(desc(payouts.createdAt))

    const { generatePayoutStatementPdfBuffer } = await import("@/lib/pdf/payout-statement-document")
    const pdfBuffer = await generatePayoutStatementPdfBuffer({
      organizerName: organizer.name ?? "Organiser",
      organizerEmail: organizer.email ?? "",
      eventTitle,
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
    const eventFilename = eventTitle
      ? `_${eventTitle.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60)}`
      : ""
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TicketPulse_Payout_Statement${eventFilename}_${date}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    })
  } catch (err) {
    log.error("payout statement pdf generation failed", { error: String(err) })
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 })
  }
}
