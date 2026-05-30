"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Search, RefreshCw, Activity, Smartphone,
  ExternalLink, DollarSign, ShoppingCart, X,
  CheckCircle, XCircle, AlertTriangle,
} from "lucide-react"

import type { VelocityApiOrder, VelocityApiResponse } from "@/app/api/admin/velocity/data/route"
import type { VelocityOrderMetadata } from "@/types/velocity"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import RecheckButton from "./RecheckButton"
import ResendButton from "./ResendButton"

const POLL_STYLES: Record<string, string> = {
  SUCCESS:  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50",
  FAILED:   "bg-rose-50 text-rose-700 ring-1 ring-rose-200/50",
  PENDING:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200/50",
  TIMEOUT:  "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
}

const POLL_LABEL: Record<string, string> = {
  SUCCESS:  "Success",
  FAILED:   "Failed",
  PENDING:  "Pending",
  TIMEOUT:  "Timeout",
}

const LOCAL_STYLES: Record<string, string> = {
  paid:                   "bg-emerald-50 text-emerald-700",
  pending:                "bg-amber-50 text-amber-700",
  awaiting_verification:  "bg-blue-50 text-blue-700 ring-1 ring-blue-200/50",
  refunded:               "bg-rose-50 text-rose-700",
  cancelled:              "bg-paper-2 text-ink-3 ring-1 ring-line",
  expired:                "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
}

const LOCAL_LABEL: Record<string, string> = {
  paid:                   "Paid",
  pending:                "Pending",
  awaiting_verification:  "Awaiting verification",
  refunded:               "Refunded",
  cancelled:              "Cancelled",
  expired:                "Expired",
}

const FILTER_PILLS = [
  { label: "All",      value: "all" },
  { label: "Pending",  value: "pending" },
  { label: "Paid",     value: "paid" },
  { label: "Awaiting", value: "awaiting_verification" },
  { label: "Failed",   value: "failed" },
  { label: "Expired",  value: "expired" },
] as const

type EnrichedRow = VelocityApiOrder & {
  velocity: VelocityOrderMetadata | null
}

type Props = {
  initialData: VelocityApiResponse
}

// ── Toast types and helpers ────────────────────────────────────────────

type Toast = {
  id: string
  orderId: string
  label: string
  customerName: string
  eventTitle: string
  amount: string
  type: "fixed" | "paid" | "poll_success"
  message: string
  createdAt: number
}

/** Build a serialized snapshot key for quick comparison. */
function buildSnapshot(data: VelocityApiResponse): Map<string, string> {
  const map = new Map<string, string>()
  for (const o of data.orders) {
    const meta = (o.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const v = meta.velocity
    // Composite key: local status + poll status + invoice ref
    map.set(o.id, `${o.status ?? ""}|${v?.pollStatus ?? ""}|${v?.invoiceRef ?? ""}`)
  }
  return map
}

/** Compare snapshots and return toasts for newly-fixed orders. */
function detectFixes(
  prev: Map<string, string>,
  fresh: VelocityApiResponse,
): Toast[] {
  const toasts: Toast[] = []
  const now = Date.now()

  for (const o of fresh.orders) {
    const prevKey = prev.get(o.id)
    if (!prevKey) continue // new order, not a fix

    const meta = (o.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const v = meta.velocity
    const currentKey = `${o.status ?? ""}|${v?.pollStatus ?? ""}|${v?.invoiceRef ?? ""}`
    if (currentKey === prevKey) continue

    // Parse previous state
    const [prevStatus, prevPollStatus, prevInvoice] = prevKey.split("|")

    // Detect: local status improved from pending → awaiting_verification/paid
    const isFixedStatus =
      (prevStatus === "pending" || prevStatus === "awaiting_verification") &&
      (o.status === "paid" || o.status === "awaiting_verification")

    // Detect: poll status just became SUCCESS
    const isPollSuccess = prevPollStatus !== "SUCCESS" && v?.pollStatus === "SUCCESS"

    // Detect: invoice ref appeared (means finalization completed)
    const isFinalized = !prevInvoice && !!v?.invoiceRef

    if (isFixedStatus || isPollSuccess || isFinalized) {
      const customer = o.guestName ?? o.guestEmail?.split("@")[0] ?? "—"
      const eventTitle = o.eventTitle ?? "—"
      const amount = formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")

      let type: Toast["type"] = "poll_success"
      let message = `Poll status changed to ${v?.pollStatus ?? "SUCCESS"}`

      if (isFixedStatus && o.status === "paid") {
        type = "paid"
        message = `Order moved to Paid`
      } else if (isFixedStatus && o.status === "awaiting_verification") {
        type = "fixed"
        message = `Order moved to awaiting verification`
      } else if (isFinalized) {
        type = "paid"
        message = `Payment finalized — Invoice: ${v?.invoiceRef?.slice(0, 10)}`
      }

      toasts.push({
        id: `${o.id}-${now}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: o.id,
        label: `#${o.id.slice(0, 8)}`,
        customerName: customer,
        eventTitle,
        amount,
        type,
        message,
        createdAt: now,
      })
    }
  }

  return toasts
}

// ── Component ────────────────────────────────────────────────────────────

function getPollCounts(data: VelocityApiResponse) {
  let pollSuccess = 0
  let pollFailed = 0
  let pollPending = 0
  for (const o of data.orders) {
    const meta = (o.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    const poll = meta.velocity?.pollStatus
    if (poll === "SUCCESS") pollSuccess++
    else if (poll === "FAILED") pollFailed++
    else pollPending++
  }
  return { pollSuccess, pollFailed, pollPending }
}

export default function VelocityViewer({ initialData }: Props) {
  const [data, setData] = useState<VelocityApiResponse>(initialData)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [isLive, setIsLive] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevSnapshotRef = useRef<Map<string, string>>(new Map())

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
        const params = new URLSearchParams()
        if (query) params.set("q", query)
        if (statusFilter !== "all") params.set("status", statusFilter)
        const res = await fetch(`/api/admin/velocity/data?${params.toString()}`)
        if (res.ok) {
          const fresh: VelocityApiResponse = await res.json()
          const newToasts = detectFixes(prevSnapshotRef.current, fresh)
          if (newToasts.length > 0) {
            setToasts((prev) => [...prev, ...newToasts].slice(-5)) // max 5 toasts
          }
          prevSnapshotRef.current = buildSnapshot(fresh)
          setData(fresh)
          setLastRefreshed(new Date())
        }
      } catch {
        // Silently fail — next poll will retry
      }
    }

    // Fetch immediately, then poll every 15s
    fetchData()
    pollRef.current = setInterval(fetchData, 15_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isLive, query, statusFilter])

  // ── Auto-dismiss toasts after 6s (per-toast, independent timers) ────
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = toastTimersRef.current

    // Set a timer for any new toast that doesn't have one
    for (const t of toasts) {
      if (!timers.has(t.id)) {
        const timer = setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id))
          timers.delete(t.id)
        }, 6000)
        timers.set(t.id, timer)
      }
    }

    // Clean up timers for toasts that were removed (e.g. manually dismissed)
    const activeIds = new Set(toasts.map((t) => t.id))
    for (const [id, timer] of timers.entries()) {
      if (!activeIds.has(id)) {
        clearTimeout(timer)
        timers.delete(id)
      }
    }
  }, [toasts])

  // ── Manual refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set("q", query)
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/admin/velocity/data?${params.toString()}`)
      if (res.ok) {
        const fresh: VelocityApiResponse = await res.json()
        const newToasts = detectFixes(prevSnapshotRef.current, fresh)
        if (newToasts.length > 0) {
          setToasts((prev) => [...prev, ...newToasts].slice(-5))
        }
        prevSnapshotRef.current = buildSnapshot(fresh)
        setData(fresh)
        setLastRefreshed(new Date())
      }
    } catch {
      // noop
    } finally {
      setIsRefreshing(false)
    }
  }, [query, statusFilter])

  // ── Search ──────────────────────────────────────────────────────────────
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    handleRefresh()
  }, [handleRefresh])

  // ── Compute derived data ────────────────────────────────────────────────
  const enriched: EnrichedRow[] = data.orders.map((o) => {
    const meta = (o.metadata ?? {}) as { velocity?: VelocityOrderMetadata }
    return { ...o, velocity: meta.velocity ?? null }
  })

  const stats = data.stats
  const pollCounts = getPollCounts(data)

  const velocityPaid = data.orders.filter((o) => o.status === "paid")
  const velocityPending = data.orders.filter(
    (o) => o.status === "pending" || o.status === "awaiting_verification",
  )
  const velocityFailed = data.orders.filter(
    (o) => o.status === "expired" || o.status === "cancelled",
  )

  const statCards = [
    {
      label: "Total Velocity revenue",
      value: formatCurrency(stats.totalRevenue, "USD"),
      icon: DollarSign,
      tone: "text-green-700",
      bg: "bg-green-50",
    },
    {
      label: "Total transactions",
      value: stats.totalTransactions.toLocaleString(),
      icon: Activity,
      tone: "text-navy",
      bg: "bg-navy/5",
    },
    {
      label: "Completed",
      value: stats.completed.toLocaleString(),
      icon: CheckCircle,
      tone: "text-brand-600",
      bg: "bg-green-50",
    },
    {
      label: "Pending / awaiting",
      value: stats.pending.toLocaleString(),
      icon: ShoppingCart,
      tone: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "Failed / expired",
      value: stats.failed.toLocaleString(),
      icon: XCircle,
      tone: "text-rose-600",
      bg: "bg-rose-50",
    },
  ]

  const customerName = (row: EnrichedRow) =>
    row.guestName ?? row.guestEmail?.split("@")[0] ?? "—"

  const pollIcon = (pollStatus: string | null | undefined) => {
    if (pollStatus === "SUCCESS") return <CheckCircle size={11} className="text-brand-600 shrink-0" />
    if (pollStatus === "FAILED") return <XCircle size={11} className="text-rose-600 shrink-0" />
    if (pollStatus === "TIMEOUT") return <AlertTriangle size={11} className="text-gray-500 shrink-0" />
    return <RefreshCw size={11} className="text-amber-500 shrink-0" />
  }

  const secondsSinceRefresh = Math.floor(
    (Date.now() - lastRefreshed.getTime()) / 1000,
  )

  return (
    <>
      {/* Live indicator + refresh controls */}
      <div className="flex items-center justify-between mb-5 tp-fade-up-1">
        <div className="flex items-center gap-3">
          {/* Live toggle */}
          <button
            type="button"
            onClick={() => setIsLive((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
              isLive
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50"
                : "bg-paper-2 text-ink-3 ring-1 ring-line"
            }`}
            title={isLive ? "Auto-refresh is on — click to pause" : "Auto-refresh is off — click to enable"}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            {isLive ? "Live" : "Paused"}
          </button>

          {/* Last refreshed */}
          <span className="text-[11px] text-ink-3 tabular-nums">
            {isLive
              ? `Refreshed ${secondsSinceRefresh}s ago`
              : `Stopped ${secondsSinceRefresh}s ago`}
          </span>

          {/* Manual refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-navy hover:text-navy/70 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Auto-scroll status */}
        {enriched.length > 0 && (
          <span className="text-[10.5px] text-ink-3 tabular-nums">
            {enriched.length} order{enriched.length !== 1 ? "s" : ""}
            {isLive && (
              <span className="ml-1 text-emerald-600">· watching</span>
            )}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 tp-fade-up-1">
        {statCards.map(({ label, value, icon: Icon, tone, bg }) => (
          <div
            key={label}
            className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift transition-opacity"
          >
            <span
              className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${bg}`}
            >
              <Icon size={16} className={tone} />
            </span>
            <div>
              <p className="text-[11.5px] text-ink-3 mb-0.5">{label}</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums transition-all">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Poll status mini-breakdown */}
      <div className="flex items-center gap-4 tp-fade-up-1">
        <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-ink-3">
          Poll status
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[11px] font-medium ring-1 ring-emerald-200/50">
            <CheckCircle size={11} />
            {pollCounts.pollSuccess} success
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-[11px] font-medium ring-1 ring-amber-200/50">
            <RefreshCw size={11} />
            {pollCounts.pollPending} pending
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-700 px-2.5 py-1 text-[11px] font-medium ring-1 ring-rose-200/50">
            <XCircle size={11} />
            {pollCounts.pollFailed} failed
          </span>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 tp-fade-up-2">
        <form
          onSubmit={handleSearch}
          className="relative flex-1 max-w-md"
        >
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order #, email, or name…"
            className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-brand-500/10"
          />
        </form>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {FILTER_PILLS.map(({ label, value }) => {
            const isActive = statusFilter === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatusFilter(value)
                }}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-paper-2 text-ink font-semibold ring-1 ring-line"
                    : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
        {enriched.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                    <th className="text-left px-5 py-3 font-semibold">Order</th>
                    <th className="text-left px-3 py-3 font-semibold">Customer</th>
                    <th className="text-left px-3 py-3 font-semibold">Event</th>
                    <th className="text-left px-3 py-3 font-semibold">Amount</th>
                    <th className="text-left px-3 py-3 font-semibold">Method</th>
                    <th className="text-left px-3 py-3 font-semibold">Poll status</th>
                    <th className="text-left px-3 py-3 font-semibold">Local status</th>
                    <th className="text-left px-3 py-3 font-semibold">Traces</th>
                    <th className="text-left px-3 py-3 font-semibold">Created</th>
                    <th className="text-right px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {enriched.map((o) => {
                    const v = o.velocity
                    return (
                      <tr key={o.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="text-[11.5px] font-mono font-semibold text-ink-2 truncate block max-w-[120px]" title={o.id}>
                            #{o.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 max-w-[160px]">
                          <p className="text-[12.5px] text-ink truncate">{customerName(o)}</p>
                          {o.guestEmail && (
                            <p className="text-[11px] text-ink-3 truncate">{o.guestEmail}</p>
                          )}
                          {o.guestPhone && (
                            <p className="text-[11px] text-ink-3 truncate">{o.guestPhone}</p>
                          )}
                        </td>
                        <td className="px-3 py-3.5 max-w-[180px]">
                          <span className="text-[12.5px] text-ink-2 line-clamp-1">
                            {o.eventTitle ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-bold tracking-tight text-ink whitespace-nowrap tabular-nums">
                            {formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {v?.paymentProcessor ? (
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                              <Smartphone size={12} className="text-green-700" />
                              {v.paymentProcessor}
                            </span>
                          ) : (
                            <span className="text-[12px] text-ink-3 italic">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          {v?.pollStatus ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={`inline-flex items-center gap-1.5 w-fit text-[10.5px] font-semibold tracking-wide px-2 py-1 rounded-full ${POLL_STYLES[v.pollStatus] ?? "bg-paper-2 text-ink-3"}`}>
                                {pollIcon(v.pollStatus)}
                                {POLL_LABEL[v.pollStatus] ?? v.pollStatus}
                              </span>
                              {v.finalizedAt && (
                                <span className="text-[9.5px] text-brand-600 font-medium">
                                  Finalized {formatDateShort(v.finalizedAt)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-ink-3 italic">Not polled</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-block w-fit text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${LOCAL_STYLES[o.status ?? ""] ?? "bg-paper-2 text-ink-3"}`}
                            >
                              {LOCAL_LABEL[o.status ?? ""] ?? o.status}
                            </span>
                            {o.status === "awaiting_verification" && o.verificationSentAt && (
                              <span className="text-[9.5px] text-blue-600 font-medium">
                                Sent {formatDateShort(o.verificationSentAt)}
                              </span>
                            )}
                            {o.paidAt && (
                              <span className="text-[9.5px] text-brand-600 font-medium">
                                Paid {formatDateShort(o.paidAt)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 max-w-[140px]">
                          <div className="flex flex-col gap-0.5">
                            {v?.transactionTrace ? (
                              <span className="text-[9.5px] font-mono text-ink-3 truncate" title={v.transactionTrace}>
                                TX: {v.transactionTrace.slice(0, 14)}
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-ink-3 italic">No TX trace</span>
                            )}
                            {v?.salesOrderTrace ? (
                              <span className="text-[9.5px] font-mono text-ink-3 truncate" title={v.salesOrderTrace}>
                                SO: {v.salesOrderTrace.slice(0, 14)}
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-ink-3 italic">No SO trace</span>
                            )}
                            {v?.invoiceRef && (
                              <span className="text-[9.5px] font-mono text-brand-600 truncate" title={v.invoiceRef}>
                                INV: {v.invoiceRef.slice(0, 14)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex flex-col text-[12px] text-ink-2 whitespace-nowrap">
                            <span>{o.createdAt ? formatDateShort(o.createdAt) : "—"}</span>
                            {o.createdAt && (o.status === "pending" || o.status === "awaiting_verification") && (
                              <span className="text-[10px] text-ink-3">
                                {Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60 / 60)}h ago
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {o.status === "pending" && (
                              <RecheckButton orderId={o.id} variant="desktop" />
                            )}
                            {(o.status === "paid" || o.status === "awaiting_verification") && (
                              <ResendButton
                                orderId={o.id}
                                status={o.status ?? ""}
                                variant="desktop"
                              />
                            )}
                            <Link
                              href={`/orders/${o.id}`}
                              target="_blank"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors"
                              title="View order"
                            >
                              <ExternalLink size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="md:hidden divide-y divide-line">
              {enriched.map((o) => {
                const v = o.velocity
                return (
                  <li key={o.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-mono font-semibold text-ink-3">
                          #{o.id.slice(0, 8)}
                        </p>
                        <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1 mt-0.5">
                          {customerName(o)}
                        </p>
                        <p className="text-[11.5px] text-ink-3 line-clamp-1">
                          {o.eventTitle ?? "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-bold tracking-tight text-ink whitespace-nowrap tabular-nums">
                          {formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}
                        </p>
                        <span
                          className={`mt-1 inline-block text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${LOCAL_STYLES[o.status ?? ""] ?? "bg-paper-2 text-ink-3"}`}
                        >
                          {LOCAL_LABEL[o.status ?? ""] ?? o.status}
                        </span>
                      </div>
                    </div>

                    {o.guestEmail && (
                      <p className="text-[11px] text-ink-3 truncate">{o.guestEmail}</p>
                    )}

                    {/* Poll + Velocity details */}
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {v?.paymentProcessor && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-ink-2">
                            <Smartphone size={11} className="text-green-700" />
                            {v.paymentProcessor}
                          </span>
                        )}
                        {v?.pollStatus && (
                          <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${POLL_STYLES[v.pollStatus] ?? "bg-paper-2 text-ink-3"}`}>
                            {pollIcon(v.pollStatus)}
                            {POLL_LABEL[v.pollStatus] ?? v.pollStatus}
                          </span>
                        )}
                      </div>
                      {v?.transactionTrace && (
                        <p className="text-[9.5px] font-mono text-ink-3 truncate" title={v.transactionTrace}>
                          TX: {v.transactionTrace.slice(0, 20)}
                        </p>
                      )}
                      {v?.salesOrderTrace && (
                        <p className="text-[9.5px] font-mono text-ink-3 truncate" title={v.salesOrderTrace}>
                          SO: {v.salesOrderTrace.slice(0, 20)}
                        </p>
                      )}
                      {v?.invoiceRef && (
                        <p className="text-[9.5px] font-mono text-brand-600 truncate" title={v.invoiceRef}>
                          INV: {v.invoiceRef.slice(0, 20)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11.5px] text-ink-3 mt-2">
                      <span className="inline-flex items-center gap-1.5">
                        {o.status === "awaiting_verification" && o.verificationSentAt && (
                          <span className="text-blue-600">Verification sent {formatDateShort(o.verificationSentAt)}</span>
                        )}
                        {!o.verificationSentAt && o.status !== "pending" && (
                          <span className="text-ink-3 italic">
                            No verification sent
                          </span>
                        )}
                      </span>
                      <span>
                        {o.createdAt ? formatDateShort(o.createdAt) : "—"}
                        {o.createdAt && (o.status === "pending" || o.status === "awaiting_verification") && (
                          <span className="text-[10px] text-ink-3 ml-1">
                            ({Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60 / 60)}h ago)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      {o.status === "pending" && (
                        <RecheckButton orderId={o.id} variant="mobile" />
                      )}
                      {(o.status === "paid" || o.status === "awaiting_verification") && (
                        <ResendButton
                          orderId={o.id}
                          status={o.status ?? ""}
                          variant="mobile"
                        />
                      )}
                      <Link
                        href={`/orders/${o.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-2 text-[12px] font-medium text-ink-2 hover:text-ink hover:border-line-2 transition-colors"
                      >
                        <ExternalLink size={12} />
                        View
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <div className="px-5 py-16 text-center">
            <span className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-paper-2 mb-4">
              <Activity size={20} className="text-ink-3" />
            </span>
            <p className="text-[15px] font-semibold text-ink mb-1">
              {query ? "No matching Velocity transactions" : "No Velocity transactions yet"}
            </p>
            <p className="text-[12.5px] text-ink-3 max-w-sm mx-auto">
              {query
                ? `No transactions match "${query}". Try a different search term.`
                : "Orders processed through Velocity Africa will appear here once customers start checking out."}
            </p>
          </div>
        )}
      </div>

      {query && enriched.length > 0 && (
        <p className="text-[12.5px] text-ink-3 text-center tp-fade-up-3">
          Showing {enriched.length} result{enriched.length !== 1 ? "s" : ""} for{" "}
          <span className="font-medium text-ink-2">&ldquo;{query}&rdquo;</span>
          {" · "}
          <button
            type="button"
            onClick={() => {
              setQuery("")
              setStatusFilter("all")
            }}
            className="text-navy hover:underline font-medium"
          >
            Clear search
          </button>
        </p>
      )}

      {/* ── Toast notifications ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl border p-4 shadow-xl transition-all animate-toast-slide ${
              t.type === "paid"
                ? "border-emerald-200 bg-emerald-50"
                : t.type === "fixed"
                  ? "border-blue-200 bg-blue-50"
                  : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex mt-0.5 w-7 h-7 items-center justify-center rounded-lg shrink-0 ${
                  t.type === "paid"
                    ? "bg-emerald-200"
                    : t.type === "fixed"
                      ? "bg-blue-200"
                      : "bg-amber-200"
                }`}
              >
                {t.type === "paid" ? (
                  <CheckCircle size={14} className="text-emerald-700" />
                ) : t.type === "fixed" ? (
                  <CheckCircle size={14} className="text-blue-700" />
                ) : (
                  <RefreshCw size={14} className="text-amber-700" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-semibold text-ink-2">
                    {t.label}
                  </span>
                  <span
                    className={`inline-block px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider rounded-full ${
                      t.type === "paid"
                        ? "bg-emerald-200 text-emerald-800"
                        : t.type === "fixed"
                          ? "bg-blue-200 text-blue-800"
                          : "bg-amber-200 text-amber-800"
                    }`}
                  >
                    {t.type === "paid" ? "Paid" : t.type === "fixed" ? "Fixed" : "Poll update"}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-ink mt-0.5 leading-tight truncate">
                  {t.customerName}
                </p>
                <p className="text-[11.5px] text-ink-3 truncate mt-0.5">
                  {t.eventTitle}
                </p>
                <p className="text-[12px] text-ink-2 mt-1">
                  <span className="font-semibold">{t.amount}</span>
                  {t.message && (
                    <span className="ml-1.5 text-ink-3">&middot; {t.message}</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-black/5 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            {/* Progress bar for auto-dismiss (CSS keyframe animation) */}
            <div className="mt-2.5 h-1 rounded-full bg-black/5 overflow-hidden">
              <div
                className={`h-full rounded-full animate-toast-shrink ${
                  t.type === "paid"
                    ? "bg-emerald-300"
                    : t.type === "fixed"
                      ? "bg-blue-300"
                      : "bg-amber-300"
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
