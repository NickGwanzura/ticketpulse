import { Search, DollarSign, Receipt, RefreshCw, TrendingUp, Smartphone, CreditCard, Building2, Banknote } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import { formatCurrency, formatDateShort } from "@/lib/utils"

type Status = "paid" | "pending" | "refunded"
type Method = "EcoCash" | "Card" | "Bank" | "USD cash"

const ORDERS = [
  { id: "TP-9421", customer: "Tinashe Moyo",       event: "Nyuki Marathon 2026",            amount: 48,    currency: "USD", method: "EcoCash"  as Method, status: "refunded" as Status, at: new Date("2026-05-07") },
  { id: "TP-9420", customer: "Rumbidzai Chari",    event: "Harare Jazz Night",              amount: 30,    currency: "USD", method: "Card"     as Method, status: "paid"     as Status, at: new Date("2026-05-07") },
  { id: "TP-9419", customer: "Tariro Chiweshe",    event: "Rumble in SA, Pretoria",         amount: 1470,  currency: "ZAR", method: "Card"     as Method, status: "paid"     as Status, at: new Date("2026-05-07") },
  { id: "TP-9418", customer: "Kudzai Madziwa",     event: "Vic Falls Eco Expedition",       amount: 220,   currency: "USD", method: "Bank"     as Method, status: "paid"     as Status, at: new Date("2026-05-07") },
  { id: "TP-9417", customer: "Farai Sibanda",      event: "Bulawayo Film Premiere: Mukoma", amount: 14,    currency: "USD", method: "EcoCash"  as Method, status: "paid"     as Status, at: new Date("2026-05-06") },
  { id: "TP-9416", customer: "Anesu Mhondoro",     event: "Nyuki Marathon 2026",            amount: 48,    currency: "USD", method: "EcoCash"  as Method, status: "paid"     as Status, at: new Date("2026-05-06") },
  { id: "TP-9415", customer: "Munyaradzi T.",      event: "Avondale Open Mic",              amount: 12,    currency: "USD", method: "USD cash" as Method, status: "pending"  as Status, at: new Date("2026-05-06") },
  { id: "TP-9414", customer: "Chiedza Madenga",    event: "Harare Jazz Night",              amount: 60,    currency: "USD", method: "Card"     as Method, status: "paid"     as Status, at: new Date("2026-05-05") },
  { id: "TP-9413", customer: "Tendai Ncube",       event: "CBD 5K",                          amount: 8,     currency: "USD", method: "EcoCash"  as Method, status: "paid"     as Status, at: new Date("2026-05-05") },
  { id: "TP-9412", customer: "Tariro Chiweshe",    event: "Rumble in SA, Pretoria",         amount: 980,   currency: "ZAR", method: "Card"     as Method, status: "refunded" as Status, at: new Date("2026-05-05") },
  { id: "TP-9411", customer: "Rumbidzai Chari",    event: "Borrowdale Art Exhibition",      amount: 22,    currency: "USD", method: "EcoCash"  as Method, status: "paid"     as Status, at: new Date("2026-05-04") },
  { id: "TP-9410", customer: "Tinashe Moyo",       event: "Nyuki Warm-up Run",              amount: 6,     currency: "USD", method: "EcoCash"  as Method, status: "paid"     as Status, at: new Date("2026-05-04") },
] as const

const STATUS_STYLE: Record<Status, string> = {
  paid:     "bg-emerald-50 text-emerald-700",
  pending:  "bg-amber-50 text-amber-700",
  refunded: "bg-rose-50 text-rose-700",
}

const METHOD_ICON: Record<Method, { Icon: typeof Smartphone; color: string }> = {
  "EcoCash":  { Icon: Smartphone, color: "text-emerald-700" },
  "Card":     { Icon: CreditCard, color: "text-blue" },
  "Bank":     { Icon: Building2,  color: "text-sky-700" },
  "USD cash": { Icon: Banknote,   color: "text-amber-700" },
}

const FILTER_PILLS = ["All", "Paid", "Pending", "Refunded"]

export default function AdminOrdersPage() {
  const stats = [
    { label: "Today's revenue",   value: "$2,420",   icon: DollarSign, tone: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Today's orders",    value: "48",       icon: Receipt,    tone: "text-sky-700",     bg: "bg-sky-50" },
    { label: "Refunds this week", value: "6",        icon: RefreshCw,  tone: "text-rose-700",    bg: "bg-rose-50" },
    { label: "AOV",               value: "$48.20",   icon: TrendingUp, tone: "text-blue",        bg: "bg-blue-soft" },
  ]

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Orders"
        title="Recent transactions"
        subtitle="Every order placed across the platform."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {stats.map(({ label, value, icon: Icon, tone, bg }) => (
            <div key={label} className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
              <span className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${bg}`}>
                <Icon size={16} className={tone} />
              </span>
              <div>
                <p className="text-[11.5px] text-ink-3 mb-0.5">{label}</p>
                <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3 tp-fade-up-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="Search by order # or customer"
              className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {FILTER_PILLS.map((p, i) => (
              <button
                key={p}
                className={`rounded-lg px-3.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                  i === 0 ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                  <th className="text-left px-5 py-3 font-semibold">Order</th>
                  <th className="text-left px-3 py-3 font-semibold">Customer</th>
                  <th className="text-left px-3 py-3 font-semibold">Event</th>
                  <th className="text-left px-3 py-3 font-semibold">Method</th>
                  <th className="text-left px-3 py-3 font-semibold">Status</th>
                  <th className="text-left px-3 py-3 font-semibold">Date</th>
                  <th className="text-right px-5 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ORDERS.map((o) => {
                  const { Icon, color } = METHOD_ICON[o.method]
                  return (
                    <tr key={o.id} className="hover:bg-paper-2 transition-colors">
                      <td className="px-5 py-3.5 text-[12.5px] font-mono font-semibold text-ink whitespace-nowrap">#{o.id}</td>
                      <td className="px-3 py-3.5 text-[12.5px] text-ink whitespace-nowrap">{o.customer}</td>
                      <td className="px-3 py-3.5 text-[12.5px] text-ink-2 line-clamp-1 max-w-[220px]">{o.event}</td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                          <Icon size={12} className={color} />
                          {o.method}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[o.status]}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">{formatDateShort(o.at)}</td>
                      <td className="px-5 py-3.5 text-right text-[13.5px] font-bold tracking-tight text-ink whitespace-nowrap">
                        {formatCurrency(o.amount, o.currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden divide-y divide-line">
            {ORDERS.map((o) => {
              const { Icon, color } = METHOD_ICON[o.method]
              return (
                <li key={o.id} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-mono font-semibold text-ink-3">#{o.id}</p>
                      <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1">{o.customer}</p>
                      <p className="text-[11.5px] text-ink-3 line-clamp-1">{o.event}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                        {formatCurrency(o.amount, o.currency)}
                      </p>
                      <span className={`mt-1 inline-block text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status]}`}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-ink-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon size={11} className={color} /> {o.method}
                    </span>
                    <span>{formatDateShort(o.at)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
