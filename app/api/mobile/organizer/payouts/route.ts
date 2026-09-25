import { NextResponse } from "next/server"
import { authenticateOrganizer, privateHeaders } from "@/lib/mobile-organizer"
import { submitPayoutRequest } from "@/lib/payout-request"
import { rateLimit } from "@/lib/rate-limit"

// A payout request sends emails and writes an audit record; keep retries sane.
const limiter = rateLimit({ windowMs: 60_000, max: 5 })

/**
 * Request a payout from the organizer mobile app. Uses the same validation,
 * balance check and one-active-request rule as the website
 * (lib/payout-request.ts). The payout is always for the signed-in user.
 */
export async function POST(request: Request) {
  const identity = await authenticateOrganizer(request)
  if (!identity.ok) return NextResponse.json(identity, { status: identity.status, headers: privateHeaders })

  if (!(await limiter.checkDistributed(`mobile-payout:${identity.userId}`)).allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many payout attempts. Please wait a minute." },
      { status: 429, headers: privateHeaders },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid payout request." }, { status: 400, headers: privateHeaders })
  }
  const input = body as Record<string, unknown>

  const result = await submitPayoutRequest(identity.userId, identity.email ?? identity.userId, {
    amount: input.amount,
    currency: input.currency ?? "USD",
    method: input.method,
    ecocashNumber: input.ecocashNumber,
    accountNumber: input.accountNumber,
    accountName: input.accountName,
    bankName: input.bankName,
  })

  return NextResponse.json(
    result.ok
      ? { ok: true, message: result.message, payoutId: result.payoutId }
      : { ok: false, error: result.message },
    { status: result.ok ? 201 : 400, headers: privateHeaders },
  )
}
