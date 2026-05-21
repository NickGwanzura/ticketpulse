import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, and, desc, sql } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Users, QrCode, Shield } from "lucide-react"

import { db } from "@/db"
import { events, tickets } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import StaffTicketList from "./StaffTicketList"
import GenerateStaffTicketForm from "./GenerateStaffTicketForm"

export const metadata = { title: "Staff tickets" }

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

  const total = staffTickets.length
  const activeCount = staffTickets.filter((t) => t.status === "available").length
  const usedCount = staffTickets.filter((t) => t.status === "used" || t.scannedAt).length
  const cancelledCount = staffTickets.filter((t) => t.status === "cancelled").length

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
        title={`Staff tickets: ${event.title}`}
        subtitle="Generate free staff tickets for event workers. These are separate from paid attendee tickets."
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
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total staff tickets", value: total.toString(), icon: QrCode },
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

        {/* Generate form */}
        <GenerateStaffTicketForm eventId={id} />

        {/* Ticket list */}
        <div className="rounded-2xl border border-line bg-paper overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="text-[16px] font-semibold tracking-tight text-ink">
              All staff tickets ({total})
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
