import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"

import { db } from "@/db"
import { events, orderItems, orders, reviews, tickets } from "@/db/schema"
import { confirmedOrderStatus } from "@/lib/revenue"

/**
 * Platform-wide key statistics for the admin Key Stats module and the
 * shareable client-facing PDF. Monetary figures are confirmed USD order
 * value, including direct sales, and are distinct from platform ticket revenue.
 */

export type MonthlyRevenuePoint = {
  /** e.g. "Feb 2026" */
  label: string
  revenue: number
  tickets: number
}

export type TopEvent = {
  title: string
  city: string
  startsAt: Date | null
  revenue: number
  ticketsSold: number
}

export type PlatformKeyStats = {
  generatedAt: Date
  grossSales: number
  confirmedOrders: number
  ticketsSold: number
  uniqueAttendees: number
  avgOrderValue: number
  eventsHosted: number
  citiesCovered: number
  organizers: number
  checkIns: number
  avgRating: number | null
  reviewCount: number
  last30: { revenue: number; tickets: number; orders: number }
  monthlyTrend: MonthlyRevenuePoint[]
  topEvents: TopEvent[]
}

const LIVE_EVENT_STATUSES = ["published", "sold_out", "completed"] as const

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function getPlatformKeyStats(): Promise<PlatformKeyStats> {
  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 86400000)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const confirmedUsdOrders = and(
    confirmedOrderStatus,
    sql`COALESCE(${orders.currency}, 'USD') = 'USD'`,
    sql`${orders.paymentMethod} IS DISTINCT FROM 'complimentary'`,
  )
  const settledSince30 = sql`COALESCE(${orders.paidAt}, ${orders.completedAt}) >= ${since30}`

  const [
    [salesRow],
    [ticketRow],
    [attendeeRow],
    [eventRow],
    [checkInRow],
    [reviewRow],
    [last30Row],
    [last30TicketRow],
    monthlyRows,
    topEventRevenueRows,
  ] = await Promise.all([
    db
      .select({
        gross: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(confirmedUsdOrders),
    db
      .select({ count: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(confirmedUsdOrders, eq(orderItems.type, "ticket"))),
    db
      .select({
        count: sql<number>`COUNT(DISTINCT COALESCE(${orders.userId}, LOWER(${orders.guestEmail})))::int`,
      })
      .from(orders)
      .where(confirmedUsdOrders),
    db
      .select({
        count: sql<number>`COUNT(*)::int`,
        cities: sql<number>`COUNT(DISTINCT LOWER(${events.city}))::int`,
        organizers: sql<number>`COUNT(DISTINCT ${events.organizerId})::int`,
      })
      .from(events)
      .where(inArray(events.status, [...LIVE_EVENT_STATUSES])),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tickets)
      .where(and(isNotNull(tickets.scannedAt), eq(tickets.isStaffTicket, false))),
    db
      .select({
        avg: sql<string | null>`AVG(${reviews.rating})`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(reviews)
      .where(eq(reviews.status, "approved")),
    db
      .select({
        revenue: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(and(confirmedUsdOrders, settledSince30)),
    db
      .select({ count: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(confirmedUsdOrders, settledSince30, eq(orderItems.type, "ticket"))),
    db
      .select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', COALESCE(${orders.paidAt}, ${orders.completedAt})), 'YYYY-MM')`,
        revenue: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        orders: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(
        and(
          confirmedUsdOrders,
          sql`COALESCE(${orders.paidAt}, ${orders.completedAt}) >= ${sixMonthsAgo}`,
        ),
      )
      .groupBy(sql`DATE_TRUNC('month', COALESCE(${orders.paidAt}, ${orders.completedAt}))`),
    db
      .select({
        eventId: orders.eventId,
        title: events.title,
        city: events.city,
        startsAt: events.startsAt,
        revenue: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
      })
      .from(orders)
      .innerJoin(events, eq(events.id, orders.eventId))
      .where(confirmedUsdOrders)
      .groupBy(orders.eventId, events.title, events.city, events.startsAt)
      .orderBy(desc(sql`SUM(${orders.totalAmount})`))
      .limit(5),
  ])

  // Ticket counts for the top events (separate query so order totals aren't
  // multiplied by the order_items join).
  const topEventIds = topEventRevenueRows.map((r) => r.eventId)
  const topEventTicketRows = topEventIds.length
    ? await db
        .select({
          eventId: orders.eventId,
          tickets: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            confirmedUsdOrders,
            eq(orderItems.type, "ticket"),
            inArray(orders.eventId, topEventIds),
          ),
        )
        .groupBy(orders.eventId)
    : []
  const ticketsByEvent = new Map(topEventTicketRows.map((r) => [r.eventId, num(r.tickets)]))

  // Monthly ticket counts for the trend.
  const monthlyTicketRows = await db
    .select({
      month: sql<string>`TO_CHAR(DATE_TRUNC('month', COALESCE(${orders.paidAt}, ${orders.completedAt})), 'YYYY-MM')`,
      tickets: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        confirmedUsdOrders,
        eq(orderItems.type, "ticket"),
        sql`COALESCE(${orders.paidAt}, ${orders.completedAt}) >= ${sixMonthsAgo}`,
      ),
    )
    .groupBy(sql`DATE_TRUNC('month', COALESCE(${orders.paidAt}, ${orders.completedAt}))`)

  const revenueByMonth = new Map(monthlyRows.map((r) => [r.month, num(r.revenue)]))
  const ticketsByMonth = new Map(monthlyTicketRows.map((r) => [r.month, num(r.tickets)]))

  // Build a contiguous 6-month series, zero-filling quiet months.
  const monthlyTrend: MonthlyRevenuePoint[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthlyTrend.push({
      label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      revenue: revenueByMonth.get(key) ?? 0,
      tickets: ticketsByMonth.get(key) ?? 0,
    })
  }

  const grossSales = num(salesRow?.gross)
  const confirmedOrders = num(salesRow?.count)

  return {
    generatedAt: now,
    grossSales,
    confirmedOrders,
    ticketsSold: num(ticketRow?.count),
    uniqueAttendees: num(attendeeRow?.count),
    avgOrderValue: confirmedOrders > 0 ? grossSales / confirmedOrders : 0,
    eventsHosted: num(eventRow?.count),
    citiesCovered: num(eventRow?.cities),
    organizers: num(eventRow?.organizers),
    checkIns: num(checkInRow?.count),
    avgRating: reviewRow?.avg != null ? Number(Number(reviewRow.avg).toFixed(1)) : null,
    reviewCount: num(reviewRow?.count),
    last30: {
      revenue: num(last30Row?.revenue),
      orders: num(last30Row?.count),
      tickets: num(last30TicketRow?.count),
    },
    monthlyTrend,
    topEvents: topEventRevenueRows.map((r) => ({
      title: r.title,
      city: r.city,
      startsAt: r.startsAt,
      revenue: num(r.revenue),
      ticketsSold: ticketsByEvent.get(r.eventId) ?? 0,
    })),
  }
}
