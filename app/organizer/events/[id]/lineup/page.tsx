import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { db } from "@/db"
import { events, eventLineup } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import LineupManager from "./_components/LineupManager"

export const metadata = {
  title: "Lineup",
}

type RouteParams = { id: string }

export default async function LineupPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { id } = await params

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [event] = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  const members = await db
    .select()
    .from(eventLineup)
    .where(eq(eventLineup.eventId, id))
    .orderBy(asc(eventLineup.displayOrder))

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Lineup: ${event.title}`}
        subtitle="Manage artists, speakers, DJs, and performers for this event."
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} /> Back to event
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10">
        <LineupManager
          members={members.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role,
            bio: m.bio,
            imageUrl: m.imageUrl,
            socialUrl: m.socialUrl,
            displayOrder: m.displayOrder,
          }))}
          eventId={id}
        />
      </div>
    </div>
  )
}
