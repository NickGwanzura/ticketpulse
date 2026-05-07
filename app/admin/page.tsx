import Link from "next/link"
import {
  ArrowUpRight, ArrowDownRight,
  UserPlus, Wallet, CalendarCheck, RefreshCw, Store, ShieldCheck, Receipt, AlertCircle,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import { formatCurrency } from "@/lib/utils"

const KPIS = [
  { label: "Gross volume",  value: 482140, currency: "USD", delta: 12.4, up: true,  spark: [42, 45, 41, 48, 52, 50, 58, 64, 61, 72] },
  { label: "Net revenue",   value: 38571,  currency: "USD", delta: 8.7,  up: true,  spark: [22, 24, 23, 26, 28, 27, 30, 33, 31, 36] },
  { label: "Active events", value: 84,     currency: null,  delta: 4.2,  up: true,  spark: [60, 62, 64, 63, 68, 70, 74, 78, 80, 84] },
  { label: "New users",     value: 1247,   currency: null,  delta: -2.3, up: false, spark: [110, 124, 132, 118, 96, 102, 88, 94, 86, 92] },
] as const

const ACTIVITY = [
  { kind: "signup",   icon: UserPlus,      iconColor: "text-emerald-700",  iconBg: "bg-emerald-50", who: "Tinashe Moyo",        msg: "signed up as attendee",                    when: "2m ago" },
  { kind: "payout",   icon: Wallet,        iconColor: "text-violet-700",   iconBg: "bg-violet-50",  who: "Rumbidzai Chari",     msg: "received a payout of $2,140",              when: "14m ago" },
  { kind: "event",    icon: CalendarCheck, iconColor: "text-sky-700",      iconBg: "bg-sky-50",     who: "Tariro Events",       msg: "published 'Harare Jazz Night'",            when: "38m ago" },
  { kind: "refund",   icon: RefreshCw,     iconColor: "text-amber-700",    iconBg: "bg-amber-50",   who: "Order #TP-9421",      msg: "refund issued for $48",                    when: "1h ago" },
  { kind: "vendor",   icon: Store,         iconColor: "text-indigo-700",   iconBg: "bg-indigo-50",  who: "Anesu Sound & AV",    msg: "applied for vendor verification",          when: "2h ago" },
  { kind: "verify",   icon: ShieldCheck,   iconColor: "text-emerald-700",  iconBg: "bg-emerald-50", who: "Kudzai Productions",  msg: "passed organizer verification",            when: "3h ago" },
  { kind: "order",    icon: Receipt,       iconColor: "text-blue",         iconBg: "bg-blue-soft",  who: "Order #TP-9418",      msg: "checkout completed for ZAR 1,470",         when: "4h ago" },
  { kind: "alert",    icon: AlertCircle,   iconColor: "text-rose-700",     iconBg: "bg-rose-50",    who: "Munyaradzi Tafadzwa", msg: "flagged for repeated chargebacks",         when: "6h ago" },
] as const

const TOP_EVENTS = [
  { title: "Rumble in SA, Pretoria",            organizer: "Tariro Events",      sold: 1620, capacity: 2000, revenue: 248000, currency: "ZAR" },
  { title: "Nyuki Marathon 2026",                organizer: "Kudzai Productions", sold: 1280, capacity: 2000, revenue: 9430,   currency: "USD" },
  { title: "Harare Jazz Night",                  organizer: "Chiedza Live",       sold: 642,  capacity: 800,  revenue: 5780,   currency: "USD" },
  { title: "Vic Falls Eco Expedition",           organizer: "Tendai Outdoors",    sold: 184,  capacity: 240,  revenue: 8420,   currency: "USD" },
  { title: "Bulawayo Film Premiere: Mukoma",     organizer: "Farai Films",        sold: 320,  capacity: 500,  revenue: 2240,   currency: "USD" },
] as const

const PENDING = [
  { kind: "Event",   title: "Mutare Country Fair",    detail: "Publish request from Anesu Events",     primary: "Approve" },
  { kind: "Vendor",  title: "Munyaradzi Catering",    detail: "Verification documents submitted",       primary: "Verify" },
  { kind: "Refund",  title: "Order #TP-9298",         detail: "$120 refund requested by Rumbidzai M.", primary: "Approve" },
] as const

function Sparkline({ points, up }: { points: readonly number[]; up: boolean }) {
  const w = 120, h = 36, pad = 2
  const min = Math.min(...points), max = Math.max(...points)
  const span = max - min || 1
  const step = (w - pad * 2) / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = pad + i * step
    const y = h - pad - ((v - min) / span) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={coords}
        fill="none"
        stroke={up ? "rgb(10 37 64)" : "rgb(190 18 60)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function AdminOverviewPage() {
  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Overview"
        title="Platform pulse"
        subtitle="Real-time activity across organizers, vendors, and attendees."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-8">
        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {KPIS.map(({ label, value, currency, delta, up, spark }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
              <p className="text-[11.5px] text-ink-3 mb-2.5">{label}</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {currency ? formatCurrency(value, currency) : value.toLocaleString()}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>
                  {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                  {Math.abs(delta).toFixed(1)}% MoM
                </span>
                <div className="flex-1 max-w-[120px]">
                  <Sparkline points={spark} up={up} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Activity + Top events */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 tp-fade-up-2">
          <div className="lg:col-span-3 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Recent activity</h2>
              <Link href="/admin/orders" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                View all <ArrowUpRight size={12} />
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {ACTIVITY.map((a, i) => {
                const Icon = a.icon
                return (
                  <li key={i} className="px-5 md:px-6 py-3.5 flex items-start gap-3 hover:bg-paper-2 transition-colors">
                    <span className={`shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-lg ${a.iconBg}`}>
                      <Icon size={14} className={a.iconColor} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] text-ink leading-snug">
                        <span className="font-semibold">{a.who}</span> <span className="text-ink-2">{a.msg}</span>
                      </p>
                      <p className="text-[11.5px] text-ink-3 mt-0.5">{a.when}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Top events this week</h2>
              <Link href="/admin/events" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                Manage <ArrowUpRight size={12} />
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {TOP_EVENTS.map((e) => {
                const pct = Math.round((e.sold / e.capacity) * 100)
                return (
                  <li key={e.title} className="px-5 md:px-6 py-3.5 hover:bg-paper-2 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{e.title}</p>
                        <p className="text-[11.5px] text-ink-3 mt-0.5">{e.organizer}</p>
                      </div>
                      <p className="text-[13px] font-bold tracking-tight text-ink whitespace-nowrap">
                        {formatCurrency(e.revenue, e.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-paper-2 rounded-full overflow-hidden">
                        <div className="h-full bg-navy tp-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-ink-3 whitespace-nowrap tabular-nums">{e.sold}/{e.capacity}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Pending review */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Pending review</h2>
              <p className="text-[12px] text-ink-3 mt-0.5">{PENDING.length} items waiting on you</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-[11px] font-semibold">
              <AlertCircle size={11} /> Action needed
            </span>
          </div>
          <ul className="divide-y divide-line">
            {PENDING.map((p, i) => (
              <li key={i} className="px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-paper-2 text-ink-2 ring-1 ring-line">
                      {p.kind}
                    </span>
                    <p className="text-[13.5px] font-semibold tracking-tight text-ink truncate">{p.title}</p>
                  </div>
                  <p className="text-[12.5px] text-ink-2">{p.detail}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors">
                    Reject
                  </button>
                  <button className="rounded-lg bg-navy text-white px-3 py-1.5 text-[12.5px] font-semibold shadow-sm shadow-navy/20 hover:bg-navy-700 transition-colors">
                    {p.primary}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
