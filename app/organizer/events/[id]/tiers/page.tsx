import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Ticket, ShoppingBag, ImageIcon } from "lucide-react"

import { db } from "@/db"
import { events, ticketTiers } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import TierCard from "./TierCard"
import NewTierPanel from "./NewTierPanel"

export const metadata = {
  title: "Ticket tiers",
}

type RouteParams = { id: string }

export default async function TiersPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<{ created?: string; error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect(access.redirectTo)

  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
    })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) notFound()

  const tiers = await db
    .select()
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, id))
    .orderBy(asc(ticketTiers.createdAt))

  const justCreated = sp.created === "1"

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Tickets: ${event.title}`}
        subtitle="Set up the tiers people can buy. Add as many as you need — early bird, GA, VIP."
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} /> Back to event
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">

        {justCreated && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800">
            Draft created. Add at least one ticket tier below so people can buy.
          </div>
        )}

        <NewTierPanel eventId={id} defaultOpen={tiers.length === 0} />

        {tiers.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No tiers yet"
            body="Add at least one tier above so people can buy tickets to this event."
            variant="card"
          />
        ) : (
          <div className="space-y-4">
            {tiers.map((t) => (
              <TierCard
                key={t.id}
                eventId={id}
                eventTitle={event.title}
                
                tier={{
                  id: t.id,
                  name: t.name,
                  description: t.description,
                  price: t.price,
                  currency: t.currency,
                  totalQuantity: t.totalQuantity,
                  soldQuantity: t.soldQuantity,
                  maxPerOrder: t.maxPerOrder,
                  salesStart: t.salesStart,
                  salesEnd: t.salesEnd,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
