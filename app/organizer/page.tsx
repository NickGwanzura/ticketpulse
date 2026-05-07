import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Plus, ArrowUpRight, Calendar, DollarSign, Users, Ticket, TrendingUp,
  MoreHorizontal, Zap, Star, Clock, CheckCircle, RefreshCw, Send,
} from "lucide-react"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const MOCK_EVENTS = [
  { id: "1", slug: "nyuki-marathon-2026", title: "Nyuki Marathon 2026: One Bee, Million Futures", category: "Marathon", venue: "National Sports Stadium, Harare", startsAt: new Date("2026-05-17T06:00:00"), status: "published", sold: 1280, capacity: 2000, revenue: 9430, currency: "USD" },
  { id: "2", slug: "rumble-in-sa-pretoria-2026", title: "Rumble in SA, Pretoria", category: "Concert", venue: "Propaganda, Pretoria", startsAt: new Date("2026-05-17T12:00:00"), status: "published", sold: 420, capacity: 800, revenue: 147000, currency: "ZAR" },
  { id: "3", slug: "nyuki-warmup-run", title: "Nyuki Warm-up Run", category: "Walkathon", venue: "Harare Gardens", startsAt: new Date("2026-04-12T07:00:00"), status: "draft", sold: 0, capacity: 300, revenue: 0, currency: "USD" },
  { id: "4", slug: "harare-jazz-night", title: "Harare Jazz Night Vol. 4", category: "Concert", venue: "The Venue, Harare", startsAt: new Date("2026-06-05T19:00:00"), status: "published", sold: 310, capacity: 500, revenue: 4340, currency: "USD" },
] as const

const STATUS_STYLE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-700",
  draft:     "bg-paper-2 text-ink-2 ring-1 ring-line",
  sold_out:  "bg-rose-50 text-rose-700",
  cancelled: "bg-rose-50 text-rose-700",
}

const REVENUE_30D = [1840, 2100, 1650, 3200, 2800, 4100, 3600, 5200, 4700, 6100, 5400, 7200, 6800, 8100, 7400, 9200, 8600, 10100, 9300, 11200, 10500, 12100, 11400, 13200, 12600, 14100, 13200, 15400, 14800, 16240]

const MOCK_ORDERS = [
  { name: "Tinashe Moyo",      event: "Nyuki Marathon 2026", amount: 25,  method: "EcoCash", status: "confirmed", ago: "2m ago" },
  { name: "Tariro Chigwida",   event: "Harare Jazz Night",   amount: 14,  method: "Card",    status: "confirmed", ago: "9m ago" },
  { name: "Kudzai Mutasa",     event: "Nyuki Marathon 2026", amount: 50,  method: "Bank",    status: "confirmed", ago: "18m ago" },
  { name: "Farai Nhira",       event: "Rumble in SA",        amount: 120, method: "Card",    status: "confirmed", ago: "34m ago" },
  { name: "Rumbidzai Sithole", event: "Harare Jazz Night",   amount: 14,  method: "EcoCash", status: "refunded",  ago: "1h ago" },
  { name: "Tendai Zvobgo",     event: "Nyuki Marathon 2026", amount: 25,  method: "EcoCash", status: "confirmed", ago: "2h ago" },
  { name: "Chiedza Makoni",    event: "Nyuki Warm-up Run",   amount: 0,   method: "EcoCash", status: "pending",   ago: "3h ago" },
  { name: "Munyaradzi Dube",   event: "Rumble in SA",        amount: 240, method: "Card",    status: "confirmed", ago: "5h ago" },
] as const

const VIP_BUYERS = [
  { name: "Anesu Chikwanda",   spent: 890,  tickets: 12 },
  { name: "Rutendo Mapfumo",   spent: 640,  tickets: 8  },
  { name: "Munyaradzi Dube",   spent: 480,  tickets: 5  },
  { name: "Kudzai Mutasa",     spent: 310,  tickets: 4  },
  { name: "Farai Nhira",       spent: 240,  tickets: 3  },
] as const

const ACTIVITY = [
  { icon: Ticket,    text: "Tinashe bought 2 tickets to Nyuki Marathon",       ago: "2m ago"  },
  { icon: Star,      text: "New review on Nyuki Marathon 2026 (5 stars)",       ago: "1h ago"  },
  { icon: CheckCircle, text: "Vendor confirmed: Rainbow Catering for Jazz Night", ago: "3h ago"  },
  { icon: Send,      text: "Payout of $1,240 sent to EcoCash",                 ago: "Yesterday"},
  { icon: RefreshCw, text: "Refund issued to Tendai Zvobgo ($14.00)",          ago: "Yesterday"},
  { icon: Zap,       text: "Harare Jazz Night reached 60% capacity",           ago: "2d ago"  },
] as const

const SALES_BY_EVENT = [
  { title: "Nyuki Marathon 2026",   revenue: 9430  },
  { title: "Rumble in SA, Pretoria", revenue: 8200  },
  { title: "Harare Jazz Night Vol. 4", revenue: 4340  },
  { title: "Nyuki Warm-up Run",     revenue: 1200  },
] as const

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
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
  const min = 0
  const max = Math.max(...data)
  const w = 800
  const h = 120
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min)) * h
    return [x, y] as [number, number]
  })

  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L${w} ${h} L0 ${h} Z`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: h - t * h,
    label: formatCurrency(t * max, "USD"),
  }))

  return (
    <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-full overflow-visible" preserveAspectRatio="none" style={{ height: 120 }}>
      <defs>
        <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a2540" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0a2540" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map(({ y }) => (
        <line key={y} x1="0" y1={y.toFixed(1)} x2={w} y2={y.toFixed(1)} stroke="#e3e8ee" strokeWidth="0.8" />
      ))}
      <path d={areaPath} fill="url(#rev-fill)" />
      <path d={linePath} fill="none" stroke="#0a2540" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => i === pts.length - 1 && (
        <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" fill="#0a2540" />
      ))}
    </svg>
  )
}

const KPI_SPARKLINES = {
  "Live events":   [1, 1, 2, 2, 2, 3, 2, 3, 3, 3],
  "Tickets sold":  [820, 940, 1010, 1090, 1180, 1240, 1310, 1420, 1580, 1700],
  "Revenue (USD)": [6200, 7100, 7800, 8200, 8600, 9000, 9100, 9200, 9350, 9430],
  "Followers":     [5200, 5320, 5440, 5510, 5580, 5650, 5710, 5760, 5800, 5840],
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

export default async function OrganizerPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/organizer")

  const totalRevenue = MOCK_EVENTS.reduce((s, e) => s + (e.currency === "USD" ? e.revenue : 0), 0)
  const totalSold    = MOCK_EVENTS.reduce((s, e) => s + e.sold, 0)
  const liveEvents   = MOCK_EVENTS.filter((e) => e.status === "published").length

  const gross    = 16240
  const net      = Math.round(gross * 0.95)
  const refunds  = 280
  const avgOrder = Math.round(gross / 142)

  const maxSales = Math.max(...SALES_BY_EVENT.map((e) => e.revenue))

  return (
    <div>
      {/* Header */}
      <div className="border-b border-line bg-paper-2">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-blue uppercase mb-2">Organizer</p>
            <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight leading-tight text-ink">
              Your events
            </h1>
            <p className="mt-1.5 text-[14.5px] text-ink-2">
              Welcome back, {session.user.name?.split(" ")[0] ?? "organizer"}.
            </p>
          </div>
          <Link
            href="/organizer/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition"
          >
            <Plus size={15} /> Create event
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-8">

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {(
            [
              { l: "Live events",   v: liveEvents.toString(),               i: Calendar,   trend: "+1 this week",   pos: true  },
              { l: "Tickets sold",  v: totalSold.toLocaleString(),          i: Ticket,     trend: "+248 this week", pos: true  },
              { l: "Revenue (USD)", v: formatCurrency(totalRevenue, "USD"), i: DollarSign, trend: "+12.4% MoM",     pos: true  },
              { l: "Followers",     v: "5,840",                             i: Users,      trend: "+184 this week", pos: true  },
            ] as const
          ).map(({ l, v, i: Icon, trend, pos }) => {
            const spark = KPI_SPARKLINES[l as keyof typeof KPI_SPARKLINES] ?? []
            return (
              <div key={l} className="rounded-2xl border border-line bg-paper p-5 flex flex-col justify-between min-h-[120px]">
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Icon size={14} className="text-ink-3" />
                    <span className="text-[11.5px] text-ink-3">{l}</span>
                  </div>
                  <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none">{v}</p>
                  <p className="text-[11.5px] text-emerald-700 mt-2 inline-flex items-center gap-1">
                    <TrendingUp size={11} /> {trend}
                  </p>
                </div>
                <div className="flex justify-end mt-3">
                  <Sparkline data={spark} positive={pos} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Revenue chart */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
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
        <div className="grid grid-cols-12 gap-4 md:gap-6">

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

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-line">
              {MOCK_EVENTS.map((e) => (
                <Link key={e.id} href={`/events/${e.slug}`} className="block p-5 hover:bg-paper-2 transition-colors">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>
                      {e.status}
                    </span>
                    <ArrowUpRight size={14} className="text-ink-3" />
                  </div>
                  <p className="text-[14.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                  <p className="text-[12.5px] text-ink-2 mt-0.5">{e.venue}</p>
                  <div className="mt-3 flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px]">
                    <span className="text-ink-3">{formatDateShort(e.startsAt)}</span>
                    <span className="text-ink-2"><span className="font-semibold text-ink">{e.sold}</span>/{e.capacity}</span>
                    <span className="text-ink font-semibold">{formatCurrency(e.revenue, e.currency)}</span>
                  </div>
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
                {MOCK_EVENTS.map((e) => {
                  const pct = Math.round((e.sold / e.capacity) * 100)
                  return (
                    <tr key={e.id} className="hover:bg-paper-2 transition-colors">
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-[14px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                        <p className="text-[12px] text-ink-3 mt-0.5">{e.venue}</p>
                      </td>
                      <td className="px-3 py-4 text-[13px] text-ink-2 whitespace-nowrap">{formatDateShort(e.startsAt)}</td>
                      <td className="px-3 py-4">
                        <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[e.status]}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right whitespace-nowrap">
                        <p className="text-[13px] font-semibold text-ink">{e.sold.toLocaleString()} <span className="text-ink-3 font-normal">/ {e.capacity.toLocaleString()}</span></p>
                        <div className="w-24 h-1 bg-paper-2 rounded-full mt-1.5 ml-auto overflow-hidden">
                          <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                        {formatCurrency(e.revenue, e.currency)}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <button className="text-ink-3 hover:text-ink p-1.5 rounded-md hover:bg-paper-2">
                          <MoreHorizontal size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Side column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

            {/* Upcoming payout */}
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Upcoming payout</p>
              <p className="text-[32px] font-bold tracking-tight text-ink tabular-nums">$1,536</p>
              <p className="text-[12px] text-ink-3 mt-0.5 mb-4">USD via EcoCash</p>
              <div className="space-y-2 text-[12.5px] text-ink-2">
                <div className="flex justify-between">
                  <span>Scheduled</span>
                  <span className="font-medium text-ink">14 May 2026</span>
                </div>
                <div className="flex justify-between">
                  <span>From event</span>
                  <span className="font-medium text-ink truncate max-w-[140px]">Nyuki Marathon 2026</span>
                </div>
              </div>
              <button className="mt-5 w-full rounded-xl border border-line text-[13px] font-semibold text-ink py-2.5 hover:bg-paper-2 transition">
                Request earlier
              </button>
            </div>

            {/* VIP attendees */}
            <div className="rounded-2xl border border-line bg-paper p-5 flex-1">
              <p className="text-[16px] font-semibold tracking-tight text-ink mb-4">Top buyers</p>
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
            </div>

          </div>
        </div>

        {/* Sales by event + Recent orders */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Sales by event */}
          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-line bg-paper p-5">
            <p className="text-[16px] font-semibold tracking-tight text-ink mb-5">Sales by event</p>
            <div className="space-y-4">
              {SALES_BY_EVENT.map((e) => {
                const pct = Math.round((e.revenue / maxSales) * 100)
                return (
                  <div key={e.title}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <p className="text-[13px] font-medium text-ink truncate max-w-[180px]">{e.title}</p>
                      <span className="text-[13px] font-bold text-ink tabular-nums shrink-0 ml-3">{formatCurrency(e.revenue, "USD")}</span>
                    </div>
                    <div className="h-1.5 bg-paper-2 rounded-full overflow-hidden">
                      <div className="h-full bg-navy rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent orders */}
          <div className="col-span-12 lg:col-span-7 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">Recent orders</h2>
            </div>

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
          </div>
        </div>

        {/* Activity timeline + Quick links */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Activity timeline */}
          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-line bg-paper p-5">
            <p className="text-[16px] font-semibold tracking-tight text-ink mb-5">What&apos;s happening</p>
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
          </div>

          {/* Quick links */}
          <div className="col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
            <p className="text-[16px] font-semibold tracking-tight text-ink sm:col-span-3">Quick links</p>
            {[
              { title: "Set up payouts", body: "Add EcoCash or bank to receive payouts.", href: "/payouts" },
              { title: "Browse vendors", body: "Find catering, sound, security and more.", href: "/vendors" },
              { title: "Read the guide", body: "Selling tips for first-time organizers.",  href: "/help" },
            ].map(({ title, body, href }) => (
              <Link key={title} href={href} className="rounded-2xl border border-line bg-paper p-5 hover:border-line-2 hover:shadow-sm transition-all">
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
