"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  DollarSign, TrendingUp, Activity, CheckCircle2, AlertTriangle,
  Smartphone, CreditCard, ArrowUpRight, RefreshCw, Pause, Play,
} from "lucide-react"

import type { PaymentsApiResponse } from "@/app/api/admin/payments/data/route"
import { formatCurrency } from "@/lib/utils"

type Props = {
  initialData: PaymentsApiResponse
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  positive,
}: {
  icon: typeof DollarSign
  label: string
  value: string
  sub?: string
  positive?: boolean
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</span>
        <Icon size={16} className="text-ink-2" />
      </div>
      <p className="text-[26px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
      {sub && (
        <div className="flex items-center gap-1.5">
          <span className={`text-[12px] font-medium tabular-nums ${positive === undefined ? "text-ink-3" : positive ? "text-emerald-700" : "text-rose-600"}`}>
            {sub}
          </span>
        </div>
      )}
    </div>
  )
}

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="text-[11px] text-ink-3">—</span>
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const w = 56, h = 20, pad = 1
  const step = (w - pad * 2) / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = pad + i * step
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-5 shrink-0" aria-hidden>
      <polyline points={coords} fill="none" stroke="rgb(5 150 105)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50",
  failed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/50",
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/50",
  expired: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  failed: "Failed",
  pending: "Pending",
  expired: "Expired",
}

// ── Toast ────────────────────────────────────────────────────────────────────

type ToastItem = {
  id: string
  message: string
  amount: string
  method: string
}

export default function PaymentsViewer({ initialData }: Props) {
  const [data, setData] = useState<PaymentsApiResponse>(initialData)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [isLive, setIsLive] = useState(true)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevTxCountRef = useRef<number>(initialData.transactions.length)

  // ── Poll every 15s ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLive) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/payments/data")
        if (res.ok) {
          const fresh: PaymentsApiResponse = await res.json()

          // Detect new transactions
          if (fresh.transactions.length > prevTxCountRef.current) {
            const newCount = fresh.transactions.length - prevTxCountRef.current
            const newest = fresh.transactions.slice(0, newCount)
            for (const tx of newest) {
              setToasts((prev) => [
                ...prev,
                {
                  id: tx.id,
                  message: `${tx.currency ?? "USD"} ${tx.amount} — ${tx.localStatus === "paid" ? "Paid" : tx.localStatus}`,
                  amount: `${tx.currency ?? "USD"} ${tx.amount}`,
                  method: tx.processor ?? "unknown",
                },
              ].slice(-5))
            }
          }
          prevTxCountRef.current = fresh.transactions.length
          setData(fresh)
          setLastRefreshed(new Date())
        }
      } catch {
        // Silently fail — next poll will retry
      }
    }

    fetchData()
    pollRef.current = setInterval(fetchData, 15_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isLive])

  const { stats, methods, transactions } = data

  return (
    <div className="space-y-8">
      {/* Live toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-3 tabular-nums">
            {lastRefreshed.toLocaleTimeString()}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${isLive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
            {isLive ? "Live" : "Paused"}
          </span>
        </div>
        <button
          onClick={() => setIsLive(!isLive)}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-ink transition-colors"
        >
          {isLive ? <Pause size={14} /> : <Play size={14} />}
          {isLive ? "Pause" : "Resume"}
        </button>
      </div>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
          {toasts.map((t) => (
            <div key={t.id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg animate-in slide-in-from-right">
              <p className="text-[13px] font-semibold text-emerald-800">💰 New payment</p>
              <p className="text-[12px] text-emerald-700">{t.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Today" value={formatCurrency(stats.todayRevenue, "USD")} />
        <StatCard
          icon={TrendingUp}
          label="This Week"
          value={formatCurrency(stats.weekRevenue, "USD")}
          sub={stats.weekDelta >= 0 ? `+${stats.weekDelta.toFixed(1)}% vs prev` : `${stats.weekDelta.toFixed(1)}% vs prev`}
          positive={stats.weekDelta >= 0}
        />
        <StatCard icon={Activity} label="This Month" value={formatCurrency(stats.monthRevenue, "USD")} />
        <StatCard
          icon={DollarSign}
          label="All Time"
          value={formatCurrency(stats.allTimeRevenue, "USD")}
          sub={`${stats.successRate}% success rate`}
          positive={stats.successRate >= 80}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={CheckCircle2} label="Paid Transactions" value={String(stats.paidCount)} />
        <StatCard
          icon={AlertTriangle}
          label="Failed Transactions"
          value={String(stats.failedCount)}
          sub={stats.successRate >= 80 ? "Healthy" : "Needs attention"}
          positive={stats.successRate >= 80}
        />
        <div className="rounded-xl border border-line bg-paper p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">14d Revenue</span>
            <TrendingUp size={16} className="text-ink-2" />
          </div>
          <MiniSparkline points={data.sparkPoints} />
          <p className="text-[12px] text-ink-3">Last 14 days</p>
        </div>
      </div>

      {/* Payment methods */}
      <section>
        <h2 className="text-[16px] font-bold tracking-tight text-ink mb-4">Payment Methods</h2>
        {methods.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-8 text-center">
            <CreditCard size={24} className="mx-auto mb-2 text-ink-3" />
            <p className="text-[13px] text-ink-3">No payment data yet</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {methods.map((row) => {
              const method = row.method ?? "unknown"
              const rate = row.total > 0 ? Math.round((row.paid / row.total) * 100) : 0
              return (
                <div key={method} className="rounded-xl border border-line bg-paper p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-navy/5 text-navy">
                      {method.includes("ecocash") ? <Smartphone size={18} /> : <CreditCard size={18} />}
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-ink capitalize">{method.replace("velocity-", "")}</p>
                      <p className="text-[12px] text-ink-3">{row.paid} paid · {row.total - row.paid} failed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-bold text-ink tabular-nums">{formatCurrency(row.revenue, "USD")}</p>
                    <p className={`text-[12px] font-medium tabular-nums ${rate >= 80 ? "text-emerald-700" : "text-rose-600"}`}>
                      {rate}% success
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent transactions */}
      <section>
        <h2 className="text-[16px] font-bold tracking-tight text-ink mb-4">Recent Transactions</h2>
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper p-8 text-center">
            <Activity size={24} className="mx-auto mb-2 text-ink-3" />
            <p className="text-[13px] text-ink-3">No recent transactions</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-paper-2 border-b border-line">
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Date</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Amount</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Status</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Processor</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Source</th>
                  <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((entry) => {
                  const st = entry.localStatus ?? "unknown"
                  return (
                    <tr key={entry.id} className="border-b border-line last:border-0 hover:bg-paper-2 transition-colors">
                      <td className="px-4 py-3 text-[13px] text-ink-2 tabular-nums">
                        {entry.createdAt
                          ? new Date(entry.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-[14px] font-semibold text-ink tabular-nums">
                        {entry.currency ?? "USD"} {entry.amount}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[st] ?? "bg-gray-50 text-gray-600"}`}>
                          {STATUS_LABEL[st] ?? st}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ink-2 capitalize">{entry.processor}</td>
                      <td className="px-4 py-3 text-[13px] text-ink-2">{entry.source}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${entry.orderId}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-navy hover:underline"
                        >
                          View order <ArrowUpRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
