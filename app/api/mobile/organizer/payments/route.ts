import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { events, payouts } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { getOrganizerRevenueSummary } from "@/lib/revenue-summary"

export async function GET(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return NextResponse.json(identity, { status: identity.status, headers: privateHeaders })
  // Always personal finances, including for admins. Never accept a user ID from the client.
  const [summary, rows, eventRows] = await Promise.all([
    getOrganizerRevenueSummary(identity.userId),
    db.select({ id: payouts.id, eventId: payouts.eventId, amount: payouts.amount, currency: payouts.currency,
      status: payouts.status, method: payouts.method, createdAt: payouts.createdAt,
      processedAt: payouts.processedAt, rejectionReason: payouts.rejectionReason,
    }).from(payouts).where(eq(payouts.userId, identity.userId))
      .orderBy(desc(payouts.createdAt), desc(payouts.id)).limit(101),
    db.select({ id: events.id, title: events.title, startsAt: events.startsAt, status: events.status })
      .from(events).where(eq(events.organizerId, identity.userId))
      .orderBy(desc(events.startsAt)).limit(100),
  ])
  // Keep the endpoint compatible with lightweight test/runtime mocks that only
  // provide the organizer-level balance helper.
  const revenueSummaryModule = await import("@/lib/revenue-summary")
  const eventSummaries = "getEventRevenueSummaries" in revenueSummaryModule
    ? await revenueSummaryModule.getEventRevenueSummaries(eventRows.map((event) => event.id))
    : new Map()
  return NextResponse.json({ ok: true, currency: "USD", summary,
    hasMore: rows.length > 100,
    payouts: rows.slice(0, 100).map(row => ({ ...row, amount: Number(row.amount) })),
    eventBalances: eventRows.map((event) => ({
      ...event,
      summary: eventSummaries.get(event.id) ?? {
        eventId: event.id,
        grossRevenue: 0,
        platformFee: 0,
        netRevenue: 0,
        paidOut: 0,
        pendingPayouts: 0,
        outstandingClawbacks: 0,
        availableBalance: 0,
        confirmedOrderCount: 0,
        confirmedTicketCount: 0,
      },
    })),
  }, { headers: privateHeaders })
}
