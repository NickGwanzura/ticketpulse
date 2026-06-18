import { redirect } from "next/navigation"
import Link from "next/link"
import {
  DollarSign, CreditCard, TrendingUp, CheckCircle2, AlertTriangle,
  Smartphone, Activity, ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import { eq, sql, and, gte, desc, count, sum } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events, paymentLedger } from "@/db/schema"
import { formatCurrency } from "@/lib/utils"
import { confirmedOrderStatus, paymentTimeSince } from "@/lib/revenue"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: typeof DollarSign
  label: string
  value: string
  sub?: string
  positive?: boolean
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</span>
        <Icon size={16} className="text-ink-2" />
      </div>
      <p className="text-[26px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
      {sub && (
        <div className="flex items-center gap-1.5">
          {positive !== undefined && (
            positive
              ? <ArrowUpRight size={13} className="text-emerald-600" />
              : <ArrowDownRight size={13} className="text-rose-600" />
          )}
          <span className={`text-[12px] font-medium tabular-nums ${positive === undefined ? "text-ink-3" : positive ? "text-emerald-700" : "text-rose-600"}`}>
            {sub}
          </span>
        </div>
      )}
    </div>
  )
}

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="text-[11px] text-ink-3">—</span>
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const w = 56, h = 20, pad = 1
  const step = (w - pad * 2) / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = pad + i * step
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-5 shrink-0" aria-hidden>
      <polyline points={coords} fill="none" stroke="rgb(5 150 105)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50",
  failed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/50",
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/50",
  expired: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  failed: "Failed",
  pending: "Pending",
  expired: "Expired",
}

type SearchParams = Promise<{ period?: string }>

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/payments")
  }

  const sp = await searchParams
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  // ── Parallel queries ──────────────────────────────────────────────────────

  const [
    // Revenue stats
    [allTimeRevenue],
    [todayRevenue],
    [weekRevenue],
    [monthRevenue],
    [prevWeekRevenue],

    // Success rate
    [paidCount],
    [failedCount],

    // Payment method breakdown
    methodRows,

    // Daily revenue for chart (last 14 days)
    dailyRevenue,

    // Recent transactions
    recentLedger,
  ] = await Promise.all([
    // All-time revenue
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(confirmedOrderStatus),

    // Today's revenue
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(and(confirmedOrderStatus, gte(orders.paidAt, todayStart))),

    // Last 7 days revenue
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(and(confirmedOrderStatus, gte(orders.paidAt, sevenDaysAgo))),

    // Last 30 days revenue
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(and(confirmedOrderStatus, gte(orders.paidAt, thirtyDaysAgo))),

    // Previous 7 days (for comparison)
    db.select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(and(
        confirmedOrderStatus,
        gte(orders.paidAt, fourteenDaysAgo),
        sql`${orders.paidAt} < ${sevenDaysAgo}`,
      )),

    // Paid ledger entries count
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(paymentLedger)
      .where(eq(paymentLedger.localStatus, "paid")),

    // Failed ledger entries count
    db.select({ count: sql<number>`COUNT(*)::int` })
      .from(paymentLedger)
      .where(eq(paymentLedger.localStatus, "failed")),

    // Payment method breakdown
    db.select({
      method: orders.paymentMethod,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('paid', 'completed'))::int`,
      total: sql<number>`COUNT(*)::int`,
      revenue: sql<string>`COALESCE(SUM(${orders.totalAmount}) FILTER (WHERE ${orders.status} IN ('paid', 'completed')), 0)`,
    })
      .from(orders)
      .where(sql`${orders.paymentMethod} IS NOT NULL`)
      .groupBy(orders.paymentMethod)
      .orderBy(orders.paymentMethod),

    // Daily revenue for last 14 days
    db.select({
      day: sql<string>`DATE(${orders.paidAt})`,
      total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    })
      .from(orders)
      .where(and(confirmedOrderStatus, gte(orders.paidAt, fourteenDaysAgo)))
      .groupBy(sql`DATE(${orders.paidAt})`)
      .orderBy(sql`DATE(${orders.paidAt})`),

    // Recent 50 payment ledger entries
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
    })
      .from(paymentLedger)
      .orderBy(desc(paymentLedger.createdAt))
      .limit(50),
  ])

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalRevenue = Number(allTimeRevenue?.total ?? 0)
  const todayRev = Number(todayRevenue?.total ?? 0)
  const weekRev = Number(weekRevenue?.total ?? 0)
  const monthRev = Number(monthRevenue?.total ?? 0)
  const prevWeekRev = Number(prevWeekRevenue?.total ?? 0)

  const successRate = paidCount?.count && failedCount?.count
    ? Math.round((paidCount.count / (paidCount.count + failedCount.count)) * 100)
    : paidCount?.count ? 100 : 0

  const weekDelta = prevWeekRev > 0
    ? ((weekRev - prevWeekRev) / prevWeekRev) * 100
    : weekRev > 0 ? 100 : 0

  // Sparkline points
  const dayMap = new Map<string, number>()
  for (const r of dailyRevenue) {
    dayMap.set(r.day, Number(r.total))
  }
  const sparkPoints: number[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    sparkPoints.push(dayMap.get(key) ?? 0)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">Payments</h1>
          <p className="text-[13px] text-ink-3 mt-1">Real-time payment dashboard with revenue and transaction data</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Today"
          value={formatCurrency(todayRev, "USD")}
        />
        <StatCard
          icon={TrendingUp}
          label="This Week"
          value={formatCurrency(weekRev, "USD")}
          sub={weekDelta >= 0 ? `+${weekDelta.toFixed(1)}% vs prev` : `${weekDelta.toFixed(1)}% vs prev`}
          positive={weekDelta >= 0}
        />
        <StatCard
          icon={Activity}
          label="This Month"
          value={formatCurrency(monthRev, "USD")}
        />
        <StatCard
          icon={DollarSign}
          label="All Time"
          value={formatCurrency(totalRevenue, "USD")}
          sub={`${successRate}% success rate`}
          positive={successRate >= 80}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={CheckCircle2}
          label="Paid Transactions"
          value={String(paidCount?.count ?? 0)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Failed Transactions"
          value={String(failedCount?.count ?? 0)}
          sub={successRate >= 80 ? "Healthy" : "Needs attention"}
          positive={successRate >= 80}
        />
        <div className="rounded-xl border border-line bg-paper p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">14d Revenue</span>
            <TrendingUp size={16} className="text-ink-2" />
          </div>
          <MiniSparkline points={sparkPoints} />
          <p className="text-[12px] text-ink-3">Last 14 days</p>
        </div>
      </div>

      {/* Payment method breakdown */}
      <section>
        <h2 className="text-[16px] font-bold tracking-tight text-ink mb-4">Payment Methods</h2>
        {methodRows.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-8 text-center">
            <CreditCard size={24} className="mx-auto mb-2 text-ink-3" />
            <p className="text-[13px] text-ink-3">No payment data yet</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {methodRows.map((row) => {
              const method = row.method ?? "unknown"
              const rev = Number(row.revenue)
              const rate = row.total > 0 ? Math.round((row.paid / row.total) * 100) : 0
              return (
                <div key={method} className="rounded-xl border border-line bg-paper p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-navy/5 text-navy">
                      {method.includes("ecocash") ? <Smartphone size={18} /> : <CreditCard size={18} />}
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-ink capitalize">{method.replace("velocity-", "")}</p>
                      <p className="text-[12px] text-ink-3">{row.paid} paid · {row.total - row.paid} failed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-bold text-ink tabular-nums">{formatCurrency(rev, "USD")}</p>
                    <p className={`text-[12px] font-medium tabular-nums ${rate >= 80 ? "text-emerald-700" : "text-rose-600"}`}>
                      {rate}% success
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent transactions */}
      <section>
        <h2 className="text-[16px] font-bold tracking-tight text-ink mb-4">Recent Transactions</h2>
        {recentLedger.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-8 text-center">
            <Activity size={24} className="mx-auto mb-2 text-ink-3" />
            <p className="text-[13px] text-ink-3">No recent transactions</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-paper-2 border-b border-line">
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Date</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Amount</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Status</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Processor</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Source</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentLedger.map((entry) => {
                  const st = entry.localStatus ?? "unknown"
                  return (
                    <tr key={entry.id} className="border-b border-line last:border-0 hover:bg-paper-2 transition-colors">
                      <td className="px-4 py-3 text-[13px] text-ink-2 tabular-nums">
                        {entry.createdAt
                          ? new Date(entry.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-[14px] font-semibold text-ink tabular-nums">
                        {entry.currency ?? "USD"} {entry.amount}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[st] ?? "bg-gray-50 text-gray-600"}`}>
                          {STATUS_LABEL[st] ?? st}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ink-2 capitalize">{entry.processor}</td>
                      <td className="px-4 py-3 text-[13px] text-ink-2">{entry.source}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${entry.orderId}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-navy hover:underline"
                        >
                          View order <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
