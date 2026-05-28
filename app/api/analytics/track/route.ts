import { NextRequest, NextResponse } from "next/server"
import { trackEvent } from "@/lib/analytics"

export async function POST(req: NextRequest) {
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
