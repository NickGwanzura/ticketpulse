import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { payouts } from "@/db/schema"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { ACTIVE_PAYOUT_STATUSES } from "@/lib/payout-request"
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
      accountNumber: payouts.accountNumber, accountName: payouts.accountName, bankName: payouts.bankName,
    }).from(payouts).where(eq(payouts.userId, identity.userId))
      .orderBy(desc(payouts.createdAt), desc(payouts.id)).limit(101),
  ])

  // Only one payout can be in flight; the app disables "Request payout" while it is.
  const activePayout = rows.some((row) => (ACTIVE_PAYOUT_STATUSES as readonly string[]).includes(row.status))
  // Prefill the request form with where the organizer was last paid.
  const last = rows.find((row) => row.method === "ecocash" || row.method === "bank_usd")
  const lastDestination = last
    ? last.method === "ecocash"
      ? { method: "ecocash", ecocashNumber: last.accountNumber }
      : { method: "bank_usd", accountNumber: last.accountNumber, accountName: last.accountName, bankName: last.bankName }
    : null

  return NextResponse.json({ ok: true, currency: "USD", summary,
    activePayout,
    lastDestination,
    hasMore: rows.length > 100,
    // Account details stay out of the history list; only lastDestination carries them.
    payouts: rows.slice(0, 100).map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      method: row.method,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
      rejectionReason: row.rejectionReason,
    })),
  }, { headers: privateHeaders })
}
