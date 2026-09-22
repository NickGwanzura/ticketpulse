import { NextRequest, NextResponse } from "next/server"
import { trackEvent } from "@/lib/analytics"
import { rateLimit } from "@/lib/rate-limit"

const analyticsLimiter = rateLimit({ windowMs: 60_000, max: 120 })

export async function POST(req: NextRequest) {
  const rl = await analyticsLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  try {
    const body = await req.json()
    const { event, eventId, sessionId, referrer, userAgent } = body

    if (!event || !eventId) {
      return NextResponse.json({ error: "Missing event or eventId" }, { status: 400 })
    }

    await trackEvent({
      event,
      eventId,
      sessionId: sessionId ?? null,
      referrer: referrer ?? null,
      userAgent: userAgent ?? req.headers.get("user-agent"),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[analytics/track] error", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
