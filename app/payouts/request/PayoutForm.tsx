"use client"

import { useRouter } from "next/navigation"
import { useActionState, useState, useEffect } from "react"
import Link from "next/link"
import {
  ArrowLeft, Send, Smartphone, Building2, AlertCircle, CheckCircle2,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { requestPayoutAction } from "../actions"
import { useToast } from "@/components/ui/Toast"

type PayoutMethod = "ecocash" | "bank_usd"

const METHOD_LABELS: Record<PayoutMethod, string> = {
  ecocash: "EcoCash",
  bank_usd: "USD Bank Transfer",
}

const METHOD_ICONS: Record<PayoutMethod, typeof Smartphone> = {
  ecocash: Smartphone,
  bank_usd: Building2,
}

type BalanceData = {
  availableBalance: number
  totalEarned: number
  totalPaidOut: number
  pendingTotal: number
  commissionRate: number
  grossRevenue: number
  platformFee: number
  confirmedOrderCount: number
  confirmedTicketCount: number
}

export default function PayoutForm({ balance }: { balance: BalanceData }) {
  const router = useRouter()
  const { toast } = useToast()
  const [method, setMethod] = useState<PayoutMethod>("bank_usd")
  const [amount, setAmount] = useState("")
  const [ecocashNumber, setEcocashNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [bankName, setBankName] = useState("")

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      try {
        const result = await requestPayoutAction(formData)
        if (!result.ok) return { error: result.message }
        router.push("/payouts?success=1")
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to submit payout request" }
      }
    },
    { error: null as string | null }
  )

  useEffect(() => {
    if (state?.error) toast({ title: "Could not submit request", description: state.error, variant: "error" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.error])

  const parsedAmount = parseFloat(amount) || 0
  const exceedsBalance = parsedAmount > balance.availableBalance
  const remainingAfterRequest = Math.max(0, balance.availableBalance - parsedAmount)

  return (
    <div className="tp-fade-up">
      <div className="max-w-lg mx-auto px-5 md:px-0 pt-8 pb-16">
        {/* Back link */}
        <Link
          href="/payouts"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to payouts
        </Link>

        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-line">
            <h1 className="text-[22px] font-bold tracking-tight text-ink">Request payout</h1>
            <p className="text-[14px] text-ink-2 mt-1">
              Available balance: <span className="font-semibold text-ink tabular-nums">{formatCurrency(balance.availableBalance, "USD")}</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-paper-2 px-3 py-2">
                <p className="text-[11px] text-ink-3">Confirmed tickets</p>
                <p className="text-[15px] font-bold text-ink tabular-nums">{balance.confirmedTicketCount}</p>
              </div>
              <div className="rounded-lg bg-paper-2 px-3 py-2">
                <p className="text-[11px] text-ink-3">Gross sales</p>
                <p className="text-[15px] font-bold text-ink tabular-nums">{formatCurrency(balance.grossRevenue, "USD")}</p>
              </div>
              <div className="rounded-lg bg-paper-2 px-3 py-2">
                <p className="text-[11px] text-ink-3">You receive</p>
                <p className="text-[15px] font-bold text-ink tabular-nums">{formatCurrency(balance.totalEarned, "USD")}</p>
              </div>
            </div>
          </div>

          <form action={formAction} className="p-6 space-y-5">
            {/* Error */}
            {state?.error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
                <AlertCircle size={15} className="text-rose-600 mt-0.5 shrink-0" />
                <p className="text-[13px] text-rose-700">{state.error}</p>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="text-[13px] font-semibold text-ink mb-1.5 block">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-ink-3 font-semibold">$</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  max={balance.availableBalance}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full rounded-xl border border-line bg-paper px-8 py-3 text-[18px] font-bold tracking-tight text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition tabular-nums"
                />
              </div>
              {amount && exceedsBalance && (
                <p className="text-[12px] text-rose-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={12} /> Amount exceeds available balance
                </p>
              )}
              {balance.availableBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(balance.availableBalance.toFixed(2))}
                  className="text-[12px] text-brand-600 font-medium hover:text-brand-700 mt-1.5 transition-colors"
                >
                  Max: {formatCurrency(balance.availableBalance, "USD")}
                </button>
              )}
            </div>

            {/* Payout method */}
            <div>
              <label className="text-[13px] font-semibold text-ink mb-1.5 block">Payout method</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(METHOD_LABELS) as [PayoutMethod, string][]).map(([key, label]) => {
                  const Icon = METHOD_ICONS[key]
                  const isActive = method === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMethod(key)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[12px] font-medium transition-all ${
                        isActive
                          ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600/20"
                          : "border-line text-ink-2 hover:text-ink hover:bg-paper-2"
                      }`}
                    >
                      <Icon size={18} className={isActive ? "text-brand-600" : "text-ink-3"} />
                      {label.split(" ")[0]}
                    </button>
                  )
                })}
              </div>
              <input type="hidden" name="method" value={method} />
            </div>

            {/* EcoCash details */}
            {method === "ecocash" && (
              <div>
                <label className="text-[13px] font-semibold text-ink mb-1.5 block">EcoCash number</label>
                <input
                  name="ecocashNumber"
                  type="tel"
                  placeholder="0771 234 567"
                  value={ecocashNumber}
                  onChange={(e) => setEcocashNumber(e.target.value)}
                  required
                  className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition"
                />
                <p className="text-[12px] text-ink-3 mt-1">Funds are settled to this EcoCash number</p>
              </div>
            )}

            {/* Bank details */}
            {method === "bank_usd" && (
              <div className="space-y-4">
                <div>
                  <label className="text-[13px] font-semibold text-ink mb-1.5 block">Bank name</label>
                  <input
                    name="bankName"
                    type="text"
                    placeholder="e.g. CBZ, NMB, Stanbic"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-ink mb-1.5 block">Account number</label>
                  <input
                    name="accountNumber"
                    type="text"
                    placeholder="Enter account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-ink mb-1.5 block">Account holder name</label>
                  <input
                    name="accountName"
                    type="text"
                    placeholder="Full name as on bank account"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-[14px] text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-600 transition"
                  />
                </div>
              </div>
            )}

            <input type="hidden" name="currency" value="USD" />

            <div className="rounded-xl border border-line bg-paper-2 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-ink">Payout calculation</p>
                  <p className="text-[12px] text-ink-2 mt-0.5">
                    TicketPulse deducts {balance.commissionRate}% from confirmed paid ticket sales before funds become available.
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                <dt className="text-ink-3">Gross confirmed tickets</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">{formatCurrency(balance.grossRevenue, "USD")}</dd>
                <dt className="text-ink-3">TicketPulse fee</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">-{formatCurrency(balance.platformFee, "USD")}</dd>
                <dt className="text-ink-3">Already paid</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">-{formatCurrency(balance.totalPaidOut, "USD")}</dd>
                <dt className="text-ink-3">Pending requests</dt>
                <dd className="text-right font-semibold text-ink tabular-nums">-{formatCurrency(balance.pendingTotal, "USD")}</dd>
                <dt className="text-ink">Remaining after this request</dt>
                <dd className="text-right font-bold text-ink tabular-nums">{formatCurrency(remainingAfterRequest, "USD")}</dd>
              </dl>
            </div>

            <p className="rounded-xl bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800">
              After you submit, you will receive a confirmation email. Payouts usually take about 24 hours, plus or minus depending on bank processing times and TicketPulse review.
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={pending || !amount || parseFloat(amount) <= 0 || exceedsBalance}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[14px] font-semibold text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
            >
              {pending ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {pending ? "Submitting..." : "Request payout"}
            </button>
          </form>
        </div>

        {/* Summary card */}
        <div className="mt-4 rounded-xl border border-line bg-paper p-5 grid grid-cols-3 gap-4 text-center text-[13px]">
          <div>
            <p className="text-ink-3 mb-0.5">TicketPulse fee</p>
            <p className="font-semibold text-ink">{balance.commissionRate}%</p>
          </div>
          <div>
            <p className="text-ink-3 mb-0.5">Gross</p>
            <p className="font-semibold text-ink tabular-nums">{formatCurrency(balance.grossRevenue, "USD")}</p>
          </div>
          <div>
            <p className="text-ink-3 mb-0.5">Net</p>
            <p className="font-semibold text-ink tabular-nums">{formatCurrency(balance.totalEarned, "USD")}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
