import { notFound, redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { db } from "@/db"
import { events } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import FeeSwitcher from "./_components/FeeSwitcher"

export const metadata = {
  title: "Platform fees",
}

type RouteParams = { id: string }

export default async function PlatformFeesPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { id } = await params

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      absorbFee: events.absorbFee,
    })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="Platform Fees"
        subtitle="Choose who pays the TicketPulse service fee."
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} /> Back to event
          </Link>
        }
      />

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-10">
        <div className="rounded-2xl border border-line bg-paper p-6 md:p-8 space-y-2">
          <div className="mb-6">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">{event.title}</h2>
            <p className="text-[13px] text-ink-3 mt-1">
              Fee configuration applies to all ticket tiers for this event.
            </p>
          </div>
          <FeeSwitcher eventId={id} currentlyAbsorb={event.absorbFee ?? false} />
        </div>
      </div>
    </div>
  )
}
