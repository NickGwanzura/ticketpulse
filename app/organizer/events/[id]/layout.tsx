import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { events } from "@/db/schema"
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
  if (event.organizerId !== session.user.id && session.user.role !== "admin") {
    redirect("/organizer")
  }

  return (
    <div className="flex">
      <EventSidebar
        eventId={id}
        eventSlug={event.slug ?? id}
        eventTitle={event.title}
        eventStatus={event.status}
      />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
