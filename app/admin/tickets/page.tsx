import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Search, Ticket, ShoppingCart, ExternalLink, Download,
  ChevronDown, Calendar, Mail, Smartphone,
} from "lucide-react"
import { desc, eq, or, like, and, inArray } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { orders, events, orderItems, ticketTiers, tickets } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import ResendButton from "@/app/admin/_components/ResendButton"
import CancelOrderButton from "@/app/admin/_components/CancelOrderButton"
import CancelTicketButton from "@/app/admin/_components/CancelTicketButton"

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

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; event?: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/tickets")
  }

  const sp = await searchParams
  const query = sp.q?.trim() ?? ""
  const eventFilter = sp.event?.trim() ?? ""

  // ── Fetch all events for the dropdown ────────────────────────────────────
  const allEvents = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .orderBy(events.title)

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

  if (eventFilter) {
    conditions.push(eq(orders.eventId, eventFilter))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // ── Fetch orders with event info ────────────────────────────────────────
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
      eventId: orders.eventId,
      eventTitle: events.title,
      eventSlug: events.slug,
    })
    .from(orders)
    .leftJoin(events, eq(orders.eventId, events.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(200)

  // ── Fetch ticket line items for each order ───────────────────────────────
  const orderIds = orderRows.map((o) => o.id)
  const itemsRows = orderIds.length > 0
    ? await db
        .select({
          orderId: orderItems.orderId,
          qty: orderItems.quantity,
          tierName: ticketTiers.name,
        })
        .from(orderItems)
        .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
        .where(and(inArray(orderItems.orderId, orderIds), eq(orderItems.type, "ticket")))
    : []

  const ticketsByOrder = new Map<string, { tierName: string; qty: number }[]>()
  for (const item of itemsRows) {
    const arr = ticketsByOrder.get(item.orderId) ?? []
    arr.push({ tierName: item.tierName ?? "Ticket", qty: item.qty })
    ticketsByOrder.set(item.orderId, arr)
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const paidOrders = orderRows.filter((o) => o.status === "paid")
  const pendingOrders = orderRows.filter(
    (o) => o.status === "pending" || o.status === "awaiting_verification",
  )
  const totalTickets = itemsRows.reduce((s, i) => s + i.qty, 0)
  const totalRevenue = paidOrders.reduce(
    (s, o) => s + Number(o.totalAmount ?? 0), 0,
  )

  const customerName = (row: (typeof orderRows)[number]) =>
    row.guestName ?? row.guestEmail?.split("@")[0] ?? "—"

  // ── Fetch individual tickets (staff tickets, tickets without orders) ───
  const cancellableStatuses = new Set(["available", "reserved", "sold", "used"])
  const rawTickets = !query
    ? await db
        .select({
          id: tickets.id,
          status: tickets.status,
          isStaffTicket: tickets.isStaffTicket,
          staffRole: tickets.staffRole,
          staffName: tickets.staffName,
          tierName: ticketTiers.name,
          eventId: tickets.eventId,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .leftJoin(ticketTiers, eq(tickets.tierId, ticketTiers.id))
        .where(eventFilter ? eq(tickets.eventId, eventFilter) : undefined)
        .orderBy(desc(tickets.createdAt))
        .limit(500)
    : []

  // Group tickets by event ID for display
  const ticketsByEvent = new Map<string, typeof rawTickets>()
  for (const t of rawTickets) {
    const arr = ticketsByEvent.get(t.eventId) ?? []
    arr.push(t)
    ticketsByEvent.set(t.eventId, arr)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Tickets"
        title="Customer tickets"
        subtitle="Look up orders by event or customer and resend ticket emails if needed."
        width="full"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 tp-fade-up-1">
          <div className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-green-50">
              <Ticket size={16} className="text-green-700" />
            </span>
            <div>
              <p className="text-[11.5px] text-ink-3 mb-0.5">Tickets issued</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {totalTickets.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-blue-soft">
              <ShoppingCart size={16} className="text-navy" />
            </span>
            <div>
              <p className="text-[11.5px] text-ink-3 mb-0.5">Completed orders</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {paidOrders.length.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-amber-50">
              <Mail size={16} className="text-amber-700" />
            </span>
            <div>
              <p className="text-[11.5px] text-ink-3 mb-0.5">Awaiting verification</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {pendingOrders.length.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5 flex items-center gap-4 tp-lift">
            <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-sky-50">
              <Calendar size={16} className="text-sky-700" />
            </span>
            <div>
              <p className="text-[11.5px] text-ink-3 mb-0.5">Events</p>
              <p className="text-[26px] md:text-[28px] font-bold tracking-tight text-ink leading-none tabular-nums">
                {allEvents.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Search + event filter */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 tp-fade-up-2">
          <form
            method="GET"
            id="tickets-search"
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
            {eventFilter && (
              <input type="hidden" name="event" value={eventFilter} />
            )}
          </form>

          {/* Event filter dropdown */}
          <form method="GET" id="event-filter-form" className="flex items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <select
                name="event"
                defaultValue={eventFilter}
                className="appearance-none w-full rounded-xl border border-line bg-paper pl-3.5 pr-9 py-2.5 text-[13px] text-ink focus:outline-none focus:border-line-2 focus:ring-4 focus:ring-blue/10"
              >
                <option value="">All events</option>
                {allEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
              />
              {query && (
                <input type="hidden" name="q" value={query} />
              )}
            </div>
            <button
              type="submit"
              className="rounded-xl bg-navy px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-navy/20 hover:bg-navy-700 active:scale-[0.99] transition"
            >
              Filter
            </button>
          </form>

          {/* Clear filters */}
          {(query || eventFilter) && (
            <Link
              href="/admin/tickets"
              className="text-[12.5px] font-medium text-navy hover:underline shrink-0"
            >
              Clear filters
            </Link>
          )}
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
                      <th className="text-left px-3 py-3 font-semibold">Tickets</th>
                      <th className="text-left px-3 py-3 font-semibold">Status</th>
                      <th className="text-left px-3 py-3 font-semibold">Date</th>
                      <th className="text-right px-3 py-3 font-semibold">Amount</th>
                      <th className="text-right px-5 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {orderRows.map((o) => {
                      const ticketLines = ticketsByOrder.get(o.id) ?? []
                      return (
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
                            <div className="space-y-0.5">
                              {ticketLines.length > 0 ? (
                                ticketLines.map((t, i) => (
                                  <p key={i} className="text-[11.5px] text-ink-2 whitespace-nowrap">
                                    {t.qty}× <span className="font-medium">{t.tierName}</span>
                                  </p>
                                ))
                              ) : (
                                <span className="text-[11.5px] text-ink-3">—</span>
                              )}
                            </div>
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
                              <ResendButton
                                orderId={o.id}
                                status={o.status ?? ""}
                                variant="desktop"
                              />
                              {o.status === "paid" && (
                                <Link
                                  href={`/orders/${o.id}/print`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-navy-700 transition-colors"
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
                              {o.status !== "cancelled" && o.status !== "refunded" && (
                                <CancelOrderButton
                                  orderId={o.id}
                                  variant="desktop"
                                />
                              )}
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
                  const ticketLines = ticketsByOrder.get(o.id) ?? []
                  return (
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
                          {ticketLines.length > 0 && (
                            <div className="mt-1.5 text-[11px] text-ink-2">
                              {ticketLines.map((t, i) => (
                                <span key={i} className="inline-block mr-2">
                                  {t.qty}× {t.tierName}
                                </span>
                              ))}
                            </div>
                          )}
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
                      <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-2">
                        <span className="inline-flex items-center gap-1">
                          {o.paymentMethod ? (
                            <>
                              <Smartphone size={11} className="text-green-700" />
                              {o.paymentMethod}
                            </>
                          ) : (
                            <span className="italic">No payment method</span>
                          )}
                          {o.paymentRef && (
                            <span className="font-mono text-[10px] text-ink-3 ml-1" title={o.paymentRef}>
                              #{o.paymentRef.slice(0, 8)}
                            </span>
                          )}
                        </span>
                        <span className="ml-auto">
                          {o.createdAt ? formatDateShort(o.createdAt) : "—"}
                          {o.createdAt && (o.status === "pending" || o.status === "awaiting_verification") && (
                            <span className="ml-1 text-[10px] text-ink-3">
                              ({Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000 / 60 / 60)}h ago)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <ResendButton
                          orderId={o.id}
                          status={o.status ?? ""}
                          variant="mobile"
                        />
                        {o.status === "paid" && (
                          <Link
                            href={`/orders/${o.id}/print`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-[12px] font-semibold text-white hover:bg-navy-700 transition-colors"
                          >
                            <Download size={12} />
                            Tickets
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
                        {o.status !== "cancelled" && o.status !== "refunded" && (
                          <CancelOrderButton
                            orderId={o.id}
                            variant="mobile"
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Ticket}
              title={query || eventFilter ? "No matching tickets" : "No orders yet"}
              body={
                query || eventFilter
                  ? "No orders match the current filters. Try a different search or event."
                  : "Orders with tickets will appear here once customers check out."
              }
              variant="inline"
            />
          )}
        </div>

        {(query || eventFilter) && orderRows.length > 0 && (
          <p className="text-[12.5px] text-ink-3 text-center tp-fade-up-3">
            Showing {orderRows.length} result{orderRows.length !== 1 ? "s" : ""}
            {query && (
              <> for <span className="font-medium text-ink-2">&ldquo;{query}&rdquo;</span></>
            )}
            {eventFilter && (
              <> in <span className="font-medium text-ink-2">
                {allEvents.find((e) => e.id === eventFilter)?.title ?? eventFilter}
              </span></>
            )}
            {" · "}
            <Link
              href="/admin/tickets"
              className="text-navy hover:underline font-medium"
            >
              Clear filters
            </Link>
          </p>
        )}

        {/* ── Individual tickets (staff tickets, tickets without orders) ── */}
        {!query && ticketsByEvent.size > 0 && (
          <>
            <h2 className="text-[11.5px] font-semibold tracking-widest text-ink-3 uppercase tp-fade-up-3 mt-10 mb-4 px-1">
              All tickets by event
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 tp-fade-up-3">
              {allEvents
                .filter((ev) => ticketsByEvent.has(ev.id))
                .map((ev) => {
                  const eventTickets = ticketsByEvent.get(ev.id)!
                  const activeCount = eventTickets.filter((t) =>
                    cancellableStatuses.has(t.status ?? ""),
                  ).length

                  return (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-line bg-paper overflow-hidden tp-lift"
                    >
                      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-ink truncate">
                          {ev.title}
                        </span>
                        <span className="text-[10.5px] text-ink-3 font-medium tabular-nums shrink-0 ml-2">
                          {eventTickets.length} ticket{eventTickets.length !== 1 ? "s" : ""}
                          {activeCount > 0 && (
                            <> · <span className="text-rose-600">{activeCount} active</span></>
                          )}
                        </span>
                      </div>
                      <div className="divide-y divide-line max-h-[320px] overflow-y-auto">
                        {eventTickets.map((t) => {
                          const badge = t.isStaffTicket
                            ? "bg-violet-50 text-violet-700"
                            : STATUS_STYLE[t.status ?? ""] ?? "bg-paper-2 text-ink-3"
                          const label = t.isStaffTicket
                            ? (t.staffRole ?? "Staff")
                            : (STATUS_LABEL[t.status ?? ""] ?? t.status ?? "—")
                          return (
                            <div
                              key={t.id}
                              className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-paper-2 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono text-ink-3 truncate" title={t.id}>
                                    #{t.id.slice(0, 8)}
                                  </span>
                                  {t.tierName && (
                                    <span className="text-[11.5px] font-medium text-ink truncate">
                                      {t.tierName}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span
                                    className={`inline-block text-[9.5px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full ${badge}`}
                                  >
                                    {label}
                                  </span>
                                  {t.staffName && (
                                    <span className="text-[10.5px] text-ink-3 truncate">
                                      {t.staffName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {cancellableStatuses.has(t.status ?? "") && (
                                <CancelTicketButton ticketId={t.id} variant="desktop" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
