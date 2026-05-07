import { ArrowUpRight, ArrowDownRight, MapPin, CreditCard, TrendingUp } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import { formatCurrency } from "@/lib/utils"

const REVENUE_30D = [
  8200, 9100, 7800, 10200, 11400, 9700, 8800, 12200, 13400, 12800,
  14100, 15200, 13900, 14700, 16200, 17400, 15800, 16900, 18200, 17100,
  16400, 18900, 19800, 18200, 20400, 21800, 20200, 22100, 23400, 24800,
] as const

const SUB_STATS = [
  { label: "Avg order value",  value: "$48.20",  delta: 4.1,  up: true },
  { label: "Conversion rate",  value: "3.8%",    delta: 0.6,  up: true },
  { label: "Refund rate",      value: "1.2%",    delta: -0.3, up: true },
  { label: "Tickets / event",  value: "342",     delta: 11.4, up: true },
] as const

const SALES_MIX = [
  { label: "Concerts",    revenue: 184200, pct: 38.2 },
  { label: "Marathons",   revenue: 124600, pct: 25.8 },
  { label: "Walkathons",  revenue: 62800,  pct: 13.0 },
  { label: "Film",        revenue: 48900,  pct: 10.1 },
  { label: "Exhibitions", revenue: 38200,  pct: 7.9 },
  { label: "Expeditions", revenue: 23440,  pct: 4.8 },
] as const

const ORGANIZERS = [
  { name: "Tariro Events",      events: 14, revenue: 184200 },
  { name: "Kudzai Productions", events: 9,  revenue: 92400 },
  { name: "Chiedza Live",       events: 12, revenue: 78600 },
  { name: "Tendai Outdoors",    events: 6,  revenue: 54200 },
  { name: "Farai Films",        events: 8,  revenue: 42100 },
] as const

const CITIES = [
  { name: "Harare",         revenue: 248200, pct: 51.5 },
  { name: "Bulawayo",       revenue: 92400,  pct: 19.2 },
  { name: "Mutare",         revenue: 54200,  pct: 11.2 },
  { name: "Victoria Falls", revenue: 48400,  pct: 10.0 },
  { name: "Pretoria",       revenue: 38940,  pct: 8.1 },
] as const

const PAYMENTS = [
  { label: "EcoCash",   pct: 48, color: "bg-navy" },
  { label: "Card",      pct: 28, color: "bg-blue" },
  { label: "Bank",      pct: 16, color: "bg-emerald-500" },
  { label: "USD cash",  pct: 8,  color: "bg-amber-500" },
] as const

function AreaChart({ points }: { points: readonly number[] }) {
  const w = 800, h = 220, padX = 16, padY = 18
  const min = Math.min(...points), max = Math.max(...points)
  const span = max - min || 1
  const step = (w - padX * 2) / (points.length - 1)
  const xs = points.map((_, i) => padX + i * step)
  const ys = points.map((v) => h - padY - ((v - min) / span) * (h - padY * 2))

  // Smooth path with cubic bezier
  let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`
  for (let i = 0; i < xs.length - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2
    d += ` C ${cx.toFixed(2)} ${ys[i].toFixed(2)}, ${cx.toFixed(2)} ${ys[i + 1].toFixed(2)}, ${xs[i + 1].toFixed(2)} ${ys[i + 1].toFixed(2)}`
  }
  const area = `${d} L ${xs[xs.length - 1].toFixed(2)} ${(h - padY).toFixed(2)} L ${xs[0].toFixed(2)} ${(h - padY).toFixed(2)} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px]" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="rev-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(10 37 64)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="rgb(10 37 64)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={padX} x2={w - padX} y1={padY + (h - padY * 2) * t} y2={padY + (h - padY * 2) * t}
              stroke="rgb(228 230 234)" strokeWidth="1" strokeDasharray="2 4" />
      ))}
      <path d={area} fill="url(#rev-area)" />
      <path d={d} fill="none" stroke="rgb(10 37 64)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3.5" fill="rgb(10 37 64)" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="6" fill="rgb(10 37 64)" fillOpacity="0.18" />
    </svg>
  )
}

export default function AdminAnalyticsPage() {
  const total = REVENUE_30D.reduce((s, v) => s + v, 0)
  const prevTotal = total * 0.88
  const delta = ((total - prevTotal) / prevTotal) * 100

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Analytics"
        title="Revenue and conversion"
        subtitle="How the platform is trending against last period."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Revenue chart card */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-1">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 px-5 md:px-6 pt-5 pb-4 border-b border-line">
            <div>
              <p className="text-[11.5px] text-ink-3 mb-1">Revenue over time</p>
              <div className="flex items-baseline gap-3">
                <p className="text-[26px] md:text-[30px] font-bold tracking-tight text-ink leading-none">
                  {formatCurrency(total, "USD")}
                </p>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
                  <ArrowUpRight size={12} /> {delta.toFixed(1)}% vs prev
                </span>
              </div>
            </div>
            <div className="inline-flex items-center rounded-lg bg-paper-2 ring-1 ring-line p-1 self-start sm:self-auto">
              {["7d", "30d", "90d"].map((p, i) => (
                <button key={p} className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${
                  i === 1 ? "bg-paper text-ink shadow-sm" : "text-ink-2 hover:text-ink"
                }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 md:px-4 pt-4">
            <AreaChart points={REVENUE_30D} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-line">
            {SUB_STATS.map(({ label, value, delta, up }, i) => (
              <div key={label} className={`px-5 md:px-6 py-4 ${i > 0 ? "border-l border-line" : ""} ${i >= 2 ? "border-t lg:border-t-0 border-line" : ""}`}>
                <p className="text-[11px] text-ink-3 mb-1.5">{label}</p>
                <p className="text-[18px] font-bold tracking-tight text-ink leading-none">{value}</p>
                <span className={`mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>
                  {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(delta).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sales mix */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-2">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Sales mix by category</h2>
              <p className="text-[12px] text-ink-3 mt-0.5">Last 30 days, all currencies normalised to USD</p>
            </div>
            <TrendingUp size={15} className="text-ink-3" />
          </div>
          <ul className="divide-y divide-line">
            {SALES_MIX.map(({ label, revenue, pct }) => (
              <li key={label} className="px-5 md:px-6 py-4">
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <p className="text-[13.5px] font-semibold tracking-tight text-ink">{label}</p>
                  <div className="flex items-baseline gap-3 whitespace-nowrap">
                    <span className="text-[13.5px] font-bold text-ink">{formatCurrency(revenue, "USD")}</span>
                    <span className="text-[12px] text-ink-3">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-paper-2 rounded-full overflow-hidden">
                  <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 3-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 tp-fade-up-3">
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">Top organizers</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-[10.5px] font-semibold tracking-widest text-ink-3 uppercase border-b border-line">
                  <th className="text-left px-5 py-2.5 font-semibold">Organizer</th>
                  <th className="text-right px-5 py-2.5 font-semibold">Events</th>
                  <th className="text-right px-5 py-2.5 font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ORGANIZERS.map((o) => (
                  <tr key={o.name} className="hover:bg-paper-2 transition-colors">
                    <td className="px-5 py-3 text-[12.5px] font-semibold text-ink">{o.name}</td>
                    <td className="px-5 py-3 text-right text-[12.5px] text-ink-2">{o.events}</td>
                    <td className="px-5 py-3 text-right text-[12.5px] font-bold text-ink whitespace-nowrap">
                      {formatCurrency(o.revenue, "USD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-2">
              <MapPin size={13} className="text-ink-3" />
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">Cities by revenue</h3>
            </div>
            <ul className="divide-y divide-line">
              {CITIES.map(({ name, revenue, pct }) => (
                <li key={name} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <p className="text-[12.5px] font-semibold text-ink">{name}</p>
                    <p className="text-[12.5px] font-bold text-ink whitespace-nowrap">{formatCurrency(revenue, "USD")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-paper-2 rounded-full overflow-hidden">
                      <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10.5px] text-ink-3 whitespace-nowrap tabular-nums">{pct.toFixed(1)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-2">
              <CreditCard size={13} className="text-ink-3" />
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">Payment method mix</h3>
            </div>
            <div className="px-5 py-5">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-paper-2">
                {PAYMENTS.map(({ label, pct, color }) => (
                  <div key={label} className={`${color}`} style={{ width: `${pct}%` }} title={`${label} ${pct}%`} />
                ))}
              </div>
              <ul className="mt-4 space-y-2.5">
                {PAYMENTS.map(({ label, pct, color }) => (
                  <li key={label} className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
                      {label}
                    </span>
                    <span className="text-[12.5px] font-bold text-ink">{pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
