import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, and, gt, lte, sql } from "drizzle-orm"
import { db } from "@/db"
import { events, promoCodes } from "@/db/schema"
import { checkoutLimiter } from "@/lib/rate-limit"

const Query = z.object({
  eventSlug: z.string().min(1).max(160),
  code: z.string().min(1).max(40).transform((v) => v.toUpperCase()),
})

export async function GET(req: Request) {
  const rl = await checkoutLimiter.checkRequest(req)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    })
  }

  const url = new URL(req.url)
  const raw = {
    eventSlug: url.searchParams.get("eventSlug"),
    code: url.searchParams.get("code"),
  }

  const parsed = Query.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, error: "Invalid parameters" },
      { status: 400 },
    )
  }

  const { eventSlug, code } = parsed.data

  // Resolve event
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, eventSlug))
    .limit(1)
  if (!event) {
    return NextResponse.json({ valid: false, error: "Event not found" }, { status: 404 })
  }

  // Find promo code
  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(and(eq(promoCodes.code, code), eq(promoCodes.eventId, event.id)))
    .limit(1)

  if (!promo) {
    return NextResponse.json({ valid: false, error: "Invalid promo code" })
  }

  if (!promo.active) {
    return NextResponse.json({ valid: false, error: "This promo code is no longer active" })
  }

  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return NextResponse.json({ valid: false, error: "This promo code has expired" })
  }

  if ((promo.maxUses ?? 0) > 0 && (promo.usedCount ?? 0) >= (promo.maxUses ?? 0)) {
    return NextResponse.json({ valid: false, error: "This promo code has reached its usage limit" })
  }

  return NextResponse.json({
    valid: true,
    type: promo.type,
    value: promo.value.toString(),
    code: promo.code,
  })
}
