import { NextResponse } from "next/server"
import { eq, sql, and, or, gte, desc } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, paymentLedger } from "@/db/schema"

export type PaymentsApiResponse = {
  stats: {
    todayRevenue: number
    weekRevenue: number
    monthRevenue: number
    allTimeRevenue: number
    prevWeekRevenue: number
    paidCount: number
    failedCount: number
    weekDelta: number
    successRate: number
  }
  methods: Array<{
    method: string | null
    paid: number
    total: number
    revenue: number
  }>
  transactions: Array<{
    id: string
    orderId: string
    eventId: string
    amount: string
    currency: string | null
    localStatus: string | null
    processor: string | null
    source: string | null
    createdAt: string | null
    invoiceId: string | null
  }>
  sparkPoints: number[]
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const confirmedOrderStatus = or(
    eq(orders.status, "paid"),
    eq(orders.status, "completed"),
  )!

  const [
    [allTimeRevenue],
    [todayRevenue],
    [weekRevenue],
    [monthRevenue],
    [prevWeekRevenue],
    [paidCount],
    [failedCount],
    methodRows,
    dailyRevenue,
    recentLedger,
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(confirmedOrderStatus),

    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(confirmedOrderStatus, gte(orders.paidAt, todayStart))),

    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(confirmedOrderStatus, gte(orders.paidAt, sevenDaysAgo))),

    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(confirmedOrderStatus, gte(orders.paidAt, thirtyDaysAgo))),

    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(confirmedOrderStatus, gte(orders.paidAt, fourteenDaysAgo), sql`${orders.paidAt} < ${sevenDaysAgo}`)),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(paymentLedger).where(eq(paymentLedger.localStatus, "paid")),

    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(paymentLedger).where(eq(paymentLedger.localStatus, "failed")),

    db.select({
      method: orders.paymentMethod,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('paid', 'completed'))::int`,
      total: sql<number>`COUNT(*)::int`,
      revenue: sql<string>`COALESCE(SUM(${orders.totalAmount}) FILTER (WHERE ${orders.status} IN ('paid', 'completed')), 0)`,
    }).from(orders)
      .where(sql`${orders.paymentMethod} IS NOT NULL`)
      .groupBy(orders.paymentMethod)
      .orderBy(orders.paymentMethod),

    db.select({
      day: sql<string>`DATE(${orders.paidAt})`,
      total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    }).from(orders)
      .where(and(confirmedOrderStatus, gte(orders.paidAt, fourteenDaysAgo)))
      .groupBy(sql`DATE(${orders.paidAt})`)
      .orderBy(sql`DATE(${orders.paidAt})`),

    db.select({
      id: paymentLedger.id,
      orderId: paymentLedger.orderId,
      eventId: paymentLedger.eventId,
      amount: paymentLedger.amount,
      currency: paymentLedger.currency,
      localStatus: paymentLedger.localStatus,
      processor: paymentLedger.processor,
      source: paymentLedger.source,
      createdAt: paymentLedger.createdAt,
      invoiceId: paymentLedger.invoiceId,
    }).from(paymentLedger)
      .orderBy(desc(paymentLedger.createdAt))
      .limit(50),
  ])

  // ── Derived stats ─────────────────────────────────────────────────────────
  const weekRev = Number(weekRevenue?.total ?? 0)
  const prevWeekRev = Number(prevWeekRevenue?.total ?? 0)
  const totalPaid = paidCount?.count ?? 0
  const totalFailed = failedCount?.count ?? 0

  const successRate = totalPaid + totalFailed > 0
    ? Math.round((totalPaid / (totalPaid + totalFailed)) * 100)
    : totalPaid ? 100 : 0

  const weekDelta = prevWeekRev > 0
    ? ((weekRev - prevWeekRev) / prevWeekRev) * 100
    : weekRev > 0 ? 100 : 0

  // Sparkline
  const dayMap = new Map<string, number>()
  for (const r of dailyRevenue) dayMap.set(r.day, Number(r.total))
  const sparkPoints: number[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    sparkPoints.push(dayMap.get(d.toISOString().slice(0, 10)) ?? 0)
  }

  return NextResponse.json({
    stats: {
      todayRevenue: Number(todayRevenue?.total ?? 0),
      weekRevenue: weekRev,
      monthRevenue: Number(monthRevenue?.total ?? 0),
      allTimeRevenue: Number(allTimeRevenue?.total ?? 0),
      prevWeekRevenue: prevWeekRev,
      paidCount: totalPaid,
      failedCount: totalFailed,
      weekDelta,
      successRate,
    },
    methods: methodRows.map((m) => ({
      method: m.method,
      paid: m.paid,
      total: m.total,
      revenue: Number(m.revenue),
    })),
    transactions: recentLedger.map((t) => ({
      ...t,
      amount: String(t.amount),
      createdAt: t.createdAt ? t.createdAt.toISOString() : null,
    })),
    sparkPoints,
  } as PaymentsApiResponse)
}
