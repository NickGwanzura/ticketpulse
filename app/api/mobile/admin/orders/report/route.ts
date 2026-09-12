import { NextResponse } from "next/server"
import { eq, inArray, or } from "drizzle-orm"
import { db } from "@/db"
import { eventOrganisers, events } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { getOrdersReconReport } from "@/lib/orders-recon-report"

export async function GET(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return NextResponse.json(identity, { status: identity.status, headers: privateHeaders })
  const params = new URL(request.url).searchParams
  const isAdmin = identity.role === "admin"
  let accessibleEvents
  if (isAdmin) {
    accessibleEvents = await db.select({ id: events.id }).from(events)
  } else {
    const invited = await db.select({ eventId: eventOrganisers.eventId }).from(eventOrganisers).where(eq(eventOrganisers.userId, identity.userId))
    accessibleEvents = await db.select({ id: events.id }).from(events).where(
      invited.length > 0 ? or(eq(events.organizerId, identity.userId), inArray(events.id, invited.map((row) => row.eventId))) : eq(events.organizerId, identity.userId),
    )
  }
  const report = await getOrdersReconReport({
    title: isAdmin ? "Platform orders reconciliation" : "Organizer orders reconciliation",
    scope: isAdmin ? "All platform orders" : "Organizer-accessible events",
    generatedBy: identity.email,
    search: params.get("q") ?? undefined,
    status: params.get("status") ?? "all",
    eventIds: accessibleEvents.map((event) => event.id),
  })
  return NextResponse.json({
    ok: true,
    generatedAt: report.generatedAt.toISOString(),
    totals: report.totals,
    rows: report.rows,
  }, { headers: privateHeaders })
}
