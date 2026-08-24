"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  DollarSign, TrendingUp, Activity, CheckCircle2, AlertTriangle,
  Smartphone, CreditCard, ArrowUpRight, Pause, Play, PartyPopper, MailWarning, Copy,
  Clock3, Phone, Mail, Archive,
} from "lucide-react"
import EmptyState from "@/components/dashboard/EmptyState"
import Pagination from "@/components/ui/Pagination"

import type { PaymentsApiResponse } from "@/app/api/admin/payments/data/route"
import { archiveFinishedEventPendingPaymentsAction } from "@/app/admin/actions/payments"
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
  completed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50",
  cancelled: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/50",
  refunded: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/50",
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  failed: "Failed",
  pending: "Pending",
  expired: "Expired",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
}

function pendingAge(createdAt: string | null, now: number): string {
  if (!createdAt) return "Unknown age"
  const elapsed = Math.max(0, now - new Date(createdAt).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

// ── Toast ────────────────────────────────────────────────────────────────────

type ToastItem = {
  id: string
  message: string
  amount: string
  method: string
}

export default function PaymentsViewer({ initialData }: Props) {
  const onFirstPage = initialData.page === 1
  const [data, setData] = useState<PaymentsApiResponse>(initialData)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  // Live polling only makes sense while viewing the newest page — pause it
  // automatically on historical pages so it doesn't clobber what's on screen.
  const [isLive, setIsLive] = useState(onFirstPage)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSeenIdRef = useRef<string | null>(initialData.transactions[0]?.id ?? null)

  // ── Poll every 15s (page 1 only) ──────────────────────────────────────
  useEffect(() => {
    if (!isLive || !onFirstPage) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/payments/data?page=1")
        if (res.ok) {
          const fresh: PaymentsApiResponse = await res.json()

          // Detect new transactions by walking from the top until we hit
          // the last transaction id we'd already seen.
          const newest: PaymentsApiResponse["transactions"] = []
          for (const tx of fresh.transactions) {
            if (tx.id === lastSeenIdRef.current) break
            newest.push(tx)
          }
          if (newest.length > 0) {
            setToasts((prev) => [
              ...prev,
              ...newest.map((tx) => ({
                id: tx.id,
                message: `${tx.currency ?? "USD"} ${tx.amount} — ${tx.localStatus === "paid" ? "Paid" : tx.localStatus}`,
                amount: `${tx.currency ?? "USD"} ${tx.amount}`,
                method: tx.processor ?? "unknown",
              })),
            ].slice(-5))
          }
          lastSeenIdRef.current = fresh.transactions[0]?.id ?? lastSeenIdRef.current
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
  }, [isLive, onFirstPage])

  const { stats, methods, transactions, pendingPayments } = data

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
            {onFirstPage ? (isLive ? "Live" : "Paused") : "Historical view"}
          </span>
        </div>
        {onFirstPage ? (
          <button
            onClick={() => setIsLive(!isLive)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-ink transition-colors"
          >
            {isLive ? <Pause size={14} /> : <Play size={14} />}
            {isLive ? "Pause" : "Resume"}
          </button>
        ) : (
          <span className="text-[12px] text-ink-3">Live updates resume on page 1</span>
        )}
      </div>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
          {toasts.map((t) => (
            <div key={t.id} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg animate-in slide-in-from-right flex items-start gap-2.5">
              <PartyPopper size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-800">New payment</p>
                <p className="text-[12px] text-emerald-700">{t.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards — one grid so columns stay aligned across rows */}
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
        <StatCard icon={CheckCircle2} label="Paid Orders" value={String(stats.paidCount)} />
        <StatCard
          icon={AlertTriangle}
          label="Failed Orders"
          value={String(stats.failedCount)}
          sub="Cancelled or refunded"
        />
        <StatCard icon={AlertTriangle} label="Expired Orders" value={String(stats.expiredCount)} sub="Timed out before payment" />
        <StatCard icon={Activity} label="Pending Orders" value={String(stats.pendingCount)} sub="Needs follow-up" />
        <StatCard icon={MailWarning} label="Delivery Attention" value={String(stats.deliveryAttentionCount)} sub="Paid orders needing delivery" />
        <StatCard icon={Copy} label="Duplicate Ledgers" value={String(stats.duplicateOrderCount)} sub="Orders with >1 settled entry" />
        <div className="rounded-xl border border-line bg-paper p-5 space-y-1.5 col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">14d Revenue</span>
            <TrendingUp size={16} className="text-ink-2" />
          </div>
          <MiniSparkline points={data.sparkPoints} />
          <p className="text-[12px] text-ink-3">Last 14 days</p>
        </div>
      </div>

      {/* Pending orders are queried directly from orders, so payments that
          never produced a ledger row are still visible and actionable. */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight text-ink">Pending payments</h2>
            <p className="text-[12px] text-ink-3 mt-1">Latest 50 unresolved orders, including provider errors without ledger entries.</p>
          </div>
          <div className="flex items-center gap-3">
            {stats.finishedEventPendingCount > 0 && (
              <form action={archiveFinishedEventPendingPaymentsAction}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700 hover:bg-rose-100">
                  <Archive size={13} /> Archive {stats.finishedEventPendingCount} finished-event payment{stats.finishedEventPendingCount === 1 ? "" : "s"}
                </button>
              </form>
            )}
            <span className="text-[12px] font-semibold text-amber-700 whitespace-nowrap">{stats.pendingCount} unresolved</span>
          </div>
        </div>

        {pendingPayments.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No pending payments" body="Every payment order is currently resolved." variant="inline" />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-xl border border-line bg-paper">
              <table className="w-full text-left min-w-[1100px]">
                <thead>
                  <tr className="bg-paper-2 border-b border-line">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Age</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Buyer / event</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Amount</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Method</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Provider state</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Error</th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Contact</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.map((payment) => (
                    <tr key={payment.orderId} className="border-b border-line last:border-0 hover:bg-paper-2 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-700"><Clock3 size={12} />{pendingAge(payment.createdAt, lastRefreshed.getTime())}</span>
                        <p className="text-[11px] text-ink-3 mt-1">{payment.status}</p>
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <p className="text-[13px] font-semibold text-ink">{payment.buyerName ?? payment.buyerEmail ?? "Anonymous"}</p>
                        <p className="text-[12px] text-ink-3 truncate max-w-[260px]">{payment.eventTitle ?? "Unknown event"}</p>
                        {payment.eventFinished && <p className="text-[11px] font-semibold text-rose-700 mt-1">Event finished — ready to archive</p>}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-ink whitespace-nowrap">{payment.currency ?? "USD"} {payment.amount}</td>
                      <td className="px-4 py-3 text-[12px] text-ink-2 whitespace-nowrap">{payment.paymentMethod?.replace("velocity-", "") ?? "—"}</td>
                      <td className="px-4 py-3 min-w-[160px]">
                        <p className="text-[12px] font-medium text-ink">{payment.paymentStatus ?? "Unknown"} / {payment.pollStatus ?? "Unknown"}</p>
                        {payment.providerHttpStatus && <p className="text-[11px] text-ink-3 mt-1">HTTP {payment.providerHttpStatus} · {payment.consecutiveProviderErrors} errors</p>}
                        {payment.transactionTrace && <p className="text-[10px] font-mono text-ink-3 mt-1 max-w-[180px] truncate" title={payment.transactionTrace}>TX: {payment.transactionTrace}</p>}
                        {payment.updatedAt && <p className="text-[10px] text-ink-3 mt-1">Updated {pendingAge(payment.updatedAt, lastRefreshed.getTime())} ago</p>}
                      </td>
                      <td className="px-4 py-3 max-w-[240px] text-[12px] text-rose-600 break-words">{payment.providerError ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {payment.buyerEmail && <a href={`mailto:${payment.buyerEmail}`} title={`Email ${payment.buyerEmail}`} className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-paper-2 text-ink-2 hover:text-navy"><Mail size={13} /></a>}
                          {payment.buyerPhone && <a href={`tel:${payment.buyerPhone}`} title={`Call ${payment.buyerPhone}`} className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-paper-2 text-ink-2 hover:text-navy"><Phone size={13} /></a>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${payment.orderId}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-navy hover:underline whitespace-nowrap">Review <ArrowUpRight size={12} /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden space-y-3">
              {pendingPayments.map((payment) => (
                <li key={payment.orderId} className="rounded-xl border border-line bg-paper p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-ink">{payment.buyerName ?? payment.buyerEmail ?? "Anonymous"}</p>
                      <p className="text-[12px] text-ink-3">{payment.eventTitle ?? "Unknown event"}</p>
                      {payment.eventFinished && <p className="text-[11px] font-semibold text-rose-700 mt-1">Event finished — ready to archive</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700"><Clock3 size={11} />{pendingAge(payment.createdAt, lastRefreshed.getTime())}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-ink">{payment.currency ?? "USD"} {payment.amount} · {payment.paymentMethod?.replace("velocity-", "") ?? "Unknown method"}</p>
                  <p className="text-[12px] text-ink-2">{payment.paymentStatus ?? "Unknown"} / {payment.pollStatus ?? "Unknown"}{payment.providerHttpStatus ? ` · HTTP ${payment.providerHttpStatus}` : ""}</p>
                  {payment.transactionTrace && <p className="text-[10px] font-mono text-ink-3 truncate" title={payment.transactionTrace}>TX: {payment.transactionTrace}</p>}
                  {payment.updatedAt && <p className="text-[11px] text-ink-3">Last updated {pendingAge(payment.updatedAt, lastRefreshed.getTime())} ago</p>}
                  {payment.providerError && <p className="text-[12px] text-rose-600">{payment.providerError} · {payment.consecutiveProviderErrors} consecutive errors</p>}
                  <div className="flex items-center gap-2">
                    {payment.buyerEmail && <a href={`mailto:${payment.buyerEmail}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-paper-2 text-[12px] text-ink-2"><Mail size={12} /> Email</a>}
                    {payment.buyerPhone && <a href={`tel:${payment.buyerPhone}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-paper-2 text-[12px] text-ink-2"><Phone size={12} /> Call</a>}
                    <Link href={`/admin/orders/${payment.orderId}`} className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-navy">Review <ArrowUpRight size={12} /></Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Payment methods */}
      <section>
        <h2 className="text-[16px] font-bold tracking-tight text-ink mb-4">Payment Methods</h2>
        {methods.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payment data yet" variant="inline" />
        ) : (
          <div className="grid gap-3">
            {methods.map((row) => {
              const method = row.method ?? "unknown"
              const resolved = row.paid + row.failed + row.expired
              const rate = resolved > 0 ? Math.round((row.paid / resolved) * 100) : 0
              return (
                <div key={method} className="rounded-xl border border-line bg-paper p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-navy/5 text-navy">
                      {method.includes("ecocash") ? <Smartphone size={18} /> : <CreditCard size={18} />}
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-ink capitalize">{method.replace("velocity-", "")}</p>
                      <p className="text-[12px] text-ink-3">{row.paid} paid · {row.pending} pending · {row.failed} failed · {row.expired} expired</p>
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
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[16px] font-bold tracking-tight text-ink">Recent Transactions</h2>
          <span className="text-[12px] text-ink-3">
            Page {data.page} of {data.totalPages} · {data.totalTransactions.toLocaleString()} total
          </span>
        </div>
        {transactions.length === 0 ? (
          <EmptyState icon={Activity} title="No recent transactions" variant="inline" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-paper-2 border-b border-line">
                    <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Date</th>
                    <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Order</th>
                    <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Amount</th>
                    <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Status</th>
                    <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Processor</th>
                    <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Source</th>
                    <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Reason</th>
                    <th className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((entry) => {
                    const st = entry.orderStatus ?? entry.localStatus ?? "unknown"
                    return (
                      <tr key={entry.id} className="border-b border-line last:border-0 hover:bg-paper-2 transition-colors">
                        <td className="px-4 py-3 text-[13px] text-ink-2 tabular-nums whitespace-nowrap">
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleDateString("en-GB", {
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 min-w-[180px]">
                          <p className="text-[13px] font-medium text-ink truncate">{entry.eventTitle ?? "Unknown event"}</p>
                          <p className="text-[12px] text-ink-3 truncate">{entry.buyerName || entry.buyerEmail || entry.orderId.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-3 text-[14px] font-semibold text-ink tabular-nums whitespace-nowrap">
                          {entry.currency ?? "USD"} {entry.amount}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md ${STATUS_STYLES[st] ?? "bg-gray-50 text-gray-600"}`}>
                            {STATUS_LABEL[st] ?? st}
                          </span>
                          {entry.localStatus && entry.localStatus !== st && <p className="text-[11px] text-ink-3 mt-1">Ledger: {entry.localStatus}</p>}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-ink-2 capitalize whitespace-nowrap">{entry.processor}</td>
                        <td className="px-4 py-3 text-[13px] text-ink-2 whitespace-nowrap">{entry.source}</td>
                        <td className="px-4 py-3 max-w-[240px]">
                          {entry.errorMessage ? (
                            <span className="text-[12px] text-rose-600 leading-snug break-words">
                              {entry.errorMessage}
                            </span>
                          ) : (
                            <span className="text-[12px] text-ink-3">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orders/${entry.orderId}`}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-navy hover:underline whitespace-nowrap"
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

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-line rounded-xl border border-line overflow-hidden">
              {transactions.map((entry) => {
                const st = entry.orderStatus ?? entry.localStatus ?? "unknown"
                return (
                  <li key={entry.id} className="p-4 bg-paper space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-ink tabular-nums">
                          {entry.currency ?? "USD"} {entry.amount}
                        </p>
                        <p className="text-[12px] text-ink-3 mt-0.5 tabular-nums">
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleDateString("en-GB", {
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                              })
                            : "—"}
                        </p>
                        <p className="text-[12px] text-ink-2 mt-1 truncate">{entry.eventTitle ?? "Unknown event"}</p>
                        <p className="text-[12px] text-ink-3 truncate">{entry.buyerName || entry.buyerEmail || entry.orderId.slice(0, 8)}</p>
                      </div>
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md shrink-0 ${STATUS_STYLES[st] ?? "bg-gray-50 text-gray-600"}`}>
                        {STATUS_LABEL[st] ?? st}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-2 capitalize">{entry.processor} · {entry.source}</p>
                    {entry.errorMessage && (
                      <p className="text-[12px] text-rose-600 leading-snug">{entry.errorMessage}</p>
                    )}
                    <Link
                      href={`/admin/orders/${entry.orderId}`}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-navy hover:underline pt-1"
                    >
                      View order <ArrowUpRight size={12} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {data.totalPages > 1 && (
          <Pagination
            currentPage={data.page}
            totalPages={data.totalPages}
            baseUrl="/admin/payments"
            className="border-t-0 px-0"
          />
        )}
      </section>
    </div>
  )
}
