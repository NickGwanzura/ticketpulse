import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, and, desc, or, sql } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Users, QrCode, Shield } from "lucide-react"

import { db } from "@/db"
import { events, tickets, orders } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import StaffTicketList from "./StaffTicketList"
import GenerateStaffTicketForm from "./GenerateStaffTicketForm"

export const metadata = { title: "Complimentary tickets" }

type RouteParams = { id: string }

export default async function StaffTicketsPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = await params

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}/staff`)

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [event] = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  // Fetch staff tickets
  const staffTickets = await db
    .select({
      id: tickets.id,
      staffName: tickets.staffName,
      staffRole: tickets.staffRole,
      staffPhone: tickets.staffPhone,
      qrCode: tickets.qrCode,
      status: tickets.status,
      scannedAt: tickets.scannedAt,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(and(eq(tickets.eventId, id), eq(tickets.isStaffTicket, true)))
    .orderBy(desc(tickets.createdAt))

  const guestTickets = await db.select({
    id: tickets.id,
    name: sql<string>`coalesce(${tickets.holderName}, ${orders.guestName})`,
    email: sql<string>`coalesce(${tickets.holderEmail}, ${orders.guestEmail})`,
    status: tickets.status,
    scannedAt: tickets.scannedAt,
    orderId: orders.id,
  }).from(tickets).innerJoin(orders, eq(tickets.orderId, orders.id))
    .where(and(eq(tickets.eventId, id), eq(orders.eventId, id),
      or(eq(tickets.isStaffTicket, false), sql`${tickets.isStaffTicket} is null`),
      eq(orders.paymentMethod, "complimentary")))
    .orderBy(desc(tickets.createdAt))

  const allTickets = [...staffTickets, ...guestTickets]
  const total = allTickets.length
  const activeCount = allTickets.filter((t) => t.status === "available" && !t.scannedAt).length
  const usedCount = allTickets.filter((t) => t.status === "used" || t.scannedAt).length
  const cancelledCount = allTickets.filter((t) => t.status === "cancelled").length

  const roleLabels: Record<string, string> = {
    security: "Security",
    usher: "Usher",
    dj_sound: "DJ / Sound",
    bar_staff: "Bar Staff",
    vip_host: "VIP Host",
    media: "Media",
    other: "Other",
  }

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Complimentary tickets: ${event.title}`}
        subtitle="View free guest tickets and manage staff passes for this event."
        actions={
          <Link
            href={`/organizer/events/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to event
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Complimentary tickets", value: total.toString(), icon: QrCode },
            { label: "Active", value: activeCount.toString(), icon: Users },
            { label: "Used", value: usedCount.toString(), icon: Shield },
            { label: "Cancelled", value: cancelledCount.toString(), icon: Shield },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-line bg-paper p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={13} className="text-ink-3" />
                <span className="text-[11px] text-ink-3">{label}</span>
              </div>
              <p className="text-[22px] font-bold tracking-tight text-ink tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold text-ink">Guest tickets ({guestTickets.length})</h2>
            <p className="text-[13px] text-ink-3 mt-1">Complimentary admission · no charge. Each row is one ticket.</p>
          </div>
          {guestTickets.length === 0 ? (
            <EmptyState icon={Users} title="No complimentary guest tickets yet" body="Issued complimentary guest tickets will appear here." variant="inline" />
          ) : (
            <ul className="divide-y divide-line">
              {guestTickets.map((ticket) => (
                <li key={ticket.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">{ticket.name ?? "Guest"}</p>
                    <p className="text-[13px] text-ink-3 break-all">{ticket.email ?? "No email"}</p>
                    <p className="text-[11px] text-ink-3 mt-1">Ticket #{ticket.id.slice(0, 8)} · Order #{ticket.orderId.slice(0, 8)}</p>
                  </div>
                  <span className="text-[12px] font-medium text-ink-2">{ticket.status === "cancelled" ? "Cancelled" : ticket.scannedAt || ticket.status === "used" ? "Used" : ticket.status === "available" ? "Active" : ticket.status ?? "Unknown"} · Free</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Generate staff passes */}
        <GenerateStaffTicketForm eventId={id} />

        {/* Ticket list */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">
              Staff passes ({staffTickets.length})
            </h2>
          </div>

          {staffTickets.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No staff tickets yet"
              body="Generate staff tickets for event workers like security, ushers, DJs, and more. Each ticket gets a unique QR code."
              variant="inline"
            />
          ) : (
            <StaffTicketList
              eventId={id}
              tickets={staffTickets.map((t) => ({
                ...t,
                staffRole: t.staffRole ? (roleLabels[t.staffRole] ?? t.staffRole) : null,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
