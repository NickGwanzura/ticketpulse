import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { eq, count, and } from "drizzle-orm"
import {
  Wallet, CheckCircle2,
  Send, Smartphone, Building2, Inbox, Banknote, ReceiptText,
} from "lucide-react"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { getOrganizerPayouts, getOrganizerBalance } from "./actions"
import { db } from "@/db"
import { users, payouts } from "@/db/schema"
import TrustJourney from "./TrustJourney"

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

function payoutMethodLabel(payout: { method: string }) {
  if (payout.method === "cash") return "Manual cash"
  if (payout.method === "ecocash") return "EcoCash"
  return "USD Bank"
}

function payoutDestination(payout: {
  method: string
  accountNumber: string | null
  accountName: string | null
  bankName: string | null
  proofReference: string | null
}) {
  if (payout.method === "cash") return payout.proofReference ? `Ref: ${payout.proofReference}` : "Manual cash"
  if (payout.method === "ecocash") return payout.accountNumber ? `EcoCash ${payout.accountNumber}` : "EcoCash"
  return [payout.bankName, payout.accountName, payout.accountNumber].filter(Boolean).join(" · ") || "Bank account"
}

export default async function PayoutsDashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/signin")

  const userId = session.user?.id
  if (!userId) redirect("/auth/signin")

  const { payouts: payoutRows } = await getOrganizerPayouts(userId)
  const {
    availableBalance,
    totalEarned,
    totalPaidOut,
    pendingTotal,
    commissionRate,
    grossRevenue,
    platformFee,
    confirmedTicketCount,
  } = await getOrganizerBalance(userId)

  // Trust journey data
  const [userRow, paidPayoutCount] = await Promise.all([
    db
      .select({ approvedAt: users.approvedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ count: count() })
      .from(payouts)
      .where(and(eq(payouts.userId, userId), eq(payouts.status, "paid")))
      .then((rows) => rows[0]?.count ?? 0),
  ])

  const totalPaidPayouts = Number(paidPayoutCount)
  const trustStatus =
    !userRow?.approvedAt
      ? "new"
      : totalPaidPayouts >= 3
      ? "trusted"
      : "verified"

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Payouts"
        title="Your payouts"
        subtitle="Track revenue, request withdrawals, and view payment history."
        width="xl"
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-8">
        {/* Trust journey */}
        <TrustJourney status={trustStatus} totalPaidPayouts={totalPaidPayouts} />

        {/* Balance cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
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
              <span className="text-[13px] text-ink-3">Net earned</span>
            </div>
            <p className="text-[28px] md:text-[32px] font-bold tracking-tight text-ink leading-none tabular-nums">
              {formatCurrency(totalEarned, "USD")}
            </p>
            <p className="text-[13px] text-ink-3 mt-2">After {commissionRate}% fee</p>
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

          <div className="rounded-2xl border border-line bg-paper p-5 tp-lift">
            <div className="flex items-center gap-2 mb-2.5">
              <ReceiptText size={15} className="text-ink-3" />
              <span className="text-[13px] text-ink-3">Confirmed tickets</span>
            </div>
            <p className="text-[28px] md:text-[32px] font-bold tracking-tight text-ink leading-none tabular-nums">
              {confirmedTicketCount}
            </p>
            <p className="text-[13px] text-ink-3 mt-2">{formatCurrency(grossRevenue, "USD")} gross</p>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5 tp-fade-up-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-ink">Payout calculation</h2>
              <p className="text-[13px] text-ink-2 mt-1">Only confirmed paid/completed ticket orders are included.</p>
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
              <div>
                <dt className="text-ink-3">Gross</dt>
                <dd className="font-bold text-ink tabular-nums">{formatCurrency(grossRevenue, "USD")}</dd>
              </div>
              <div>
                <dt className="text-ink-3">TicketPulse fee</dt>
                <dd className="font-bold text-ink tabular-nums">-{formatCurrency(platformFee, "USD")}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Pending payouts</dt>
                <dd className="font-bold text-ink tabular-nums">-{formatCurrency(pendingTotal, "USD")}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Available</dt>
                <dd className="font-bold text-ink tabular-nums">{formatCurrency(availableBalance, "USD")}</dd>
              </div>
            </dl>
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
                <p className="text-[13px] text-ink-2">Request a payout to your EcoCash wallet or bank account.</p>
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
        {availableBalance <= 0 && (
          <div className="rounded-2xl border border-line bg-paper-2 px-5 md:px-6 py-5 tp-fade-up-2">
            <p className="text-[14px] font-semibold tracking-tight text-ink">No payout available right now</p>
            <p className="mt-1 text-[13px] text-ink-2">
              {pendingTotal > 0
                ? `${formatCurrency(pendingTotal, "USD")} is already pending review.`
                : grossRevenue > 0
                ? "Your confirmed net revenue has either been paid out or is not yet available after reconciliation."
                : "Confirmed paid ticket revenue will appear here once tickets are sold and payments clear."}
            </p>
          </div>
        )}

        {/* Payout history */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          <div className="px-5 md:px-6 py-4 border-b border-line flex items-center justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight text-ink">Payout history</h2>
          </div>

          {payoutRows.length > 0 ? (
            <>
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Method</th>
                      <th className="text-left px-3 py-3 font-semibold">Destination / proof</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-right px-3 py-3 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payoutRows.map((p) => (
                      <tr key={p.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-[14px] font-semibold tracking-tight text-ink">{p.eventTitle ?? "General"}</p>
                          <p className="text-[12px] text-ink-3 mt-0.5">{p.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-3 py-4">
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
                            {p.method === "cash" ? <Banknote size={12} className="text-emerald-700" /> : p.method === "ecocash" ? <Smartphone size={12} className="text-emerald-700" /> : <Building2 size={12} className="text-sky-700" />}
                            {payoutMethodLabel(p)}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <p className="max-w-[260px] truncate text-[12px] text-ink-2">{payoutDestination(p)}</p>
                          {p.rejectionReason && (
                            <p className="mt-1 max-w-[260px] truncate text-[11px] text-red-600">Rejected: {p.rejectionReason}</p>
                          )}
                          {p.proofReference && p.method !== "cash" && (
                            <p className="mt-1 max-w-[260px] truncate text-[11px] text-ink-3">Proof: {p.proofReference}</p>
                          )}
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
                {payoutRows.map((p) => (
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
                        {p.method === "cash" ? <Banknote size={12} className="text-emerald-700" /> : p.method === "ecocash" ? <Smartphone size={12} className="text-emerald-700" /> : <Building2 size={12} className="text-sky-700" />}
                        {payoutMethodLabel(p)}
                      </span>
                      <span className="text-[14px] font-bold tracking-tight text-ink">
                        {formatCurrency(Number(p.amount), p.currency)}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-3 leading-4">{payoutDestination(p)}</p>
                    {p.rejectionReason && (
                      <p className="mt-1 text-[11px] text-red-600">{p.rejectionReason}</p>
                    )}
                    {p.proofReference && p.method !== "cash" && (
                      <p className="mt-1 text-[11px] text-ink-3">Proof: {p.proofReference}</p>
                    )}
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
