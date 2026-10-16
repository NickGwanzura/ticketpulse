import { redirect } from "next/navigation"
import Link from "next/link"
import { and, count, desc, eq, inArray, like, or, sql } from "drizzle-orm"
import { ChevronLeft, ChevronRight, Download, Search, Users } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { eventOrganisers, events, orderItems, orders, ticketTiers, tickets } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"

export const metadata = { title: "Attendees" }

const PAGE_SIZE = 50

type SearchParams = { q?: string; event?: string; page?: string }

/** Who is coming to your events, across all of them. Payment details stay out of sight. */
export default async function OrganizerAttendeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/organizer/attendees")
  const isAdmin = session.user.role === "admin"

  const sp = await searchParams
  const query = (sp.q ?? "").trim().slice(0, 80)
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  // Events this person may see: all (admin), or owned + shared with them.
  const invited = isAdmin
    ? []
    : await db.select({ eventId: eventOrganisers.eventId }).from(eventOrganisers).where(eq(eventOrganisers.userId, session.user.id))
  const accessWhere = isAdmin
    ? undefined
    : invited.length > 0
      ? or(eq(events.organizerId, session.user.id), inArray(events.id, invited.map((r) => r.eventId)))
      : eq(events.organizerId, session.user.id)
  const myEvents = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(accessWhere)
    .orderBy(desc(events.startsAt))
    .limit(200)
  const myEventIds = myEvents.map((e) => e.id)
  const eventFilter = sp.event && myEventIds.includes(sp.event) ? sp.event : ""
  const scopeIds = eventFilter ? [eventFilter] : myEventIds

  const deliveredTicketExists = sql`EXISTS (SELECT 1 FROM tickets delivered_ticket WHERE delivered_ticket.order_id = ${orders.id} AND delivered_ticket.event_id = ${orders.eventId})`
  const escaped = query.replace(/[\\%_]/g, "\\$&")
  const where = and(
    scopeIds.length > 0 ? inArray(orders.eventId, scopeIds) : sql`false`,
    eq(orderItems.type, "ticket"),
    deliveredTicketExists,
    query
      ? or(
          like(orders.guestName, `%${escaped}%`),
          like(orders.guestEmail, `%${escaped}%`),
          like(orders.guestPhone, `%${escaped}%`),
        )
      : undefined,
  )

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        orderId: orders.id,
        eventId: orders.eventId,
        eventTitle: events.title,
        guestName: orders.guestName,
        guestEmail: orders.guestEmail,
        guestPhone: orders.guestPhone,
        tierId: orderItems.tierId,
        tierName: ticketTiers.name,
        quantity: orderItems.quantity,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(events, eq(events.id, orders.eventId))
      .leftJoin(ticketTiers, eq(ticketTiers.id, orderItems.tierId))
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({
        rows: count(),
        buyers: sql<number>`COUNT(DISTINCT lower(${orders.guestEmail}))::int`,
        tickets: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(where),
  ])

  const orderIds = [...new Set(rows.map((r) => r.orderId))]
  const scanned = orderIds.length
    ? await db
        .select({
          orderId: tickets.orderId,
          tierId: tickets.tierId,
          n: sql<number>`cast(count(*) filter (where ${tickets.scannedAt} is not null) as integer)`,
        })
        .from(tickets)
        .where(inArray(tickets.orderId, orderIds))
        .groupBy(tickets.orderId, tickets.tierId)
    : []
  const scannedMap = new Map(scanned.map((c) => [`${c.orderId}:${c.tierId ?? ""}`, c.n]))
  const list = rows.map((r) => ({ ...r, scanned: scannedMap.get(`${r.orderId}:${r.tierId ?? ""}`) ?? 0 }))

  const totalRows = Number(totals?.rows ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const pageHref = (p: number) => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (eventFilter) params.set("event", eventFilter)
    if (p > 1) params.set("page", String(p))
    const qs = params.toString()
    return qs ? `/organizer/attendees?${qs}` : "/organizer/attendees"
  }

  const checkInBadge = (scannedCount: number, quantity: number) =>
    scannedCount >= quantity && quantity > 0
      ? { cls: "bg-green-100 text-green-700", text: quantity > 1 ? `${scannedCount}/${quantity} checked in` : "Checked in" }
      : scannedCount > 0
        ? { cls: "bg-amber-100 text-amber-700", text: `${scannedCount}/${quantity} checked in` }
        : { cls: "bg-ink/5 text-ink-3", text: "Not checked in" }

  return (
    <div className="tp-fade-up">
      <PageHeader eyebrow="Organizer" title="Attendees" subtitle="Everyone with a ticket to your events." />

      <div className="mx-auto max-w-7xl space-y-5 px-5 py-6 md:px-8 md:py-8">
        <form action="/organizer/attendees" method="get" className="flex flex-col gap-2 md:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search attendees</span>
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search name, email or phone…"
              className="min-h-11 w-full rounded-xl border border-line bg-paper pl-10 pr-4 text-[15px] text-ink"
            />
          </label>
          <label>
            <span className="sr-only">Event</span>
            <select name="event" defaultValue={eventFilter} className="min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-[14px] text-ink md:w-64">
              <option value="">All events</option>
              {myEvents.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-ink px-5 text-[14px] font-semibold text-paper">Search</button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-5 py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-3">
            <span>Buyers: <strong className="text-ink">{Number(totals?.buyers ?? 0).toLocaleString()}</strong></span>
            <span>Tickets: <strong className="text-ink">{Number(totals?.tickets ?? 0).toLocaleString()}</strong></span>
          </div>
          {eventFilter ? (
            <div className="flex gap-2">
              <a href={`/api/events/${eventFilter}/attendees/pdf`} download className="tp-tap inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-paper">
                <Download size={14} /> PDF
              </a>
              <a href={`/api/events/${eventFilter}/attendees/export`} download className="tp-tap inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3.5 py-2 text-[13px] font-medium text-ink">
                <Download size={14} /> CSV
              </a>
            </div>
          ) : (
            <p className="text-[12px] text-ink-3">Choose an event to download its list.</p>
          )}
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query || eventFilter ? "No attendees match" : "No attendees yet"}
            body={query || eventFilter ? "Try a different search or event." : "Attendees appear here once tickets are sold."}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-paper">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line text-[12px] font-semibold uppercase tracking-widest text-ink-3">
                    <th className="px-5 py-3.5 text-left">Name</th>
                    <th className="px-3 py-3.5 text-left">Contact</th>
                    <th className="px-3 py-3.5 text-left">Event</th>
                    <th className="px-3 py-3.5 text-left">Ticket</th>
                    <th className="px-3 py-3.5 text-right">Qty</th>
                    <th className="px-3 py-3.5 text-center">Check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((r, i) => {
                    const badge = checkInBadge(r.scanned, r.quantity)
                    return (
                      <tr key={`${r.orderId}-${r.tierId ?? ""}-${i}`} className="hover:bg-paper-2">
                        <td className="px-5 py-3.5 text-[13px] font-medium text-ink">{r.guestName || "—"}</td>
                        <td className="px-3 py-3.5 text-[13px] text-ink-2">
                          <div>{r.guestEmail}</div>
                          {r.guestPhone && (
                            <a href={`https://wa.me/${r.guestPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] hover:text-brand-600">{r.guestPhone}</a>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-[13px] text-ink-2">
                          <Link href={`/organizer/events/${r.eventId}/attendees`} className="hover:text-navy hover:underline">{r.eventTitle}</Link>
                        </td>
                        <td className="px-3 py-3.5 text-[13px] text-ink-2">{r.tierName ?? "N/A"}</td>
                        <td className="px-3 py-3.5 text-right text-[13px] text-ink">{r.quantity}</td>
                        <td className="px-3 py-3.5 text-center"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${badge.cls}`}>{badge.text}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {list.map((r, i) => {
                const badge = checkInBadge(r.scanned, r.quantity)
                return (
                  <li key={`${r.orderId}-${r.tierId ?? ""}-${i}`} className="space-y-1.5 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-semibold text-ink">{r.guestName || "—"}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${badge.cls}`}>{badge.text}</span>
                    </div>
                    <p className="break-all text-[13px] text-ink-2">{r.guestEmail}</p>
                    {r.guestPhone && (
                      <a href={`https://wa.me/${r.guestPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="tp-tap inline-flex items-center font-mono text-[13px] text-ink-2">{r.guestPhone}</a>
                    )}
                    <p className="text-[13px] text-ink-3">{r.eventTitle} · {r.tierName ?? "N/A"} × {r.quantity}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-[13px] text-ink-2">
            <span>Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalRows)} of {totalRows}</span>
            <div className="flex gap-1">
              {page > 1 && <Link href={pageHref(page - 1)} className="tp-tap inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-3 py-1.5"><ChevronLeft size={14} /> Prev</Link>}
              {page < totalPages && <Link href={pageHref(page + 1)} className="tp-tap inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-3 py-1.5">Next <ChevronRight size={14} /></Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
