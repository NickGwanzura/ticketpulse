import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Search, Smartphone, ShoppingCart, ExternalLink,
} from "lucide-react"
import { desc, eq, or, like, and, inArray } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events, eventOrganisers } from "@/db/schema"
import type { VelocityOrderMetadata } from "@/types/velocity"

import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"

import CompleteButton from "@/app/admin/_components/CompleteButton"
import SendTicketsButton from "@/app/admin/_components/SendTicketsButton"
import CompleteAndSendButton from "@/app/admin/_components/CompleteAndSendButton"
import ResendButton from "@/app/admin/_components/ResendButton"
import ResendTicketsButton from "@/app/admin/_components/ResendTicketsButton"
import RecheckButton from "@/app/admin/_components/RecheckButton"

const STATUS_STYLE: Record<string, string> = {
  paid:                   "bg-emerald-50 text-emerald-700",
  pending:                "bg-amber-50 text-amber-700",
  awaiting_verification:  "bg-blue-50 text-blue-700 ring-1 ring-blue-200/50",
  completed:              "bg-violet-50 text-violet-700 ring-1 ring-violet-200/50",
  refunded:               "bg-rose-50 text-rose-700",
  cancelled:              "bg-paper-2 text-ink-3 ring-1 ring-line",
  expired:                "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
}

const STATUS_LABEL: Record<string, string> = {
  paid:                   "Paid",
  pending:                "Pending",
  awaiting_verification:  "Awaiting verification",
  completed:              "Completed",
  refunded:               "Refunded",
  cancelled:              "Cancelled",
  expired:                "Expired",
}

const FILTER_PILLS = [
  { label: "All",              value: "all" },
  { label: "Paid",             value: "paid" },
  { label: "Pending",          value: "pending" },
  { label: "Completed",        value: "completed" },
  { label: "Cancelled",        value: "cancelled" },
]

function getPaymentBadge(status: string | null) {
  const paidStatuses = ["paid", "completed"]
  if (paidStatuses.includes(status ?? "")) {
    return <span className="text-[10px] font-medium text-emerald-600">Paid</span>
  }
  if (status === "refunded") {
    return <span className="text-[10px] font-medium text-rose-600">Refunded</span>
  }
  return <span className="text-[10px] font-medium text-amber-600">Pending</span>
}

function getFulfilmentBadge(meta: Record<string, unknown> | null) {
  const delivery = meta ? (meta as Record<string, unknown>).delivery as Record<string, unknown> | undefined : undefined
  const hasTickets = delivery?.ticketIssuedAt || (delivery?.status && delivery.status !== "NOT_STARTED")
  if (hasTickets) {
    return <span className="text-[10px] font-medium text-emerald-600">Generated</span>
  }
  return <span className="text-[10px] font-medium text-amber-600">Not Generated</span>
}

function getDeliveryBadge(meta: Record<string, unknown> | null) {
  const delivery = meta ? (meta as Record<string, unknown>).delivery as Record<string, unknown> | undefined : undefined
  if (!delivery || delivery.status === "NOT_STARTED") {
    return <span className="text-[10px] font-medium text-amber-600">Pending</span>
  }
  if (delivery.status === "EMAIL_SENT" || delivery.status === "DELIVERED") {
    return <span className="text-[10px] font-medium text-emerald-600">Sent</span>
  }
  if (delivery.status === "EMAIL_FAILED" || delivery.status === "FAILED") {
    return <span className="text-[10px] font-medium text-rose-600">Failed</span>
  }
  return <span className="text-[10px] font-medium text-amber-600">Pending</span>
}

export default async function OrganizerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/auth/signin?callbackUrl=/organizer/orders")

  const isAdmin = session.user.role === "admin"

  const invitedEventIds = isAdmin ? [] : await db
    .select({ eventId: eventOrganisers.eventId })
    .from(eventOrganisers)
    .where(eq(eventOrganisers.userId, session.user.id))

  const ownedIds = invitedEventIds.map((r) => r.eventId)

  const myEvents = await db
    .select({ id: events.id, title: events.title, organizerId: events.organizerId })
    .from(events)
    .where(
      isAdmin
        ? undefined
        : or(eq(events.organizerId, session.user.id), inArray(events.id, ownedIds)),
    )

  const myEventIds = myEvents.map((e) => e.id)
  const eventTitleMap = new Map(myEvents.map((e) => [e.id, e.title]))

  if (myEventIds.length === 0) {
    return (
      <div className="tp-fade-up">
        <PageHeader
          eyebrow="Orders"
          title="All orders"
          subtitle="Orders for your events will appear here."
          width="full"
        />
        <div className="px-5 md:px-8 py-10">
          <EmptyState
            icon={ShoppingCart}
            title="No events yet"
            body="Create and publish an event to start receiving orders."
            variant="inline"
          />
        </div>
      </div>
    )
  }

  const sp = await searchParams
  const query = sp.q?.trim() ?? ""
  const statusFilter = sp.status ?? "all"

  const conditions: ReturnType<typeof and>[] = [inArray(orders.eventId, myEventIds)]

  if (query) {
    conditions.push(
      or(
        like(orders.guestEmail, `%${query}%`),
        like(orders.guestName, `%${query}%`),
        like(orders.id, `%${query}%`),
      ),
    )
  }

  if (statusFilter === "pending") {
    conditions.push(
      or(eq(orders.status, "pending"), eq(orders.status, "awaiting_verification")),
    )
  } else if (statusFilter !== "all") {
    conditions.push(eq(orders.status, statusFilter as "paid" | "pending" | "awaiting_verification" | "completed" | "cancelled" | "refunded" | "expired"))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const orderRows = await db
    .select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      paymentMethod: orders.paymentMethod,
      paymentRef: orders.paymentRef,
      metadata: orders.metadata,
      guestEmail: orders.guestEmail,
      guestName: orders.guestName,
      guestPhone: orders.guestPhone,
      paidAt: orders.paidAt,
      createdAt: orders.createdAt,
      eventId: orders.eventId,
    })
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(100)

  const customerName = (row: (typeof orderRows)[number]) =>
    row.guestName ?? row.guestEmail?.split("@")[0] ?? "—"

  return (
    <div className="tp-fade-up">
      <div className="max-w-7xl mx-auto px-5 md:px-8 pt-6 md:pt-8">
        <Link href="/organizer">
          <img src="/ticketpulse-logo.svg" alt="TicketPulse" className="h-10 w-auto lg:hidden" />
        </Link>
      </div>
      <PageHeader
        eyebrow="Organizer"
        title="Order management"
        subtitle="View and manage all orders across your events."
        width="full"
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
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
              className="w-full rounded-xl border border-line bg-paper pl-9 pr-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-brand-500/10"
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
                ? `/organizer/orders?${params.toString()}`
                : "/organizer/orders"
              return (
                <Link
                  key={value}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
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
                      <th className="text-left px-5 py-3 font-semibold">Customer</th>
                      <th className="text-left px-3 py-3 font-semibold">Event</th>
                      <th className="text-left px-3 py-3 font-semibold">Method</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-left px-3 py-3 font-semibold">Payment</th>
                      <th className="text-left px-3 py-3 font-semibold">Fulfilment</th>
                      <th className="text-left px-3 py-3 font-semibold">Delivery</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-right px-3 py-3 font-semibold">Amount</th>
                      <th className="text-right px-5 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {orderRows.map((o) => {
                      const eventTitle = eventTitleMap.get(o.eventId) ?? "—"
                      return (
                        <tr key={o.id} className="hover:bg-paper-2 transition-colors">
                          <td className="px-5 py-3.5 max-w-[180px]">
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
                              {eventTitle}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            {o.paymentMethod ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
                                  <Smartphone size={12} className="text-green-700" />
                                  {o.paymentMethod}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[12px] text-ink-3 italic">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <span
                              className={`inline-block w-fit text-[10.5px] font-semibold tracking-wide uppercase px-2 py-1 rounded-full ${STATUS_STYLE[o.status ?? ""] ?? "bg-paper-2 text-ink-3"}`}
                            >
                              {STATUS_LABEL[o.status ?? ""] ?? o.status}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            {getPaymentBadge(o.status)}
                          </td>
                          <td className="px-3 py-3.5">
                            {getFulfilmentBadge(o.metadata as Record<string, unknown> | null)}
                          </td>
                          <td className="px-3 py-3.5">
                            {getDeliveryBadge(o.metadata as Record<string, unknown> | null)}
                          </td>
                          <td className="px-3 py-3.5 text-[12.5px] text-ink-2 whitespace-nowrap">
                            {o.createdAt ? formatDateShort(o.createdAt) : "—"}
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <span className="text-[13.5px] font-bold tracking-tight text-ink whitespace-nowrap tabular-nums">
                              {formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1 max-w-[280px] flex-wrap">
                              {(o.status === "paid" || o.status === "awaiting_verification") && (
                                <ResendButton
                                  orderId={o.id}
                                  status={o.status ?? ""}
                                  variant="desktop"
                                />
                              )}
                              {o.status === "pending" && (
                                <RecheckButton orderId={o.id} variant="desktop" />
                              )}
                              {(o.status === "pending" || o.status === "awaiting_verification") && (
                                <CompleteAndSendButton orderId={o.id} variant="desktop" />
                              )}
                              {o.status === "paid" && (
                                <>
                                  <CompleteButton orderId={o.id} variant="desktop" />
                                  <SendTicketsButton orderId={o.id} variant="desktop" />
                                </>
                              )}
                              {o.status === "completed" && (
                                <ResendTicketsButton orderId={o.id} variant="desktop" />
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
                {orderRows.map((o) => {
                  const eventTitle = eventTitleMap.get(o.eventId) ?? "—"
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
                          <p className="text-[11.5px] text-ink-3 line-clamp-1">{eventTitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[14px] font-bold tracking-tight text-ink whitespace-nowrap tabular-nums">
                            {formatCurrency(Number(o.totalAmount ?? 0), o.currency ?? "USD")}
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
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(o.status === "paid" || o.status === "awaiting_verification") && (
                          <ResendButton
                            orderId={o.id}
                            status={o.status ?? ""}
                            variant="mobile"
                          />
                        )}
                        {o.status === "pending" && (
                          <RecheckButton orderId={o.id} variant="mobile" />
                        )}
                        {(o.status === "pending" || o.status === "awaiting_verification") && (
                          <CompleteAndSendButton orderId={o.id} variant="mobile" />
                        )}
                        {o.status === "paid" && (
                          <>
                            <CompleteButton orderId={o.id} variant="mobile" />
                            <SendTicketsButton orderId={o.id} variant="mobile" />
                          </>
                        )}
                        {o.status === "completed" && (
                          <ResendTicketsButton orderId={o.id} variant="mobile" />
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
            <EmptyState
              icon={ShoppingCart}
              title={query ? "No matching orders" : "No orders yet"}
              body={
                query
                  ? `No orders match "${query}". Try a different search term.`
                  : "Ticket purchases for your events will appear here."
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
              href="/organizer/orders"
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
