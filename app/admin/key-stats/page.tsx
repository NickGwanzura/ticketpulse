import { redirect } from "next/navigation"
import {
  Banknote, Ticket, Calendar, Users, Receipt, Scan, MapPin,
  Star, TrendingUp, FileDown, Building2,
} from "lucide-react"

import { auth } from "@/auth"
import PageHeader from "@/components/dashboard/PageHeader"
import { formatCurrency } from "@/lib/utils"
import { getPlatformKeyStats } from "@/lib/key-stats"

export const dynamic = "force-dynamic"

function countFmt(value: number) {
  return value.toLocaleString("en-US")
}

export default async function AdminKeyStatsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/key-stats")
  }

  const stats = await getPlatformKeyStats()
  const maxMonthly = Math.max(...stats.monthlyTrend.map((m) => m.revenue), 1)

  const heroCards = [
    { label: "Gross ticket sales",  value: formatCurrency(stats.grossSales, "USD"),  icon: Banknote, tone: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Tickets sold",        value: countFmt(stats.ticketsSold),              icon: Ticket,   tone: "text-brand-600",   bg: "bg-brand-50" },
    { label: "Events hosted",       value: countFmt(stats.eventsHosted),             icon: Calendar, tone: "text-violet-700",  bg: "bg-violet-50" },
    { label: "Attendees reached",   value: countFmt(stats.uniqueAttendees),          icon: Users,    tone: "text-sky-700",     bg: "bg-sky-50" },
  ]

  const secondaryCards = [
    { label: "Confirmed orders",       value: countFmt(stats.confirmedOrders),                                icon: Receipt },
    { label: "Avg order value",        value: formatCurrency(stats.avgOrderValue, "USD"),                     icon: TrendingUp },
    { label: "Tickets scanned",        value: countFmt(stats.checkIns),                                       icon: Scan },
    { label: "Cities covered",         value: countFmt(stats.citiesCovered),                                  icon: MapPin },
    { label: "Organizers",             value: countFmt(stats.organizers),                                     icon: Building2 },
    { label: "Avg event rating",       value: stats.avgRating != null ? `${stats.avgRating} / 5` : "—",       icon: Star },
  ]

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Key stats"
        title="Platform key statistics"
        subtitle="Live platform totals from confirmed paid orders — export as a branded PDF to share with potential clients."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Export CTA */}
        <div className="rounded-2xl border border-brand-500/15 bg-brand-50/60 px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 tp-fade-up-1">
          <div className="flex items-start gap-3">
            <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line shrink-0">
              <FileDown size={15} className="text-brand-600" />
            </span>
            <div>
              <p className="text-[14px] font-semibold tracking-tight text-ink">Client-ready one-pager</p>
              <p className="text-[13px] text-ink-2">Download these stats as a branded PDF to share with potential clients and partners.</p>
            </div>
          </div>
          <a
            href="/api/admin/key-stats/pdf"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition-colors"
          >
            <FileDown size={13} /> Download PDF
          </a>
        </div>

        {/* Hero stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {heroCards.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
              <span className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon size={16} className={tone} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] text-ink-3 mb-0.5">{label}</p>
                <p className="text-[24px] md:text-[26px] font-bold tracking-tight text-ink leading-none tabular-nums truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 tp-fade-up-2">
          {secondaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-4">
              <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-paper-2 ring-1 ring-line mb-3">
                <Icon size={14} className="text-ink-2" />
              </span>
              <p className="text-[11px] text-ink-3 mb-0.5">{label}</p>
              <p className="text-[18px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Last 30 days */}
        <div className="rounded-2xl border border-line bg-paper p-5 tp-fade-up-2">
          <p className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase mb-4">Last 30 days</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[12px] text-ink-3 mb-0.5">Revenue</p>
              <p className="text-[22px] font-bold tracking-tight text-emerald-600 tabular-nums">{formatCurrency(stats.last30.revenue, "USD")}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-3 mb-0.5">Tickets sold</p>
              <p className="text-[22px] font-bold tracking-tight text-ink tabular-nums">{countFmt(stats.last30.tickets)}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-3 mb-0.5">Orders</p>
              <p className="text-[22px] font-bold tracking-tight text-ink tabular-nums">{countFmt(stats.last30.orders)}</p>
            </div>
          </div>
        </div>

        {/* Monthly trend */}
        <div className="rounded-2xl border border-line bg-paper p-5 tp-fade-up-3">
          <p className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase mb-4">Monthly gross sales — last 6 months</p>
          <div className="space-y-3">
            {stats.monthlyTrend.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[12px] text-ink-2">{m.label}</span>
                <div className="flex-1 h-3 rounded-full bg-paper-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-navy"
                    style={{ width: `${Math.max((m.revenue / maxMonthly) * 100, m.revenue > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="w-40 shrink-0 text-right text-[12px] font-semibold text-ink tabular-nums">
                  {formatCurrency(m.revenue, "USD")} · {countFmt(m.tickets)} tix
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top events */}
        {stats.topEvents.length > 0 && (
          <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
            <p className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase px-5 pt-5 pb-3">Top events by gross sales</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[460px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                  <th className="text-left px-5 py-3 font-semibold">Event</th>
                  <th className="text-left px-3 py-3 font-semibold">City</th>
                  <th className="text-right px-3 py-3 font-semibold">Tickets</th>
                  <th className="text-right px-5 py-3 font-semibold">Gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.topEvents.map((event, i) => (
                  <tr key={`${event.title}-${i}`} className="hover:bg-paper-2 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-[14px] font-semibold tracking-tight text-ink">{event.title}</p>
                      {event.startsAt && (
                        <p className="text-[12px] text-ink-3 mt-0.5">
                          {new Date(event.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-4 text-[13px] text-ink-2">{event.city}</td>
                    <td className="px-3 py-4 text-right text-[13px] text-ink-2 tabular-nums">{countFmt(event.ticketsSold)}</td>
                    <td className="px-5 py-4 text-right text-[14px] font-bold tracking-tight text-ink tabular-nums">{formatCurrency(event.revenue, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </div>
    </div>
  )
}
