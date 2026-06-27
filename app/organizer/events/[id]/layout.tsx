import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, and } from "drizzle-orm"

import { db } from "@/db"
import { events, eventOrganisers } from "@/db/schema"
import EventSidebar from "./_components/EventSidebar"

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}`)

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      organizerId: events.organizerId,
      status: events.status,
    })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  const isOwner = event.organizerId === session.user.id || session.user.role === "admin"
  if (!isOwner) {
    const [invited] = await db
      .select({ id: eventOrganisers.id })
      .from(eventOrganisers)
      .where(and(eq(eventOrganisers.eventId, id), eq(eventOrganisers.userId, session.user.id)))
      .limit(1)
    if (!invited) redirect("/organizer")
  }

  return (
    <div className="flex">
      <EventSidebar
        eventId={id}
        eventSlug={event.slug ?? id}
        eventTitle={event.title}
        eventStatus={event.status}
      />
      <main className="flex-1 min-w-0 bg-paper-2 min-h-[calc(100vh-6rem)]">
        {children}
      </main>
    </div>
  )
}
