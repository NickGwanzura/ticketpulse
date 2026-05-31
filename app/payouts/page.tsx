import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Wallet, Clock, CheckCircle2, ArrowUpRight,
  Send, Smartphone, Building2, Inbox, Banknote,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getOrganizerPayouts, getOrganizerBalance } from "./actions"

type PayoutStatus = "pending" | "approved" | "processing" | "paid" | "held" | "rejected" | "failed" | "cancelled"

const STATUS_STYLE: Record<PayoutStatus, string> = {
  pending:    "bg-amber-50 text-amber-700",
  approved:   "bg-violet-50 text-violet-700",
  processing: "bg-sky-50 text-sky-700",
  paid:       "bg-emerald-50 text-emerald-700",
  held:       "bg-rose-50 text-rose-700",
  rejected:   "bg-red-50 text-red-700",
  failed:     "bg-orange-50 text-orange-700",
  cancelled:  "bg-gray-50 text-gray-600",
}

const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending:   "Pending",
  approved:  "Approved",
  processing: "Processing",
  paid:      "Paid",
  held:      "Held",
  rejected:  "Rejected",
  failed:    "Failed",
  cancelled: "Cancelled",
}

export default async function PayoutsDashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  const userId = session.user.id
  const isOrganizer = session.user.role === "organizer" || session.user.role === "admin"

  const { payouts, stats } = await getOrganizerPayouts(userId)
  const { availableBalance, totalEarned, totalPaidOut, commissionRate, grossRevenue } = await getOrganizerBalance(userId)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Payouts"
        title="Your payouts"
        subtitle="Track revenue, request withdrawals, and view payment history."
        width="xl"
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-8">
        {/* Balance cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 tp-fade-up-1">
          <div className="rounded-2xl border border-line bg-paper p-5 tp-lift">
            <div className="flex items-center gap-2 mb-2.5">
              <Wallet size={15} className="text-ink-3" />
              <span className="text-[13px] text-ink-3">Available balance</span>
            </div>
            <p className="text-[28px] md:text-[32px] font-bold tracking-tight text-ink leading-none tabular-nums">
              {formatCurrency(availableBalance, "USD")}
            </p>
            <p className="text-[13px] text-ink-3 mt-2">Ready to withdraw</p>
          </div>

          <div className="rounded-2xl border border-line bg-paper p-5 tp-lift">
            <div className="flex items-center gap-2 mb-2.5">
              <Banknote size={15} className="text-ink-3" />
              <span className="text-[13px] text-ink-3">Total earned</span>
            </div>
            <p className="text-[28px] md:text-[32px] font-bold tracking-tight text-ink leading-none tabular-nums">
              {formatCurrency(totalEarned, "USD")}
            </p>
            <p className="text-[13px] text-ink-3 mt-2">All time revenue</p>
          </div>

          <div className="rounded-2xl border border-line bg-paper p-5 tp-lift">
            <div className="flex items-center gap-2 mb-2.5">
              <CheckCircle2 size={15} className="text-ink-3" />
              <span className="text-[13px] text-ink-3">Paid out</span>
            </div>
            <p className="text-[28px] md:text-[32px] font-bold tracking-tight text-ink leading-none tabular-nums">
              {formatCurrency(totalPaidOut, "USD")}
            </p>
            <p className="text-[13px] text-ink-3 mt-2">Already transferred</p>
          </div>
        </div>

        {/* Request payout CTA */}
        {availableBalance > 0 && (
          <div className="rounded-2xl border border-brand-500/15 bg-brand-50/60 px-5 md:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 tp-fade-up-2">
            <div className="flex items-start gap-3">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg bg-paper ring-1 ring-line shrink-0">
                <Send size={15} className="text-brand-600" />
              </span>
              <div>
                <p className="text-[14px] font-semibold tracking-tight text-ink">{formatCurrency(availableBalance, "USD")} available</p>
                <p className="text-[13px] text-ink-2">Request a payout to your EcoCash or bank account.</p>
              </div>
            </div>
            <Link
              href="/payouts/request"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 transition-colors"
            >
              <Send size={13} /> Request payout
            </Link>
          </div>
        )}

        {/* Payout history */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight text-ink">Payout history</h2>
          </div>

          {payouts.length > 0 ? (
            <>
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Method</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-right px-3 py-3 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-[14px] font-semibold tracking-tight text-ink">{p.eventTitle ?? "General"}</p>
                          <p className="text-[12px] text-ink-3 mt-0.5">{p.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-3 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
                            {p.method === "ecocash" ? <Smartphone size={12} className="text-emerald-700" /> : <Building2 size={12} className="text-sky-700" />}
                            {p.method === "ecocash" ? "EcoCash" : p.method === "bank_usd" ? "USD Bank" : "ZAR Bank"}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-[13px] text-ink-2 whitespace-nowrap">
                          {p.createdAt ? formatDateShort(new Date(p.createdAt)) : "—"}
                        </td>
                        <td className="px-3 py-4">
                          <span className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[p.status as PayoutStatus]}`}>
                            {STATUS_LABEL[p.status as PayoutStatus]}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right text-[14px] font-bold tracking-tight text-ink whitespace-nowrap">
                          {formatCurrency(Number(p.amount), p.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-line">
                {payouts.map((p) => (
                  <li key={p.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold tracking-tight text-ink truncate">{p.eventTitle ?? "General"}</p>
                        <p className="text-[12px] text-ink-3 mt-0.5">{p.createdAt ? formatDateShort(new Date(p.createdAt)) : "—"}</p>
                      </div>
                      <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[p.status as PayoutStatus]}`}>
                        {STATUS_LABEL[p.status as PayoutStatus]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        {p.method === "ecocash" ? <Smartphone size={12} className="text-emerald-700" /> : <Building2 size={12} className="text-sky-700" />}
                        {p.method === "ecocash" ? "EcoCash" : p.method === "bank_usd" ? "USD Bank" : "ZAR Bank"}
                      </span>
                      <span className="text-[14px] font-bold tracking-tight text-ink">
                        {formatCurrency(Number(p.amount), p.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No payouts yet"
              body="Your payout history will appear here once you request a withdrawal."
              variant="inline"
            />
          )}
        </div>
      </div>
    </div>
  )
}
