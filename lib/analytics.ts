import { db } from "@/db"
import { analyticsEvents } from "@/db/schema"
import { sql, and, eq, gte } from "drizzle-orm"
import { log } from "@/lib/logger"

export type AnalyticsEventType =
  | "EVENT_VIEWED"
  | "CHECKOUT_STARTED"
  | "BUYER_DETAILS_SUBMITTED"
  | "PAYMENT_METHOD_SELECTED"
  | "PAYMENT_INITIATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_FAILED"
  | "ORDER_ABANDONED"
  | "TICKET_ISSUED"
  | "TICKET_CHECKED_IN"

interface TrackEventInput {
  event: AnalyticsEventType
  eventId: string
  organizerId?: string | null
  orderId?: string | null
  sessionId?: string | null
  buyerEmail?: string | null
  paymentMethod?: string | null
  ticketType?: string | null
  amount?: number | null
  referrer?: string | null
  userAgent?: string | null
  source?: string | null
  metadata?: Record<string, unknown> | null
}

export async function trackEvent(input: TrackEventInput) {
  try {
    await db.insert(analyticsEvents).values({
      event: input.event,
      eventId: input.eventId,
      organizerId: input.organizerId ?? null,
      orderId: input.orderId ?? null,
      sessionId: input.sessionId ?? null,
      buyerEmail: input.buyerEmail ?? null,
      paymentMethod: input.paymentMethod ?? null,
      ticketType: input.ticketType ?? null,
      amount: input.amount != null ? input.amount.toFixed(2) : null,
      referrer: input.referrer ?? null,
      userAgent: input.userAgent ?? null,
      source: input.source ?? null,
      metadata: input.metadata ?? null,
    })
  } catch (err) {
    console.error("[analytics] trackEvent failed", err)
    log.error("analytics — trackEvent failed", { error: err instanceof Error ? err.message : String(err) })
  }
}

export async function getFunnelStats({
  eventId,
  days = 90,
}: {
  eventId: string
  days?: number
}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      event: analyticsEvents.event,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.eventId, eventId),
        gte(analyticsEvents.createdAt, since),
      ),
    )
    .groupBy(analyticsEvents.event)

  const map = new Map<string, number>()
  for (const r of rows) map.set(r.event, r.count)

  const views = map.get("EVENT_VIEWED") ?? 0
  const checkoutStarts = map.get("CHECKOUT_STARTED") ?? 0
  const detailsSubmitted = map.get("BUYER_DETAILS_SUBMITTED") ?? 0
  const methodSelected = map.get("PAYMENT_METHOD_SELECTED") ?? 0
  const initiated = map.get("PAYMENT_INITIATED") ?? 0
  const confirmed = map.get("PAYMENT_CONFIRMED") ?? 0
  const failed = map.get("PAYMENT_FAILED") ?? 0
  const abandoned = map.get("ORDER_ABANDONED") ?? 0
  const issued = map.get("TICKET_ISSUED") ?? 0
  const checkedIn = map.get("TICKET_CHECKED_IN") ?? 0

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

  return {
    raw: { views, checkoutStarts, detailsSubmitted, methodSelected, initiated, confirmed, failed, abandoned, issued, checkedIn },
    funnel: [
      { stage: "Event viewed", count: views },
      { stage: "Checkout started", count: checkoutStarts, dropoff: pct(checkoutStarts, views) },
      { stage: "Details submitted", count: detailsSubmitted, dropoff: pct(detailsSubmitted, checkoutStarts) },
      { stage: "Payment method selected", count: methodSelected, dropoff: pct(methodSelected, detailsSubmitted) },
      { stage: "Payment initiated", count: initiated, dropoff: pct(initiated, methodSelected) },
      { stage: "Payment confirmed", count: confirmed, dropoff: pct(confirmed, initiated) },
      { stage: "Ticket issued", count: issued, dropoff: pct(issued, confirmed) },
      { stage: "Checked in", count: checkedIn, dropoff: pct(checkedIn, issued) },
    ],
    conversions: {
      "Views to checkout": pct(checkoutStarts, views),
      "Checkout to payment": pct(initiated, checkoutStarts),
      "Payment success rate": pct(confirmed, initiated + failed),
      "Payment to ticket": pct(issued, confirmed),
      "Ticket to check-in": pct(checkedIn, issued),
    },
    paymentBreakdown: { successful: confirmed, failed, abandoned },
  }
}
