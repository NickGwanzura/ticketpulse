import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { eq, or } from "drizzle-orm"

import { db } from "@/db"
import { events } from "@/db/schema"
import ReviewForm from "@/components/reviews/ReviewForm"

export const metadata: Metadata = {
  title: "Send a review — TicketPulse",
  description: "Share a review about your TicketPulse event or ticket-buying experience.",
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; name?: string; email?: string; order?: string }>
}) {
  const sp = await searchParams
  const eventParam = sp.event?.trim()

  const event = eventParam
    ? (await db
      .select({ id: events.id, title: events.title, slug: events.slug })
      .from(events)
      .where(UUID_RE.test(eventParam) ? or(eq(events.id, eventParam), eq(events.slug, eventParam))! : eq(events.slug, eventParam))
      .limit(1))[0] ?? null
    : null

  return (
    <main className="min-h-screen bg-paper-2">
      <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-12">
        <Link href={event ? `/events/${event.slug}` : "/"} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors mb-5">
          <ArrowLeft size={14} />
          Back
        </Link>
        <ReviewForm
          eventId={event?.id ?? null}
          eventTitle={event?.title ?? null}
          initialName={sp.name ?? ""}
          initialEmail={sp.email ?? ""}
          initialOrderRef={sp.order ?? ""}
        />
      </div>
    </main>
  )
}
