import { redirect } from "next/navigation"
import { desc, inArray } from "drizzle-orm"

import { auth } from "@/auth"
import { db } from "@/db"
import { events, ticketTiers } from "@/db/schema"
import PageHeader from "@/components/dashboard/PageHeader"
import NewOfflineOrderForm from "@/app/admin/_components/NewOfflineOrderForm"

export default async function NewOfflineOrderPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    redirect("/auth/signin?callbackUrl=/admin/orders/new")
  }

  const eventRows = await db
    .select({ id: events.id, title: events.title, status: events.status })
    .from(events)
    .where(inArray(events.status, ["published", "sold_out", "completed"]))
    .orderBy(desc(events.startsAt))

  const tierRows = eventRows.length
    ? await db
        .select({
          id: ticketTiers.id,
          eventId: ticketTiers.eventId,
          name: ticketTiers.name,
          price: ticketTiers.price,
          currency: ticketTiers.currency,
          totalQuantity: ticketTiers.totalQuantity,
          soldQuantity: ticketTiers.soldQuantity,
        })
        .from(ticketTiers)
        .where(inArray(ticketTiers.eventId, eventRows.map((e) => e.id)))
    : []

  const eventsWithTiers = eventRows
    .map((ev) => ({
      ...ev,
      tiers: tierRows
        .filter((t) => t.eventId === ev.id)
        .map((t) => ({
          id: t.id,
          name: t.name,
          price: t.price,
          currency: t.currency ?? "USD",
          remaining: t.totalQuantity - (t.soldQuantity ?? 0),
        })),
    }))
    .filter((ev) => ev.tiers.length > 0)

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Orders"
        title="New offline order"
        subtitle="Issue a ticket for a payment collected outside the app — cash, bank transfer, etc. Sends the ticket email immediately."
        width="lg"
      />

      <div className="px-5 md:px-8 py-8 md:py-10 max-w-2xl">
        <NewOfflineOrderForm events={eventsWithTiers} />
      </div>
    </div>
  )
}
