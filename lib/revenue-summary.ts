import { eq, inArray, sql } from "drizzle-orm"

import { db } from "@/db"
import { payouts } from "@/db/schema"
import {
  calculateOrganizerNet,
  calculatePlatformFee,
} from "@/lib/platform-fee"

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
 *   fee        = PLATFORM_FEE_RATE × gross
 *   net        = gross − fee
 *   paidOut    = payouts with status "paid" (incl. manual payouts)
 *   pending    = payouts in pending/approved/processing
 *   available  = max(0, net − paidOut − pending)
 *
 * The fee policy lives in lib/platform-fee.ts and is fixed system-wide.
 */

export const ACTIVE_PAYOUT_STATUSES = ["pending", "approved", "processing"] as const

export type RevenueSummary = {
  grossRevenue: number
  platformFee: number
  netRevenue: number
  paidOut: number
  pendingPayouts: number
  availableBalance: number
  confirmedOrderCount: number
  confirmedTicketCount: number
}

export type EventRevenueSummary = RevenueSummary & { eventId: string }

function money(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0
}

function summarize(base: {
  grossRevenue: number
  paidOut: number
  pendingPayouts: number
  confirmedOrderCount: number
  confirmedTicketCount: number
}): RevenueSummary {
  const grossRevenue = money(base.grossRevenue)
  const platformFee = calculatePlatformFee(grossRevenue)
  const netRevenue = calculateOrganizerNet(grossRevenue)
  const paidOut = money(base.paidOut)
  const pendingPayouts = money(base.pendingPayouts)
  return {
    grossRevenue,
    platformFee,
    netRevenue,
    paidOut,
    pendingPayouts,
    availableBalance: money(Math.max(0, netRevenue - paidOut - pendingPayouts)),
    confirmedOrderCount: base.confirmedOrderCount,
    confirmedTicketCount: base.confirmedTicketCount,
  }
}

type GrossRow = {
  eventId: string
  grossRevenue: number
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
        -- for. Excluded here; tracked instead in organizer_fee_dues.
        AND o.payment_method IS DISTINCT FROM 'organizer_direct'
      GROUP BY oi.id, oi.order_id, o.event_id, oi.quantity, oi.total
    )
    SELECT
      event_id,
      COALESCE(SUM(LEAST(issued_count, quantity) * (total::numeric / NULLIF(quantity, 0))), 0)::numeric AS gross_revenue,
      COALESCE(SUM(LEAST(issued_count, quantity)), 0)::int AS confirmed_ticket_count,
      COUNT(DISTINCT CASE WHEN LEAST(issued_count, quantity) > 0 THEN order_id END)::int AS confirmed_order_count
    FROM ticket_items
    GROUP BY event_id
  `)

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    eventId: String(row.event_id),
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

  const [grossRows, payoutRows] = await Promise.all([
    getGrossByEvent({ eventIds }),
    db
      .select({
        eventId: payouts.eventId,
        paid: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} = 'paid' THEN ${payouts.amount} ELSE 0 END), 0)`,
        pending: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} IN ('pending', 'approved', 'processing') THEN ${payouts.amount} ELSE 0 END), 0)`,
      })
      .from(payouts)
      .where(inArray(payouts.eventId, eventIds))
      .groupBy(payouts.eventId),
  ])

  const grossByEvent = new Map(grossRows.map((row) => [row.eventId, row]))
  const payoutsByEvent = new Map(payoutRows.map((row) => [row.eventId ?? "", row]))

  return new Map(eventIds.map((eventId) => {
    const gross = grossByEvent.get(eventId)
    const payout = payoutsByEvent.get(eventId)
    return [eventId, {
      eventId,
      ...summarize({
        grossRevenue: gross?.grossRevenue ?? 0,
        paidOut: Number(payout?.paid ?? 0),
        pendingPayouts: Number(payout?.pending ?? 0),
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
  const [grossRows, payoutRows] = await Promise.all([
    getGrossByEvent({ organizerId: userId }),
    db
      .select({
        paid: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} = 'paid' THEN ${payouts.amount} ELSE 0 END), 0)`,
        pending: sql<string>`COALESCE(SUM(CASE WHEN ${payouts.status} IN ('pending', 'approved', 'processing') THEN ${payouts.amount} ELSE 0 END), 0)`,
      })
      .from(payouts)
      .where(eq(payouts.userId, userId)),
  ])

  return summarize({
    grossRevenue: grossRows.reduce((sum, row) => sum + row.grossRevenue, 0),
    paidOut: Number(payoutRows[0]?.paid ?? 0),
    pendingPayouts: Number(payoutRows[0]?.pending ?? 0),
    confirmedOrderCount: grossRows.reduce((sum, row) => sum + row.confirmedOrderCount, 0),
    confirmedTicketCount: grossRows.reduce((sum, row) => sum + row.confirmedTicketCount, 0),
  })
}
