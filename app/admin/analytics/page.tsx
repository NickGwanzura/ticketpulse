import { redirect } from "next/navigation"
import Link from "next/link"
import {
  ArrowUpRight, ArrowDownRight, MapPin, CreditCard, TrendingUp, BarChart2, Users, PieChart,
} from "lucide-react"
import { eq, sql } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, users } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"
import {
  countExcludedCurrencyOrders,
  getPlatformAnalyticsOrders,
  getPlatformRefundedValue,
} from "@/lib/platform-analytics"
import AiNarrativeSummary from "@/components/ai/AiNarrativeSummary"

const PERIODS = [
  { label: "7d",  value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
] as const

function periodDateRange(period: string): { since: Date; previousSince: Date; previousEnd: Date } {
  const now = new Date()
  let days: number
  if (period === "7d") days = 7
  else if (period === "90d") days = 90
  else days = 30

  const since = new Date(now.getTime() - days * 86400000)
  const previousEnd = new Date(since.getTime())
  const previousSince = new Date(previousEnd.getTime() - days * 86400000)
  return { since, previousSince, previousEnd }
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/analytics")
  }

  const sp = await searchParams
  const period = sp.period ?? "30d"
  const { since, previousSince, previousEnd } = periodDateRange(period)

  // ── Canonical confirmed revenue and issued tickets ─────────────────────
  // Keep analytics on the same issued-ticket, direct-sale and payout rules as
  // organizer balances and reconciliation.
  // Amounts are never converted: everything below is USD-only, and orders in
  // other currencies are counted separately so the page can say they're excluded.
  const [currentOrders, previousOrders, refundedAmount, prevRefunded, excludedCurrencyOrders] = await Promise.all([
    getPlatformAnalyticsOrders({ since }),
    getPlatformAnalyticsOrders({ since: previousSince, until: previousEnd }),
    getPlatformRefundedValue({ since }),
    getPlatformRefundedValue({ since: previousSince, until: previousEnd }),
    countExcludedCurrencyOrders({ since }),
  ])

  const currentRevenue = currentOrders.reduce((sum, order) => sum + order.grossRevenue, 0)
  const paidOrderCount = currentOrders.length
  const prevRevenue = previousOrders.reduce((sum, order) => sum + order.grossRevenue, 0)
  const prevOrderCount = previousOrders.length
  const revenueDelta = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0

  const ticketsSold = currentOrders.reduce((sum, order) => sum + order.issuedTickets, 0)
  const prevTickets = previousOrders.reduce((sum, order) => sum + order.issuedTickets, 0)
  const ticketsDelta = prevTickets > 0 ? ((ticketsSold - prevTickets) / prevTickets) * 100 : 0

  // ── Refund rate ─────────────────────────────────────────────────────────
  // Refunded orders are excluded from gross revenue, so the base is confirmed
  // plus refunded ticket value.
  const refundBase = currentRevenue + refundedAmount
  const refundRate = refundBase > 0 ? (refundedAmount / refundBase) * 100 : 0
  const prevRefundBase = prevRevenue + prevRefunded
  const prevRefundRate = prevRefundBase > 0 ? (prevRefunded / prevRefundBase) * 100 : 0
  const refundDelta = refundRate - prevRefundRate

  // ── Avg order value ─────────────────────────────────────────────────────
  const avgOrderValue = paidOrderCount > 0 ? currentRevenue / paidOrderCount : 0

  // Previous period avg order value
  const prevAvg = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0

  // ── Tickets per event (published events in period) ──────────────────────
  const [eventCountRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(events)

  const totalEvents = eventCountRow?.count ?? 0
  const ticketsPerEvent = totalEvents > 0 ? Math.round(ticketsSold / totalEvents * 10) / 10 : 0

  // ── Sub-stats breakdown ─────────────────────────────────────────────────
  const subStats = [
    {
      label: "Avg order value",
      value: formatCurrency(avgOrderValue, "USD"),
      delta: prevAvg > 0 ? ((avgOrderValue - prevAvg) / prevAvg) * 100 : 0,
      up:    avgOrderValue >= prevAvg,
    },
    {
      label: "Tickets sold",
      value: ticketsSold.toLocaleString(),
      delta: ticketsDelta,
      up:    ticketsDelta >= 0,
    },
    {
      label: "Refund rate",
      value: `${refundRate.toFixed(2)}%`,
      delta: refundDelta,
      up:    refundDelta <= 0, // lower refund rate is "up" (good)
    },
    {
      label: "Tickets / event",
      value: String(ticketsPerEvent),
      delta: 0,
      up:    true,
    },
  ]

  // ── Breakdowns from the same canonical order rows ───────────────────────
  const salesMixByCategory = new Map<string, number>()
  const organizerById = new Map<string, { name: string; events: Set<string>; revenue: number }>()
  const cityByName = new Map<string, number>()
  const paymentByMethod = new Map<string, number>()
  for (const order of currentOrders) {
    salesMixByCategory.set(order.category, (salesMixByCategory.get(order.category) ?? 0) + order.grossRevenue)
    cityByName.set(order.city, (cityByName.get(order.city) ?? 0) + order.grossRevenue)
    if (order.paymentMethod) paymentByMethod.set(order.paymentMethod, (paymentByMethod.get(order.paymentMethod) ?? 0) + 1)
    const organizer = organizerById.get(order.organizerId) ?? {
      name: order.organizerName ?? order.organizerEmail ?? "—",
      events: new Set<string>(),
      revenue: 0,
    }
    organizer.events.add(order.eventId)
    organizer.revenue += order.grossRevenue
    organizerById.set(order.organizerId, organizer)
  }

  const salesMixTotal = Array.from(salesMixByCategory.values()).reduce((sum, value) => sum + value, 0)
  const salesMix: { label: string; revenue: number; pct: number }[] = Array.from(salesMixByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, revenue]) => ({ label, revenue, pct: salesMixTotal > 0 ? (revenue / salesMixTotal) * 100 : 0 }))

  const ORGANIZERS: { name: string; events: number; revenue: number }[] = Array.from(organizerById.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((organizer) => ({ name: organizer.name, events: organizer.events.size, revenue: organizer.revenue }))

  const cityTotal = Array.from(cityByName.values()).reduce((sum, value) => sum + value, 0)
  const CITIES: { name: string; revenue: number; pct: number }[] = Array.from(cityByName.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, revenue]) => ({ name, revenue, pct: cityTotal > 0 ? (revenue / cityTotal) * 100 : 0 }))

  const totalPayments = Array.from(paymentByMethod.values()).reduce((sum, value) => sum + value, 0)
  const COLORS = [
    "bg-navy",
    "bg-green-500",
    "bg-amber-500",
    "bg-sky-500",
    "bg-rose-500",
    "bg-indigo-500",
  ]
  const PAYMENTS: { label: string; pct: number; color: string }[] = Array.from(paymentByMethod.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count], i) => ({
      label,
      pct: totalPayments > 0 ? (count / totalPayments) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }))

  const paymentMethodsForAI = PAYMENTS.map((p) => ({
    method: p.label,
    pct: Math.round(p.pct),
  }))

  // ── AI narrative data ───────────────────────────────────────────────────
  const [orgCountRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(users)
    .where(eq(users.role, "organizer"))

  const [topCatLive] = await db
    .select({ category: events.category })
    .from(events)
    .where(eq(events.status, "published"))
    .groupBy(events.category)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1)

  const [topCityLive] = await db
    .select({ city: events.city })
    .from(events)
    .where(eq(events.status, "published"))
    .groupBy(events.city)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1)

  // ── Revenue over time (daily aggregates from canonical order rows) ──────
  const revenueByDay = new Map<string, number>()
  for (const order of currentOrders) {
    const timestamp = order.paidAt ?? order.completedAt
    if (!timestamp) continue
    const day = timestamp.toISOString().slice(0, 10)
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + order.grossRevenue)
  }
  const revenueOverTime = Array.from(revenueByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, revenue]) => revenue)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Analytics"
        title="Revenue and conversion"
        subtitle="How the platform is trending against last period."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        {excludedCurrencyOrders > 0 && (
          <p className="rounded-xl border border-line bg-paper-2 px-4 py-3 text-[12px] text-ink-2">
            Figures are USD only. {excludedCurrencyOrders.toLocaleString()} confirmed{" "}
            {excludedCurrencyOrders === 1 ? "order" : "orders"} in another currency in this period{" "}
            {excludedCurrencyOrders === 1 ? "is" : "are"} not included, as no exchange rate is applied.
          </p>
        )}

        {/* Revenue chart card */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-1">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 px-5 md:px-6 pt-5 pb-4 border-b border-line">
            <div>
              <p className="text-[12px] text-ink-3 mb-1">Revenue over time</p>
              <div className="flex items-baseline gap-3">
                <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none">
                  {formatCurrency(currentRevenue, "USD")}
                </p>
                {prevRevenue > 0 && (
                  <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${revenueDelta >= 0 ? "text-green-700" : "text-rose-700"}`}>
                    {revenueDelta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(revenueDelta).toFixed(1)}% vs prev
                  </span>
                )}
              </div>
            </div>
            <div className="inline-flex items-center rounded-lg bg-paper-2 ring-1 ring-line p-1 self-start sm:self-auto">
              {PERIODS.map((p) => {
                const isActive = period === p.value
                const params = new URLSearchParams()
                if (p.value !== "30d") params.set("period", p.value)
                return (
                  <Link
                    key={p.value}
                    href={`/admin/analytics${params.toString() ? `?${params.toString()}` : ""}`}
                    className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                      isActive ? "bg-paper text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {p.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Sparkline-style mini chart */}
          {revenueOverTime.length > 1 ? (
            <div className="px-3 md:px-4 pt-4 pb-3">
              <svg
                viewBox={`0 0 ${revenueOverTime.length * 20} 80`}
                className="w-full h-20 text-navy"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {(() => {
                  const max = Math.max(...revenueOverTime, 1)
                  const w = revenueOverTime.length * 20
                  const h = 80
                  const pts = revenueOverTime.map((v, i) => ({
                    x: (i / (revenueOverTime.length - 1)) * w,
                    y: h - (v / max) * (h - 8) - 4,
                  }))
                  const area = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + ` L${w},${h} L0,${h} Z`
                  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
                  return (
                    <>
                      <path d={area} fill="url(#revFill)" />
                      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )
                })()}
              </svg>
            </div>
          ) : (
            <div className="px-3 md:px-4 pt-4">
              <EmptyState
                icon={BarChart2}
                title="No revenue data yet"
                body="Revenue will chart here once the first ticket orders are placed."
                variant="inline"
              />
            </div>
          )}

          {/* Sub-stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-line">
            {subStats.map(({ label, value, delta, up }, i) => (
              <div
                key={label}
                className={`px-5 md:px-6 py-4 ${i > 0 ? "border-l border-line" : ""} ${i >= 2 ? "border-t lg:border-t-0 border-line" : ""}`}
              >
                <p className="text-[11px] text-ink-3 mb-1.5">{label}</p>
                <p className="text-[18px] font-bold tracking-tight text-ink leading-none">{value}</p>
                {delta !== 0 && (
                  <span className={`mt-2 inline-flex items-center gap-1 text-[12px] font-medium ${up ? "text-green-700" : "text-rose-700"}`}>
                    {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {Math.abs(delta).toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sales mix */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-2">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Sales mix by category</h2>
              <p className="text-[12px] text-ink-3 mt-0.5">
                Last {period}, USD orders only
              </p>
            </div>
            <TrendingUp size={15} className="text-ink-3" />
          </div>
          {salesMix.length > 0 ? (
            <ul className="divide-y divide-line">
              {salesMix.map(({ label, revenue, pct }) => (
                <li key={label} className="px-5 md:px-6 py-4">
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <p className="text-[14px] font-semibold tracking-tight text-ink capitalize">{label}</p>
                    <div className="flex items-baseline gap-3 whitespace-nowrap">
                      <span className="text-[14px] font-bold text-ink">{formatCurrency(revenue, "USD")}</span>
                      <span className="text-[12px] text-ink-3">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-paper-2 rounded-full overflow-hidden">
                    <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={PieChart}
              title="No sales data yet"
              body="Category breakdown will appear after the first ticket purchases."
              variant="inline"
            />
          )}
        </div>

        {/* AI Narrative Summary */}
        <div className="tp-fade-up-2">
          <AiNarrativeSummary
            totalRevenue={currentRevenue}
            eventCount={totalEvents}
            organizerCount={orgCountRow?.count ?? 0}
            topCity={topCityLive?.city ?? "N/A"}
            topCategory={topCatLive?.category ?? "N/A"}
            paymentMethods={paymentMethodsForAI}
          />
        </div>

        {/* 3-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 tp-fade-up-3">
          {/* Top organizers */}
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">Top organizers</h3>
            </div>
            {ORGANIZERS.length > 0 ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[460px]">
                <thead>
                  <tr className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase border-b border-line">
                    <th className="text-left px-5 py-2.5 font-semibold">Organizer</th>
                    <th className="text-right px-5 py-2.5 font-semibold">Events</th>
                    <th className="text-right px-5 py-2.5 font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ORGANIZERS.map((o) => (
                    <tr key={o.name} className="hover:bg-paper-2 transition-colors">
                      <td className="px-5 py-3 text-[13px] font-semibold text-ink truncate max-w-[140px]">{o.name}</td>
                      <td className="px-5 py-3 text-right text-[13px] text-ink-2">{o.events}</td>
                      <td className="px-5 py-3 text-right text-[13px] font-bold text-ink whitespace-nowrap">
                        {formatCurrency(o.revenue, "USD")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : (
              <EmptyState
                icon={Users}
                title="No organizer data"
                body="Top organizers by revenue will appear here."
                variant="inline"
              />
            )}
          </div>

          {/* Cities by revenue */}
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-2">
              <MapPin size={13} className="text-ink-3" />
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">Cities by revenue</h3>
            </div>
            {CITIES.length > 0 ? (
              <ul className="divide-y divide-line">
                {CITIES.map(({ name, revenue, pct }) => (
                  <li key={name} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <p className="text-[13px] font-semibold text-ink">{name}</p>
                      <p className="text-[13px] font-bold text-ink whitespace-nowrap">{formatCurrency(revenue, "USD")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-paper-2 rounded-full overflow-hidden">
                        <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-ink-3 whitespace-nowrap tabular-nums">{pct.toFixed(1)}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={MapPin}
                title="No city data"
                body="Revenue by city will appear after orders come in."
                variant="inline"
              />
            )}
          </div>

          {/* Payment method mix */}
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-2">
              <CreditCard size={13} className="text-ink-3" />
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">Payment method mix</h3>
            </div>
            {PAYMENTS.length > 0 ? (
              <div className="px-5 py-5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-paper-2">
                  {PAYMENTS.map(({ label, pct, color }) => (
                    <div key={label} className={`${color}`} style={{ width: `${pct}%` }} title={`${label} ${pct.toFixed(1)}%`} />
                  ))}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {PAYMENTS.map(({ label, pct, color }) => (
                    <li key={label} className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
                        {label}
                      </span>
                      <span className="text-[13px] font-bold text-ink">{pct.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No payment data"
                body="Payment method breakdown will appear after the first transactions."
                variant="inline"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
