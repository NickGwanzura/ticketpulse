import Link from "next/link"
import {
  ArrowUpRight, ArrowDownRight,
  AlertCircle, CalendarCheck, LayoutList,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"

type KPI = { label: string; value: number; currency: string | null; delta: number; up: boolean; spark: readonly number[] }
type Activity = { kind: string; icon: React.ElementType; iconColor: string; iconBg: string; who: string; msg: string; when: string }
type TopEvent = { title: string; organizer: string; sold: number; capacity: number; revenue: number; currency: string }
type Pending = { kind: string; title: string; detail: string; primary: string }

const KPIS: KPI[] = []
const ACTIVITY: Activity[] = []
const TOP_EVENTS: TopEvent[] = []
const PENDING: Pending[] = []

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
          {KPIS.length > 0 ? KPIS.map(({ label, value, currency, delta, up, spark }) => (
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
          )) : (
            <>
              {["Gross volume", "Net revenue", "Active events", "New users"].map((label) => (
                <div key={label} className="rounded-2xl border border-line bg-paper p-5 tp-lift">
                  <p className="text-[11.5px] text-ink-3 mb-2.5">{label}</p>
                  <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">0</p>
                  <div className="mt-3">
                    <span className="text-[11.5px] text-ink-3">No data yet</span>
                  </div>
                </div>
              ))}
            </>
          )}
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
            {ACTIVITY.length > 0 ? (
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
            ) : (
              <EmptyState
                icon={LayoutList}
                title="No activity yet"
                body="Platform events, signups, orders, payouts, and refunds will appear here."
                variant="inline"
              />
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-line">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Top events this week</h2>
              <Link href="/admin/events" className="text-[12.5px] font-semibold text-navy inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                Manage <ArrowUpRight size={12} />
              </Link>
            </div>
            {TOP_EVENTS.length > 0 ? (
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
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="No events this week"
                body="Published events with ticket sales will appear here."
                variant="inline"
              />
            )}
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
          {PENDING.length > 0 ? (
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
          ) : (
            <EmptyState
              icon={AlertCircle}
              title="All clear"
              body="No events, vendors, or refunds are waiting for review."
              variant="inline"
            />
          )}
        </div>
      </div>
    </div>
  )
}
