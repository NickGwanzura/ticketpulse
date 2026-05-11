import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Ticket, ShoppingBag, ImageIcon } from "lucide-react"

import { db } from "@/db"
import { events, ticketTiers } from "@/db/schema"
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

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}/tiers`)

  const [event] = await db
    .select({ id: events.id, title: events.title, organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) notFound()
  if (event.organizerId !== session.user.id && session.user.role !== "admin") {
    redirect("/organizer")
  }

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
          <>
            <Link
              href={`/organizer/events/${id}/edit`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              Event details
            </Link>
            <Link
              href={`/organizer/events/${id}/gallery`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <ImageIcon size={15} /> Gallery
            </Link>
            <Link
              href={`/organizer/events/${id}/merch`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink hover:border-line-2 active:scale-[0.99] transition"
            >
              <ShoppingBag size={15} /> Merch
            </Link>
          </>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        <Link
          href={`/organizer/events/${id}/edit`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to event
        </Link>

        {justCreated && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
            Draft created. Add at least one ticket tier below so people can buy.
          </div>
        )}
        {sp.error === "tier_has_sales" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            That tier already has sold tickets and can&apos;t be deleted. Set its sales end date in the past to take it off sale.
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
