import Link from "next/link"
import { Wallet, Clock, CheckCircle2, AlertOctagon, Send, ArrowUpRight, Smartphone, Building2, Inbox, Loader2 } from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getPayouts, processPayoutAction, updatePayoutStatusAction } from "./actions"

type PayoutStatus = "pending" | "approved" | "processing" | "paid" | "held"

const STATUS_STYLE: Record<PayoutStatus, string> = {
  pending:   "bg-amber-50 text-amber-700",
  approved:  "bg-violet-50 text-violet-700",
  processing: "bg-sky-50 text-sky-700",
  paid:      "bg-emerald-50 text-emerald-700",
  held:      "bg-rose-50 text-rose-700",
}

const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending:   "Pending",
  approved:  "Approved",
  processing: "Processing",
  paid:      "Paid",
  held:      "Held",
}

const TABS: { key: PayoutStatus | "all"; label: string }[] = [
  { key: "pending",   label: "Pending" },
  { key: "approved",  label: "Approved" },
  { key: "processing", label: "Processing" },
  { key: "paid",      label: "Paid" },
  { key: "held",      label: "Held" },
]

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams
  const active = (params.status as PayoutStatus | "all" | undefined) ?? "pending"

  const { payouts: payoutRows, stats } = await getPayouts(active === "all" ? undefined : active)

  const statsCards = [
    { label: "Pending payouts", value: stats.pending,   icon: Clock,         tone: "text-amber-700",   bg: "bg-amber-50" },
    { label: "Approved",        value: stats.approved,  icon: CheckCircle2,  tone: "text-violet-700",  bg: "bg-violet-50" },
    { label: "Processing",      value: stats.processing, icon: Send,         tone: "text-sky-700",     bg: "bg-sky-50" },
    { label: "Paid",            value: stats.paid,      icon: CheckCircle2,  tone: "text-emerald-700", bg: "bg-emerald-50" },
  ]

  const pendingTotal = Number(stats.pendingTotal ?? 0)

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
          {statsCards.map(({ label, value, icon: Icon, tone, bg }) => (
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
        {pendingTotal > 0 && (
          <div className="rounded-2xl border border-brand-500/15 bg-brand-50/60 px-5 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 tp-fade-up-2">
            <div className="flex items-start gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line shrink-0">
                <Wallet size={15} className="text-brand-600" />
              </span>
              <div>
                <p className="text-[14px] font-semibold tracking-tight text-ink">{formatCurrency(pendingTotal, "USD")} ready to send</p>
                <p className="text-[12.5px] text-ink-2">{stats.pending} pending payout request{stats.pending !== 1 ? "s" : ""} awaiting processing.</p>
              </div>
            </div>
            <Link
              href="/admin/payouts?status=pending"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition-colors"
            >
              <Send size={13} /> Review pending
            </Link>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(({ key, label }) => {
            const isActive = active === key
            const count = key === "pending" ? stats.pending
              : key === "approved" ? stats.approved
              : key === "processing" ? stats.processing
              : key === "paid" ? stats.paid
              : stats.held
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
          {payoutRows.length > 0 ? (
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
                    {payoutRows.map((p) => (
                      <tr key={p.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-[13.5px] font-semibold tracking-tight text-ink">{p.organizerName ?? "—"}</p>
                          <p className="text-[12px] text-ink-3 mt-0.5 line-clamp-1">{p.eventTitle ?? "General"} · {p.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-3 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
                            {p.method === "ecocash" ? <Smartphone size={12} className="text-emerald-700" /> : <Building2 size={12} className="text-sky-700" />}
                            {p.method === "ecocash" ? "EcoCash" : p.method === "bank_usd" ? "USD Bank" : "ZAR Bank"}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-[12.5px] text-ink-2 whitespace-nowrap">{p.createdAt ? formatDateShort(new Date(p.createdAt)) : "—"}</td>
                        <td className="px-3 py-4">
                          <span className={`text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[p.status as PayoutStatus]}`}>
                            {STATUS_LABEL[p.status as PayoutStatus]}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                          {formatCurrency(Number(p.amount), p.currency)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {p.status === "pending" && (
                            <form action={async () => { await processPayoutAction(p.id) }} className="inline-flex">
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-brand-700 transition-colors"
                              >
                                <Send size={11} /> Pay
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-line">
                {payoutRows.map((p) => (
                  <li key={p.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold tracking-tight text-ink truncate">{p.organizerName ?? "—"}</p>
                        <p className="text-[12px] text-ink-3 mt-0.5 line-clamp-1">{p.eventTitle ?? "General"}</p>
                      </div>
                      <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[p.status as PayoutStatus]}`}>
                        {STATUS_LABEL[p.status as PayoutStatus]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        {p.method === "ecocash" ? <Smartphone size={12} className="text-emerald-700" /> : <Building2 size={12} className="text-sky-700" />}
                        {p.method === "ecocash" ? "EcoCash" : p.method === "bank_usd" ? "USD Bank" : "ZAR Bank"} · {p.createdAt ? formatDateShort(new Date(p.createdAt)) : "—"}
                      </span>
                      <span className="text-[14px] font-bold tracking-tight text-ink">
                        {formatCurrency(Number(p.amount), p.currency)}
                      </span>
                    </div>
                    {p.status === "pending" && (
                      <form action={async () => { await processPayoutAction(p.id) }} className="mt-3">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-700 transition-colors"
                        >
                          <Send size={12} /> Mark as paid
                        </button>
                      </form>
                    )}
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
