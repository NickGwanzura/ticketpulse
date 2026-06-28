import { redirect, notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { db } from "@/db"
import { events } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import SeoForm from "./_components/SeoForm"

export const metadata = {
  title: "SEO Settings",
}

type RouteParams = { id: string }

export default async function SeoPage({
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
      slug: events.slug,
      metaTitle: events.metaTitle,
      metaDescription: events.metaDescription,
    })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)

  if (!event) notFound()

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="SEO Settings"
        subtitle="Control how your event appears in search results and social shares."
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
        <SeoForm
          eventId={event.id}
          eventTitle={event.title}
          eventSlug={event.slug}
          metaTitle={event.metaTitle}
          metaDescription={event.metaDescription}
        />
      </div>
    </div>
  )
}
