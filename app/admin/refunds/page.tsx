import Link from "next/link"
import { asc, eq, inArray, sql } from "drizzle-orm"
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react"

import { db } from "@/db"
import { events, orders, refundRequests, refundRequestTickets } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import { requireAdmin } from "@/lib/auth-guard"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const pendingStatuses = ["requested", "approved"] as const

export default async function AdminRefundsPage() {
  await requireAdmin()
  const rows = await db
    .select({
      id: refundRequests.id,
      orderId: refundRequests.orderId,
      status: refundRequests.status,
      source: refundRequests.source,
      reason: refundRequests.reason,
      amount: refundRequests.amount,
      currency: refundRequests.currency,
      outsideStandardWindow: refundRequests.outsideStandardWindow,
      requestedAt: refundRequests.requestedAt,
      buyerEmail: orders.guestEmail,
      eventTitle: events.title,
      ticketCount: sql<number>`count(${refundRequestTickets.id})::int`,
    })
    .from(refundRequests)
    .innerJoin(orders, eq(orders.id, refundRequests.orderId))
    .innerJoin(events, eq(events.id, refundRequests.eventId))
    .leftJoin(refundRequestTickets, eq(refundRequestTickets.refundRequestId, refundRequests.id))
    .where(inArray(refundRequests.status, pendingStatuses))
    .groupBy(refundRequests.id, orders.guestEmail, events.title)
    .orderBy(asc(refundRequests.requestedAt))
    .limit(200)

  const requestedCount = rows.filter((row) => row.status === "requested").length
  const approvedCount = rows.filter((row) => row.status === "approved").length

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Finance"
        title="Refund requests"
        subtitle="Review requests, process approved refunds in Velocity, then record only provider-confirmed outcomes."
        width="xl"
      />
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8 md:px-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-paper p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Needs review</p>
            <p className="mt-1 text-2xl font-bold text-ink">{requestedCount}</p>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Approved · awaiting provider confirmation</p>
            <p className="mt-1 text-2xl font-bold text-ink">{approvedCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-[12px] leading-5 text-sky-950">
          <p className="flex items-center gap-2 font-semibold"><RotateCcw size={14} />Money does not move from this queue.</p>
          <p className="mt-1">Approve a request to hold its tickets. Then issue the exact displayed amount in Velocity. Record the provider reference only after Velocity shows success.</p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper px-5 py-12 text-center">
            <p className="text-[15px] font-semibold text-ink">No open refund requests</p>
            <p className="mt-1 text-[13px] text-ink-3">New buyer and event-cancellation requests will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-line bg-paper p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">{row.eventTitle}</p>
                    <p className="mt-1 text-[12px] text-ink-2">{row.source === "event_cancellation" ? "Event cancellation" : row.buyerEmail ?? "Buyer email unavailable"} · order {row.orderId.slice(0, 8)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.status === "approved" ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-900"}`}>{row.status === "approved" ? "Awaiting provider confirmation" : "Needs review"}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[18px] font-bold tracking-tight text-ink">{formatCurrency(Number(row.amount), row.currency)}</p>
                    <p className="text-[11px] text-ink-3">{row.ticketCount} ticket{row.ticketCount === 1 ? "" : "s"} · requested {row.requestedAt ? formatDateShort(row.requestedAt) : "—"}</p>
                  </div>
                  <Link href={`/admin/orders/${row.orderId}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-[12px] font-semibold text-ink hover:bg-paper-2">
                    {row.status === "approved" ? "Record provider result" : "Review request"} <ArrowRight size={13} />
                  </Link>
                </div>
                <p className="mt-3 text-[12px] leading-5 text-ink-2">{row.reason}</p>
                {row.outsideStandardWindow && <p className="mt-2 flex items-center gap-2 text-[11px] text-amber-800"><AlertTriangle size={13} />Outside standard 24-hour window; review as an exception.</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
