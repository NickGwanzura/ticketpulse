import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, ShoppingBag } from "lucide-react"

import { db } from "@/db"
import { events, merchItems } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import MerchCard from "./MerchCard"
import NewMerchPanel from "./NewMerchPanel"

export const metadata = {
  title: "Merch",
}

type RouteParams = { id: string }

export default async function MerchPage({
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

  const items = await db
    .select()
    .from(merchItems)
    .where(eq(merchItems.eventId, id))
    .orderBy(asc(merchItems.createdAt))

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Merch: ${event.title}`}
        subtitle="Add t-shirts, caps, posters and other merch attendees can buy alongside tickets."
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

        <NewMerchPanel eventId={id} />

        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No merch yet"
            body="Add your first merch item above. Drop in product images, set the price, and you&apos;re done."
            variant="card"
          />
        ) : (
          <div className="space-y-4">
            {items.map((m) => (
              <MerchCard
                key={m.id}
                eventId={id}
                merch={{
                  id: m.id,
                  name: m.name,
                  description: m.description,
                  price: m.price,
                  currency: m.currency,
                  images: m.images,
                  sizes: m.sizes,
                  colors: m.colors,
                  stockQuantity: m.stockQuantity,
                  soldQuantity: m.soldQuantity,
                  active: m.active,
                  deliveryAvailable: m.deliveryAvailable,
                  pickupAtEvent: m.pickupAtEvent,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
