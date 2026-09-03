import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { payouts } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { getOrganizerRevenueSummary } from "@/lib/revenue-summary"

export async function GET(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return NextResponse.json(identity, { status: identity.status, headers: privateHeaders })
  // Always personal finances, including for admins. Never accept a user ID from the client.
  const [summary, rows] = await Promise.all([
    getOrganizerRevenueSummary(identity.userId),
    db.select({ id: payouts.id, amount: payouts.amount, currency: payouts.currency,
      status: payouts.status, method: payouts.method, createdAt: payouts.createdAt,
      processedAt: payouts.processedAt, rejectionReason: payouts.rejectionReason,
    }).from(payouts).where(eq(payouts.userId, identity.userId))
      .orderBy(desc(payouts.createdAt), desc(payouts.id)).limit(101),
  ])
  return NextResponse.json({ ok: true, currency: "USD", summary,
    hasMore: rows.length > 100,
    payouts: rows.slice(0, 100).map(row => ({ ...row, amount: Number(row.amount) })),
  }, { headers: privateHeaders })
}
