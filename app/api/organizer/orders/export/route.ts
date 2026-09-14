import { NextResponse } from "next/server"
import { eq, inArray, or } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { eventOrganisers, events, users } from "@/db/schema"
import { generateOrdersReconPdfBuffer } from "@/lib/pdf/orders-report"
import { getOrdersReconReport } from "@/lib/orders-recon-report"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const isAdmin = session.user.role === "admin"
  if (!isAdmin && session.user.role === "organizer") {
    const [account] = await db
      .select({ frozenAt: users.organizerFrozenAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    if (account?.frozenAt) return NextResponse.json({ error: "Organizer access is temporarily frozen" }, { status: 403 })
  }
  const invitedEventIds = isAdmin ? [] : await db
    .select({ eventId: eventOrganisers.eventId })
    .from(eventOrganisers)
    .where(eq(eventOrganisers.userId, session.user.id))

  const ownedIds = invitedEventIds.map((row) => row.eventId)
  const eventRows = await db
    .select({ id: events.id })
    .from(events)
    .where(
      isAdmin
        ? undefined
        : ownedIds.length > 0
          ? or(eq(events.organizerId, session.user.id), inArray(events.id, ownedIds))
          : eq(events.organizerId, session.user.id),
    )

  if (!isAdmin && session.user.role !== "organizer" && ownedIds.length === 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const report = await getOrdersReconReport({
    title: "Organizer orders reconciliation",
    scope: isAdmin ? "All organizer orders" : "Organizer-accessible events",
    generatedBy: session.user.email ?? session.user.name ?? "organizer",
    search: params.get("q") ?? undefined,
    status: params.get("status") ?? "all",
    eventIds: eventRows.map((row) => row.id),
  })
  const stamp = report.generatedAt.toISOString().slice(0, 10)
  const pdf = await generateOrdersReconPdfBuffer(report)

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="organizer-orders-reconciliation-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
