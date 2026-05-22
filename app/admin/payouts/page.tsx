import Link from "next/link"
import { Wallet, Clock, CheckCircle2, AlertOctagon, Send, ArrowUpRight, Smartphone, Building2, Inbox } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"

type Status = "pending" | "transit" | "completed" | "held"

type Payout = {
  id: string
  organizer: string
  event: string
  amount: number
  currency: string
  method: string
  requestedAt: Date
  status: Status
}

const PAYOUTS: Payout[] = []

const STATUS_STYLE: Record<Status, string> = {
  pending:   "bg-amber-50 text-amber-700",
  transit:   "bg-sky-50 text-sky-700",
  completed: "bg-green-50 text-green-700",
  held:      "bg-rose-50 text-rose-700",
}

const STATUS_LABEL: Record<Status, string> = {
  pending:   "Pending",
  transit:   "In transit",
  completed: "Completed",
  held:      "Held",
}

const TABS: { key: Status | "all"; label: string }[] = [
  { key: "pending",   label: "Pending" },
  { key: "transit",   label: "In transit" },
  { key: "completed", label: "Completed" },
  { key: "held",      label: "Held" },
]

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams
  const active = (params.status as Status | undefined) ?? "pending"

  const visible = PAYOUTS.filter((p) => p.status === active)

  const stats = [
    { label: "Pending payouts", value: PAYOUTS.filter((p) => p.status === "pending").length,   icon: Clock,         tone: "text-amber-700",   bg: "bg-amber-50" },
    { label: "In transit",      value: PAYOUTS.filter((p) => p.status === "transit").length,   icon: Send,          tone: "text-sky-700",     bg: "bg-sky-50" },
    { label: "Paid this month", value: PAYOUTS.filter((p) => p.status === "completed").length, icon: CheckCircle2,  tone: "text-green-700", bg: "bg-green-50" },
    { label: "Held",            value: PAYOUTS.filter((p) => p.status === "held").length,      icon: AlertOctagon,  tone: "text-rose-700",    bg: "bg-rose-50" },
  ]

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Payouts"
        title="Organizer payouts"
        subtitle="Review and process payout requests across EcoCash and bank transfers."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Stats */}
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

        {/* CTA banner */}
        <div className="rounded-2xl border border-blue/15 bg-blue-soft/60 px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 tp-fade-up-2">
          <div className="flex items-start gap-3">
            <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line shrink-0">
              <Wallet size={15} className="text-blue" />
            </span>
            <div>
              <p className="text-[14px] font-semibold tracking-tight text-ink">{formatCurrency(0, "USD")} ready to send</p>
              <p className="text-[12.5px] text-ink-2">No pending payouts. New requests will appear here.</p>
            </div>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm shadow-green-600/20 hover:bg-green-700 transition-colors">
            <Send size={13} /> Process payouts
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(({ key, label }) => {
            const isActive = active === key
            const count = PAYOUTS.filter((p) => p.status === key).length
            return (
              <Link
                key={key}
                href={`/admin/payouts?status=${key}`}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors ${
                  isActive ? "bg-paper-2 text-ink font-semibold ring-1 ring-line" : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                {label}
                <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full px-1 text-[10.5px] font-bold ${
                  isActive ? "bg-navy text-white" : "bg-paper-2 text-ink-3 ring-1 ring-line"
                }`}>{count}</span>
              </Link>
            )
          })}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          {visible.length > 0 ? (
            <>
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">Organizer / Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Method</th>
                      <th className="text-left px-3 py-3 font-semibold">Requested</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-right px-3 py-3 font-semibold">Amount</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map((p) => (
                      <tr key={p.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-[13.5px] font-semibold tracking-tight text-ink">{p.organizer}</p>
                          <p className="text-[12px] text-ink-3 mt-0.5 line-clamp-1">{p.event} · {p.id}</p>
                        </td>
                        <td className="px-3 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                            {p.method === "EcoCash" ? <Smartphone size={12} className="text-green-700" /> : <Building2 size={12} className="text-sky-700" />}
                            {p.method}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-[12.5px] text-ink-2 whitespace-nowrap">{formatDateShort(p.requestedAt)}</td>
                        <td className="px-3 py-4">
                          <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[p.status]}`}>
                            {STATUS_LABEL[p.status]}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                          {formatCurrency(p.amount, p.currency)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy hover:gap-1.5 transition-all">
                            View <ArrowUpRight size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-line">
                {visible.map((p) => (
                  <li key={p.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold tracking-tight text-ink truncate">{p.organizer}</p>
                        <p className="text-[12px] text-ink-3 mt-0.5 line-clamp-1">{p.event}</p>
                      </div>
                      <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        {p.method === "EcoCash" ? <Smartphone size={12} className="text-green-700" /> : <Building2 size={12} className="text-sky-700" />}
                        {p.method} · {formatDateShort(p.requestedAt)}
                      </span>
                      <span className="text-[14px] font-bold tracking-tight text-ink">
                        {formatCurrency(p.amount, p.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No payouts in this status"
              body="When payouts are requested, processed, or held they'll appear here."
              variant="inline"
            />
          )}
        </div>
      </div>
    </div>
  )
}
