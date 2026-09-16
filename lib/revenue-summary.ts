import { eq, inArray, sql } from "drizzle-orm"

import { db } from "@/db"
import { events, payouts, payoutClawbacks } from "@/db/schema"
import {
  calculatePlatformFee,
  normalizePlatformFeePercent,
  PLATFORM_FEE_PERCENT,
} from "@/lib/platform-fee"
import { DIRECT_PAYMENT_METHODS } from "@/lib/direct-sale"

export { PLATFORM_FEE_PERCENT, PLATFORM_FEE_RATE } from "@/lib/platform-fee"

/**
 * Canonical revenue maths for the whole app.
 *
 * Every surface that shows organiser/event money — organizer dashboard,
 * organizer event page, payout balances, admin payouts — must use these
 * helpers so the figures agree everywhere:
 *
 *   gross      = issued buyer tickets on paid/completed orders, prorated
 *                from the order item total (matches what was delivered)
 *   fee        = event.platformFeePercent × gross (default 5%)
 *   net        = gross − fee
 *   paidOut    = payouts with status "paid" (incl. manual payouts)
 *   pending    = payouts in pending/approved/processing
 *   clawbacks  = outstanding payout_clawbacks — money already paid out that a
 *                later refund revealed shouldn't have been (see
 *                recordRefundClawback below)
 *   available  = max(0, net − paidOut − pending − clawbacks)
 *
 * The default fee policy lives in lib/platform-fee.ts. Events may override it.
 */

export const ACTIVE_PAYOUT_STATUSES = ["pending", "approved", "processing"] as const

export type RevenueSummary = {
  grossRevenue: number
  platformFee: number
  netRevenue: number
  paidOut: number
  pendingPayouts: number
  outstandingClawbacks: number
  availableBalance: number
  confirmedOrderCount: number
  confirmedTicketCount: number
  /** Effective fee percentage across the revenue included in this summary. */
  commissionRate: number
}

export type EventRevenueSummary = RevenueSummary & { eventId: string }

function money(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0
}

function summarize(base: {
  grossRevenue: number
  platformFee?: number
  commissionRate?: number
  paidOut: number
  pendingPayouts: number
  outstandingClawbacks?: number
  confirmedOrderCount: number
  confirmedTicketCount: number
}): RevenueSummary {
  const grossRevenue = money(base.grossRevenue)
  const platformFee = money(base.platformFee ?? calculatePlatformFee(grossRevenue))
  const netRevenue = money(grossRevenue - platformFee)
  const paidOut = money(base.paidOut)
  const pendingPayouts = money(base.pendingPayouts)
  const outstandingClawbacks = money(base.outstandingClawbacks ?? 0)
  return {
    grossRevenue,
    platformFee,
    netRevenue,
    paidOut,
    pendingPayouts,
    outstandingClawbacks,
    availableBalance: money(Math.max(0, netRevenue - paidOut - pendingPayouts - outstandingClawbacks)),
    confirmedOrderCount: base.confirmedOrderCount,
    confirmedTicketCount: base.confirmedTicketCount,
    commissionRate: Number((base.commissionRate ?? (grossRevenue > 0 ? (platformFee / grossRevenue) * 100 : PLATFORM_FEE_PERCENT)).toFixed(2)),
  }
}

/**
 * Sum of outstanding payout_clawbacks per event.
 */
async function getOutstandingClawbacksByEvent(eventIds: string[]): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map()
  const rows = await db
    .select({
      eventId: payoutClawbacks.eventId,
      amount: sql<string>`COALESCE(SUM(${payoutClawbacks.amount}), 0)`,
    })
    .from(payoutClawbacks)
    .where(sql`${payoutClawbacks.eventId} IN (${sql.join(eventIds.map((id) => sql`${id}`), sql`, `)}) AND ${payoutClawbacks.status} = 'outstanding'`)
    .groupBy(payoutClawbacks.eventId)
  return new Map(rows.map((r) => [r.eventId ?? "", Number(r.amount ?? 0)]))
}

/**
 * Create (or top up) a payout clawback for an event/organiser when a refund
 * reveals that money already paid out now exceeds net platform revenue.
 * Only records the *new* shortfall since the last time this ran, so calling
 * it after every refund never double-counts an already-tracked shortfall.
 */
export async function recordRefundClawback(opts: {
  eventId: string
  organizerId: string
  orderId: string
  reason: string
  performedBy: string
}): Promise<{ created: boolean; amount: number }> {
  const [summary] = await Promise.all([
    getEventRevenueSummaries([opts.eventId]).then((m) => m.get(opts.eventId)),
  ])
  if (!summary) return { created: false, amount: 0 }

  // netRevenue/paidOut here already reflect the refund (revenue-summary
  // re-aggregates live off ticket/order status) but availableBalance was
  // already clamped — recompute the raw shortfall directly.
  const rawShortfall = summary.paidOut - summary.netRevenue
  const newShortfall = money(Math.max(0, rawShortfall - summary.outstandingClawbacks))

  if (newShortfall <= 0) return { created: false, amount: 0 }

  await db.insert(payoutClawbacks).values({
    orderId: opts.orderId,
    eventId: opts.eventId,
    organizerId: opts.organizerId,
    amount: newShortfall.toFixed(2),
    currency: "USD",
    reason: opts.reason,
    createdBy: opts.performedBy,
  })

  return { created: true, amount: newShortfall }
}

type GrossRow = {
  eventId: string
  grossRevenue: number
  platformFeePercent: number
  confirmedOrderCount: number
  confirmedTicketCount: number
}

/**
 * Issued-ticket revenue per event: each ticket order item contributes
 * `min(issued, quantity) × (total / quantity)` so the gross only counts
 * tickets that were actually delivered on confirmed (paid/completed) orders.
 */
async function getGrossByEvent(filter: { eventIds?: string[]; organizerId?: string }): Promise<GrossRow[]> {
  if (filter.eventIds && filter.eventIds.length === 0) return []

  const eventCondition = filter.eventIds
    ? sql`o.event_id IN (${sql.join(filter.eventIds.map((id) => sql`${id}`), sql`, `)})`
    : sql`e.organizer_id = ${filter.organizerId}`

  const result = await db.execute(sql`
    WITH ticket_items AS (
      SELECT
        oi.id,
        oi.order_id,
        o.event_id,
        e.platform_fee_percent,
        oi.quantity,
        oi.total,
        COUNT(t.id)::int AS issued_count
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      INNER JOIN events e ON e.id = o.event_id
      LEFT JOIN tickets t
        ON t.order_id = o.id
       AND t.tier_id = oi.tier_id
       AND t.is_staff_ticket = false
       AND t.status IN ('sold', 'used')
      WHERE ${eventCondition}
        AND o.status IN ('paid', 'completed')
        AND oi.type = 'ticket'
        AND oi.quantity > 0
        -- Organiser-direct sales: the buyer paid the organiser directly, we only
        -- issued the ticket, so no money passed through us to owe the organiser
        -- for. Excluded here; tracked instead in organizer_fee_dues. Covers every
        -- direct-payment method string, not just the literal "organizer_direct".
        AND (o.payment_method IS NULL OR o.payment_method NOT IN (${sql.join([...DIRECT_PAYMENT_METHODS, "complimentary"].map((m) => sql`${m}`), sql`, `)}))
      GROUP BY oi.id, oi.order_id, o.event_id, e.platform_fee_percent, oi.quantity, oi.total
    )
    SELECT
      event_id,
      COALESCE(MAX(platform_fee_percent), 5.00)::numeric AS platform_fee_percent,
      COALESCE(SUM(LEAST(issued_count, quantity) * (total::numeric / NULLIF(quantity, 0))), 0)::numeric AS gross_revenue,
      COALESCE(SUM(LEAST(issued_count, quantity)), 0)::int AS confirmed_ticket_count,
      COUNT(DISTINCT CASE WHEN LEAST(issued_count, quantity) > 0 THEN order_id END)::int AS confirmed_order_count
    FROM ticket_items
    GROUP BY event_id
  `)

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    eventId: String(row.event_id),
    platformFeePercent: normalizePlatformFeePercent(String(row.platform_fee_percent ?? "")),
    grossRevenue: Number(row.gross_revenue ?? 0),
    confirmedOrderCount: Number(row.confirmed_order_count ?? 0),
    confirmedTicketCount: Number(row.confirmed_ticket_count ?? 0),
  }))
}

/**
 * Per-event summaries. Payout figures count payouts linked to the event
 * (`payouts.event_id`), which includes manual payouts recorded by admins.
 */
export async function getEventRevenueSummaries(eventIds: string[]): Promise<Map<string, EventRevenueSummary>> {
  if (eventIds.length === 0) return new Map()

  const [grossRows, feeRows, payoutRows, clawbacksByEvent] = await Promise.all([
    getGrossByEvent({ eventIds }),
    db
      .select({ id: events.id, platformFeePercent: events.platformFeePercent })
      .from(events)
      .where(inArray(events.id, eventIds)),
    db
      .select({
        eventId: payouts.eventId,
        paid: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} = 'paid' THEN ${payouts.amount} ELSE 0 END), 0)`,
        pending: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} IN ('pending', 'approved', 'processing') THEN ${payouts.amount} ELSE 0 END), 0)`,
      })
      .from(payouts)
      .where(inArray(payouts.eventId, eventIds))
      .groupBy(payouts.eventId),
    getOutstandingClawbacksByEvent(eventIds),
  ])

  const grossByEvent = new Map(grossRows.map((row) => [row.eventId, row]))
  const feeByEvent = new Map(feeRows.map((row) => [row.id, normalizePlatformFeePercent(row.platformFeePercent)]))
  const payoutsByEvent = new Map(payoutRows.map((row) => [row.eventId ?? "", row]))

  return new Map(eventIds.map((eventId) => {
    const gross = grossByEvent.get(eventId)
    const payout = payoutsByEvent.get(eventId)
    const commissionRate = feeByEvent.get(eventId) ?? gross?.platformFeePercent ?? PLATFORM_FEE_PERCENT
    return [eventId, {
      eventId,
      ...summarize({
        grossRevenue: gross?.grossRevenue ?? 0,
        platformFee: calculatePlatformFee(gross?.grossRevenue ?? 0, commissionRate / 100),
        commissionRate,
        paidOut: Number(payout?.paid ?? 0),
        pendingPayouts: Number(payout?.pending ?? 0),
        outstandingClawbacks: clawbacksByEvent.get(eventId) ?? 0,
        confirmedOrderCount: gross?.confirmedOrderCount ?? 0,
        confirmedTicketCount: gross?.confirmedTicketCount ?? 0,
      }),
    }]
  }))
}

/**
 * Organiser-level summary across all events they own. Payout figures count
 * every payout for the organiser (`payouts.user_id`), whether or not it was
 * linked to a specific event.
 */
export async function getOrganizerRevenueSummary(userId: string): Promise<RevenueSummary> {
  const [grossRows, payoutRows, clawbackRows] = await Promise.all([
    getGrossByEvent({ organizerId: userId }),
    db
      .select({
        paid: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} = 'paid' THEN ${payouts.amount} ELSE 0 END), 0)`,
        pending: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} IN ('pending', 'approved', 'processing') THEN ${payouts.amount} ELSE 0 END), 0)`,
      })
      .from(payouts)
      .where(eq(payouts.userId, userId)),
    db
      .select({
        amount: sql<string>`COALESCE(SUM(${payoutClawbacks.amount}), 0)`,
      })
      .from(payoutClawbacks)
      .where(sql`${payoutClawbacks.organizerId} = ${userId} AND ${payoutClawbacks.status} = 'outstanding'`),
  ])

  const grossRevenue = grossRows.reduce((sum, row) => sum + row.grossRevenue, 0)
  const platformFee = grossRows.reduce(
    (sum, row) => sum + calculatePlatformFee(row.grossRevenue, row.platformFeePercent / 100),
    0,
  )

  return summarize({
    grossRevenue,
    platformFee,
    commissionRate: grossRevenue > 0 ? (platformFee / grossRevenue) * 100 : PLATFORM_FEE_PERCENT,
    paidOut: Number(payoutRows[0]?.paid ?? 0),
    pendingPayouts: Number(payoutRows[0]?.pending ?? 0),
    outstandingClawbacks: Number(clawbackRows[0]?.amount ?? 0),
    confirmedOrderCount: grossRows.reduce((sum, row) => sum + row.confirmedOrderCount, 0),
    confirmedTicketCount: grossRows.reduce((sum, row) => sum + row.confirmedTicketCount, 0),
  })
}
