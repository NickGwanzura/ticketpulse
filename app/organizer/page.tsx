import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { eq, desc } from "drizzle-orm"
import {
  Plus, ArrowUpRight, Calendar, DollarSign, Users, Ticket, TrendingUp,
  MoreHorizontal, ScanLine, LayoutList, ShoppingCart,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"
import { db } from "@/db"
import { events } from "@/db/schema"

type EventRow = {
  id: string
  slug: string
  title: string
  category: string
  venue: string
  startsAt: Date
  status: string
  sold: number
  capacity: number
  revenue: number
  currency: string
}

type OrderRow = {
  name: string
  event: string
  amount: number
  method: string
  status: string
  ago: string
}

type VipBuyer = {
  name: string
  spent: number
  tickets: number
}

type ActivityItem = {
  icon: React.ElementType
  text: string
  ago: string
}

type SalesByEvent = {
  title: string
  revenue: number
}

const MOCK_ORDERS: OrderRow[] = []
const VIP_BUYERS: VipBuyer[] = []
const ACTIVITY: ActivityItem[] = []
const SALES_BY_EVENT: SalesByEvent[] = []
const REVENUE_30D: number[] = []

const KPI_SPARKLINES: Record<string, number[]> = {
  "Live events":   [],
  "Tickets sold":  [],
  "Revenue (USD)": [],
  "Followers":     [],
}

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700",
  draft:     "bg-paper-2 text-ink-2 ring-1 ring-line",
  sold_out:  "bg-rose-50 text-rose-700",
  cancelled: "bg-rose-50 text-rose-700",
}

const METHOD_STYLE: Record<string, string> = {
  EcoCash: "bg-emerald-50 text-emerald-700",
  Card:    "bg-blue-soft text-blue",
  Bank:    "bg-paper-2 text-ink-2 ring-1 ring-line",
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700",
  refunded:  "bg-rose-50 text-rose-600",
  pending:   "bg-amber-50 text-amber-700",
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) {
    const w = 80
    const h = 28
    const color = positive ? "#0a2540" : "#dc2626"
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke={color} strokeWidth="1.5" opacity="0.25" strokeDasharray="3 3" />
      </svg>
    )
  }
  const min = Math.min(...data)
  const max = Math.max(...data)
  const w = 80
  const h = 28
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  const color = positive ? "#0a2540" : "#dc2626"
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

function RevenueChart({ data }: { data: number[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No revenue data yet"
        body="Revenue will appear here once tickets are sold."
        variant="inline"
      />
    )
  }
  const min = 0
  const max = Math.max(...data)
  const w = 800
  const h = 120
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * h
    return [x, y] as [number, number]
  })

  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L${w} ${h} L0 ${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-full overflow-visible" preserveAspectRatio="none" style={{ height: 120 }}>
      <defs>
        <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a2540" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0a2540" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#rev-fill)" />
      <path d={linePath} fill="none" stroke="#0a2540" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => i === pts.length - 1 && (
        <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" fill="#0a2540" />
      ))}
    </svg>
  )
}

export default async function OrganizerPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/organizer")
  if (session.user.role !== "organizer" && session.user.role !== "admin") redirect("/dashboard")

  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      category: events.category,
      venue: events.venue,
      startsAt: events.startsAt,
      status: events.status,
    })
    .from(events)
    .where(eq(events.organizerId, session.user.id))
    .orderBy(desc(events.startsAt))
    .limit(50)

  // Sales/revenue/capacity figures will land once tickets+orders are wired up.
  // For now we surface honest empty rows so the dashboard reflects real data.
  const ORGANIZER_EVENTS: EventRow[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    category: r.category,
    venue: r.venue,
    startsAt: r.startsAt,
    status: r.status ?? "draft",
    sold: 0,
    capacity: 0,
    revenue: 0,
    currency: "USD",
  }))

  const totalRevenue = ORGANIZER_EVENTS.reduce((s, e) => s + (e.currency === "USD" ? e.revenue : 0), 0)
  const totalSold    = ORGANIZER_EVENTS.reduce((s, e) => s + e.sold, 0)
  const liveEvents   = ORGANIZER_EVENTS.filter((e) => e.status === "published").length

  const gross    = 0
  const net      = 0
  const refunds  = 0
  const avgOrder = 0

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="Your events"
        subtitle={`Welcome back, ${session.user.name?.split(" ")[0] ?? "organizer"}.`}
        width="xl"
        actions={
          <>
            <Link
              href="/organizer/scan"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <ScanLine size={15} /> Open scanner
            </Link>
            <Link
              href="/organizer/events/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition"
            >
              <Plus size={15} /> Create event
            </Link>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-8">

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {(
            [
              { l: "Live events",   v: liveEvents.toString(),               i: Calendar,   pos: true  },
              { l: "Tickets sold",  v: totalSold.toLocaleString(),          i: Ticket,     pos: true  },
              { l: "Revenue (USD)", v: formatCurrency(totalRevenue, "USD"), i: DollarSign, pos: true  },
              { l: "Followers",     v: "0",                                 i: Users,      pos: true  },
            ] as const
          ).map(({ l, v, i: Icon, pos }) => {
            const spark = KPI_SPARKLINES[l] ?? []
            return (
              <div key={l} className="rounded-2xl border border-line bg-paper p-5 flex flex-col justify-between min-h-[120px] tp-lift">
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Icon size={14} className="text-ink-3" />
                    <span className="text-[11.5px] text-ink-3">{l}</span>
                  </div>
                  <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{v}</p>
                  <p className="text-[11.5px] text-ink-3 mt-2">—</p>
                </div>
                <div className="flex justify-end mt-3">
                  <Sparkline data={spark} positive={pos} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Revenue chart */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-2">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">Revenue (last 30 days)</h2>
            <div className="flex items-center gap-1">
              {["7d", "30d", "90d", "All"].map((pill, i) => (
                <span
                  key={pill}
                  className={`text-[11.5px] font-medium px-2.5 py-1 rounded-md cursor-pointer select-none ${
                    i === 1
                      ? "bg-paper-2 ring-1 ring-line text-ink"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
          <div className="px-5 md:px-6 pt-5 pb-4">
            <RevenueChart data={REVENUE_30D} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-line border-t border-line">
            {[
              { label: "Gross volume",    value: formatCurrency(gross, "USD")    },
              { label: "Net revenue",     value: formatCurrency(net, "USD")      },
              { label: "Refunds",         value: formatCurrency(refunds, "USD")  },
              { label: "Avg order value", value: formatCurrency(avgOrder, "USD") },
            ].map(({ label, value }) => (
              <div key={label} className="px-5 md:px-6 py-4">
                <p className="text-[11px] text-ink-3 mb-1">{label}</p>
                <p className="text-[18px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Events table + side column */}
        <div className="grid grid-cols-12 gap-4 md:gap-6 tp-fade-up-3">

          {/* Events table */}
          <div className="col-span-12 lg:col-span-8 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">All events</h2>
              <div className="flex items-center gap-1.5">
                <button className="text-[12.5px] font-medium text-ink-2 hover:text-ink px-3 py-1.5 rounded-md hover:bg-paper-2">All</button>
                <button className="text-[12.5px] font-medium text-ink-2 hover:text-ink px-3 py-1.5 rounded-md hover:bg-paper-2">Live</button>
                <button className="text-[12.5px] font-medium text-ink-2 hover:text-ink px-3 py-1.5 rounded-md hover:bg-paper-2">Drafts</button>
              </div>
            </div>

            {ORGANIZER_EVENTS.length === 0 ? (
              <EmptyState
                icon={LayoutList}
                title="No events yet"
                body="Create your first event to start selling tickets."
                ctaLabel="Create event"
                ctaHref="/organizer/events/new"
              />
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-line">
                  {ORGANIZER_EVENTS.map((e) => (
                    <Link key={e.id} href={`/organizer/events/${e.id}/edit`} className="block p-5 hover:bg-paper-2 transition-colors">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status] ?? STATUS_STYLE.draft}`}>
                          {e.status}
                        </span>
                        <ArrowUpRight size={14} className="text-ink-3" />
                      </div>
                      <p className="text-[14.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                      <p className="text-[12.5px] text-ink-2 mt-0.5">{e.venue}</p>
                    </Link>
                  ))}
                </div>

                {/* Desktop table */}
                <table className="hidden md:table w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-6 py-3 font-semibold">Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-right px-3 py-3 font-semibold">Sold</th>
                      <th className="text-right px-3 py-3 font-semibold">Revenue</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ORGANIZER_EVENTS.map((e) => {
                      const pct = e.capacity > 0 ? Math.round((e.sold / e.capacity) * 100) : 0
                      return (
                        <tr key={e.id} className="hover:bg-paper-2 transition-colors">
                          <td className="px-6 py-4 max-w-xs">
                            <Link href={`/organizer/events/${e.id}/edit`} className="block">
                              <p className="text-[14px] font-semibold tracking-tight text-ink line-clamp-1 hover:text-navy transition-colors">{e.title}</p>
                              <p className="text-[12px] text-ink-3 mt-0.5">{e.venue}</p>
                            </Link>
                          </td>
                          <td className="px-3 py-4 text-[13px] text-ink-2 whitespace-nowrap">{e.startsAt.toLocaleDateString()}</td>
                          <td className="px-3 py-4">
                            <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[e.status] ?? STATUS_STYLE.draft}`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-right whitespace-nowrap">
                            <p className="text-[13px] font-semibold text-ink">{e.sold.toLocaleString()} <span className="text-ink-3 font-normal">/ {e.capacity.toLocaleString()}</span></p>
                            <div className="w-24 h-1 bg-paper-2 rounded-full mt-1.5 ml-auto overflow-hidden">
                              <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-4 text-right text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                            {formatCurrency(e.revenue, e.currency)}
                          </td>
                          <td className="px-3 py-4 text-right">
                            <Link
                              href={`/organizer/events/${e.id}/edit`}
                              className="inline-flex items-center justify-center text-ink-3 hover:text-ink p-1.5 rounded-md hover:bg-paper-2"
                            >
                              <MoreHorizontal size={15} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* Side column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

            {/* Upcoming payout */}
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Upcoming payout</p>
              <p className="text-[32px] font-bold tracking-tight text-ink tabular-nums">{formatCurrency(0, "USD")}</p>
              <p className="text-[12px] text-ink-3 mt-0.5 mb-4">USD via EcoCash</p>
              <div className="space-y-2 text-[12.5px] text-ink-2">
                <div className="flex justify-between">
                  <span>Scheduled</span>
                  <span className="font-medium text-ink-3">—</span>
                </div>
                <div className="flex justify-between">
                  <span>From event</span>
                  <span className="font-medium text-ink-3">—</span>
                </div>
              </div>
              <button className="mt-5 w-full rounded-xl border border-line text-[13px] font-semibold text-ink py-2.5 hover:bg-paper-2 transition">
                Request earlier
              </button>
            </div>

            {/* VIP attendees */}
            <div className="rounded-2xl border border-line bg-paper p-5 flex-1">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Top buyers</p>
              {VIP_BUYERS.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No buyers yet"
                  body="Top ticket buyers will appear here."
                  variant="inline"
                />
              ) : (
                <div className="space-y-3">
                  {VIP_BUYERS.map((b, i) => (
                    <div key={b.name} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-ink-3 w-4 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{b.name}</p>
                        <p className="text-[11px] text-ink-3">{b.tickets} tickets</p>
                      </div>
                      <span className="text-[13px] font-bold text-ink tabular-nums shrink-0">{formatCurrency(b.spent, "USD")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Sales by event + Recent orders */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Sales by event */}
          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-line bg-paper p-5">
            <p className="text-[16px] font-semibold tracking-tight text-ink mb-5">Sales by event</p>
            {SALES_BY_EVENT.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="No sales data yet"
                body="Revenue by event will appear here once orders come in."
                variant="inline"
              />
            ) : (
              <div className="space-y-4">
                {SALES_BY_EVENT.map((e) => {
                  const maxSales = Math.max(...SALES_BY_EVENT.map((s) => s.revenue))
                  const pct = Math.round((e.revenue / maxSales) * 100)
                  return (
                    <div key={e.title}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <p className="text-[13px] font-medium text-ink truncate max-w-[180px]">{e.title}</p>
                        <span className="text-[13px] font-bold text-ink tabular-nums shrink-0 ml-3">{formatCurrency(e.revenue, "USD")}</span>
                      </div>
                      <div className="h-1.5 bg-paper-2 rounded-full overflow-hidden">
                        <div className="h-full bg-navy rounded-full tp-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div className="col-span-12 lg:col-span-7 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">Recent orders</h2>
            </div>

            {MOCK_ORDERS.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="No orders yet"
                body="Orders will appear here as attendees purchase tickets."
              />
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="md:hidden divide-y divide-line">
                  {MOCK_ORDERS.map((o) => (
                    <div key={`${o.name}-${o.ago}`} className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <p className="text-[13.5px] font-semibold text-ink">{o.name}</p>
                        <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full shrink-0 ${ORDER_STATUS_STYLE[o.status]}`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-[12px] text-ink-3 truncate mb-2">{o.event}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-ink tabular-nums">{formatCurrency(o.amount, "USD")}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${METHOD_STYLE[o.method]}`}>{o.method}</span>
                        <span className="text-[11px] text-ink-3 ml-auto">{o.ago}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <table className="hidden md:table w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">Customer</th>
                      <th className="text-left px-3 py-3 font-semibold">Event</th>
                      <th className="text-right px-3 py-3 font-semibold">Amount</th>
                      <th className="text-center px-3 py-3 font-semibold">Method</th>
                      <th className="text-center px-3 py-3 font-semibold">Status</th>
                      <th className="text-right px-3 py-3 font-semibold">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {MOCK_ORDERS.map((o) => (
                      <tr key={`${o.name}-${o.ago}`} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-3 text-[13px] font-semibold text-ink whitespace-nowrap">{o.name}</td>
                        <td className="px-3 py-3 text-[12px] text-ink-2 max-w-[160px]">
                          <span className="line-clamp-1">{o.event}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] font-bold text-ink tabular-nums whitespace-nowrap">{formatCurrency(o.amount, "USD")}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${METHOD_STYLE[o.method]}`}>{o.method}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${ORDER_STATUS_STYLE[o.status]}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-[11.5px] text-ink-3 whitespace-nowrap">{o.ago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Activity timeline + Quick links */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Activity timeline */}
          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-line bg-paper p-5">
            <p className="text-[16px] font-semibold tracking-tight text-ink mb-5">What&apos;s happening</p>
            {ACTIVITY.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No recent activity"
                body="Activity from your events will appear here."
                variant="inline"
              />
            ) : (
              <div className="space-y-4">
                {ACTIVITY.map(({ icon: Icon, text, ago }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-paper-2 p-1.5 shrink-0">
                      <Icon size={13} className="text-ink-2" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-ink leading-snug">{text}</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">{ago}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
            <p className="text-[16px] font-semibold tracking-tight text-ink sm:col-span-3">Quick links</p>

            <Link
              href="/organizer/scan"
              className="sm:col-span-3 rounded-2xl border border-navy/10 bg-gradient-to-br from-navy via-navy-700 to-navy text-white p-5 tp-lift relative overflow-hidden"
            >
              <span className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue/30 blur-3xl pointer-events-none" aria-hidden />
              <div className="relative flex items-start gap-4">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 shrink-0">
                  <ScanLine size={18} className="text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold tracking-[0.18em] text-white/70 uppercase">End-to-end · included</p>
                  <p className="text-[15.5px] font-semibold tracking-tight text-white mt-0.5">Open the gate scanner</p>
                  <p className="text-[12.5px] text-white/75 mt-1 leading-relaxed">
                    Run TicketPulse&apos;s reader app on a phone or tablet at the gate. Reads PDF, mobile QR, and wallet passes. No third-party scanner contracts.
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-white">
                    Launch scanner <ArrowUpRight size={12} />
                  </p>
                </div>
              </div>
            </Link>

            {[
              { title: "Set up payouts", body: "Add EcoCash or bank to receive payouts.",   href: "/payouts" },
              { title: "Browse vendors", body: "Find catering, sound, security and more.",  href: "/vendors" },
              { title: "Read the guide", body: "Selling tips for first-time organizers.",    href: "/help" },
            ].map(({ title, body, href }) => (
              <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
                <p className="text-[14px] font-semibold tracking-tight text-ink">{title}</p>
                <p className="text-[12.5px] text-ink-2 mt-1">{body}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy">
                  Open <ArrowUpRight size={12} />
                </p>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
