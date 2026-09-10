import { and, desc, eq, gte, or, sql } from "drizzle-orm"

import { db } from "@/db"
import { events, orders, paymentLedger } from "@/db/schema"

export type PaymentsApiResponse = {
  stats: {
    todayRevenue: number
    weekRevenue: number
    monthRevenue: number
    allTimeRevenue: number
    prevWeekRevenue: number
    paidCount: number
    failedCount: number
    pendingCount: number
    finishedEventPendingCount: number
    expiredCount: number
    deliveryAttentionCount: number
    duplicateOrderCount: number
    weekDelta: number
    successRate: number
  }
  methods: Array<{
    method: string | null
    paid: number
    failed: number
    pending: number
    expired: number
    total: number
    revenue: number
  }>
  transactions: Array<{
    id: string
    orderId: string
    eventId: string
    eventTitle: string | null
    buyerName: string | null
    buyerEmail: string | null
    orderStatus: string | null
    paymentMethod: string | null
    deliveryStatus: string | null
    amount: string
    currency: string | null
    localStatus: string | null
    processor: string | null
    source: string | null
    createdAt: string | null
    invoiceId: string | null
    errorMessage: string | null
  }>
  pendingPayments: Array<{
    orderId: string
    eventTitle: string | null
    buyerName: string | null
    buyerEmail: string | null
    buyerPhone: string | null
    status: string | null
    paymentMethod: string | null
    amount: string
    currency: string | null
    createdAt: string | null
    updatedAt: string | null
    paymentStatus: string | null
    pollStatus: string | null
    providerHttpStatus: string | null
    providerError: string | null
    consecutiveProviderErrors: number
    transactionTrace: string | null
    eventFinished: boolean
  }>
  sparkPoints: number[]
  page: number
  totalPages: number
  totalTransactions: number
}

const PAGE_SIZE = 25
const settledOrderStatus = sql`${orders.status} IN ('paid', 'completed') AND ${orders.paymentMethod} IS DISTINCT FROM 'complimentary'`
const failedOrderStatus = sql`${orders.status} IN ('cancelled', 'refunded')`
const pendingOrderStatus = sql`${orders.status} IN ('pending', 'awaiting_verification')`
const settledLedgerStatus = sql`${paymentLedger.localStatus} IN ('paid', 'completed', 'success', 'paid_success')`

export async function getAdminPaymentsData(page: number): Promise<PaymentsApiResponse> {
  const safePage = Math.max(1, page)
  const offset = (safePage - 1) * PAGE_SIZE
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    [allTimeRevenue],
    [todayRevenue],
    [weekRevenue],
    [monthRevenue],
    [prevWeekRevenue],
    [paidCount],
    [failedCount],
    [pendingCount],
    [finishedEventPendingCount],
    [expiredCount],
    [deliveryAttention],
    methodRows,
    dailyRevenue,
    recentLedger,
    [ledgerCount],
    pendingOrders,
    duplicateRows,
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` }).from(orders).where(settledOrderStatus),
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` }).from(orders).where(and(settledOrderStatus, gte(orders.paidAt, todayStart))),
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` }).from(orders).where(and(settledOrderStatus, gte(orders.paidAt, sevenDaysAgo))),
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` }).from(orders).where(and(settledOrderStatus, gte(orders.paidAt, thirtyDaysAgo))),
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` }).from(orders).where(and(settledOrderStatus, gte(orders.paidAt, fourteenDaysAgo), sql`${orders.paidAt} < ${sevenDaysAgo}`)),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(orders).where(settledOrderStatus),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(orders).where(failedOrderStatus),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(orders).where(pendingOrderStatus),
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(orders)
      .innerJoin(events, eq(events.id, orders.eventId))
      .where(and(pendingOrderStatus, sql`COALESCE(${events.endsAt}, ${events.startsAt}) <= NOW()`)),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(orders).where(eq(orders.status, "expired")),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(orders).where(and(
      settledOrderStatus,
      or(
        sql`${orders.metadata}->'delivery'->>'status' IN ('FAILED', 'EMAIL_FAILED')`,
        sql`${orders.metadata}->'delivery' IS NULL`,
        sql`${orders.metadata}->>'delivery' IS NULL`,
      ),
    )),
    db.select({
      method: orders.paymentMethod,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${settledOrderStatus})::int`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${failedOrderStatus})::int`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${pendingOrderStatus})::int`,
      expired: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'expired')::int`,
      total: sql<number>`COUNT(*)::int`,
      revenue: sql<string>`COALESCE(SUM(${orders.totalAmount}) FILTER (WHERE ${settledOrderStatus}), 0)`,
    }).from(orders)
      .where(sql`${orders.paymentMethod} IS NOT NULL`)
      .groupBy(orders.paymentMethod)
      .orderBy(orders.paymentMethod),
    db.select({
      day: sql<string>`DATE(${orders.paidAt})`,
      total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    }).from(orders).where(and(settledOrderStatus, gte(orders.paidAt, fourteenDaysAgo)))
      .groupBy(sql`DATE(${orders.paidAt})`).orderBy(sql`DATE(${orders.paidAt})`),
    db.select({
      id: paymentLedger.id,
      orderId: paymentLedger.orderId,
      eventId: paymentLedger.eventId,
      eventTitle: events.title,
      buyerName: sql<string | null>`COALESCE(${orders.guestName}, '')`,
      buyerEmail: orders.guestEmail,
      orderStatus: orders.status,
      paymentMethod: orders.paymentMethod,
      deliveryStatus: sql<string | null>`${orders.metadata}->'delivery'->>'status'`,
      amount: paymentLedger.amount,
      currency: paymentLedger.currency,
      localStatus: paymentLedger.localStatus,
      processor: paymentLedger.processor,
      source: paymentLedger.source,
      createdAt: paymentLedger.createdAt,
      invoiceId: paymentLedger.invoiceId,
      errorMessage: paymentLedger.errorMessage,
    }).from(paymentLedger)
      .leftJoin(orders, eq(paymentLedger.orderId, orders.id))
      .leftJoin(events, eq(paymentLedger.eventId, events.id))
      .orderBy(desc(paymentLedger.createdAt)).limit(PAGE_SIZE).offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(paymentLedger),
    db.select({
      orderId: orders.id,
      eventTitle: events.title,
      buyerName: orders.guestName,
      buyerEmail: orders.guestEmail,
      buyerPhone: orders.guestPhone,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      amount: orders.totalAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      paymentStatus: sql<string | null>`${orders.metadata}->'velocity'->>'paymentStatus'`,
      pollStatus: sql<string | null>`${orders.metadata}->'velocity'->>'pollStatus'`,
      providerHttpStatus: sql<string | null>`${orders.metadata}->'velocity'->>'lastProviderHttpStatus'`,
      providerError: sql<string | null>`${orders.metadata}->'velocity'->>'lastProviderError'`,
      consecutiveProviderErrors: sql<number>`COALESCE((${orders.metadata}->'velocity'->>'consecutiveProviderErrors')::int, 0)`,
      transactionTrace: sql<string | null>`${orders.metadata}->'velocity'->>'transactionTrace'`,
      eventFinished: sql<boolean>`COALESCE(${events.endsAt}, ${events.startsAt}) <= NOW()`,
    }).from(orders)
      .leftJoin(events, eq(orders.eventId, events.id))
      .where(pendingOrderStatus)
      .orderBy(desc(orders.createdAt))
      .limit(50),
    db.select({ orderId: paymentLedger.orderId }).from(paymentLedger)
      .where(settledLedgerStatus).groupBy(paymentLedger.orderId).having(sql`COUNT(*) > 1`),
  ])

  const weekRev = Number(weekRevenue?.total ?? 0)
  const prevWeekRev = Number(prevWeekRevenue?.total ?? 0)
  const totalPaid = paidCount?.count ?? 0
  const totalFailed = failedCount?.count ?? 0
  const totalExpired = expiredCount?.count ?? 0
  const successRate = totalPaid + totalFailed + totalExpired > 0
    ? Math.round((totalPaid / (totalPaid + totalFailed + totalExpired)) * 100)
    : 0
  const weekDelta = prevWeekRev > 0 ? ((weekRev - prevWeekRev) / prevWeekRev) * 100 : weekRev > 0 ? 100 : 0

  const dayMap = new Map<string, number>()
  for (const row of dailyRevenue) dayMap.set(row.day, Number(row.total))
  const sparkPoints: number[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    sparkPoints.push(dayMap.get(d.toISOString().slice(0, 10)) ?? 0)
  }

  return {
    stats: {
      todayRevenue: Number(todayRevenue?.total ?? 0),
      weekRevenue: weekRev,
      monthRevenue: Number(monthRevenue?.total ?? 0),
      allTimeRevenue: Number(allTimeRevenue?.total ?? 0),
      prevWeekRevenue: prevWeekRev,
      paidCount: totalPaid,
      failedCount: totalFailed,
      pendingCount: pendingCount?.count ?? 0,
      finishedEventPendingCount: finishedEventPendingCount?.count ?? 0,
      expiredCount: expiredCount?.count ?? 0,
      deliveryAttentionCount: deliveryAttention?.count ?? 0,
      duplicateOrderCount: duplicateRows.length,
      weekDelta,
      successRate,
    },
    methods: methodRows.map((row) => ({
      method: row.method,
      paid: row.paid,
      failed: row.failed,
      pending: row.pending,
      expired: row.expired,
      total: row.total,
      revenue: Number(row.revenue),
    })),
    transactions: recentLedger.map((row) => ({
      ...row,
      amount: String(row.amount),
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    })),
    pendingPayments: pendingOrders.map((row) => ({
      ...row,
      amount: String(row.amount),
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
      consecutiveProviderErrors: Number(row.consecutiveProviderErrors ?? 0),
    })),
    sparkPoints,
    page: safePage,
    totalPages: Math.max(1, Math.ceil((ledgerCount?.count ?? 0) / PAGE_SIZE)),
    totalTransactions: ledgerCount?.count ?? 0,
  }
}
