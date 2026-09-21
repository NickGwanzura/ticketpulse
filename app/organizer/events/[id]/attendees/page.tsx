import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, and, inArray, desc, asc, sql, count } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Download, Users, ChevronLeft, ChevronRight } from "lucide-react"

import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, tickets, ticketQuestions, ticketQuestionResponses } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"

export const metadata = { title: "Attendees" }

const PAGE_SIZE = 50
type RouteParams = { id: string }

export default async function AttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}/attendees`)

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect("/organizer")

  const [event] = await db
    .select({ id: events.id, title: events.title, slug: events.slug })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) notFound()

  // ── Event questions ────────────────────────────────────────────────────────
  const questions = await db
    .select({ id: ticketQuestions.id, question: ticketQuestions.question })
    .from(ticketQuestions)
    .where(eq(ticketQuestions.eventId, id))
    .orderBy(asc(ticketQuestions.sortOrder))

  // ── Attendee data ──────────────────────────────────────────────────────────
  // One row per orderItem (buyer × tier). Use an EXISTS predicate so the
  // database paginates delivered orders directly instead of loading the full
  // attendee list into server memory.
  const deliveredTicketExists = sql`EXISTS (SELECT 1 FROM tickets delivered_ticket WHERE delivered_ticket.order_id = ${orders.id} AND delivered_ticket.event_id = ${id})`
  const attendeeWhere = and(
    eq(orders.eventId, id),
    eq(orderItems.type, "ticket"),
    deliveredTicketExists,
  )
  const [rows, [{ totalRows }]] = await Promise.all([
    db
    .select({
      orderId: orders.id,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      tierName: ticketTiers.name,
      tierId: orderItems.tierId,
      quantity: orderItems.quantity,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
    .where(
      attendeeWhere,
    )
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset),
    db.select({ totalRows: count() }).from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(attendeeWhere),
  ])

  const totalPages = Math.max(1, Math.ceil(Number(totalRows ?? 0) / PAGE_SIZE))

  const orderIds = [...new Set(rows.map((r) => r.orderId))]

  // Check-in counts per (orderId, tierId) — separate query avoids row inflation
  const checkedInData = orderIds.length > 0
    ? await db
        .select({
          orderId: tickets.orderId,
          tierId: tickets.tierId,
          scannedCount: sql<number>`cast(count(*) filter (where ${tickets.scannedAt} is not null) as integer)`,
        })
        .from(tickets)
        .where(inArray(tickets.orderId, orderIds))
        .groupBy(tickets.orderId, tickets.tierId)
    : []

  const checkedInMap = new Map<string, number>()
  for (const c of checkedInData) {
    checkedInMap.set(`${c.orderId}:${c.tierId ?? ""}`, c.scannedCount)
  }

  const enrichedRows = rows.map((r) => ({
    ...r,
    scannedCount: checkedInMap.get(`${r.orderId}:${r.tierId ?? ""}`) ?? 0,
  }))

  // Fetch responses for all confirmed orders
  const responses = orderIds.length > 0
    ? await db
        .select({
          orderId: ticketQuestionResponses.orderId,
          questionId: ticketQuestionResponses.questionId,
          response: ticketQuestionResponses.response,
        })
        .from(ticketQuestionResponses)
        .where(inArray(ticketQuestionResponses.orderId, orderIds))
    : []

  const responseMap = new Map<string, Map<string, string>>()
  for (const r of responses) {
    if (!responseMap.has(r.orderId)) {
      responseMap.set(r.orderId, new Map())
    }
    responseMap.get(r.orderId)!.set(r.questionId, r.response)
  }

  const [{ totalBuyers }] = await db
    .select({ totalBuyers: sql<number>`COUNT(DISTINCT ${orders.guestEmail})::int` })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(attendeeWhere)
  const [{ totalTickets }] = await db
    .select({ totalTickets: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int` })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(attendeeWhere)
  const checkedIn = enrichedRows.reduce((sum, r) => sum + r.scannedCount, 0)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Attendees: ${event.title}`}
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to event
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-paper p-5">
          <div className="flex flex-wrap items-center gap-6 text-[13px]">
            <span className="text-ink-3">
              Total buyers: <strong className="text-ink">{totalBuyers}</strong>
            </span>
            <span className="text-ink-3">
              Total tickets: <strong className="text-ink">{totalTickets}</strong>
            </span>
            <span className="text-ink-3">
              Checked in: <strong className="text-green-700">{checkedIn}</strong> / {totalTickets}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/events/${id}/attendees/pdf`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-[13px] font-medium text-paper hover:bg-ink-2 transition"
            >
              <Download size={14} />
              Download PDF
            </a>
            <a
              href={`/api/events/${id}/attendees/export`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:bg-paper-2 transition"
            >
              <Download size={14} />
              CSV
            </a>
          </div>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No attendees yet"
            body="Attendees will appear here once tickets are sold."
          />
        ) : (
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                    <th className="px-5 py-3.5 text-left">Name</th>
                    <th className="px-3 py-3.5 text-left">Email</th>
                    <th className="px-3 py-3.5 text-left">Phone</th>
                    <th className="px-3 py-3.5 text-left">Ticket</th>
                    <th className="px-3 py-3.5 text-right">Qty</th>
                    <th className="px-3 py-3.5 text-center">Checked in</th>
                    {questions.map((q) => (
                      <th key={q.id} className="px-3 py-3.5 text-left w-[160px] min-w-[160px] max-w-[160px]">
                        <span className="block truncate" title={q.question}>{q.question}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {enrichedRows.map((r, i) => (
                    <tr key={`${r.orderId}-${r.tierId ?? ""}-${i}`} className="hover:bg-paper-2 transition-colors">
                      <td className="px-5 py-3.5 text-[13px] font-medium text-ink">
                        {r.guestName || "—"}
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">{r.guestEmail}</td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-2 font-mono">
                        {r.guestPhone ? (
                          <a
                            href={`https://wa.me/${r.guestPhone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-brand-600 transition-colors"
                          >
                            {r.guestPhone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">{r.tierName ?? "N/A"}</td>
                      <td className="px-3 py-3.5 text-[13px] text-right text-ink">{r.quantity}</td>
                      <td className="px-3 py-3.5 text-center">
                        {r.scannedCount >= r.quantity && r.quantity > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                            {r.quantity > 1 ? `${r.scannedCount}/${r.quantity}` : "Yes"}
                          </span>
                        ) : r.scannedCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                            {r.scannedCount}/{r.quantity}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-ink/5 px-2.5 py-0.5 text-[11px] font-medium text-ink-3">
                            No
                          </span>
                        )}
                      </td>
                      {questions.map((q) => {
                        const answer = responseMap.get(r.orderId)?.get(q.id)
                        return (
                          <td key={q.id} className="px-3 py-3.5 text-[13px] text-ink-2 max-w-[180px] truncate" title={answer ?? undefined}>
                            {answer ?? "—"}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-line">
              {enrichedRows.map((r, i) => {
                const orderResponses = responseMap.get(r.orderId)
                return (
                  <div key={`${r.orderId}-${r.tierId ?? ""}-${i}`} className="px-5 py-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-ink">{r.guestName || "—"}</span>
                      {r.scannedCount >= r.quantity && r.quantity > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          {r.quantity > 1 ? `${r.scannedCount}/${r.quantity} checked in` : "Checked in"}
                        </span>
                      ) : r.scannedCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          {r.scannedCount}/{r.quantity} checked in
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink-3">
                          Not checked in
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-ink-3">{r.guestEmail}</div>
                    {r.guestPhone && (
                      <div className="text-[12px] text-ink-3 font-mono">
                        <a
                          href={`https://wa.me/${r.guestPhone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand-600 transition-colors"
                        >
                          {r.guestPhone}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[12px] text-ink-2">
                      <span>{r.tierName ?? "N/A"}</span>
                      <span>×{r.quantity}</span>
                    </div>
                    {questions.length > 0 && (
                      <div className="pt-2 space-y-1 border-t border-line mt-2">
                        {questions.map((q) => {
                          const answer = orderResponses?.get(q.id)
                          return (
                            <div key={q.id} className="text-[12px]">
                              <span className="text-ink-3">{q.question}:</span>{" "}
                              <span className="text-ink-2">{answer ?? "—"}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-ink-2">
            <span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalRows)} of {totalRows} attendees</span>
            <div className="flex items-center gap-1">
              {page > 1 && (
                <Link
                  href={`/organizer/events/${id}/attendees?page=${page - 1}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-3 py-1.5 hover:border-line-2 transition"
                >
                  <ChevronLeft size={14} /> Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/organizer/events/${id}/attendees?page=${page + 1}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-3 py-1.5 hover:border-line-2 transition"
                >
                  Next <ChevronRight size={14} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
