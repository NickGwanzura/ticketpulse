import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Search, DollarSign, Receipt, TrendingUp,
  Smartphone, ShoppingCart, Download, ExternalLink,
} from "lucide-react"

import ResendButton from "@/app/admin/_components/ResendButton"
import { desc, eq, or, like, and } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events } from "@/db/schema"

import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const STATUS_STYLE: Record<string, string> = {
  paid:                   "bg-green-50 text-green-700",
  pending:                "bg-amber-50 text-amber-700",
  awaiting_verification:  "bg-blue-soft text-navy",
  refunded:               "bg-rose-50 text-rose-700",
  cancelled:              "bg-paper-2 text-ink-3 ring-1 ring-line",
}

const STATUS_LABEL: Record<string, string> = {
  paid:                   "Paid",
  pending:                "Pending",
  awaiting_verification:  "Awaiting verification",
  refunded:               "Refunded",
  cancelled:              "Cancelled",
}

const FILTER_PILLS = [
  { label: "All",     value: "all" },
  { label: "Paid",    value: "paid" },
  { label: "Pending", value: "pending" },
  { label: "Refunded",value: "refunded" },
]

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/orders")
  }

  const sp = await searchParams
  const query = sp.q?.trim() ?? ""
  const statusFilter = sp.status ?? "all"

  // ── Build WHERE clause ──────────────────────────────────────────────────
  const conditions: ReturnType<typeof and>[] = []

  if (query) {
    conditions.push(
      or(
        like(orders.guestEmail, `%${query}%`),
        like(orders.guestName, `%${query}%`),
        like(orders.id, `%${query}%`),
      ),
    )
  }

  if (statusFilter !== "all") {
    conditions.push(eq(orders.status, statusFilter as "paid" | "pending" | "awaiting_verification" | "refunded" | "cancelled"))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // ── Fetch orders ────────────────────────────────────────────────────────
  const orderRows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      paymentMethod: orders.paymentMethod,
      paymentRef: orders.paymentRef,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      guestPhone: orders.guestPhone,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
      verificationSentAt: orders.verificationSentAt,
      verificationExpires: orders.verificationExpires,
      verifiedAt: orders.verifiedAt,
      eventTitle: events.title,
      eventSlug: events.slug,
    })
    .from(orders)
    .leftJoin(events, eq(orders.eventId, events.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(100)

  // ── Aggregate stats from all orders ─────────────────────────────────────
  const allOrders = await db
    .select({
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
    })
    .from(orders)

  const paidOrders = allOrders.filter((o) => o.status === "paid")
  const pendingOrders = allOrders.filter(
    (o) => o.status === "pending" || o.status === "awaiting_verification",
  )
  const totalPaid = paidOrders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0)

  const statCards = [
    {
      label: "Total revenue",
      value: formatCurrency(totalPaid, "USD"),
      icon: DollarSign,
      tone: "text-green-700",
      bg: "bg-green-50",
    },
    {
      label: "Total orders",
      value: allOrders.length.toLocaleString(),
      icon: Receipt,
      tone: "text-sky-700",
      bg: "bg-sky-50",
    },
    {
      label: "Completed",
      value: paidOrders.length.toLocaleString(),
      icon: TrendingUp,
      tone: "text-blue",
      bg: "bg-blue-soft",
    },
    {
      label: "Pending / awaiting",
      value: pendingOrders.length.toLocaleString(),
      icon: ShoppingCart,
      tone: "text-amber-700",
      bg: "bg-amber-50",
    },
  ]

  const customerName = (row: (typeof orderRows)[number]) =>
    row.guestName ?? row.guestEmail?.split("@")[0] ?? "—"

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Orders"
        title="All transactions"
        subtitle="Every order placed across the platform. Search by order ID, email, or name."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          {statCards.map(({ label, value, icon: Icon, tone, bg }) => (
            <div
              key={label}
              className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift"
            >
              <span
                className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${bg}`}
              >
                <Icon size={16} className={tone} />
              </span>
              <div>
                <p className="text-[11.5px] text-ink-3 mb-0.5">{label}</p>
                <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 tp-fade-up-2">
          <form
            method="GET"
            id="orders-search"
            className="relative flex-1 max-w-md"
          >
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by order #, email, or name…"
              className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
            />
            {statusFilter !== "all" && (
              <input type="hidden" name="status" value={statusFilter} />
            )}
          </form>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {FILTER_PILLS.map(({ label, value }) => {
              const isActive = statusFilter === value
              const params = new URLSearchParams()
              if (query) params.set("q", query)
              if (value !== "all") params.set("status", value)
              const href = params.toString()
                ? `/admin/orders?${params.toString()}`
                : "/admin/orders"
              return (
                <Link
                  key={value}
                  href={href}
                  className={`rounded-lg px-3.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-paper-2 text-ink font-semibold ring-1 ring-line"
                      : "text-ink-2 hover:text-ink hover:bg-paper-2 font-medium"
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden tp-fade-up-3">
          {orderRows.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                      <th className="text-left px-5 py-3 font-semibold">Order</th>
                      <th className="text-left px-3 py-3 font-semibold">Customer</th>
                      <th className="text-left px-3 py-3 font-semibold">Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Method</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-right px-3 py-3 font-semibold">Amount</th>
                      <th className="text-right px-5 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {orderRows.map((o) => (
                      <tr key={o.id} className="hover:bg-paper-2 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="text-[11.5px] font-mono font-semibold text-ink-2 truncate block max-w-[140px]" title={o.id}>
                            #{o.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 max-w-[180px]">
                          <p className="text-[12.5px] text-ink truncate">{customerName(o)}</p>
                          {o.guestEmail && (
                            <p className="text-[11px] text-ink-3 truncate">{o.guestEmail}</p>
                          )}
                          {o.guestPhone && (
                            <p className="text-[11px] text-ink-3 truncate">{o.guestPhone}</p>
                          )}
                          {!o.guestPhone && !o.guestEmail && (
                            <p className="text-[11px] text-ink-3">No contact info</p>
                          )}
                        </td>
                        <td className="px-3 py-3.5 max-w-[200px]">
                          <span className="text-[12.5px] text-ink-2 line-clamp-1">
                            {o.eventTitle ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {o.paymentMethod ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                                <Smartphone size={12} className="text-green-700" />
                                {o.paymentMethod}
                              </span>
                              {o.paymentRef && (
                                <span className="text-[10px] font-mono text-ink-3 truncate max-w-[140px]" title={o.paymentRef}>
                                  Ref: {o.paymentRef.slice(0, 20)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[12px] text-ink-3 italic">Not selected</span>
                              {o.status === "pending" && o.createdAt && (
                                <span className="text-[10px] text-amber-600 font-medium">
                                  {(Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60 < 60
                                    ? `${Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60)}m ago`
                                    : `${Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60 / 60)}h ago`}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-block w-fit text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[o.status ?? ""] ?? "bg-paper-2 text-ink-3"}`}
                            >
                              {STATUS_LABEL[o.status ?? ""] ?? o.status}
                            </span>
                            {o.status === "awaiting_verification" && o.verificationSentAt && (
                              <span className="text-[10px] text-blue-600 font-medium">
                                Verification sent {formatDateShort(o.verificationSentAt)}
                              </span>
                            )}
                            {o.status === "awaiting_verification" && !o.verificationSentAt && (
                              <span className="text-[10px] text-amber-600 font-medium">Not yet verified</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{o.createdAt ? formatDateShort(o.createdAt) : "—"}</span>
                            {o.createdAt && (o.status === "pending" || o.status === "awaiting_verification") && (
                              <span className="text-[10px] text-ink-3">
                                {Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60 / 60)}h ago
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <span className="text-[13.5px] font-bold tracking-tight text-ink whitespace-nowrap tabular-nums">
                            {formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {(o.status === "paid" || o.status === "awaiting_verification") && (
                              <ResendButton
                                orderId={o.id}
                                status={o.status ?? ""}
                                variant="desktop"
                              />
                            )}
                            {o.status === "paid" && (
                              <Link
                                href={`/orders/${o.id}/print`}
                                target="_blank"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-green-700 transition-colors"
                              >
                                <Download size={12} />
                                Tickets
                              </Link>
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
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <ul className="md:hidden divide-y divide-line">
                {orderRows.map((o) => (
                  <li key={o.id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-mono font-semibold text-ink-3">
                          #{o.id.slice(0, 8)}
                        </p>
                        <p className="text-[13.5px] font-semibold tracking-tight text-ink line-clamp-1 mt-0.5">
                          {o.guestName || o.guestEmail || "—"}
                        </p>
                        <p className="text-[11.5px] text-ink-3 line-clamp-1">
                          {o.eventTitle ?? "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-bold tracking-tight text-ink whitespace-nowrap tabular-nums">
                          {formatCurrency(
                            Number(o.totalAmount ?? 0),
                            o.currency ?? "USD",
                          )}
                        </p>
                        <span
                          className={`mt-1 inline-block text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status ?? ""] ?? "bg-paper-2 text-ink-3"}`}
                        >
                          {STATUS_LABEL[o.status ?? ""] ?? o.status}
                        </span>
                      </div>
                    </div>
                    {o.guestEmail && (
                      <p className="text-[11px] text-ink-3 truncate">{o.guestEmail}</p>
                    )}
                    {o.guestPhone && (
                      <p className="text-[11px] text-ink-3 truncate">{o.guestPhone}</p>
                    )}
                    {/* Verification detail for awaiting_verification */}
                    {o.status === "awaiting_verification" && (
                      <p className="text-[10.5px] text-blue-600 font-medium mt-1">
                        {o.verificationSentAt
                          ? `Verification sent ${formatDateShort(o.verificationSentAt)}`
                          : "Not yet verified"}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[11.5px] text-ink-3 mt-2">
                      <span className="inline-flex items-center gap-1.5">
                        {o.paymentMethod ? (
                          <>
                            <Smartphone size={11} className="text-green-700" />
                            {o.paymentMethod}
                          </>
                        ) : (
                          <span className="italic text-ink-3">No payment method</span>
                        )}
                        {o.paymentRef && (
                          <span className="text-[10px] font-mono text-ink-3 ml-1" title={o.paymentRef}>
                            #{o.paymentRef.slice(0, 8)}
                          </span>
                        )}
                      </span>
                      <div className="text-right">
                        <span>{o.createdAt ? formatDateShort(o.createdAt) : "—"}</span>
                        {o.createdAt && (o.status === "pending" || o.status === "awaiting_verification") && (
                          <p className="text-[10px] text-ink-3">
                            {Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60 / 60)}h ago
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {(o.status === "paid" || o.status === "awaiting_verification") && (
                        <ResendButton
                          orderId={o.id}
                          status={o.status ?? ""}
                          variant="mobile"
                        />
                      )}
                      {o.status === "paid" && (
                        <Link
                          href={`/orders/${o.id}/print`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-green-700 transition-colors"
                        >
                          <Download size={12} />
                          Download tickets
                        </Link>
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
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title={query ? "No matching orders" : "No orders yet"}
              body={
                query
                  ? `No orders match "${query}". Try a different search term.`
                  : "Ticket purchases across all events will appear here."
              }
              variant="inline"
            />
          )}
        </div>

        {query && orderRows.length > 0 && (
          <p className="text-[12.5px] text-ink-3 text-center tp-fade-up-3">
            Showing {orderRows.length} result{orderRows.length !== 1 ? "s" : ""} for{" "}
            <span className="font-medium text-ink-2">&ldquo;{query}&rdquo;</span>
            {" · "}
            <Link
              href="/admin/orders"
              className="text-navy hover:underline font-medium"
            >
              Clear search
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
