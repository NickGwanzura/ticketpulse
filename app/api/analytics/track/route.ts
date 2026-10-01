import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { events } from "@/db/schema"
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
    const parsed = z.object({event: z.enum(['EVENT_VIEWED','CHECKOUT_STARTED','BUYER_DETAILS_SUBMITTED','PAYMENT_METHOD_SELECTED']), eventId: z.string().uuid().optional(), eventSlug: z.string().min(1).max(160).optional(), sessionId: z.string().max(160).optional(), referrer: z.string().max(2000).optional(), userAgent: z.string().max(1000).optional()}).safeParse(await req.json())
    if (!parsed.success || (!parsed.data.eventId && !parsed.data.eventSlug)) return NextResponse.json({error:'Invalid analytics event'}, {status:400})
    const {event, sessionId, referrer, userAgent}=parsed.data
    let eventId=parsed.data.eventId
    if (!eventId) {
      const [found]=await db.select({id:events.id}).from(events).where(eq(events.slug,parsed.data.eventSlug!)).limit(1)
      if (!found) return NextResponse.json({error:'Event not found'},{status:404})
      eventId=found.id
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
