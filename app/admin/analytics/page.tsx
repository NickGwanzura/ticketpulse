import { ArrowUpRight, MapPin, CreditCard, TrendingUp, BarChart2, Users, PieChart } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency } from "@/lib/utils"
import AiNarrativeSummary from "@/components/ai/AiNarrativeSummary"

type SubStat = { label: string; value: string; delta: number; up: boolean }
type SalesMixItem = { label: string; revenue: number; pct: number }
type OrganizerItem = { name: string; events: number; revenue: number }
type CityItem = { name: string; revenue: number; pct: number }
type PaymentItem = { label: string; pct: number; color: string }

const REVENUE_30D: readonly number[] = []
const SUB_STATS: SubStat[] = []
const SALES_MIX: SalesMixItem[] = []
const ORGANIZERS: OrganizerItem[] = []
const CITIES: CityItem[] = []
const PAYMENTS: PaymentItem[] = []

export default function AdminAnalyticsPage() {
  const total = REVENUE_30D.reduce((s, v) => s + v, 0)

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
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-3">
                  <ArrowUpRight size={12} /> vs prev
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
            <EmptyState
              icon={BarChart2}
              title="No revenue data yet"
              body="Revenue will chart here once the first ticket orders are placed."
              variant="inline"
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-line">
            {SUB_STATS.length > 0 ? SUB_STATS.map(({ label, value, delta, up }, i) => (
              <div key={label} className={`px-5 md:px-6 py-4 ${i > 0 ? "border-l border-line" : ""} ${i >= 2 ? "border-t lg:border-t-0 border-line" : ""}`}>
                <p className="text-[11px] text-ink-3 mb-1.5">{label}</p>
                <p className="text-[18px] font-bold tracking-tight text-ink leading-none">{value}</p>
                <span className={`mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>
                  <ArrowUpRight size={11} />
                  {Math.abs(delta).toFixed(1)}%
                </span>
              </div>
            )) : (
              <>
                {["Avg order value", "Conversion rate", "Refund rate", "Tickets / event"].map((label, i) => (
                  <div key={label} className={`px-5 md:px-6 py-4 ${i > 0 ? "border-l border-line" : ""} ${i >= 2 ? "border-t lg:border-t-0 border-line" : ""}`}>
                    <p className="text-[11px] text-ink-3 mb-1.5">{label}</p>
                    <p className="text-[18px] font-bold tracking-tight text-ink leading-none">0</p>
                  </div>
                ))}
              </>
            )}
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
          {SALES_MIX.length > 0 ? (
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
            totalRevenue={total}
            eventCount={0}
            organizerCount={0}
            topCity="N/A"
            topCategory="N/A"
            paymentMethods={[]}
          />
        </div>

        {/* 3-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 tp-fade-up-3">
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">Top organizers</h3>
            </div>
            {ORGANIZERS.length > 0 ? (
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
            ) : (
              <EmptyState
                icon={Users}
                title="No organizer data"
                body="Top organizers by revenue will appear here."
                variant="inline"
              />
            )}
          </div>

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
            ) : (
              <EmptyState
                icon={MapPin}
                title="No city data"
                body="Revenue by city will appear after orders come in."
                variant="inline"
              />
            )}
          </div>

          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center gap-2">
              <CreditCard size={13} className="text-ink-3" />
              <h3 className="text-[14px] font-semibold tracking-tight text-ink">Payment method mix</h3>
            </div>
            {PAYMENTS.length > 0 ? (
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
