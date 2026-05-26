import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, and, inArray, desc, asc, sql } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Download, Users } from "lucide-react"

import { db } from "@/db"
import { events, orders, orderItems, ticketTiers, tickets, ticketQuestions, ticketQuestionResponses } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"

export const metadata = { title: "Attendees" }

type RouteParams = { id: string }

export default async function AttendeesPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = await params

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
  const rows = await db
    .select({
      orderId: orders.id,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      guestPhone: orders.guestPhone,
      tierName: ticketTiers.name,
      quantity: orderItems.quantity,
      scannedAt: tickets.scannedAt,
      qrCode: tickets.qrCode,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
    .leftJoin(
      tickets,
      and(eq(tickets.orderId, orders.id), eq(tickets.tierId, orderItems.tierId)),
    )
    .where(
      and(
        eq(orders.eventId, id),
        inArray(orders.status, ["paid"]),
        eq(orderItems.type, "ticket"),
      ),
    )
    .orderBy(desc(orders.createdAt))

  // Fetch responses for all paid orders
  const orderIds = [...new Set(rows.map((r) => r.orderId))]
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

  const totalBuyers = new Set(rows.map((r) => r.guestEmail)).size
  const totalTickets = rows.reduce((sum, r) => sum + r.quantity, 0)
  const checkedIn = rows.filter((r) => r.scannedAt).length

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Attendees: ${event.title}`}
        actions={
          <Link
            href={`/organizer/events/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to event
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
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
          <a
            href={`/api/events/${id}/attendees/export`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-[12.5px] font-medium text-white hover:bg-ink-2 transition"
          >
            <Download size={14} />
            Download CSV
          </a>
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
                      <th key={q.id} className="px-3 py-3.5 text-left max-w-[180px]">{q.question}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr key={`${r.qrCode ?? r.guestEmail}-${i}`} className="hover:bg-paper-2 transition-colors">
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
                            className="hover:text-green-600 transition-colors"
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
                        {r.scannedAt ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                            Yes
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
              {rows.map((r, i) => {
                const orderResponses = responseMap.get(r.orderId)
                return (
                  <div key={`${r.qrCode ?? r.guestEmail}-${i}`} className="px-5 py-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-ink">{r.guestName || "—"}</span>
                      {r.scannedAt ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          Checked in
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
                          className="hover:text-green-600 transition-colors"
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
                            <div key={q.id} className="text-[11.5px]">
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
      </div>
    </div>
  )
}
