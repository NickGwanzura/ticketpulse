import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Ticket } from "lucide-react"

import { db } from "@/db"
import { events, ticketTiers } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import { formatCurrency } from "@/lib/utils"

export const metadata = {
  title: "Capacity",
}

type RouteParams = { id: string }

export default async function CapacityPage({
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

  const tiers = await db
    .select({
      id: ticketTiers.id,
      name: ticketTiers.name,
      price: ticketTiers.price,
      currency: ticketTiers.currency,
      totalQuantity: ticketTiers.totalQuantity,
      soldQuantity: ticketTiers.soldQuantity,
    })
    .from(ticketTiers)
    .where(eq(ticketTiers.eventId, id))
    .orderBy(asc(ticketTiers.createdAt))

  const totalCapacity = tiers.reduce((sum, t) => sum + (t.totalQuantity ?? 0), 0)
  const totalSold = tiers.reduce((sum, t) => sum + (t.soldQuantity ?? 0), 0)
  const fillRate = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title="Capacity"
        subtitle="Track how many tickets are available and sold across your tiers."
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} /> Back to event
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-8">

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-line bg-paper p-5">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-ink-3 mb-1">
              Total Capacity
            </p>
            <p className="text-[32px] font-bold text-ink leading-none">{totalCapacity.toLocaleString()}</p>
            <p className="mt-1 text-[12px] text-ink-3">tickets available</p>
          </div>

          <div className="rounded-xl border border-line bg-paper p-5">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-ink-3 mb-1">
              Tickets Sold
            </p>
            <p className="text-[32px] font-bold text-ink leading-none">{totalSold.toLocaleString()}</p>
            <p className="mt-1 text-[12px] text-ink-3">across all tiers</p>
          </div>

          <div className="rounded-xl border border-line bg-paper p-5">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-ink-3 mb-1">
              Fill Rate
            </p>
            <p
              className={`text-[32px] font-bold leading-none ${
                fillRate >= 90 ? "text-rose-500" : fillRate >= 60 ? "text-amber-500" : "text-emerald-500"
              }`}
            >
              {fillRate}%
            </p>
            <p className="mt-1 text-[12px] text-ink-3">of total capacity sold</p>
          </div>
        </div>

        {/* Tier breakdown */}
        <div>
          <h2 className="text-[13px] font-semibold text-ink-2 uppercase tracking-widest mb-4">
            Tier Breakdown
          </h2>

          {tiers.length === 0 ? (
            <div className="rounded-xl border border-line bg-paper p-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper-2">
                <Ticket size={18} className="text-ink-3" />
              </div>
              <p className="text-[14px] font-semibold text-ink">No tiers yet</p>
              <p className="mt-1 text-[13px] text-ink-3">
                Create ticket tiers to start tracking capacity.
              </p>
              <Link
                href={`/organizer/events/${id}/tiers`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
              >
                <Ticket size={13} /> Manage tiers
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {tiers.map((tier) => {
                const sold = tier.soldQuantity ?? 0
                const total = tier.totalQuantity ?? 0
                const pct = total > 0 ? Math.round((sold / total) * 100) : 0
                const price = parseFloat(tier.price ?? "0")

                return (
                  <div
                    key={tier.id}
                    className="rounded-xl border border-line bg-paper p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-ink truncate">{tier.name}</p>
                        <p className="text-[12px] text-ink-3 mt-0.5">
                          {formatCurrency(price, tier.currency ?? "USD")} per ticket
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[14px] font-semibold text-ink">
                          {sold.toLocaleString()} / {total.toLocaleString()}
                        </p>
                        <p
                          className={`text-[12px] font-medium mt-0.5 ${
                            pct >= 90 ? "text-rose-500" : pct >= 60 ? "text-amber-500" : "text-emerald-500"
                          }`}
                        >
                          {pct}% filled
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-paper-2 rounded-full">
                      <div
                        style={{ width: `${pct}%` }}
                        className={
                          pct >= 90
                            ? "h-full bg-rose-500 rounded-full transition-all"
                            : pct >= 60
                            ? "h-full bg-amber-500 rounded-full transition-all"
                            : "h-full bg-emerald-500 rounded-full transition-all"
                        }
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
