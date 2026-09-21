import Link from "next/link"
import { redirect } from "next/navigation"
import { and, desc, eq, inArray, or } from "drizzle-orm"
import { ArrowUpRight, CalendarDays, MapPin, Plus } from "lucide-react"

import { auth } from "@/auth"
import { db } from "@/db"
import { eventOrganisers, events, users } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import { formatDateShort } from "@/lib/utils"

const STATUS_LABEL: Record<string, string> = {
  published: "Live",
  pending_review: "Pending review",
  draft: "Draft",
  sold_out: "Sold out",
  completed: "Completed",
  cancelled: "Cancelled",
}

export default async function OrganizerEventsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/organizer/events")
  if (session.user.role !== "organizer" && session.user.role !== "admin") redirect("/dashboard")

  if (session.user.role === "organizer") {
    const [account] = await db
      .select({ approvedAt: users.approvedAt, emailVerified: users.emailVerified, frozenAt: users.organizerFrozenAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    if (!account?.approvedAt || !account.emailVerified || account.frozenAt) redirect("/organizer")
  }

  const invitedRows = session.user.role === "admin"
    ? []
    : await db
        .select({ eventId: eventOrganisers.eventId })
        .from(eventOrganisers)
        .where(eq(eventOrganisers.userId, session.user.id))
  const invitedIds = invitedRows.map((row) => row.eventId)
  const scope = session.user.role === "admin"
    ? undefined
    : invitedIds.length > 0
      ? or(eq(events.organizerId, session.user.id), inArray(events.id, invitedIds))
      : eq(events.organizerId, session.user.id)

  const eventRows = await db
    .select({
      id: events.id,
      title: events.title,
      category: events.category,
      venue: events.venue,
      city: events.city,
      startsAt: events.startsAt,
      status: events.status,
    })
    .from(events)
    .where(scope ? and(scope) : undefined)
    .orderBy(desc(events.startsAt))
    .limit(100)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="Events"
        subtitle="Manage every event you own or have been invited to work on."
        width="full"
        actions={
          <Link href="/organizer/events/new" className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper hover:bg-ink/90">
            <Plus size={14} /> New event
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {eventRows.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No events yet" body="Create your first event to start selling tickets." ctaLabel="Create event" ctaHref="/organizer/events/new" variant="inline" />
        ) : (
          <div className="rounded-2xl border border-line bg-paper overflow-hidden">
            <ul className="divide-y divide-line">
              {eventRows.map((event) => (
                <li key={event.id}>
                  <Link href={`/organizer/events/${event.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper-2 transition-colors">
                    <span className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy/5 text-navy shrink-0">
                      <CalendarDays size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-semibold text-ink truncate">{event.title}</p>
                        <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[10px] font-semibold text-ink-2">{STATUS_LABEL[event.status ?? "draft"] ?? "Draft"}</span>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
                        <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatDateShort(event.startsAt)}</span>
                        <span className="inline-flex items-center gap-1"><MapPin size={12} /> {event.venue}, {event.city}</span>
                      </p>
                    </div>
                    <ArrowUpRight size={15} className="text-ink-3 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
