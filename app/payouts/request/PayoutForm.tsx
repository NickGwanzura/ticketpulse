"use client"

import { useRouter } from "next/navigation"
import { useActionState, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, Send, Smartphone, Building2, AlertCircle,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { requestPayoutAction } from "../actions"

type PayoutMethod = "ecocash" | "bank_usd" | "bank_zar"

const METHOD_LABELS: Record<PayoutMethod, string> = {
  ecocash: "EcoCash",
  bank_usd: "USD Bank Transfer",
  bank_zar: "ZAR Bank Transfer",
}

const METHOD_ICONS: Record<PayoutMethod, typeof Smartphone> = {
  ecocash: Smartphone,
  bank_usd: Building2,
  bank_zar: Building2,
}

type BalanceData = {
  availableBalance: number
  totalEarned: number
  totalPaidOut: number
  pendingTotal: number
  commissionRate: number
  grossRevenue: number
}

export default function PayoutForm({ balance }: { balance: BalanceData }) {
  const router = useRouter()
  const [method, setMethod] = useState<PayoutMethod>("ecocash")
  const [amount, setAmount] = useState("")
  const [ecocashNumber, setEcocashNumber] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [bankName, setBankName] = useState("")

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      try {
        const result = await requestPayoutAction(formData)
        if (result.ok) {
          router.push("/payouts?success=1")
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to submit payout request" }
      }
    },
    { error: null as string | null }
  )

  const parsedAmount = parseFloat(amount) || 0
  const exceedsBalance = parsedAmount > balance.availableBalance

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
              <div className="grid grid-cols-3 gap-2">
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
                <p className="text-[12px] text-ink-3 mt-1">Funds sent to this EcoCash number</p>
              </div>
            )}

            {/* Bank details */}
            {(method === "bank_usd" || method === "bank_zar") && (
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
            <p className="text-ink-3 mb-0.5">Commission</p>
            <p className="font-semibold text-ink">{balance.commissionRate}%</p>
          </div>
          <div>
            <p className="text-ink-3 mb-0.5">Earned</p>
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
