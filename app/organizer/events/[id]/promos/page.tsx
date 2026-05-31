import { redirect, notFound } from "next/navigation"
import { eq, asc } from "drizzle-orm"
import Link from "next/link"
import { ArrowLeft, Tag } from "lucide-react"

import { db } from "@/db"
import { events, promoCodes } from "@/db/schema"
import { requireEventAccess } from "@/lib/event-access"
import PageHeader from "@/components/dashboard/PageHeader"
import EmptyState from "@/components/dashboard/EmptyState"
import PromoCodeList from "./PromoCodeList"
import PromoCreateForm from "./PromoCreateForm"

export const metadata = {
  title: "Promo codes",
}

type RouteParams = { id: string }

export default async function PromosPage({
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

  const codes = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.eventId, id))
    .orderBy(asc(promoCodes.createdAt))

  const serialized = codes.map((c) => ({
    ...c,
    value: c.value.toString(),
    minPurchaseAmount: c.minPurchaseAmount?.toString() ?? "0",
    maxUses: c.maxUses ?? 0,
    usedCount: c.usedCount ?? 0,
    active: c.active ?? true,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    createdAt: c.createdAt?.toISOString() ?? new Date().toISOString(),
  }))

  return (
    <div className="tp-fade-up">
      <PageHeader
        eyebrow="Organizer"
        title={`Promo codes: ${event.title}`}
        actions={
          <Link
            href={`/organizer/events/${id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to event
          </Link>
        }
      />

      <div className="max-w-4xl mx-auto px-5 md:px-8 py-8 md:py-10 space-y-6">
        {serialized.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No promo codes yet"
            body="Create discount codes to boost ticket sales."
          />
        ) : (
          <PromoCodeList codes={serialized} eventId={id} />
        )}

        <div className="rounded-2xl border border-line bg-paper p-6 md:p-8">
          <h2 className="text-[16px] font-semibold tracking-tight text-ink mb-5">Create promo code</h2>
          <PromoCreateForm eventId={id} />
        </div>
      </div>
    </div>
  )
}
