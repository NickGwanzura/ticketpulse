import Link from "next/link"
import { timingSafeEqual } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react"

import { db } from "@/db"
import { events, orders, ticketTiers, tickets } from "@/db/schema"
import { signTicketPayload } from "@/lib/tickets"

type Params = { id: string }
type SearchParams = { order?: string; sig?: string }

export default async function TicketVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { id } = await params
  const { order, sig } = await searchParams
  const [ticket] = order
    ? await db
        .select({
          id: tickets.id,
          orderId: tickets.orderId,
          status: tickets.status,
          scannedAt: tickets.scannedAt,
          tierName: ticketTiers.name,
          eventTitle: events.title,
          eventStartsAt: events.startsAt,
          eventVenue: events.venue,
          orderStatus: orders.status,
        })
        .from(tickets)
        .leftJoin(ticketTiers, eq(ticketTiers.id, tickets.tierId))
        .leftJoin(events, eq(events.id, tickets.eventId))
        .leftJoin(orders, eq(orders.id, tickets.orderId))
        .where(and(eq(tickets.id, id), eq(tickets.orderId, order)))
        .limit(1)
    : []

  const expectedSignature = ticket ? signTicketPayload(ticket.id, ticket.orderId ?? "") : ""
  const signatureValid = Boolean(
    ticket && sig && /^[a-f0-9]{64}$/i.test(sig) && timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSignature, "hex")),
  )
  const valid = Boolean(
    signatureValid &&
      ticket &&
      (ticket.orderStatus === "paid" || ticket.orderStatus === "completed") &&
      (ticket.status === "sold" || ticket.status === "used"),
  )

  return (
    <main className="min-h-screen bg-paper px-5 py-12 text-ink">
      <div className="mx-auto max-w-lg rounded-3xl border border-line bg-white p-7 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          <ShieldCheck size={18} className="text-brand-600" /> TicketPulse verification
        </div>

        <div className={`mt-8 rounded-2xl border p-5 ${valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
          {valid ? <CheckCircle2 className="text-emerald-600" size={32} /> : <AlertTriangle className="text-rose-600" size={32} />}
          <h1 className="mt-3 text-2xl font-bold">{valid ? "Ticket is valid" : "Ticket could not be verified"}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {valid ? "Show this screen to the gate team. Scanning is still required to check the ticket in." : "Do not admit this guest until the ticket is verified in the organizer scanner."}
          </p>
        </div>

        {ticket && (
          <dl className="mt-6 divide-y divide-line text-sm">
            <div className="flex justify-between gap-4 py-3"><dt className="text-ink-3">Event</dt><dd className="text-right font-semibold">{ticket.eventTitle ?? "—"}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-ink-3">Ticket</dt><dd className="text-right font-semibold">{ticket.tierName ?? "General admission"}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-ink-3">Status</dt><dd className="text-right font-semibold capitalize">{ticket.scannedAt ? "Already scanned" : ticket.status ?? "Unknown"}</dd></div>
            {ticket.eventVenue && <div className="flex justify-between gap-4 py-3"><dt className="text-ink-3">Venue</dt><dd className="text-right font-semibold">{ticket.eventVenue}</dd></div>}
          </dl>
        )}

        <Link href="/organizer/scan" className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-ink/90">
          Open gate scanner
        </Link>
      </div>
    </main>
  )
}
