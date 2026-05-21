import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { eq, and, isNotNull, sql, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Activity } from "lucide-react"

import { db } from "@/db"
import { events, ticketTiers, tickets, orders } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import StatCard from "@/components/dashboard/StatCard"
import EmptyState from "@/components/dashboard/EmptyState"
import LiveDashboardClient from "./LiveDashboardClient"

export const metadata = { title: "Live dashboard" }

type RouteParams = { id: string }

export default async function LiveDashboardPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = await params

  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/organizer/events/${id}/live`)

  const access = await requireEventAccess(id)
  if (!access.allowed) redirect("/organizer")

  const [event] = await db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(eq(events.id, id))
    .limit(1)
  if (!event) notFound()

  // ── Stats ────────────────────────────────────────────────────────────────────
  const [tierAgg] = await db
    .select({
      totalSold: sql<number>`COALESCE(SUM(${ticketTiers.soldQuantity}), 0)`,
      totalCapacity: sql<number>`COALESCE(SUM(${ticketTiers.totalQuantity}), 0)`,
    })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, id))

  const [checkinAgg] = await db
    .select({
      checkedIn: sql<number>`COUNT(*)::int`,
    })
    .from(tickets)
    .where(and(eq(tickets.eventId, id), isNotNull(tickets.scannedAt)))

  const totalSold = Number(tierAgg?.totalSold ?? 0)
  const totalCapacity = Number(tierAgg?.totalCapacity ?? 0)
  const checkedIn = Number(checkinAgg?.checkedIn ?? 0)
  const capacityPct = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0
  const checkinPct = totalSold > 0 ? Math.round((checkedIn / totalSold) * 100) : 0

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Live: ${event.title}`}
        actions={
          <Link
            href={`/organizer/events/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to event
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        <LiveDashboardClient
          eventId={id}
          initialStats={{ totalSold, totalCapacity, checkedIn, capacityPct, checkinPct }}
        />
      </div>
    </div>
  )
}
